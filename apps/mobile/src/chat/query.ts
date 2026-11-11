/** Local message history and header reads for AND-05 (M2-09, M2-12, D-44, D-70, D-92). */
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  strings,
  type ChatMemberRow,
  type ChatRow,
  type MessageRow,
  type QueueItem,
  type ReactionRow,
} from '@dologram/shared';
import { getUnsentItems } from '../queue/localQueue';
import { parseCachedAttachment, type ChatAttachment } from '../media/model';

export type ChatMessageItem = {
  messageId: string;
  chatId: string;
  senderId: string;
  senderName: string;
  content: string;
  replyTo: string | null;
  attachmentCount: number;
  attachments: ChatAttachment[];
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  seq: number | null;
  reactions: ReactionRow[];
  pending: Pick<QueueItem, 'temp_id' | 'status' | 'last_error' | 'row_may_exist' | 'next_attempt_at'> & { force_low_signal: boolean } | null;
};

export type ChatScreenSnapshot = {
  chat: ChatRow;
  members: ChatMemberRow[];
  messages: ChatMessageItem[];
  title: string;
  subtitle: string;
  savedMessages: boolean;
  myLastReadSeq: number;
  unreadCount: number;
  hasMoreBefore: boolean;
};

type PayloadRow = { payload: string };
type MemberPayloadRow = { user_id: string; payload: string };
type ProfilePayloadRow = { user_id: string; display_name: string; payload: string };
type ReactionPayloadRow = { message_id: string; payload: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function parsePayload<T>(value: string): T | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return asRecord(parsed) ? (parsed as T) : null;
  } catch {
    return null;
  }
}

function isChatRow(value: ChatRow | null): value is ChatRow {
  return Boolean(
    value &&
      typeof value.chat_id === 'string' &&
      (value.type === 'direct' || value.type === 'group') &&
      typeof value.created_at === 'string',
  );
}

function isMemberRow(value: ChatMemberRow | null): value is ChatMemberRow {
  return Boolean(
    value &&
      typeof value.chat_id === 'string' &&
      typeof value.user_id === 'string' &&
      typeof value.last_read_seq === 'number',
  );
}

function isMessageRow(value: MessageRow | null): value is MessageRow {
  return Boolean(
    value &&
      typeof value.message_id === 'string' &&
      typeof value.chat_id === 'string' &&
      typeof value.sender_id === 'string' &&
      typeof value.content === 'string' &&
      typeof value.created_at === 'string' &&
      typeof value.seq === 'number',
  );
}

function isReactionRow(value: ReactionRow | null): value is ReactionRow {
  return Boolean(
    value &&
      typeof value.message_id === 'string' &&
      typeof value.user_id === 'string' &&
      typeof value.emoji === 'string' &&
      value.removed_at === null,
  );
}

/** Reads one reaction including a removed row so D-76 re-add uses UPDATE, not INSERT. */
export async function loadCachedReaction(
  db: SQLiteDatabase,
  messageId: string,
  userId: string,
  emoji: string,
): Promise<ReactionRow | null> {
  const row = await db.getFirstAsync<ReactionPayloadRow>(
    `SELECT message_id, payload FROM cache_reactions
       WHERE message_id = ? AND user_id = ? AND emoji = ?`,
    [messageId, userId, emoji],
  );
  if (!row) return null;
  try {
    const parsed: unknown = JSON.parse(row.payload);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const candidate = parsed as Partial<ReactionRow>;
    if (typeof candidate.message_id !== 'string' || typeof candidate.user_id !== 'string' || typeof candidate.emoji !== 'string') return null;
    if (typeof candidate.chat_id !== 'string' || typeof candidate.sync_seq !== 'number' || typeof candidate.removed_at !== 'string' && candidate.removed_at !== null) return null;
    return parsed as ReactionRow;
  } catch {
    return null;
  }
}

function pendingMessage(item: QueueItem): ChatMessageItem {
  return {
    messageId: item.temp_id,
    chatId: item.payload.chat_id,
    senderId: item.payload.sender_id,
    senderName: '',
    content: item.payload.content,
    replyTo: item.payload.reply_to,
    attachmentCount: item.payload.attachment_count,
    attachments: item.payload.attachments.map((attachment) => ({
      mediaId: attachment.media_id, mediaType: attachment.media_type, localUri: attachment.local_uri,
      mime: attachment.mime, sizeBytes: attachment.size_bytes,
    })),
    createdAt: new Date(item.created_at).toISOString(),
    editedAt: null,
    deletedAt: null,
    seq: null,
    reactions: [],
    pending: {
      temp_id: item.temp_id,
      status: item.status,
      last_error: item.last_error,
      row_may_exist: item.row_may_exist,
      next_attempt_at: item.next_attempt_at,
      force_low_signal: item.payload.force_low_signal === true,
    },
  };
}

