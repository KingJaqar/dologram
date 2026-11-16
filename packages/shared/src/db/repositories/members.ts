import { classifyError, type ClassifiedError } from '../../errors';
import type { DgClient } from '../client';
import type { Json, Tables } from '../database.types';
import type { DgResult } from '../result';

export type ChatMemberRow = Tables<'chat_members'>;

const MAX_SAFE_READ_SEQ = Number.MAX_SAFE_INTEGER;
type ReadAbortSignal = Parameters<ReturnType<DgClient['rpc']>['abortSignal']>[0];

function contractError(): ClassifiedError {
  return { kind: 'server', code: null, status: 502 };
}

function isRecord(value: Json): value is { [key: string]: Json | undefined } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidTimestamp(value: Json | undefined): value is string {
  return typeof value === 'string'
    && value.length > 0
    && (value === 'infinity' || value === '-infinity' || Number.isFinite(Date.parse(value)));
}

function isValidMemberRow(value: Json, chatId: string): value is ChatMemberRow {
  if (!isRecord(value)) return false;
  const nickname = value.nickname;
  return value.chat_id === chatId
    && typeof value.user_id === 'string'
    && value.user_id.length > 0
    && typeof value.role === 'string'
    && isValidTimestamp(value.joined_at)
    && typeof value.last_read_seq === 'number'
    && Number.isSafeInteger(value.last_read_seq)
    && value.last_read_seq >= 0
    && typeof value.archived === 'boolean'
    && (value.muted_until === null || isValidTimestamp(value.muted_until))
    && (nickname === undefined || nickname === null || typeof nickname === 'string');
}

function isValidReadSeq(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_SAFE_READ_SEQ;
}

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

/** The membership-bound, monotonic read cursor writer (D-92, SEEN-02). */
export async function markChatRead(
  client: DgClient,
  chatId: string,
  maxSeq: number,
  membershipJoinedAt: string,
  signal?: ReadAbortSignal,
): Promise<DgResult<ChatMemberRow>> {
  if (chatId.length === 0 || !isValidReadSeq(maxSeq) || !isValidTimestamp(membershipJoinedAt)) {
    return { data: null, error: { kind: 'server', code: 'DG422', status: 400 } };
  }

  let request = client.rpc('mark_chat_read', {
      p_chat_id: chatId,
      p_max_seq: maxSeq,
      p_membership_joined_at: membershipJoinedAt,
    });
  if (signal) request = request.abortSignal(signal);
  const { data, error, status } = await request.single();
  if (error) {
    return { data: null, error: classifyError(error, status) };
  }
  if (!isValidMemberRow(data, chatId) || data.joined_at !== membershipJoinedAt || !isValidReadSeq(data.last_read_seq)) {
    return { data: null, error: contractError() };
  }
  return { data, error: null };
}

/** Every member row of one chat, including the caller's read state (M2-05, D-92). */
export async function listChatMembers(
  client: DgClient,
  chatId: string,
  expectedUserId?: string,
  signal?: ReadAbortSignal,
): Promise<DgResult<ChatMemberRow[]>> {
  if (chatId.length === 0) return { data: null, error: { kind: 'server', code: 'DG422', status: 400 } };

  let callerId = expectedUserId;
  if (callerId === undefined) {
    const { data: userData, error: authError } = await client.auth.getUser();
    if (authError) return { data: null, error: classifyError(authError) };
    callerId = userData.user?.id;
  }
  if (!callerId) return { data: null, error: { kind: 'server', code: 'DG401', status: 401 } };

  const query = client.rpc('get_chat_member_snapshot', { p_chat_id: chatId });
  if (signal) { query.abortSignal(signal); query.retry(false); }
  const { data, error, status } = await query;
  if (error) {
    return { data: null, error: classifyError(error, status) };
  }
  if (data === null || !isRecord(data)) return { data: null, error: contractError() };

  const members = data.members;
  const totalCount = data.total_count;
  if (!Array.isArray(members)
      || typeof totalCount !== 'number'
      || !Number.isSafeInteger(totalCount)
      || totalCount < 1
      || members.length !== totalCount) {
    return { data: null, error: contractError() };
  }

  const rows: ChatMemberRow[] = [];
  const userIds = new Set<string>();
  for (const member of members) {
    if (!isValidMemberRow(member, chatId) || userIds.has(member.user_id)) {
      return { data: null, error: contractError() };
    }
    userIds.add(member.user_id);
    rows.push(member);
  }
  if (!userIds.has(callerId)) return { data: null, error: contractError() };
  return { data: rows, error: null };
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
  Pick<ChatMemberRow, 'archived' | 'muted_until'>
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
