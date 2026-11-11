import { classifyError } from '../../errors';
import type { DgClient } from '../client';
import type { Tables } from '../database.types';
import type { DgResult } from '../result';

export type MessageRow = Tables<'messages'>;

/** Only the client-writable columns of 10.5: seq, sync_seq and the timestamps are server-assigned. */
export type InsertMessageInput = {
  message_id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  reply_to: string | null;
  attachment_count: number;
};

export async function insertMessage(
  client: DgClient,
  input: InsertMessageInput,
): Promise<DgResult<MessageRow>> {
  const { data, error, status } = await client
    .from('messages')
    .insert({
      message_id: input.message_id,
      chat_id: input.chat_id,
      sender_id: input.sender_id,
      content: input.content,
      reply_to: input.reply_to,
      attachment_count: input.attachment_count,
    })
    .select()
    .single();
  if (error) {
    return { data: null, error: classifyError(error, status) };
  }
  return { data, error: null };
}

/** Rows of one chat with sync_seq > afterSyncSeq, ascending, at most `limit` (M2-05, D-40). */
export async function listMessagesAfter(
  client: DgClient,
  chatId: string,
  afterSyncSeq: number,
  limit: number,
): Promise<DgResult<MessageRow[]>> {
  const { data, error, status } = await client
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .gt('sync_seq', afterSyncSeq)
    .order('sync_seq', { ascending: true })
    .limit(limit);
  if (error) {
    return { data: null, error: classifyError(error, status) };
  }
  return { data, error: null };
}

/** D-22: the sender may update content only; edited_at is set by the server. */
export async function editMessage(
  client: DgClient,
  messageId: string,
  content: string,
): Promise<DgResult<MessageRow>> {
  const { data, error } = await client
    .from('messages')
    .update({ content })
    .eq('message_id', messageId)
    .select()
    .single();
  if (error) {
    return { data: null, error: classifyError(error) };
  }
  return { data, error: null };
}

/** D-22 and D-76: a delete sets deleted_at; the server clears the content. */
export async function softDeleteMessage(
  client: DgClient,
  messageId: string,
): Promise<DgResult<MessageRow>> {
  const { data, error, status } = await client
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('message_id', messageId)
    .select()
    .single();
  if (error) {
    return { data: null, error: classifyError(error, status) };
  }
  return { data, error: null };
}