function mergeMessages(
  delivered: readonly ChatMessageItem[],
  pending: readonly ChatMessageItem[],
): ChatMessageItem[] {
  const byId = new Map<string, ChatMessageItem>();
  for (const item of delivered) byId.set(item.messageId, item);
  for (const item of pending) {
    const deliveredItem = byId.get(item.messageId);
    if (!deliveredItem) byId.set(item.messageId, item);
    else if (deliveredItem.deletedAt === null) {
      const attachments = new Map(item.attachments.map((attachment) => [attachment.mediaId, attachment]));
      for (const attachment of deliveredItem.attachments) attachments.set(attachment.mediaId, attachment);
      byId.set(item.messageId, { ...deliveredItem, attachments: [...attachments.values()], pending: item.pending });
    }
  }
  return [...byId.values()].sort((a, b) => {
    if (a.seq !== null && b.seq !== null) return a.seq - b.seq;
    if (a.seq !== null) return -1;
    if (b.seq !== null) return 1;
    return a.createdAt.localeCompare(b.createdAt) || a.messageId.localeCompare(b.messageId);
  });
}

export function mergeChatSnapshots(
  current: ChatScreenSnapshot,
  latest: ChatScreenSnapshot,
): ChatScreenSnapshot {
  const byId = new Map(current.messages.map((message) => [message.messageId, message]));
  for (const message of latest.messages) byId.set(message.messageId, message);
  return {
    ...latest,
    messages: mergeMessages([...byId.values()], []),
    hasMoreBefore: current.hasMoreBefore || latest.hasMoreBefore,
  };
}

function profileName(
  profiles: ReadonlyMap<string, string>,
  members: ReadonlyMap<string, ChatMemberRow>,
  userId: string,
): string {
  return members.get(userId)?.nickname || profiles.get(userId) || strings.chatList.unknownMember;
}

export async function loadChatSnapshotForMessage(
  db: SQLiteDatabase,
  chatId: string,
  userId: string,
  messageId: string,
  limit: number,
): Promise<{ snapshot: ChatScreenSnapshot; beforeSeq?: number }> {
  const latest = await loadChatSnapshot(db, chatId, userId, { limit });
  if (latest.messages.some((message) => message.messageId === messageId)) return { snapshot: latest };
  const target = await db.getFirstAsync<{ seq: number }>(
    'SELECT seq FROM cache_messages WHERE chat_id = ? AND message_id = ? AND seq IS NOT NULL',
    [chatId, messageId],
  );
  if (!target) return { snapshot: latest };
  const beforeSeq = target.seq + Math.min(11, limit);
  return { snapshot: await loadChatSnapshot(db, chatId, userId, { limit, beforeSeq }), beforeSeq };
}

