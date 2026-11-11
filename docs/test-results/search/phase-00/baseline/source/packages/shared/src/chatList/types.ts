/**
 * Chat list contracts (M2-08, F2, AND-03, AND-04, D-44, D-94).
 *
 * The screen reads one row per chat from the local cache (the SQL adapter in `apps/mobile` does
 * the unread counting, D-44) and this module turns those rows into the display items CMP-09
 * renders. Everything here is pure, so ordering, previews, unread carry-through and the time
 * labels are unit-tested without a device.
 */
import type { MediaType } from '../config';
import type { ChatRow } from '../db/repositories/chats';
import type { ChatMemberRow } from '../db/repositories/members';
import type { MessageRow } from '../db/repositories/messages';

/** One cached chat as the chat list needs it; produced by the single chat-list query. */
export type ChatListSourceRow = {
  chat: ChatRow;
  /** The caller's own `chat_members` row (read state, archive and mute flags). */
  myMember: ChatMemberRow;
  /** The newest message of the chat, or null for a chat with no messages (F2). */
  lastMessage: MessageRow | null;
  /** Media type of the newest message when it carries an attachment, for its preview word. */
  lastMediaType: MediaType | null;
  /** Display name of the newest message's sender, used for the group preview prefix. */
  lastSenderName: string | null;
  /** Messages from other senders with seq above the caller's last_read_seq (D-92). */
  unreadCount: number;
  /** Highest last_read_seq among the other members; drives the Seen status (D-92). */
  otherMaxReadSeq: number;
  /** The other member of a direct chat; null for a group and for Saved Messages. */
  otherMemberId: string | null;
  /** Display name of that member, or of the group title holder when the profile is missing. */
  otherMemberName: string | null;
};

/** The delivery status CMP-09 shows before the preview of the caller's own last message. */
export type ChatListOwnStatus = 'sent' | 'seen';

/** A chat row as CMP-09 renders it. */
export type ChatListItem = {
  chatId: string;
  /** Group title, the other member's display name, or "Saved Messages" (AND-03). */
  title: string;
  /** One-line preview, already carrying the group's sender prefix (CMP-09). */
  preview: string;
  /** Today's time, "Yesterday", a weekday, or a date (CMP-09, D-109). */
  timeLabel: string;
  /** Newest message time, or the chat's creation time when it has no messages (D-94). */
  sortMs: number;
  unreadCount: number;
  muted: boolean;
  /** True for group conversations; direct chats and Saved Messages are false. */
  isGroup: boolean;
  /** True when the conversation is locally pinned for this account. */
  pinned: boolean;
  /** Only group owners can invite members. */
  canAddMembers?: boolean;
  savedMessages: boolean;
  /** Id and name the avatar is built from (CMP-05). */
  avatarId: string;
  avatarName: string;
  ownStatus: ChatListOwnStatus | null;
  archived: boolean;
  /** Label for screen readers: name, unread count, muted, preview, time (CMP-09). */
  accessibilityLabel: string;
};

export type BuildChatListOptions = {
  /** The signed-in user. */
  userId: string;
  /** Reference time for the today/yesterday/weekday/date label. */
  now: Date;
  /** Locale for the time label; defaults to the device locale (D-109). */
  locale?: string;
  /** Time zone for the time label; defaults to the device time zone (D-109). */
  timeZone?: string;
  /** false (default) lists the main chat list, true lists the Archive (AND-04). */
  archived?: boolean;
  /** Locally pinned conversations are ordered before unpinned conversations. */
  pinnedChatIds?: readonly string[];
  /** Locally ignored conversations are hidden from the inbox and archive. */
  ignoredChatIds?: readonly string[];
  /** Lists ignored conversations across both archive states. */
  ignored?: boolean;
  deletedChatIds?: readonly string[];
  unreadChatIds?: readonly string[];
};
