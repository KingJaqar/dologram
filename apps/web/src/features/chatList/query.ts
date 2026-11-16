/**
 * Chat list read (W-P10-S01, F2, D-44, D-92, D-94, D-W16).
 *
 * One read of the account's cache assembles the rows the shared `buildChatList` expects: the
 * caller's own member row, the newest message, the other member of a direct chat and the unread
 * count. Unread is counted in the same pass over the cached messages (D-92, D-W16), and the newest
 * unsent queue item decides both the row's delivery status (CMP-08) and the chat's place in the
 * D-94 order, so a chat moves up as soon as the user sends.
 */
import { buildChatList } from '@dologram/shared/src/chatList/build';
import type { ChatListItem, ChatListSourceRow } from '@dologram/shared/src/chatList/types';
import type { MediaType } from '@dologram/shared/src/config';
import type { QueueItem, QueueStatus } from '@dologram/shared/src/queue/types';
import { strings } from '@dologram/shared/src/strings';
import type { IndexedDbStore, Records } from '../../lib/store/IndexedDbStore';

/** LS-2 status of the newest unsent item, otherwise the shared sent/seen state (CMP-08). */
export type ChatListEntry = ChatListItem & { ownLastStatus: QueueStatus | 'seen' | null };

export type ChatListData = {
  /** Non-archived chats in D-94 order (WEB-04). */
  active: ChatListEntry[];
  /** Archived chats in the same order (WEB-05). */
  archived: ChatListEntry[];
  /** The account's own folders, by name (CMP-14). */
  folders: Records['folders'][];
  folderChats: Records['folder_chats'][];
  /** Unread over every non-archived chat, for the document title (WEB-03, D-W15). */
  totalUnread: number;
};

const MEDIA_TYPES: readonly MediaType[] = ['photo', 'video', 'voice', 'file'];

function mediaTypeOf(value: string): MediaType | null {
  return MEDIA_TYPES.find((type) => type === value) ?? null;
}

/**
 * D-94 order after the shared build: the same comparator over the newest time, with a pending
 * item replacing its chat's time by the enqueue time.
 */
export function orderWithPending(
  items: readonly ChatListItem[],
  pendingAt: ReadonlyMap<string, number>,
): ChatListItem[] {
  return items
    .map((item) => {
      const at = pendingAt.get(item.chatId);
      return at !== undefined && at > item.sortMs ? { ...item, sortMs: at } : item;
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.sortMs !== b.sortMs) return b.sortMs - a.sortMs;
      return a.chatId < b.chatId ? -1 : a.chatId > b.chatId ? 1 : 0;
    });
}

export async function readChatList(
  store: IndexedDbStore,
  userId: string,
  now: Date = new Date(),
): Promise<ChatListData> {
  if (userId.length === 0) throw new Error('A signed-in account is required.');

  const [chats, members, messages, media, profiles, folders, folderChats, queue] = await Promise.all([
    store.list('chats'),
    store.list('members'),
    store.list('messages'),
    store.list('media'),
    store.list('profiles'),
    store.list('folders'),
    store.list('folder_chats'),
    store.list('queue'),
  ]);

  const profileById = new Map(profiles.map((row) => [row.user_id, row]));
  const membersByChat = new Map<string, Records['members'][]>();
  const myMember = new Map<string, Records['members']>();
  for (const row of members) {
    const known = membersByChat.get(row.chat_id);
    if (known) known.push(row);
    else membersByChat.set(row.chat_id, [row]);
    if (row.user_id === userId) myMember.set(row.chat_id, row);
  }

  const mediaTypeByMessage = new Map<string, MediaType>();
  for (const row of media) {
    const type = mediaTypeOf(row.media_type);
    if (type !== null && !mediaTypeByMessage.has(row.message_id)) mediaTypeByMessage.set(row.message_id, type);
  }

  // D-92 in one pass: messages from other senders above my read cursor, tombstones excluded.
  const stats = new Map<string, { last: Records['messages'] | null; unread: number }>();
  for (const message of messages) {
    const mine = myMember.get(message.chat_id);
    const entry = stats.get(message.chat_id) ?? { last: null, unread: 0 };
    if (entry.last === null || message.seq > entry.last.seq) entry.last = message;
    if (mine && message.sender_id !== userId && message.deleted_at === null && message.seq > mine.last_read_seq) {
      entry.unread += 1;
    }
    stats.set(message.chat_id, entry);
  }

  const pending = new Map<string, QueueItem>();
  for (const item of queue) {
    if (item.status === 'sent') continue;
    const known = pending.get(item.chat_id);
    if (!known || item.created_at > known.created_at) pending.set(item.chat_id, item);
  }

  const rows: ChatListSourceRow[] = [];
  for (const chat of chats) {
    const mine = myMember.get(chat.chat_id);
    if (!mine) continue;
    const others = (membersByChat.get(chat.chat_id) ?? []).filter((row) => row.user_id !== userId);
    const other = chat.type === 'direct' ? others[0] : undefined;
    const otherProfile = other ? profileById.get(other.user_id) : undefined;
    const entry = stats.get(chat.chat_id);
    const last = entry?.last ?? null;
    rows.push({
      chat,
      myMember: mine,
      lastMessage: last,
      lastMediaType: last ? mediaTypeByMessage.get(last.message_id) ?? null : null,
      lastSenderName: last ? profileById.get(last.sender_id)?.display_name ?? null : null,
      unreadCount: entry?.unread ?? 0,
      otherMaxReadSeq: others.reduce((max, row) => Math.max(max, row.last_read_seq), 0),
      otherMemberId: other?.user_id ?? null,
      // D-89: a member whose profile the caller can no longer read is a former member.
      otherMemberName: other ? otherProfile?.display_name ?? strings.chatList.formerMember : null,
      otherMemberAvatarUrl: otherProfile?.avatar_url ?? null,
    });
  }

  const pendingAt = new Map<string, number>();
  for (const [chatId, item] of pending) pendingAt.set(chatId, item.created_at);
  const withStatus = (item: ChatListItem): ChatListEntry => ({
    ...item,
    ownLastStatus: pending.get(item.chatId)?.status ?? item.ownStatus,
  });

  // Pin, ignore and block preferences have no web controls in this phase; the shared defaults apply.
  const active = orderWithPending(buildChatList(rows, { userId, now }), pendingAt).map(withStatus);
  const archived = orderWithPending(buildChatList(rows, { userId, now, archived: true }), pendingAt).map(withStatus);

  return {
    active,
    archived,
    folders: [...folders].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    folderChats,
    totalUnread: active.reduce((sum, item) => sum + item.unreadCount, 0),
  };
}
