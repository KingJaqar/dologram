/**
 * Sync engine (M2-05, 6.4, D-40, D-43, D-91, T-13).
 *
 * A Postgres Changes event is merged into the cache by key. The per-chat cursor is the highest
 * sync_seq received and is advanced only by a resync pass, so an event that arrives before the
 * pass that covers an offline gap can never hide the rows behind it. On start, foreground and
 * reconnect (`resyncAll`) the engine re-subscribes, refreshes every chat and its members, prunes
 * chats the server no longer lists, and fetches the messages, message_media and reactions rows
 * whose sync_seq is greater than the chat's cursor in pages of `pageSize`. Rows are stored before
 * the cursor moves, so an interrupted pass is simply fetched again; merging by key makes a
 * replayed event or a duplicate page harmless.
 */
import type { ChatRow } from '../db/repositories/chats';
import type { ChatMemberRow } from '../db/repositories/members';
import type { MessageRow } from '../db/repositories/messages';
import type { MessageMediaRow } from '../db/repositories/media';
import type { ReactionRow } from '../db/repositories/reactions';
import type {
  ChangePayload,
  SyncCacheStore,
  SyncDelivery,
  SyncSource,
  SyncSummary,
} from './types';

/** Bounds one chat's catch-up pass; a page is only fetched again when the cursor advanced. */
const MAX_PAGES_PER_CHAT = 1000;

export type SyncEngineDeps = {
  store: SyncCacheStore;
  source: SyncSource;
  delivery: SyncDelivery;
  /** Pages of 500 rows in the shipped app; injectable so tests stay small (M2-05). */
  pageSize: number;
  /** Background failures (an event that cannot be merged) are surfaced, never swallowed. */
  onError: (error: unknown) => void;
  /** Called after a change is merged, so the UI can re-read the cache. */
  onChange?: (change: ChangePayload) => void;
};

export interface SyncEngine {
  /** Subscribes (replacing the previous subscription) and runs a full resync. */
  start(): Promise<SyncSummary>;
  /** Removes the subscription; in-flight network work stops writing. */
  stop(): void;
  /** Foreground, reconnect and channel-recovery entry point. */
  resyncAll(): Promise<SyncSummary>;
  /** One chat: its chat row, its members and every row after its cursor. */
  resyncChat(chatId: string): Promise<boolean>;
}

function maxSyncSeq(rows: readonly { sync_seq: number }[]): number {
  let highest = 0;
  for (const row of rows) {
    if (row.sync_seq > highest) highest = row.sync_seq;
  }
  return highest;
}

