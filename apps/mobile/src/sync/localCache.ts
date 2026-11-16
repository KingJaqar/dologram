import type { SQLiteDatabase } from 'expo-sqlite';

/** The chat and its history may still be visible to another signed-in account. */
export async function removeCachedMembership(db: SQLiteDatabase, chatId: string, userId: string): Promise<void> {
  await db.runAsync('DELETE FROM cache_chat_members WHERE chat_id = ? AND user_id = ?', [chatId, userId]);
  await db.runAsync('DELETE FROM pending_read_states WHERE chat_id = ? AND user_id = ?', [chatId, userId]);
}
