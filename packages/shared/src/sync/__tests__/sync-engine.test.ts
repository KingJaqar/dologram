/**
 * Sync engine tests (M2-05, 6.4, D-40, D-43, D-91, T-13).
 *
 * The source, the cache and the delivery are all fakes, so each rule is checked directly: initial
 * fetch and paging, merge by key, the cursor never coming from the device clock, events for an
 * unknown chat, pruning a chat the server no longer lists, two concurrent senders, a channel drop
 * and recovery, and unsubscribing.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ChatRow } from '../../db/repositories/chats';
import type { ChatMemberRow } from '../../db/repositories/members';
import type { MessageRow } from '../../db/repositories/messages';
import type { MessageMediaRow } from '../../db/repositories/media';
import type { ReactionRow } from '../../db/repositories/reactions';
import type { ProfileRow } from '../../db/repositories/profiles';
import type { DgResult } from '../../db/result';
import { createSyncEngine } from '../engine';
import type {
  ChangePayload,
  SyncCacheStore,
  SyncDeliveryHandlers,
  SyncSource,
} from '../types';

const USER = '00000000-0000-4000-8000-000000000001';

function chat(id: string): ChatRow {
  return {
    chat_id: id,
    created_at: '2026-11-10T00:00:00.000Z',
    created_by: USER,
    direct_key: id,
    next_seq: 100,
    title: null,
    type: 'direct',
  };
}

function member(chatId: string): ChatMemberRow {
  return {
    archived: false,
    chat_id: chatId,
    joined_at: '2026-11-10T00:00:00.000Z',
    last_read_seq: 0,
    muted_until: null,
    role: 'owner',
    user_id: USER,
  };
}

function message(chatId: string, id: string, syncSeq: number, content = 'hello'): MessageRow {
  return {
    attachment_count: 0,
    chat_id: chatId,
    content,
    created_at: '2026-11-10T00:00:00.000Z',
    deleted_at: null,
    edited_at: null,
    message_id: id,
    reply_to: null,
    sender_id: USER,
    seq: syncSeq,
    sync_seq: syncSeq,
  };
}

function profile(userId: string, displayName: string): ProfileRow {
  return {
    avatar_url: null,
    display_name: displayName,
    premium_flags: null,
    user_id: userId,
    username: `user_${userId.slice(-4)}`,
  };
}

function media(chatId: string, id: string, syncSeq: number): MessageMediaRow {
  return {
    chat_id: chatId,
    compressed: false,
    deleted_at: null,
    media_id: id,
    media_type: 'photo',
    message_id: `${id}-message`,
    storage_path: `${chatId}/${id}`,
    sync_seq: syncSeq,
  };
}

function reaction(chatId: string, id: string, syncSeq: number): ReactionRow {
  return {
    chat_id: chatId,
    emoji: '👍',
    message_id: id,
    removed_at: null,
    sync_seq: syncSeq,
    user_id: USER,
  };
}

class MemoryStore implements SyncCacheStore {
  chats = new Map<string, ChatRow>();
  members = new Map<string, ChatMemberRow>();
  messages = new Map<string, MessageRow>();
  media = new Map<string, MessageMediaRow>();
  reactions = new Map<string, ReactionRow>();
  profiles = new Map<string, ProfileRow>();
  cursors = new Map<string, number>();

  async init(): Promise<void> {}

  async getCursor(chatId: string): Promise<number> {
    return this.cursors.get(chatId) ?? 0;
  }

  async setCursor(chatId: string, cursor: number): Promise<void> {
    this.cursors.set(chatId, Math.max(this.cursors.get(chatId) ?? 0, cursor));
  }

  async hasChat(chatId: string): Promise<boolean> {
    return this.chats.has(chatId);
  }

  async listChatIds(): Promise<string[]> {
    return [...this.chats.keys()];
  }

  async upsertChat(row: ChatRow): Promise<void> {
    this.chats.set(row.chat_id, row);
  }

  async upsertMember(row: ChatMemberRow): Promise<void> {
    this.members.set(`${row.chat_id}:${row.user_id}`, row);
  }

  async upsertMessage(row: MessageRow): Promise<void> {
    this.messages.set(row.message_id, row);
  }

  async upsertMedia(row: MessageMediaRow): Promise<void> {
    this.media.set(row.media_id, row);
  }

  async upsertReaction(row: ReactionRow): Promise<void> {
    this.reactions.set(`${row.message_id}:${row.user_id}:${row.emoji}`, row);
  }

  async upsertProfile(row: ProfileRow): Promise<void> {
    this.profiles.set(row.user_id, row);
  }

  async deleteChat(chatId: string): Promise<void> {
    this.chats.delete(chatId);
    this.cursors.delete(chatId);
    for (const [key, row] of [...this.members]) if (row.chat_id === chatId) this.members.delete(key);
    for (const [key, row] of [...this.messages]) if (row.chat_id === chatId) this.messages.delete(key);
    for (const [key, row] of [...this.media]) if (row.chat_id === chatId) this.media.delete(key);
    for (const [key, row] of [...this.reactions]) {
      if (row.chat_id === chatId) this.reactions.delete(key);
    }
  }
}

class FakeSource implements SyncSource {
  chats: ChatRow[] = [];
  members = new Map<string, ChatMemberRow[]>();
  profiles = new Map<string, ProfileRow>();
  messages = new Map<string, MessageRow[]>();
  media = new Map<string, MessageMediaRow[]>();
  reactions = new Map<string, ReactionRow[]>();
  chatIds = new Set<string>();
  failChats = false;
  failPages = false;
  afterCalls: number[] = [];

  addChat(id: string): void {
    this.chats.push(chat(id));
    this.chatIds.add(id);
    this.members.set(id, [member(id)]);
  }

  private page<T extends { sync_seq: number }>(rows: T[], after: number, limit: number): DgResult<T[]> {
    this.afterCalls.push(after);
    const page = rows
      .filter((row) => row.sync_seq > after)
      .sort((a, b) => a.sync_seq - b.sync_seq)
      .slice(0, limit);
    return { data: page, error: null };
  }

  async fetchMessagesAfter(
    chatId: string,
    after: number,
    limit: number,
  ): Promise<DgResult<MessageRow[]>> {
    if (this.failPages) return { data: null, error: { kind: 'network' } };
    return this.page(this.messages.get(chatId) ?? [], after, limit);
  }

  async fetchMediaAfter(
    chatId: string,
    after: number,
    limit: number,
  ): Promise<DgResult<MessageMediaRow[]>> {
    if (this.failPages) return { data: null, error: { kind: 'network' } };
    return this.page(this.media.get(chatId) ?? [], after, limit);
  }

  async fetchReactionsAfter(
    chatId: string,
    after: number,
    limit: number,
  ): Promise<DgResult<ReactionRow[]>> {
    if (this.failPages) return { data: null, error: { kind: 'network' } };
    return this.page(this.reactions.get(chatId) ?? [], after, limit);
  }

  async fetchChats(): Promise<DgResult<ChatRow[]>> {
    if (this.failChats) return { data: null, error: { kind: 'network' } };
    return { data: [...this.chats], error: null };
  }

  async fetchChat(chatId: string): Promise<DgResult<ChatRow | null>> {
    const row = this.chats.find((candidate) => candidate.chat_id === chatId) ?? null;
    return { data: row, error: null };
  }

  async fetchMembers(chatId: string): Promise<DgResult<ChatMemberRow[]>> {
    return { data: this.members.get(chatId) ?? [], error: null };
  }

  async fetchProfiles(userIds: readonly string[]): Promise<DgResult<ProfileRow[]>> {
    const rows = userIds
      .map((id) => this.profiles.get(id))
      .filter((row): row is ProfileRow => row !== undefined);
    return { data: rows, error: null };
  }
}

class FakeDelivery {
  handlers: SyncDeliveryHandlers | null = null;
  unsubscribeCount = 0;
  subscribeCount = 0;

  subscribe(handlers: SyncDeliveryHandlers): () => void {
    this.handlers = handlers;
    this.subscribeCount += 1;
    return () => {
      this.unsubscribeCount += 1;
      if (this.handlers === handlers) this.handlers = null;
    };
  }

  emit(change: ChangePayload): void {
    this.handlers?.onChange(change);
  }

  status(next: 'connected' | 'disconnected'): void {
    this.handlers?.onStatus(next);
  }
}

async function until(check: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('the expected cache state was not reached');
}

function build(options?: { pageSize?: number }) {
  const store = new MemoryStore();
  const source = new FakeSource();
  const delivery = new FakeDelivery();
  const errors: unknown[] = [];
  const engine = createSyncEngine({
    store,
    source,
    delivery,
    pageSize: options?.pageSize ?? 500,
    onError: (error) => errors.push(error),
  });
  return { store, source, delivery, engine, errors };
}

describe('sync engine initial fetch', () => {
  it('caches chats, members, messages, media and reactions and sets the cursor to the highest sync_seq', async () => {
    const { store, source, engine } = build();
    source.addChat('chat-a');
    source.messages.set('chat-a', [message('chat-a', 'm1', 1), message('chat-a', 'm2', 4)]);
    source.media.set('chat-a', [media('chat-a', 'md1', 2)]);
    source.reactions.set('chat-a', [reaction('chat-a', 'm1', 7)]);

    const summary = await engine.start();

    expect(summary).toEqual({ chats: 1, pruned: 0, failed: 0 });
    expect(store.chats.has('chat-a')).toBe(true);
    expect(store.members.size).toBe(1);
    expect(store.messages.size).toBe(2);
    expect(store.media.size).toBe(1);
    expect(store.reactions.size).toBe(1);
    expect(await store.getCursor('chat-a')).toBe(7);
  });

  it('pages through a chat until no row remains after the cursor', async () => {
    const { store, source, engine } = build({ pageSize: 2 });
    source.addChat('chat-a');
    source.messages.set(
      'chat-a',
      [1, 2, 3, 4, 5].map((seq) => message('chat-a', `m${seq}`, seq)),
    );

    await engine.start();

    expect(store.messages.size).toBe(5);
    expect(await store.getCursor('chat-a')).toBe(5);
    expect(source.afterCalls.slice(0, 2)).toEqual([0, 0]);
    expect(source.afterCalls).toContain(2);
    expect(source.afterCalls).toContain(4);
    expect(source.afterCalls).toContain(5);
  });

  it("caches the display names of a chat's members for the chat list", async () => {
    const { store, source, engine } = build();
    source.addChat('chat-a');
    source.profiles.set(USER, profile(USER, 'Ada Lovelace'));
    source.members.set('chat-a', [
      member('chat-a'),
      { ...member('chat-a'), user_id: '00000000-0000-4000-8000-000000000002' },
    ]);

    await engine.start();

    expect(store.profiles.get(USER)?.display_name).toBe('Ada Lovelace');
    expect(store.profiles.size).toBe(1);
  });

  it('never takes the cursor from the device clock', async () => {
    const { store, source, engine } = build();
    source.addChat('chat-a');
    source.messages.set('chat-a', [message('chat-a', 'm1', 3)]);
    const now = vi.spyOn(Date, 'now').mockReturnValue(9_999_999);

    try {
      await engine.start();
    } finally {
      now.mockRestore();
    }

    expect(await store.getCursor('chat-a')).toBe(3);
  });
});

describe('sync engine changes', () => {
  it('merges the same event twice without changing the cache or the cursor', async () => {
    const { store, source, delivery, engine } = build();
    source.addChat('chat-a');
    await engine.start();
    await until(() => delivery.handlers !== null);

    const change: ChangePayload = { table: 'messages', row: message('chat-a', 'm9', 9) };
    delivery.emit(change);
    await until(() => store.messages.has('m9'));
    delivery.emit(change);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(store.messages.size).toBe(1);
    expect(await store.getCursor('chat-a')).toBe(9);
  });

  it('stores an event but leaves the cursor alone until a resync has caught the chat up', async () => {
    const { store, source, delivery, engine } = build();
    source.addChat('chat-a');
    source.messages.set('chat-a', [message('chat-a', 'm1', 1)]);
    await engine.start();
    expect(await store.getCursor('chat-a')).toBe(1);

    // The next pass cannot finish, so the chat must not be treated as caught up.
    source.failPages = true;
    await engine.start();
    delivery.emit({ table: 'messages', row: message('chat-a', 'm8', 8) });
    await until(() => store.messages.has('m8'));
    expect(await store.getCursor('chat-a')).toBe(1);

    // The next successful pass fetches the row behind the event by sync_seq and moves the cursor.
    source.failPages = false;
    source.messages.set('chat-a', [message('chat-a', 'm1', 1), message('chat-a', 'm8', 8)]);
    await engine.resyncAll();
    expect(await store.getCursor('chat-a')).toBe(8);
  });

  it('fetches an unknown chat and its members when an event names one', async () => {
    const { store, source, delivery, engine } = build();
    source.addChat('chat-b');
    source.messages.set('chat-b', [
      message('chat-b', 'b1', 1),
      message('chat-b', 'b2', 2),
      message('chat-b', 'b3', 3),
    ]);
    source.failChats = true;
    await engine.start();
    source.failChats = false;

    delivery.emit({ table: 'messages', row: message('chat-b', 'b3', 3) });
    await until(() => store.chats.has('chat-b'));

    expect(store.members.size).toBe(1);
    expect(store.messages.size).toBe(3);
    expect(await store.getCursor('chat-b')).toBe(3);
  });

  it('applies an edit and a reaction from the channel', async () => {
    const { store, source, delivery, engine } = build();
    source.addChat('chat-a');
    source.messages.set('chat-a', [message('chat-a', 'm1', 1)]);
    await engine.start();

    delivery.emit({
      table: 'messages',
      row: { ...message('chat-a', 'm1', 5, 'edited'), edited_at: '2026-11-10T01:00:00.000Z' },
    });
    delivery.emit({
      table: 'reactions',
      row: { ...reaction('chat-a', 'm1', 6), removed_at: '2026-11-10T01:00:01.000Z' },
    });

    await until(() => store.messages.get('m1')?.content === 'edited');
    await until(() => store.reactions.size === 1);
    expect(store.reactions.get(`m1:${USER}:👍`)?.removed_at).not.toBeNull();
    expect(await store.getCursor('chat-a')).toBe(6);
  });

  it('ignores events after stop and unsubscribes once', async () => {
    const { store, source, delivery, engine } = build();
    source.addChat('chat-a');
    await engine.start();
    const handlers = delivery.handlers;

    engine.stop();
    handlers?.onChange({ table: 'messages', row: message('chat-a', 'm2', 2) });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(delivery.unsubscribeCount).toBe(1);
    expect(store.messages.has('m2')).toBe(false);
  });
});

describe('sync engine resync and prune', () => {
  it('picks up rows missed while the app was backgrounded, including rows from two senders', async () => {
    const { store, source, engine } = build();
    source.addChat('chat-a');
    source.messages.set('chat-a', [message('chat-a', 'm1', 1)]);

    await engine.start();
    expect(await store.getCursor('chat-a')).toBe(1);

    source.messages.set('chat-a', [
      message('chat-a', 'm1', 1),
      message('chat-a', 'm2', 2),
      message('chat-a', 'm3', 3),
      message('chat-a', 'm4', 4),
    ]);

    await engine.start();

    expect(store.messages.size).toBe(4);
    expect(await store.getCursor('chat-a')).toBe(4);
  });

  it('removes a chat the chat-list fetch no longer returns, with its cache and cursor', async () => {
    const { store, source, engine } = build();
    source.addChat('chat-a');
    source.addChat('chat-b');
    source.messages.set('chat-b', [message('chat-b', 'b1', 1)]);

    await engine.start();
    expect(store.chats.size).toBe(2);

    source.chats = source.chats.filter((row) => row.chat_id === 'chat-a');
    source.chatIds.delete('chat-b');

    const summary = await engine.resyncAll();

    expect(summary.pruned).toBe(1);
    expect(store.chats.has('chat-b')).toBe(false);
    expect(store.cursors.has('chat-b')).toBe(false);
    expect(store.messages.size).toBe(0);
  });

  it('does not prune when the chat-list fetch fails', async () => {
    const { store, source, engine } = build();
    source.addChat('chat-a');
    await engine.start();

    source.failChats = true;
    const summary = await engine.resyncAll();

    expect(summary.failed).toBe(1);
    expect(store.chats.has('chat-a')).toBe(true);
  });

  it('resyncs after the channel reports it rejoined', async () => {
    const { store, source, delivery, engine } = build();
    source.addChat('chat-a');
    await engine.start();
    await until(() => delivery.handlers !== null);

    source.messages.set('chat-a', [message('chat-a', 'm2', 2)]);
    delivery.status('connected');

    await until(() => store.messages.has('m2'));
    expect(await store.getCursor('chat-a')).toBe(2);
  });
});
