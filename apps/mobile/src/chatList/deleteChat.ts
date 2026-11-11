import { getLocalDatabase } from '../queue/db';
import { deleteCachedChat } from '../sync/localCache';
import { notifyCacheChange } from '../sync/cacheEvents';
import { updateChatListPreferences } from './preferences';

/** Deletion is private to this device. A resync must not restore the deleted list entry. */
export async function deleteChatFromDevice(userId: string, chatId: string): Promise<void> {
  await updateChatListPreferences(userId, chatId, { deleted: true, ignored: false, pinned: false, unread: false });
  // The durable visibility preference is the commit. Cache cleanup can be retried by sync;
  // failing after that commit would incorrectly tell the user their chat was not deleted.
  try { await deleteCachedChat(await getLocalDatabase(), chatId); } catch { /* Best effort. */ }
  notifyCacheChange();
}
