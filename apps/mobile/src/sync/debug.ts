/**
 * Read-only cache summary for the dev-tools screen (D-160). It reads the same expo-sqlite
 * database the sync adapter writes, so a device check can confirm what the engine cached.
 */
import { getLocalDatabase } from '../queue/db';

export type SyncDebugSnapshot = {
  chats: number;
  members: number;
  messages: number;
  media: number;
  reactions: number;
  cursors: { chatId: string; cursor: number }[];
};

async function countRows(table: string): Promise<number> {
  const db = await getLocalDatabase();
  const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`);
  return row?.count ?? 0;
}

export async function readSyncDebugSnapshot(): Promise<SyncDebugSnapshot> {
  const db = await getLocalDatabase();
  const cursors = await db.getAllAsync<{ chat_id: string; cursor: number }>(
    'SELECT chat_id, cursor FROM sync_state ORDER BY chat_id ASC',
  );

  return {
    chats: await countRows('cache_chats'),
    members: await countRows('cache_chat_members'),
    messages: await countRows('cache_messages'),
    media: await countRows('cache_message_media'),
    reactions: await countRows('cache_reactions'),
    cursors: cursors.map((row) => ({ chatId: row.chat_id, cursor: row.cursor })),
  };
}
