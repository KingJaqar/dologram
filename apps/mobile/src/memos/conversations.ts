import { memoListKey, type ChatListItem, type Memo } from '@dologram/shared';

export function memoConversation(memo: Memo, now = Date.now()): ChatListItem {
  const muted = memo.muted_until !== null && Date.parse(memo.muted_until) > now;
  return {
    conversation: { kind: 'memo', memoId: memo.memo_id }, chatId: memoListKey(memo.memo_id),
    title: memo.title, preview: memo.preview, sortMs: memo.updated_at,
    timeLabel: new Date(memo.updated_at).toLocaleDateString(), unreadCount: memo.unread ? 1 : 0,
    muted, isGroup: false, pinned: Boolean(memo.pinned), savedMessages: false,
    avatarId: memoListKey(memo.memo_id), avatarName: memo.title, ownStatus: null,
    archived: Boolean(memo.archived), accessibilityLabel: `${memo.title}, Local memo, ${memo.preview}`,
  };
}
export function combineMemoConversations(chats: readonly ChatListItem[], memos: readonly Memo[], section: 'active' | 'archived' | 'ignored', folderIds?: readonly string[]): ChatListItem[] {
  const rows = memos.filter((memo) => section === 'ignored' ? Boolean(memo.ignored) : !memo.ignored && Boolean(memo.archived) === (section === 'archived'))
    .map((memo) => memoConversation(memo)).filter((item) => !folderIds || folderIds.includes(item.chatId));
  return [...chats, ...rows].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.sortMs - a.sortMs || a.chatId.localeCompare(b.chatId));
}
