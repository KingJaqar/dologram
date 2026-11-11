/**
 * Open or create a direct chat (M2-07, AND-10, D-70, D-124, C-8).
 *
 * D-70 makes chats.direct_key unique, so a pair has at most one direct chat. The flow first checks
 * the synced local cache for a chat with that member and opens it; otherwise it inserts the three
 * rows of the contract in order (chats, the creator's owner row, the other member's row) and the
 * server trigger sets direct_key.
 *
 * C-8/PF-31: a failure on the second member row can mean the pair already has a direct chat the
 * cache did not know about. That case resyncs and opens the existing chat; a real failure is
 * reported, never hidden.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  createChat,
  findDirectChatId,
  insertMember,
  isSavedMessagesChat,
  listMyChats,
  strings,
  type DgClient,
} from '@dologram/shared';
import { loadChatListRows } from '../chatList/query';
import { resyncNow } from '../sync/lifecycle';
import { mutationErrorMessage } from './errors';

export type DirectChatOutcome =
  | { kind: 'opened' | 'created'; chatId: string }
  | { kind: 'failed'; message: string };

async function cachedDirectChatId(
  db: SQLiteDatabase,
  userId: string,
  otherUserId: string,
): Promise<string | null> {
  const rows = await loadChatListRows(db, userId);
  return findDirectChatId(rows, { userId, otherUserId });
}

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
  // A cache read failure must not block the flow: the insert below still checks direct_key.
  const existing = await cachedDirectChatId(db, userId, otherUserId).catch(() => null);
  if (existing !== null) {
    return { kind: 'opened', chatId: existing };
  }

  // The local cache may lag behind a freshly signed-in device. For self-chat, check the server
  // before creating a chat because the target should be the existing Saved Messages chat.
  if (otherUserId === userId) {
    const remoteChats = await listMyChats(client);
    const remoteExisting = remoteChats.data?.find((chat) => isSavedMessagesChat(chat, userId))?.chat_id ?? null;
    if (remoteExisting !== null) {
      return { kind: 'opened', chatId: remoteExisting };
    }
  }

  const created = await createChat(client, {
    chat_id: newChatId,
    type: 'direct',
    title: null,
    created_by: userId,
  });
  if (created.error) {
    return { kind: 'failed', message: mutationErrorMessage(created.error, strings.newChat.openFailed) };
  }

  // D-124 branch 1: the creator's own first row.
  const own = await insertMember(client, { chat_id: newChatId, user_id: userId, role: 'owner' });
  if (own.error) {
    return { kind: 'failed', message: mutationErrorMessage(own.error, strings.newChat.openFailed) };
  }

  // Saved Messages is intentionally a one-member direct chat. The username search may target the
  // caller, so do not insert the same member a second time.
  if (otherUserId === userId) {
    await resyncNow();
    return { kind: 'created', chatId: newChatId };
  }

  // D-124 branch 2: the other member, with no shared-chat rule for a direct chat (D-70).
  const other = await insertMember(client, {
    chat_id: newChatId,
    user_id: otherUserId,
    role: 'member',
  });
  if (other.error) {
    await resyncNow();
    const existingAfter = await cachedDirectChatId(db, userId, otherUserId).catch(() => null);
    if (existingAfter !== null) {
      return { kind: 'opened', chatId: existingAfter };
    }
    return {
      kind: 'failed',
      message: mutationErrorMessage(other.error, strings.newChat.openFailed),
    };
  }

  await resyncNow();
  return { kind: 'created', chatId: newChatId };
}