export async function loadChatSnapshot(
  db: SQLiteDatabase,
  chatId: string,
  userId: string,
  options: { beforeSeq?: number; limit?: number } = {},
): Promise<ChatScreenSnapshot> {
  const limit = options.limit ?? 50;
  const chatPayload = await db.getFirstAsync<PayloadRow>(
    'SELECT payload FROM cache_chats WHERE chat_id = ?',
    [chatId],
  );
  const chat = chatPayload ? parsePayload<ChatRow>(chatPayload.payload) : null;
  if (!isChatRow(chat)) throw new Error('This chat is not available offline.');

  const memberRows = await db.getAllAsync<MemberPayloadRow>(
    'SELECT user_id, payload FROM cache_chat_members WHERE chat_id = ?',
    [chatId],
  );
  const members = memberRows
    .map((row) => parsePayload<ChatMemberRow>(row.payload))
    .filter(isMemberRow);
  const membersById = new Map(members.map((member) => [member.user_id, member]));
  const ownMember = members.find((member) => member.user_id === userId);
  if (!ownMember) throw new Error('This chat is not available.');

  const profileRows = await db.getAllAsync<ProfilePayloadRow>(
    `SELECT user_id, display_name, payload FROM cache_profiles WHERE user_id IN
      (SELECT user_id FROM cache_chat_members WHERE chat_id = ?)`,
    [chatId],
  );
  const profiles = new Map<string, string>();
  for (const row of profileRows) {
    const profile = parsePayload<{ user_id: string; display_name: string }>(row.payload);
    profiles.set(row.user_id, profile?.display_name ?? row.display_name);
  }

  const messageLimit = limit + 1;
  const messageRows = options.beforeSeq === undefined
    ? await db.getAllAsync<PayloadRow>(
        `SELECT payload FROM cache_messages
           WHERE chat_id = ? AND seq IS NOT NULL
           ORDER BY seq DESC LIMIT ?`,
        [chatId, messageLimit],
      )
    : await db.getAllAsync<PayloadRow>(
        `SELECT payload FROM cache_messages
           WHERE chat_id = ? AND seq IS NOT NULL AND seq < ?
           ORDER BY seq DESC LIMIT ?`,
        [chatId, options.beforeSeq, messageLimit],
      );
  const newestFirst = messageRows
    .map((row) => parsePayload<MessageRow>(row.payload))
    .filter(isMessageRow);
  const hasMoreBefore = newestFirst.length > limit;
  const deliveredRows = newestFirst.slice(0, limit).reverse();
  const mediaRows = deliveredRows.length === 0 ? [] : await db.getAllAsync<{ message_id: string; payload: string }>(
    `SELECT message_id, payload FROM cache_message_media WHERE chat_id = ? AND message_id IN (${deliveredRows.map(() => '?').join(',')}) ORDER BY media_id`,
    [chatId, ...deliveredRows.map((row) => row.message_id)],
  );
  const mediaByMessage = new Map<string, ChatAttachment[]>();
  for (const row of mediaRows) {
    const attachment = parseCachedAttachment(row.payload);
    if (!attachment) continue;
    const media = mediaByMessage.get(row.message_id) ?? [];
    media.push(attachment);
    mediaByMessage.set(row.message_id, media);
  }

  const reactionRows = await db.getAllAsync<ReactionPayloadRow>(
    `SELECT message_id, payload FROM cache_reactions
       WHERE chat_id = ? AND removed_at IS NULL`,
    [chatId],
  );
  const reactionsByMessage = new Map<string, ReactionRow[]>();
  for (const row of reactionRows) {
    const reaction = parsePayload<ReactionRow>(row.payload);
    if (!isReactionRow(reaction)) continue;
    const reactions = reactionsByMessage.get(row.message_id) ?? [];
    reactions.push(reaction);
    reactionsByMessage.set(row.message_id, reactions);
  }

  const delivered = deliveredRows.map<ChatMessageItem>((row) => ({
    messageId: row.message_id,
    chatId: row.chat_id,
    senderId: row.sender_id,
    senderName: profileName(profiles, membersById, row.sender_id),
    content: row.content,
    replyTo: row.reply_to,
    attachmentCount: row.attachment_count,
    attachments: row.deleted_at === null ? mediaByMessage.get(row.message_id) ?? [] : [],
    createdAt: row.created_at,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
    seq: row.seq,
    reactions: reactionsByMessage.get(row.message_id) ?? [],
    pending: null,
  }));

  const queueItems = (await getUnsentItems()).filter((item) => item.chat_id === chatId);
  const messages = mergeMessages(delivered, queueItems.map(pendingMessage));
  const savedMessages = chat.type === 'direct' && chat.direct_key === userId;
  const otherMember = members.find((member) => member.user_id !== userId);
  const title = savedMessages
    ? strings.chatList.savedMessages
    : chat.type === 'group'
      ? chat.title ?? strings.chatList.unknownMember
    : profileName(profiles, membersById, otherMember?.user_id ?? '');
  const subtitle = chat.type === 'group' ? strings.chatInfo.membersCount(members.length) : '';
  const unreadRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM cache_messages
       WHERE chat_id = ? AND sender_id <> ? AND seq > ? AND deleted_at IS NULL`,
    [chatId, userId, ownMember.last_read_seq],
  );

  return {
    chat,
    members,
    messages,
    title,
    subtitle,
    savedMessages,
    myLastReadSeq: ownMember.last_read_seq,
    unreadCount: unreadRow?.count ?? 0,
    hasMoreBefore,
  };
}
