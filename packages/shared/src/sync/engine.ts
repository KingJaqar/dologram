/**
 * Sync engine (M2-05, 6.4, D-40, D-43, D-91, T-13).
 *
 * A Postgres Changes event is merged into the cache by key. The per-chat cursor is a confirmed common
 * page boundary and is advanced only by a resync pass, so an event that arrives before the
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
  /** A capped pass returns failed/incomplete with its safe continuation retained. */
  maxPages?: number;
  /** Background failures (an event that cannot be merged) are surfaced, never swallowed. */
  onError: (error: unknown) => void;
  /** Called after a change is merged, so the UI can re-read the cache. */
  onChange?: (change: ChangePayload) => void;
  onMetadataChange?: () => void;
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
  maxPages = MAX_PAGES_PER_CHAT,
  onError,
  onChange,
  onMetadataChange,
}: SyncEngineDeps): SyncEngine {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || !Number.isSafeInteger(maxPages) || maxPages < 1) throw new Error('Invalid sync page bounds');
  let started = false;
  let revision = 0;
  let unsubscribe: (() => void) | null = null;
  let inflight: Promise<SyncSummary> | null = null;
  const ensuringChats = new Set<string>();
  const invalidatedMemberRefreshes = new Map<string, Promise<void>>();
  const queuedMemberRefreshes = new Set<string>();
  const memberRevisions = new Map<string, number>();
  const memberRefreshCounts = new Map<string, number>();

  const isCurrent = (pass: number) => started && revision === pass;

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
    cursor: number | null,
    pass: number,
  ): Promise<void> {
    const all = [...(rows.messages ?? []), ...(rows.media ?? []), ...(rows.reactions ?? [])];
    if (all.length === 0) return;
    await serial(async () => {
      if (!isCurrent(pass)) return;
      for (const row of rows.messages ?? []) { if (!isCurrent(pass)) return; await store.upsertMessage(row); }
      for (const row of rows.media ?? []) { if (!isCurrent(pass)) return; await store.upsertMedia(row); }
      for (const row of rows.reactions ?? []) { if (!isCurrent(pass)) return; await store.upsertReaction(row); }
      // The cursor moves only forwards and only behind rows that are already stored (D-40).
      if (isCurrent(pass) && cursor !== null && cursor > (await store.getCursor(chatId))) {
        await store.setCursor(chatId, cursor);
      }
    });
  }

  /**
   * Refreshes one chat's row and members. `missing` means the caller is no longer a member
   * (D-91); `error` keeps the cache untouched so a transient failure cannot delete data.
   */
  async function refreshChatMeta(
    chatId: string,
    pass: number,
    knownChat?: ChatRow,
    expectedMemberRevision = memberRevisions.get(chatId) ?? 0,
  ): Promise<'ok' | 'missing' | 'error' | 'stale'> {
    if (!isCurrent(pass)) return 'error';
    const chat = knownChat ? { data: knownChat, error: null } : await source.fetchChat(chatId);
    if (!isCurrent(pass)) return 'error';
    if (chat.error) return 'error';
    const chatRow: ChatRow | null = chat.data;
    if (!chatRow) return 'missing';

    const members = await source.fetchMembers(chatId);
    if (members.error || !isCurrent(pass)) return 'error';
    if (members.data.length === 0 || members.data.some((row) => row.chat_id !== chatId)
      || new Set(members.data.map((row) => row.user_id)).size !== members.data.length) return 'error';

    // AND-03 titles and sender names come from the profiles of the chat's members. A profile
    // failure must not block the chat's history, so it is retried on the next pass and the list
    // falls back to its placeholder name until then.
    const profiles = await source.fetchProfiles(members.data.map((row) => row.user_id));

    let applied = false;
    await serial(async () => {
      if (!isCurrent(pass) || (memberRevisions.get(chatId) ?? 0) !== expectedMemberRevision) return;
      await store.upsertChat(chatRow);
      await store.replaceMembers(chatId, members.data);
      if (!profiles.error) {
        for (const row of profiles.data) await store.upsertProfile(row);
      }
      applied = true;
    });
    return applied ? 'ok' : 'stale';
  }

  /** Fetches one chat's rows after its cursor, one page per table per round (M2-05). */
  async function resyncPages(chatId: string, pass: number): Promise<boolean> {
    let after = await store.getCursor(chatId);

    for (let page = 0; page < maxPages; page += 1) {
      if (!isCurrent(pass)) return false;

      const [messages, media, reactions] = await Promise.all([
        source.fetchMessagesAfter(chatId, after, pageSize),
        source.fetchMediaAfter(chatId, after, pageSize),
        source.fetchReactionsAfter(chatId, after, pageSize),
      ]);

      if (!isCurrent(pass)) return false;
      if (messages.error || media.error || reactions.error) {
        return false;
      }

      const pages = [messages.data, media.data, reactions.data];
      // Reject malformed, unordered, cross-chat and non-progressing pages before any write.
      for (const rows of pages) {
        let previous = after;
        if (rows.length > pageSize) return false;
        for (const row of rows) {
          if (row.chat_id !== chatId || !Number.isSafeInteger(row.sync_seq) || row.sync_seq <= previous) return false;
          previous = row.sync_seq;
        }
      }
      const full = pages.filter((rows) => rows.length === pageSize);
      const next = full.length > 0
        ? Math.min(...full.map(maxSyncSeq))
        : Math.max(after, ...pages.map(maxSyncSeq));
      if (next <= after && pages.some((rows) => rows.length > 0)) return false;
      await mergeRows(chatId, { messages: messages.data, media: media.data, reactions: reactions.data }, next, pass);
      if (!isCurrent(pass)) return false;
      if (full.length === 0) return true;
      after = next;
    }
    // Keep the safe checkpoint, but never report a capped catch-up as complete.
    return false;
  }

  async function resyncChat(chatId: string): Promise<boolean> {
    const pass = revision;
    const meta = await refreshChatMeta(chatId, pass);
    if (!isCurrent(pass)) return false;
    if (meta === 'error') return false;
    if (meta === 'stale') {
      startInvalidatedMemberRefresh(chatId);
      return false;
    }
    if (meta === 'missing') {
      await serial(async () => { if (isCurrent(pass)) await store.deleteChat(chatId); });
      return true;
    }
    onMetadataChange?.();
    return resyncPages(chatId, pass);
  }

  function bumpMemberRevision(chatId: string): number {
    const next = (memberRevisions.get(chatId) ?? 0) + 1;
    memberRevisions.set(chatId, next);
    return next;
  }

  function startInvalidatedMemberRefresh(chatId: string): void {
    if (!started || invalidatedMemberRefreshes.has(chatId)) return;
    const attempts = memberRefreshCounts.get(chatId) ?? 0;
    if (attempts >= 4) { onError(new Error('Member refresh limit reached; a full resync is required.')); return; }
    memberRefreshCounts.set(chatId, attempts + 1);
    const pass = revision;
    const memberRevision = memberRevisions.get(chatId) ?? 0;
    const refresh = (async () => {
      if (!isCurrent(pass)) return;
      const known = await store.hasChat(chatId);
      const result = await refreshChatMeta(chatId, pass, undefined, memberRevision);
      if (!isCurrent(pass)) return;
      if (result === 'missing') {
        await serial(async () => { if (isCurrent(pass)) await store.deleteChat(chatId); });
      }
      if (result === 'ok' || result === 'missing') memberRefreshCounts.delete(chatId);
      if (result === 'ok' && !known && !(await resyncPages(chatId, pass)) && isCurrent(pass)) onError(new Error('Chat history catch-up incomplete; safe continuation retained.'));
      if (result === 'error') onError(new Error('Member refresh incomplete; cached roster retained.'));
      else onMetadataChange?.();
    })();
    invalidatedMemberRefreshes.set(chatId, refresh);
    const settled = () => {
      if (invalidatedMemberRefreshes.get(chatId) === refresh) invalidatedMemberRefreshes.delete(chatId);
      if (queuedMemberRefreshes.delete(chatId) && isCurrent(pass)) startInvalidatedMemberRefresh(chatId);
    };
    void refresh.then(settled, (error: unknown) => { onError(error); settled(); });
  }

  function invalidateMembers(chatId: string): void {
    if (!started) return;
    bumpMemberRevision(chatId);
    if (invalidatedMemberRefreshes.has(chatId)) {
      queuedMemberRefreshes.add(chatId);
      return;
    }
    startInvalidatedMemberRefresh(chatId);
  }

  async function runResyncAll(): Promise<SyncSummary> {
    const pass = revision;
    memberRefreshCounts.clear();
    if (!isCurrent(pass)) return { chats: 0, pruned: 0, failed: 0 };
    // Realtime can discover a chat while this request is in flight. Only memberships
    // known before the request are eligible for pruning from this server snapshot.
    const localIds = await store.listChatIds();
    const localRevisions = new Map(localIds.map((id) => [id, memberRevisions.get(id) ?? 0]));
    if (!isCurrent(pass)) return { chats: 0, pruned: 0, failed: 0 };
    const chats = await source.fetchChats();
    if (chats.error || !isCurrent(pass)) {
      return { chats: 0, pruned: 0, failed: 1 };
    }

    const serverIds = new Set(chats.data.map((row) => row.chat_id));
    let pruned = 0;

    await serial(async () => {
      for (const localId of localIds) {
        if (!isCurrent(pass)) return;
        // Only a successful chat list fetch may prune; an offline pass never reaches this line.
        if (!serverIds.has(localId) && (memberRevisions.get(localId) ?? 0) === localRevisions.get(localId)) {
          await store.deleteChat(localId);
          pruned += 1;
        }
      }
    });

    let failed = 0;
    const ready: string[] = [];
    for (const row of chats.data) {
      if (!isCurrent(pass)) break;
      const result = await refreshChatMeta(row.chat_id, pass, row);
      if (result === 'ok') ready.push(row.chat_id);
      else if (result === 'stale') { failed += 1; startInvalidatedMemberRefresh(row.chat_id); }
      else failed += 1;
    }
    if (isCurrent(pass)) onMetadataChange?.();

    for (const chatId of ready) {
      if (!isCurrent(pass)) break;
      const ok = await resyncPages(chatId, pass);
      if (!ok) failed += 1;
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
      const pass = revision;
      if (!(await resyncChat(chatId)) && isCurrent(pass)) onError(new Error('Unknown chat catch-up incomplete; cached rows retained.'));
    } finally {
      ensuringChats.delete(chatId);
    }
  }

  async function applyChange(change: ChangePayload): Promise<void> {
    if (!started) return;
    const pass = revision;
    const chatId = change.row.chat_id;

    // A chat first seen through an event has no cache and no cursor; fetch them first, otherwise
    // raising the cursor from the event would hide its earlier history from the resync.
    if (!(await store.hasChat(chatId))) {
      if (!isCurrent(pass)) return;
      await ensureChat(chatId);
      // Offline or refused: leave the event out; the next resync fetches it by sync_seq.
      if (!(await store.hasChat(chatId))) return;
    }
    if (!isCurrent(pass)) return;

    const cursor = null; // Realtime never establishes completeness of an offline gap.
    if (change.table === 'messages') {
      await mergeRows(chatId, { messages: [change.row] }, cursor, pass);
    } else if (change.table === 'message_media') {
      await mergeRows(chatId, { media: [change.row] }, cursor, pass);
    } else if (change.table === 'reactions') {
      await mergeRows(chatId, { reactions: [change.row] }, cursor, pass);
    } else {
      await serial(async () => { if (isCurrent(pass)) await store.upsertMember(change.row); });
    }
    if (isCurrent(pass)) onChange?.(change);
  }

  function subscribeDelivery(): void {
    unsubscribe?.();
    unsubscribe = delivery.subscribe({
      onChange: (change) => {
        if (change.table === 'chat_members') bumpMemberRevision(change.row.chat_id);
        void applyChange(change).catch((error: unknown) => onError(error));
      },
      onMembersInvalidated: invalidateMembers,
      // 7.1 Channel drops: a rejoined channel is followed by a resync of what it missed.
      onStatus: (status) => {
        if (status !== 'connected' || !started) return;
        void resyncAll().catch((error: unknown) => onError(error));
      },
    });
  }

  async function start(): Promise<SyncSummary> {
    const pass = ++revision;
    await store.init();
    if (pass !== revision) return { chats: 0, pruned: 0, failed: 0 };
    await store.upgradeCheckpoints();
    if (pass !== revision) return { chats: 0, pruned: 0, failed: 0 };
    started = true;
    // 6.4: re-subscribe on every foreground and reconnect, then fetch what was missed.
    subscribeDelivery();
    return resyncAll();
  }

  function stop(): void {
    revision += 1;
    started = false;
    inflight = null;
    invalidatedMemberRefreshes.clear();
    queuedMemberRefreshes.clear();
    memberRevisions.clear();
    memberRefreshCounts.clear();
    unsubscribe?.();
    unsubscribe = null;
  }

  return { start, stop, resyncAll, resyncChat };
}
