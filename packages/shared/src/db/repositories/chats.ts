/**
 * Chat reads the sync module needs (M2-05, 6.4, D-91) and the insert of M2-07.
 *
 * 10.5 grants INSERT on chats to a signed-in user with created_by set to themselves; next_seq and
 * direct_key are written by the server triggers (D-40, D-70), so no client sends them.
 */
import { classifyError } from '../../errors';
import type { DgClient } from '../client';
import type { Tables } from '../database.types';
import type { DgResult } from '../result';

export type ChatRow = Tables<'chats'>;

/** Every chat the caller is a member of; chats RLS filters the rest out. */
export async function listMyChats(client: DgClient): Promise<DgResult<ChatRow[]>> {
  const { data, error, status } = await client.from('chats').select('*');
  if (error) {
    return { data: null, error: classifyError(error, status) };
  }
  return { data, error: null };
}

export type CreateChatInput = {
  chat_id: string;
  type: 'direct' | 'group';
  /** Group title (1 to 64 characters, D-109); null for a direct chat. */
  title: string | null;
  created_by: string;
};

/** M2-07: the chats row is inserted before the creator's chat_members row (D-124 branch 1). */
export async function createChat(
  client: DgClient,
  input: CreateChatInput,
): Promise<DgResult<ChatRow>> {
  const { data, error, status } = await client.from('chats').insert(input).select().single();
  if (error) {
    return { data: null, error: classifyError(error, status) };
  }
  return { data, error: null };
}

/** One chat, or null when the caller is no longer a member or the chat is gone (D-91). */
export async function getChat(client: DgClient, chatId: string): Promise<DgResult<ChatRow | null>> {
  const { data, error, status } = await client
    .from('chats')
    .select('*')
    .eq('chat_id', chatId)
    .maybeSingle();
  if (error) {
    return { data: null, error: classifyError(error, status) };
  }
  return { data, error: null };
}

export async function updateChatTitle(
  client: DgClient,
  chatId: string,
  title: string,
): Promise<DgResult<ChatRow>> {
  const { data, error, status } = await client
    .from('chats')
    .update({ title })
    .eq('chat_id', chatId)
    .select()
    .single();
  if (error) {
    return { data: null, error: classifyError(error, status) };
  }
  return { data, error: null };
}

/** Updates the shared group photo storage path. Owners only (enforced by chats RLS). */
export async function updateChatAvatar(
  client: DgClient,
  chatId: string,
  avatar_url: string | null,
): Promise<DgResult<ChatRow>> {
  const { data, error, status } = await client
    .from('chats')
    .update({ avatar_url })
    .eq('chat_id', chatId)
    .select()
    .single();
  if (error) {
    return { data: null, error: classifyError(error, status) };
  }
  return { data, error: null };
}
