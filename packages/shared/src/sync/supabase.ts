/**
 * Supabase implementations of the sync interfaces (M2-05, 6.4, D-40, D-43).
 *
 * `createSupabaseSyncSource` reads resync pages through RLS and lists the active user's chats. The
 * delivery joins one channel carrying Postgres Changes for messages, message_media and reactions;
 * D-43 keeps it behind `SyncDelivery` so database Broadcast can replace it without touching the
 * engine. Realtime payloads are untyped, so every row is validated before it enters the cache.
 */
import {
  getChat,
  listChatMembers,
  listMessageMediaAfter,
  listMessagesAfter,
  listMyChats,
  listProfilesByIds,
  listReactionsAfter,
  type ChatMemberRow,
  type ChatRow,
  type DgClient,
  type DgResult,
  type MessageMediaRow,
  type MessageRow,
  type ProfileRow,
  type ReactionRow,
  type SyncDelivery,
  type SyncDeliveryHandlers,
  type SyncSource,
} from '../index';

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && (value === 'infinity' || value === '-infinity' || Number.isFinite(Date.parse(value)));
}

function toMessageRow(value: unknown): MessageRow | null {
  const row = asRecord(value);
  if (!row) return null;

  const message_id = row.message_id;
  const chat_id = row.chat_id;
  const sender_id = row.sender_id;
  const content = row.content;
  const attachment_count = row.attachment_count;
  const reply_to = row.reply_to;
  const seq = row.seq;
  const sync_seq = row.sync_seq;
  const edited_at = row.edited_at;
  const deleted_at = row.deleted_at;
  const created_at = row.created_at;

  if (
    typeof message_id !== 'string' ||
    typeof chat_id !== 'string' ||
    typeof sender_id !== 'string' ||
    typeof content !== 'string' ||
    (typeof attachment_count !== 'number' || !Number.isSafeInteger(attachment_count) || attachment_count < 0) ||
    !isNullableString(reply_to) ||
    (typeof seq !== 'number' || !Number.isSafeInteger(seq) || seq < 1) ||
    (typeof sync_seq !== 'number' || !Number.isSafeInteger(sync_seq) || sync_seq < 1) ||
    !isNullableString(edited_at) ||
    !isNullableString(deleted_at) ||
    typeof created_at !== 'string'
  ) {
    return null;
  }

  return {
    message_id,
    chat_id,
    sender_id,
    content,
    attachment_count,
    reply_to,
    seq,
    sync_seq,
    edited_at,
    deleted_at,
    created_at,
  };
}

function toMediaRow(value: unknown): MessageMediaRow | null {
  const row = asRecord(value);
  if (!row) return null;

  const media_id = row.media_id;
  const message_id = row.message_id;
  const chat_id = row.chat_id;
  const media_type = row.media_type;
  const storage_path = row.storage_path;
  const compressed = row.compressed;
  const sync_seq = row.sync_seq;

  if (
    typeof media_id !== 'string' ||
    typeof message_id !== 'string' ||
    typeof chat_id !== 'string' ||
    typeof media_type !== 'string' ||
    typeof storage_path !== 'string' ||
    typeof compressed !== 'boolean' ||
    (typeof sync_seq !== 'number' || !Number.isSafeInteger(sync_seq) || sync_seq < 1)
  ) {
    return null;
  }

  return { media_id, message_id, chat_id, media_type, storage_path, compressed, sync_seq, deleted_at: typeof row.deleted_at === 'string' ? row.deleted_at : null };
}

function toReactionRow(value: unknown): ReactionRow | null {
  const row = asRecord(value);
  if (!row) return null;

  const message_id = row.message_id;
  const user_id = row.user_id;
  const emoji = row.emoji;
  const chat_id = row.chat_id;
  const sync_seq = row.sync_seq;
  const removed_at = row.removed_at;

  if (
    typeof message_id !== 'string' ||
    typeof user_id !== 'string' ||
    typeof emoji !== 'string' ||
    typeof chat_id !== 'string' ||
    (typeof sync_seq !== 'number' || !Number.isSafeInteger(sync_seq) || sync_seq < 1) ||
    !isNullableString(removed_at)
  ) {
    return null;
  }

  return { message_id, user_id, emoji, chat_id, sync_seq, removed_at };
}

