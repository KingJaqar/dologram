/**
 * Create a group chat (M2-07, AND-11, D-58, D-124).
 *
 * The chats row is inserted first, then the creator's owner row (D-124 branch 1), then one member
 * row per selected person (branch 2). The creator counts towards the 100-member cap of D-58, so the
 * screen offers at most 99. A member row the server rejects (no shared chat, cap reached) is counted
 * and reported instead of failing the whole group.
 */
import {
  createChat,
  dgTrim,
  insertMember,
  strings,
  type DgClient,
} from '@dologram/shared';
import { resyncNow } from '../sync/lifecycle';
import { mutationErrorMessage } from './errors';

export type CreateGroupArgs = {
  client: DgClient;
  userId: string;
  title: string;
  memberIds: readonly string[];
  /** A fresh client-generated chat id (D-10, D-100). */
  newChatId: string;
};

export type CreateGroupOutcome =
  | { kind: 'created'; chatId: string; failedMembers: number }
  | { kind: 'failed'; message: string };

export async function createGroupChat({
  client,
  userId,
  title,
  memberIds,
  newChatId,
}: CreateGroupArgs): Promise<CreateGroupOutcome> {
  const created = await createChat(client, {
    chat_id: newChatId,
    type: 'group',
    title: dgTrim(title),
    created_by: userId,
  });
  if (created.error) {
    return { kind: 'failed', message: mutationErrorMessage(created.error, strings.newGroup.createFailed) };
  }

  const own = await insertMember(client, { chat_id: newChatId, user_id: userId, role: 'owner' });
  if (own.error) {
    return { kind: 'failed', message: mutationErrorMessage(own.error, strings.newGroup.createFailed) };
  }

  let failedMembers = 0;
  for (const memberId of memberIds) {
    try {
      const inserted = await insertMember(client, {
        chat_id: newChatId, user_id: memberId, role: 'member',
      });
      if (inserted.error) failedMembers += 1;
    } catch { failedMembers += 1; }
  }

  await resyncNow().catch(() => undefined);
  return { kind: 'created', chatId: newChatId, failedMembers };
}
