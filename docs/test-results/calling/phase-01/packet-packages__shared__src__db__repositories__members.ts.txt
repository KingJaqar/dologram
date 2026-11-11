import { classifyError } from '../../errors';
import type { DgClient } from '../client';
import type { Tables } from '../database.types';
import type { DgResult } from '../result';

export type ChatMemberRow = Tables<'chat_members'>;

export async function setChatNickname(
  client: DgClient,
  chatId: string,
  userId: string,
  nickname: string | null,
): Promise<DgResult<ChatMemberRow>> {
  const { data, error, status } = await client
    .rpc('set_chat_nickname', { p_chat_id: chatId, p_user_id: userId, p_nickname: nickname })
    .single();
  if (error) {
    return { data: null, error: classifyError(error, status) };
  }
  return { data, error: null };
}

/** Every member row of one chat, including the caller's read state (M2-05, D-92). */
export async function listChatMembers(
  client: DgClient,
  chatId: string,
): Promise<DgResult<ChatMemberRow[]>> {
  const { data, error, status } = await client
    .from('chat_members')
    .select('*')
    .eq('chat_id', chatId);
  if (error) {
    return { data: null, error: classifyError(error, status) };
  }
  return { data, error: null };
}

/** D-26, D-70: the creator's row is the owner's; every row added by the owner is a member's. */
export type MemberRole = 'owner' | 'member';

export type InsertMemberInput = {
  chat_id: string;
  user_id: string;
  role: MemberRole;
};

/**
 * M2-07 member rows. Branch 1 of D-124 is the creator's own first row (role owner); branch 2 is a
 * row the chat's owner adds (role member). RLS and the chat_members trigger enforce the limits.
 */
export async function insertMember(
  client: DgClient,
  input: InsertMemberInput,
): Promise<DgResult<ChatMemberRow>> {
  const { data, error, status } = await client
    .from('chat_members')
    .insert(input)
    .select()
    .single();
  if (error) {
    return { data: null, error: classifyError(error, status) };
  }
  return { data, error: null };
}

/**
 * M2-07: the owner removes another member, or a member leaves a group by deleting its own row.
 * 10.5 forbids deleting the rows of direct chats and Saved Messages; RLS rejects those.
 */
export async function removeMember(
  client: DgClient,
  chatId: string,
  userId: string,
): Promise<DgResult<true>> {
  const { data, error, status } = await client
    .from('chat_members')
    .delete()
    .eq('chat_id', chatId)
    .eq('user_id', userId)
    .select();
  if (error) {
    return { data: null, error: classifyError(error, status) };
  }
  if (data.length === 0) {
    // RLS rejects a forbidden delete silently by matching no row, which must not read as success.
    return { data: null, error: { kind: 'server', code: null, status: null } };
  }
  return { data: true, error: null };
}

/** D-38 and 10.5: a member may write only these three columns on its own row. */
export type OwnMemberPatch = Partial<
  Pick<ChatMemberRow, 'last_read_seq' | 'archived' | 'muted_until'>
>;

export async function updateOwnMember(
  client: DgClient,
  chatId: string,
  userId: string,
  patch: OwnMemberPatch,
): Promise<DgResult<ChatMemberRow>> {
  const { data, error } = await client
    .from('chat_members')
    .update(patch)
    .eq('chat_id', chatId)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) {
    return { data: null, error: classifyError(error) };
  }
  return { data, error: null };
}