function toChatMemberRow(value: unknown): ChatMemberRow | null {
  const row = asRecord(value);
  if (!row
    || typeof row.chat_id !== 'string' || row.chat_id.length === 0
    || typeof row.user_id !== 'string' || row.user_id.length === 0
    || !isTimestamp(row.joined_at)
    || typeof row.role !== 'string'
    || typeof row.last_read_seq !== 'number'
    || !Number.isSafeInteger(row.last_read_seq)
    || row.last_read_seq < 0
    || typeof row.archived !== 'boolean'
    || !isNullableString(row.muted_until)
    || (row.muted_until !== null && !isTimestamp(row.muted_until))
    || !(row.nickname === undefined || isNullableString(row.nickname))) return null;
  return {
    chat_id: row.chat_id,
    user_id: row.user_id,
    joined_at: row.joined_at,
    role: row.role,
    last_read_seq: row.last_read_seq,
    archived: row.archived,
    muted_until: row.muted_until,
    nickname: row.nickname ?? null,
  };
}

async function validated<T>(result: Promise<DgResult<T[]>>, parse: (value: unknown) => T | null): Promise<DgResult<T[]>> {
  const response = await result;
  if (response.error) return response;
  const rows: T[] = [];
  for (const value of response.data) {
    const row = parse(value);
    if (!row) return { data: null, error: { kind: 'server', code: null, status: 502 } };
    rows.push(row);
  }
  return { data: rows, error: null };
}

export function createSupabaseSyncSource(client: DgClient, userId: string, signal?: Parameters<ReturnType<DgClient['rpc']>['abortSignal']>[0]): SyncSource {
  return {
    fetchMessagesAfter(
      chatId: string,
      afterSyncSeq: number,
      limit: number,
    ): Promise<DgResult<MessageRow[]>> {
      return validated(listMessagesAfter(client, chatId, afterSyncSeq, limit, signal), toMessageRow);
    },
    fetchMediaAfter(
      chatId: string,
      afterSyncSeq: number,
      limit: number,
    ): Promise<DgResult<MessageMediaRow[]>> {
      return validated(listMessageMediaAfter(client, chatId, afterSyncSeq, limit, signal), toMediaRow);
    },
    fetchReactionsAfter(
      chatId: string,
      afterSyncSeq: number,
      limit: number,
    ): Promise<DgResult<ReactionRow[]>> {
      return validated(listReactionsAfter(client, chatId, afterSyncSeq, limit, signal), toReactionRow);
    },
    fetchChats(): Promise<DgResult<ChatRow[]>> {
      return listMyChats(client, userId, signal);
    },
    fetchChat(chatId: string): Promise<DgResult<ChatRow | null>> {
      return getChat(client, chatId, signal);
    },
    fetchMembers(chatId: string): Promise<DgResult<ChatMemberRow[]>> {
      return listChatMembers(client, chatId, userId, signal);
    },
    fetchProfiles(userIds: readonly string[]): Promise<DgResult<ProfileRow[]>> {
      return listProfilesByIds(client, userIds, signal);
    },
  };
}

const CHANNEL_PREFIX = 'dologram:sync';
let channelCount = 0;

function eventChatId(value: unknown): string | null {
  const row = asRecord(value);
  return typeof row?.chat_id === 'string' && row.chat_id.length > 0 ? row.chat_id : null;
}

export function createSupabaseDelivery(client: DgClient): SyncDelivery {
  return {
    subscribe({ onChange, onMembersInvalidated, onStatus }: SyncDeliveryHandlers): () => void {
      let closed = false;
      // A distinct topic per subscription avoids a clash with a channel still being removed when
      // the app foregrounds again; the client still shares one Realtime connection (D-43).
      channelCount += 1;
      const channel = client.channel(`${CHANNEL_PREFIX}:${channelCount}`, { config: { postgres_changes_options: { wait: true, timeout: 10_000 } } });

      // No client filter: RLS decides which rows a member may see (6.4). DELETE events carry no
      // readable row and are ignored; messages and reactions are removed by UPDATE (D-14, D-22).
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          if (closed) return;
          const row = toMessageRow(payload.new);
          if (row) onChange({ table: 'messages', row });
        },
      );
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_media' },
        (payload) => {
          if (closed) return;
          const row = toMediaRow(payload.new);
          if (row) onChange({ table: 'message_media', row });
        },
      );
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reactions' },
        (payload) => {
          if (closed) return;
          const row = toReactionRow(payload.new);
          if (row) onChange({ table: 'reactions', row });
        },
      );
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_members' },
        (payload) => {
          if (closed) return;
          const row = toChatMemberRow(payload.new);
          if (row) onChange({ table: 'chat_members', row });
          else {
            const chatId = eventChatId(payload.old) ?? eventChatId(payload.new);
            if (chatId) onMembersInvalidated(chatId);
          }
        },
      );

      channel.subscribe((status) => {
        if (closed) return;
        if (status === 'SUBSCRIBED') {
          onStatus('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          onStatus('disconnected');
        }
      }, 10_000);

      return () => {
        if (closed) return;
        closed = true;
        void client.removeChannel(channel).then(
          (result) => { if (result !== 'ok') onStatus('disconnected'); },
          () => onStatus('disconnected'),
        );
      };
    },
  };
}
