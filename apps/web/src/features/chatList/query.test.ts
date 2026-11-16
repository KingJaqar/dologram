import { afterEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { QueueItem } from '@dologram/shared/src/queue/types';
import { IndexedDbStore, type Records } from '../../lib/store/IndexedDbStore';
import { orderWithPending, readChatList } from './query';

const owner = 'owner-1';
const peer = 'peer-1';
const now = new Date('2026-11-16T12:00:00Z');

function chat(id: string, type: 'direct' | 'group', title: string | null = null): Records['chats'] {
  return { chat_id: id, created_by: owner, type, title, direct_key: type === 'direct' ? `${owner}:${peer}` : null, created_at: '2026-11-15T00:00:00Z', next_seq: 10, avatar_url: null };
}
function member(chatId: string, userId: string, lastRead = 0, archived = false): Records['members'] {
  return { chat_id: chatId, user_id: userId, joined_at: '2026-11-15T00:00:00Z', role: 'member', last_read_seq: lastRead, archived, muted_until: null, nickname: null };
}
function message(chatId: string, id: string, sender: string, content: string, seq: number, createdAt: string, deleted: string | null = null): Records['messages'] {
  return { message_id: id, chat_id: chatId, sender_id: sender, content, attachment_count: 0, reply_to: null, seq, sync_seq: seq, created_at: createdAt, edited_at: null, deleted_at: deleted };
}
function profile(userId: string, displayName: string): Records['profiles'] {
  return { user_id: userId, username: userId, display_name: displayName, avatar_url: null, premium_flags: null, roles: 'user' };
}
function queued(chatId: string, id: string, createdAt: number, status: QueueItem['status']): QueueItem {
  return { temp_id: id, chat_id: chatId, status, retry_count: 0, next_attempt_at: 0, row_may_exist: false, row_state: 'absent', last_error: null, created_at: createdAt, payload: { kind: 'text', chat_id: chatId, sender_id: owner, content: 'Draft', reply_to: null, attachment_count: 0, attachments: [] } };
}

const opened: IndexedDbStore[] = [];
async function setup() {
  const store = new IndexedDbStore(owner, new IDBFactory());
  opened.push(store);
  await store.init();
  return store;
}
afterEach(() => { opened.splice(0).forEach((store) => store.close()); });

describe('chat list read', () => {
  it('orders by the newest message and lists Saved Messages first when it is the newest', async () => {
    const store = await setup();
    await store.upsertChat(chat('saved', 'direct'));
    await store.upsertChat(chat('direct', 'direct'));
    await store.upsertChat(chat('group', 'group', 'Beach Trip'));
    await store.upsertMember(member('saved', owner));
    await store.upsertMember(member('direct', owner));
    await store.upsertMember(member('direct', peer));
    await store.upsertMember(member('group', owner));
    await store.upsertProfile(profile(owner, 'Owner Name'));
    await store.upsertProfile(profile(peer, 'Peer Name'));
    await store.upsertMessage(message('saved', 's1', owner, 'Note to self', 1, '2026-11-16T11:30:00Z'));
    await store.upsertMessage(message('direct', 'd1', peer, 'Hello there', 1, '2026-11-16T10:00:00Z'));
    await store.upsertMessage(message('group', 'g1', peer, 'Group hello', 1, '2026-11-16T09:00:00Z'));

    const data = await readChatList(store, owner, now);
    expect(data.active.map((item) => item.title)).toEqual(['Saved Messages', 'Peer Name', 'Beach Trip']);
    expect(data.active[0]?.savedMessages).toBe(true);
    expect(data.active[1]?.preview).toBe('Hello there');
    expect(data.active[2]?.preview).toBe('Peer Name: Group hello');
    expect(data.archived).toEqual([]);
  });

  it('counts unread only from other senders above my cursor and skips tombstones', async () => {
    const store = await setup();
    await store.upsertChat(chat('direct', 'direct'));
    await store.upsertMember(member('direct', owner, 1));
    await store.upsertMember(member('direct', peer, 0));
    await store.upsertProfile(profile(peer, 'Peer Name'));
    await store.upsertMessage(message('direct', 'd1', peer, 'Read already', 1, '2026-11-16T09:00:00Z'));
    await store.upsertMessage(message('direct', 'd2', peer, 'Unread', 2, '2026-11-16T10:00:00Z'));
    await store.upsertMessage(message('direct', 'd3', peer, 'Gone', 3, '2026-11-16T11:00:00Z', '2026-11-16T11:05:00Z'));
    await store.upsertMessage(message('direct', 'd4', owner, 'Mine', 4, '2026-11-16T11:30:00Z'));

    const data = await readChatList(store, owner, now);
    expect(data.active).toHaveLength(1);
    expect(data.active[0]?.unreadCount).toBe(1);
    expect(data.totalUnread).toBe(1);
    expect(data.active[0]?.preview).toBe('Mine');
    expect(data.active[0]?.ownLastStatus).toBe('sent');
    expect(data.active[0]?.accessibilityLabel).toContain('1 unread');
  });

  it('names an unreadable other member as a former member and keeps archived chats apart', async () => {
    const store = await setup();
    await store.upsertChat(chat('direct', 'direct'));
    await store.upsertChat(chat('archived', 'group', 'Old Group'));
    await store.upsertMember(member('direct', owner));
    await store.upsertMember(member('direct', 'gone-user'));
    await store.upsertMember(member('archived', owner, 0, true));
    await store.upsertMessage(message('archived', 'a', owner, 'Archived note', 1, '2026-11-16T08:00:00Z'));

    const data = await readChatList(store, owner, now);
    expect(data.active.map((item) => item.title)).toEqual(['Former member']);
    expect(data.active[0]?.preview).toBe('');
    expect(data.archived.map((item) => item.title)).toEqual(['Old Group']);
    expect(data.archived[0]?.preview).toBe('You: Archived note');
    expect(data.totalUnread).toBe(0);
  });

  it('moves a chat to its pending enqueue time and exposes the queue status', async () => {
    const store = await setup();
    await store.upsertChat(chat('older', 'group', 'Older'));
    await store.upsertChat(chat('newer', 'group', 'Newer'));
    await store.upsertMember(member('older', owner));
    await store.upsertMember(member('newer', owner));
    await store.upsertMessage(message('older', 'o1', peer, 'Old message', 1, '2026-11-16T08:00:00Z'));
    await store.upsertMessage(message('newer', 'n1', peer, 'Newer message', 1, '2026-11-16T09:00:00Z'));
    await store.tryInsert(queued('older', 't1', Date.parse('2026-11-16T10:00:00Z'), 'failed'), 200);

    const data = await readChatList(store, owner, now);
    expect(data.active.map((item) => item.title)).toEqual(['Older', 'Newer']);
    expect(data.active[0]?.ownLastStatus).toBe('failed');
    expect(data.active[1]?.ownLastStatus).toBeNull();
  });

  it('keeps the D-94 tie-break by chat id when pending times are equal', () => {
    const items = [1, 2, 3].map((index) => ({
      chatId: `chat-${index}`, title: '', preview: '', timeLabel: '', sortMs: 0, unreadCount: 0, muted: false,
      isGroup: false, pinned: false, savedMessages: false, avatarId: '', avatarName: '', ownStatus: null,
      archived: false, accessibilityLabel: '',
    }));
    const pending = new Map([['chat-1', 5], ['chat-2', 5], ['chat-3', 5]]);
    expect(orderWithPending(items, pending).map((item) => item.chatId)).toEqual(['chat-1', 'chat-2', 'chat-3']);
    expect(orderWithPending(items, new Map([['chat-3', 9]])).map((item) => item.chatId)).toEqual(['chat-3', 'chat-1', 'chat-2']);
  });
});
