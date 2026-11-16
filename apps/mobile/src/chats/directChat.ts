/** Opens a cached direct chat or asks the server to open/create the pair atomically. */
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  classifyError,
  findDirectChatId,
  strings,
  type DgClient,
} from '@dologram/shared';
import { loadChatListRows } from '../chatList/query';
import { resyncChatNow } from '../sync/lifecycle';
import { mutationErrorMessage } from './errors';

export type DirectChatOutcome =
  | { kind: 'opened' | 'created'; chatId: string }
  | { kind: 'failed'; message: string };

export type OpenDirectChatArgs = {
  client: DgClient;
  db: SQLiteDatabase;
  userId: string;
  otherUserId: string;
  /** A fresh client-generated chat id (D-10, D-100). */
  newChatId: string;
};

export async function openDirectChat({
  client,
  db,
  userId,
  otherUserId,
  newChatId,
}: OpenDirectChatArgs): Promise<DirectChatOutcome> {
  const cachedRows = await loadChatListRows(db, userId).catch(() => []);
  const existing = findDirectChatId(cachedRows, { userId, otherUserId });
  if (existing !== null) return { kind: 'opened', chatId: existing };

  const { data: chatId, error, status } = await client.rpc('open_direct_chat', {
    p_other_user_id: otherUserId,
    p_chat_id: newChatId,
  });
  if (error) {
    return { kind: 'failed', message: mutationErrorMessage(classifyError(error, status), strings.newChat.openFailed) };
  }

  await resyncChatNow(chatId).catch(() => undefined);
  return { kind: chatId === newChatId ? 'created' : 'opened', chatId };
}
