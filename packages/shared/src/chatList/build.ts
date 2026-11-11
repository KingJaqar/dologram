/**
 * Chat list assembly (M2-08, F2, AND-03, AND-04, D-94).
 *
 * D-94 order: chats that are not archived, ordered by the created_at of their newest message,
 * else by chats.created_at, with ties by chat_id. Archived chats appear only in the Archive view
 * and are never unarchived by a new message.
 */
import { strings } from '../strings';
import { formatChatListTime } from './format';
import { messagePreview } from './preview';
import type { BuildChatListOptions, ChatListItem, ChatListSourceRow } from './types';

function timeOf(iso: string): number {
  const value = Date.parse(iso);
  return Number.isNaN(value) ? 0 : value;
}

/** A mute lasts while muted_until is in the future or is the D-109 "Until I unmute" value. */
function isMuted(mutedUntil: string | null, now: Date): boolean {
  if (mutedUntil === null) return false;
  if (mutedUntil === 'infinity') return true;
  const value = Date.parse(mutedUntil);
  if (Number.isNaN(value)) return true;
  return value > now.getTime();
}

function titleOf(row: ChatListSourceRow, savedMessages: boolean): string {
  if (savedMessages) return strings.chatList.savedMessages;
  if (row.chat.type === 'group') return row.chat.title ?? strings.chatList.unknownMember;
  return row.otherMemberName ?? strings.chatList.unknownMember;
}

function previewOf(row: ChatListSourceRow, userId: string, savedMessages: boolean): string {
  if (row.lastMessage === null) return '';
  const text = messagePreview(row.lastMessage, row.lastMediaType);
  if (text.length === 0) return '';
  if (row.chat.type !== 'group') return text;
  const sender =
    row.lastMessage.sender_id === userId
      ? strings.chatList.youPrefix
      : `${row.lastSenderName ?? strings.chatList.unknownMember}: `;
  return `${sender}${text}`;
}

/** True when a direct chat has no other member: the Saved Messages chat of M1-03 (F7). */
function isSavedMessages(row: ChatListSourceRow): boolean {
  return row.chat.type === 'direct' && row.otherMemberId === null;
}

/**
 * Builds the rows of AND-03 (default) or AND-04 (`archived: true`), already in D-94 order.
 * Archived chats are left out of the main list by construction.
 */
export function buildChatList(
  rows: readonly ChatListSourceRow[],
  options: BuildChatListOptions,
): ChatListItem[] {
  const wantArchived = options.archived === true;
  const pinnedChatIds = new Set(options.pinnedChatIds ?? []);
  const ignoredChatIds = new Set(options.ignoredChatIds ?? []);
  const deletedChatIds = new Set(options.deletedChatIds ?? []);
  const unreadChatIds = new Set(options.unreadChatIds ?? []);

  const items = rows
    .filter((row) => options.ignored || row.myMember.archived === wantArchived)
    .filter((row) => ignoredChatIds.has(row.chat.chat_id) === (options.ignored === true))
    .filter((row) => !deletedChatIds.has(row.chat.chat_id))
    .map((row): ChatListItem => {
      const savedMessages = isSavedMessages(row);
      const unreadCount = Math.max(row.unreadCount, unreadChatIds.has(row.chat.chat_id) ? 1 : 0);
      const title = titleOf(row, savedMessages);
      const preview = previewOf(row, options.userId, savedMessages);
      const newest = row.lastMessage?.created_at ?? row.chat.created_at;
      const timeLabel = formatChatListTime(newest, options.now, {
        locale: options.locale,
        timeZone: options.timeZone,
      });
      const ownStatus =
        !savedMessages && row.lastMessage !== null && row.lastMessage.sender_id === options.userId
          ? row.otherMaxReadSeq >= row.lastMessage.seq
            ? 'seen'
            : 'sent'
          : null;

      const labelParts = [title];
      if (unreadCount > 0) labelParts.push(`${unreadCount} unread`);
      if (isMuted(row.myMember.muted_until, options.now)) labelParts.push('muted');
      if (preview.length > 0) labelParts.push(preview);
      if (timeLabel.length > 0) labelParts.push(timeLabel);

      return {
        chatId: row.chat.chat_id,
        title,
        preview,
        timeLabel,
        sortMs: timeOf(newest),
        unreadCount,
        muted: isMuted(row.myMember.muted_until, options.now),
        isGroup: row.chat.type === 'group',
        pinned: pinnedChatIds.has(row.chat.chat_id),
        canAddMembers: row.chat.type === 'group' && row.myMember.role === 'owner',
        savedMessages,
        avatarId: savedMessages ? row.chat.chat_id : (row.otherMemberId ?? row.chat.chat_id),
        avatarName: savedMessages ? strings.chatList.savedMessages : title,
        ownStatus,
        archived: row.myMember.archived,
        accessibilityLabel: labelParts.join(', '),
      };
    });

  return items.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.sortMs !== b.sortMs) return b.sortMs - a.sortMs;
    return a.chatId < b.chatId ? -1 : a.chatId > b.chatId ? 1 : 0;
  });
}
