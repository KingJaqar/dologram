import { classifyError } from '../../errors';
import type { DgClient } from '../client';
import type { Tables } from '../database.types';
import type { DgResult } from '../result';

export type ReactionRow = Tables<'reactions'>;

export type AddReactionInput = {
  message_id: string;
  user_id: string;
  emoji: string;
};

/** Rows of one chat with sync_seq > afterSyncSeq, ascending, at most `limit` (M2-05, D-40). */
export async function listReactionsAfter(
  client: DgClient,
  chatId: string,
  afterSyncSeq: number,
  limit: number,
): Promise<DgResult<ReactionRow[]>> {
  const { data, error, status } = await client
    .from('reactions')
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

/** chat_id and sync_seq are set by the M1-03 trigger, so only these columns are written (10.5). */
export async function addReaction(
  client: DgClient,
  input: AddReactionInput,
): Promise<DgResult<ReactionRow>> {
  const { data, error } = await client
    .from('reactions')
    .insert({
      message_id: input.message_id,
      user_id: input.user_id,
      emoji: input.emoji,
    })
    .select()
    .single();
  if (error) {
    return { data: null, error: classifyError(error) };
  }
  return { data, error: null };
}

/** D-22 and D-76: removal sets removed_at and re-adding clears it; a reaction is never deleted. */
export async function setReactionRemoved(
  client: DgClient,
  messageId: string,
  userId: string,
  emoji: string,
  removed: boolean,
): Promise<DgResult<ReactionRow>> {
  const { data, error } = await client
    .from('reactions')
    .update({ removed_at: removed ? new Date().toISOString() : null })
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('emoji', emoji)
    .select()
    .single();
  if (error) {
    return { data: null, error: classifyError(error) };
  }
  return { data, error: null };
}
