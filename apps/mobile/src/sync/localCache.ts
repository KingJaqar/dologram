/**
 * Local cache deletion for screens that change membership (M2-07, D-91).
 *
 * The sync engine owns the cache for chats the server lists; a member who leaves a group (or is
 * removed) deletes the chat locally at once so it cannot be read or opened again before the next
 * pass prunes it (D-91).
 */
import type { SQLiteDatabase } from 'expo-sqlite';

/** Deletes every cached row of one chat and its sync cursor. */
export async function deleteCachedChat(db: SQLiteDatabase, chatId: string): Promise<void> {
  await db.runAsync('DELETE FROM cache_folder_chats WHERE chat_id = ?', [chatId]);
  const tables = ['cache_chat_members', 'cache_messages', 'cache_message_media', 'cache_reactions'];
  for (const table of tables) {
    await db.runAsync(`DELETE FROM ${table} WHERE chat_id = ?`, [chatId]);
  }
  await db.runAsync('DELETE FROM sync_state WHERE chat_id = ?', [chatId]);
  await db.runAsync('DELETE FROM cache_chats WHERE chat_id = ?', [chatId]);
}
