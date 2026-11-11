import type { SQLiteDatabase } from 'expo-sqlite';
import type { FolderChatRow, FolderRow } from '@dologram/shared';

export type LocalFolder = FolderRow & { chatIds: string[] };

function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

export async function loadCachedFolders(
  db: SQLiteDatabase,
  userId: string,
): Promise<LocalFolder[]> {
  const folders = await db.getAllAsync<FolderRow>(
    'SELECT folder_id, user_id, name FROM cache_folders WHERE user_id = ? ORDER BY folder_id',
    [userId],
  );
  if (folders.length === 0) return [];

  const links = await db.getAllAsync<FolderChatRow>(
    `SELECT folder_id, chat_id FROM cache_folder_chats WHERE folder_id IN (${placeholders(folders.length)})`,
    folders.map((folder) => folder.folder_id),
  );
  const chatsByFolder = new Map<string, string[]>();
  for (const link of links) {
    const chats = chatsByFolder.get(link.folder_id) ?? [];
    chats.push(link.chat_id);
    chatsByFolder.set(link.folder_id, chats);
  }
  return folders.map((folder) => ({
    ...folder,
    chatIds: chatsByFolder.get(folder.folder_id) ?? [],
  }));
}

/** Replaces only the signed-in user's folder cache; no other account's cache is touched. */
export async function replaceCachedFolders(
  db: SQLiteDatabase,
  userId: string,
  folders: readonly FolderRow[],
  folderChats: readonly FolderChatRow[],
): Promise<void> {
  await db.runAsync(
    `DELETE FROM cache_folder_chats
       WHERE folder_id IN (SELECT folder_id FROM cache_folders WHERE user_id = ?)`,
    [userId],
  );
  await db.runAsync('DELETE FROM cache_folders WHERE user_id = ?', [userId]);
  for (const folder of folders) {
    await db.runAsync(
      'INSERT INTO cache_folders (folder_id, user_id, name) VALUES (?, ?, ?)',
      [folder.folder_id, folder.user_id, folder.name],
    );
  }
  for (const link of folderChats) {
    if (folders.some((folder) => folder.folder_id === link.folder_id)) {
      await db.runAsync(
        'INSERT OR IGNORE INTO cache_folder_chats (folder_id, chat_id) VALUES (?, ?)',
        [link.folder_id, link.chat_id],
      );
    }
  }
}