export function createSyncEngine({
  store,
  source,
  delivery,
  pageSize,
  onError,
  onChange,
}: SyncEngineDeps): SyncEngine {
  let started = false;
  let unsubscribe: (() => void) | null = null;
  let inflight: Promise<SyncSummary> | null = null;
  const ensuringChats = new Set<string>();
  /** Chats whose cache contained every row up to the cursor when the last pass finished. */
  const caughtUp = new Set<string>();

  // One writer at a time: event merges and resync pages never interleave their cursor updates.
  let writeChain: Promise<unknown> = Promise.resolve();
  function serial<T>(task: () => Promise<T>): Promise<T> {
    const run = writeChain.then(task);
    writeChain = run.catch(() => undefined);
    return run;
  }

  async function mergeRows(
    chatId: string,
    rows: {
      messages?: readonly MessageRow[];
      media?: readonly MessageMediaRow[];
      reactions?: readonly ReactionRow[];
    },
    advanceCursor: boolean,
  ): Promise<void> {
    const all = [...(rows.messages ?? []), ...(rows.media ?? []), ...(rows.reactions ?? [])];
    if (all.length === 0) return;
    const highest = maxSyncSeq(all);
    await serial(async () => {
      for (const row of rows.messages ?? []) await store.upsertMessage(row);
      for (const row of rows.media ?? []) await store.upsertMedia(row);
      for (const row of rows.reactions ?? []) await store.upsertReaction(row);
      // The cursor moves only forwards and only behind rows that are already stored (D-40).
      if (advanceCursor && highest > (await store.getCursor(chatId))) {
        await store.setCursor(chatId, highest);
      }
    });
  }

  /**
   * Refreshes one chat's row and members. `missing` means the caller is no longer a member
   * (D-91); `error` keeps the cache untouched so a transient failure cannot delete data.
   */
  async function refreshChatMeta(chatId: string): Promise<'ok' | 'missing' | 'error'> {
    const chat = await source.fetchChat(chatId);
    if (chat.error) return 'error';
    const chatRow: ChatRow | null = chat.data;
    if (!chatRow) return 'missing';

    const members = await source.fetchMembers(chatId);
    if (members.error) return 'error';

    // AND-03 titles and sender names come from the profiles of the chat's members. A profile
    // failure must not block the chat's history, so it is retried on the next pass and the list
    // falls back to its placeholder name until then.
    const profiles = await source.fetchProfiles(members.data.map((row) => row.user_id));

    await serial(async () => {
      await store.upsertChat(chatRow);
      for (const row of members.data) await store.upsertMember(row);
      if (!profiles.error) {
        for (const row of profiles.data) await store.upsertProfile(row);
      }
    });
    return 'ok';
  }

  /** Fetches one chat's rows after its cursor, one page per table per round (M2-05). */
  async function resyncPages(chatId: string): Promise<boolean> {
    let after = await store.getCursor(chatId);

    for (let page = 0; page < MAX_PAGES_PER_CHAT; page += 1) {
      if (!started) return false;

      const [messages, media, reactions] = await Promise.all([
        source.fetchMessagesAfter(chatId, after, pageSize),
        source.fetchMediaAfter(chatId, after, pageSize),
        source.fetchReactionsAfter(chatId, after, pageSize),
      ]);

      if (messages.error || media.error || reactions.error) {
        caughtUp.delete(chatId);
        return false;
      }

      const rows = { messages: messages.data, media: media.data, reactions: reactions.data };
      const count = messages.data.length + media.data.length + reactions.data.length;
      if (count === 0) {
        caughtUp.add(chatId);
        return true;
      }

      const next = Math.max(
        after,
        maxSyncSeq(messages.data),
        maxSyncSeq(media.data),
        maxSyncSeq(reactions.data),
      );
      await mergeRows(chatId, rows, true);
      // A server that returns rows without advancing sync_seq would repeat the same page forever.
      if (next <= after) {
        caughtUp.add(chatId);
        return true;
      }
      after = next;
    }

    return true;
  }

  async function resyncChat(chatId: string): Promise<boolean> {
    const meta = await refreshChatMeta(chatId);
    if (meta === 'error') return false;
    if (meta === 'missing') {
      caughtUp.delete(chatId);
      await serial(() => store.deleteChat(chatId));
      return true;
    }
    return resyncPages(chatId);
  }

  async function runResyncAll(): Promise<SyncSummary> {
    const chats = await source.fetchChats();
    if (chats.error) {
      return { chats: 0, pruned: 0, failed: 1 };
    }

    const serverIds = new Set(chats.data.map((row) => row.chat_id));
    let pruned = 0;

    await serial(async () => {
      for (const row of chats.data) await store.upsertChat(row);
      for (const localId of await store.listChatIds()) {
        // Only a successful chat list fetch may prune; an offline pass never reaches this line.
        if (!serverIds.has(localId)) {
          await store.deleteChat(localId);
          pruned += 1;
        }
      }
    });

    let failed = 0;
    for (const row of chats.data) {
      if (!started) break;
      const ok = await resyncChat(row.chat_id);
      if (!ok) failed += 1;
    }

    // A pruned chat can no longer be caught up.
    for (const chatId of [...caughtUp]) {
      if (!serverIds.has(chatId)) caughtUp.delete(chatId);
    }

    return { chats: chats.data.length, pruned, failed };
  }

  function resyncAll(): Promise<SyncSummary> {
    if (inflight) return inflight;
    const run = runResyncAll();
    inflight = run;
    const clear = (): void => {
      if (inflight === run) inflight = null;
    };
    void run.then(clear, clear);
    return run;
  }

  /** Fetches an unknown chat and its members, then its history, before applying the event. */
  async function ensureChat(chatId: string): Promise<void> {
    if (ensuringChats.has(chatId)) return;
    ensuringChats.add(chatId);
    try {
      if (await store.hasChat(chatId)) return;
      await resyncChat(chatId);
    } finally {
      ensuringChats.delete(chatId);
    }
  }

  async function applyChange(change: ChangePayload): Promise<void> {
    if (!started) return;
    const chatId = change.row.chat_id;

    // A chat first seen through an event has no cache and no cursor; fetch them first, otherwise
    // raising the cursor from the event would hide its earlier history from the resync.
    if (!(await store.hasChat(chatId))) {
      await ensureChat(chatId);
      // Offline or refused: leave the event out; the next resync fetches it by sync_seq.
      if (!(await store.hasChat(chatId))) return;
    }

    // Only a chat whose cache is complete up to its cursor may advance it from an event, so a
    // channel that dropped while the app was backgrounded cannot skip the rows it missed.
    const advanceCursor = caughtUp.has(chatId);
    if (change.table === 'messages') {
      await mergeRows(chatId, { messages: [change.row] }, advanceCursor);
    } else if (change.table === 'message_media') {
      await mergeRows(chatId, { media: [change.row] }, advanceCursor);
    } else if (change.table === 'reactions') {
      await mergeRows(chatId, { reactions: [change.row] }, advanceCursor);
    } else {
      await serial(() => store.upsertMember(change.row));
    }
    onChange?.(change);
  }

  function subscribeDelivery(): void {
    unsubscribe?.();
    unsubscribe = delivery.subscribe({
      onChange: (change) => {
        void applyChange(change).catch((error: unknown) => onError(error));
      },
      // 7.1 Channel drops: a rejoined channel is followed by a resync of what it missed.
      onStatus: (status) => {
        if (status !== 'connected' || !started) return;
        void resyncAll().catch((error: unknown) => onError(error));
      },
    });
  }

  async function start(): Promise<SyncSummary> {
    await store.init();
    started = true;
    caughtUp.clear();
    // 6.4: re-subscribe on every foreground and reconnect, then fetch what was missed.
    subscribeDelivery();
    return resyncAll();
  }

  function stop(): void {
    started = false;
    caughtUp.clear();
    unsubscribe?.();
    unsubscribe = null;
  }

  return { start, stop, resyncAll, resyncChat };
}
