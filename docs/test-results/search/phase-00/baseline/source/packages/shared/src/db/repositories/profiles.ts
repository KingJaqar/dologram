import { classifyError } from '../../errors';
import type { DgClient } from '../client';
import type { Database, Tables } from '../database.types';
import type { DgResult } from '../result';

export type FindUserRow = Database['public']['Functions']['find_user']['Returns'][number];

/** A profile row, readable for the caller and for users who share a chat (10.5). */
export type ProfileRow = Tables<'profiles'>;

/**
 * Profiles of the given users. RLS returns only the caller's own row and the rows of users who
 * share a chat with the caller (10.5 profiles SELECT), which is exactly the set the chat list and
 * the chat screens show; any other id is silently absent.
 */
export async function listProfilesByIds(
  client: DgClient,
  userIds: readonly string[],
): Promise<DgResult<ProfileRow[]>> {
  if (userIds.length === 0) {
    return { data: [], error: null };
  }
  const { data, error, status } = await client
    .from('profiles')
    .select('*')
    .in('user_id', [...userIds]);
  if (error) {
    return { data: null, error: classifyError(error, status) };
  }
  return { data, error: null };
}

/**
 * Exact, case-insensitive username lookup (D-42). The parameter name follows the M1-03 signature
 * `find_user(username text)` (Assumption A-05).
 */
export async function findUser(
  client: DgClient,
  username: string,
): Promise<DgResult<FindUserRow[]>> {
  const { data, error } = await client.rpc('find_user', { username });
  if (error) {
    return { data: null, error: classifyError(error) };
  }
  return { data: data ?? [], error: null };
}
