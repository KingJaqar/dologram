/**
 * Device-local data removal for sign-out (AND-14, D-109).
 *
 * The queue and sync lifecycles are stopped before their shared SQLite connection is cleared.
 * Device preferences remain intact: theme and Low Signal Mode are per-device settings, not
 * account data (D-83, F8).
 */
import { deleteQueuedAttachmentFiles } from '../queue/attachmentFiles';
import { getLocalDatabase } from '../queue/db';
import { createSqliteQueueStore } from '../queue/store';
import { stopQueueWorker } from '../queue/worker';
import { notifyQueueChange } from '../queue/events';
import { notifyCacheChange } from '../sync/cacheEvents';
import { stopSync } from '../sync/lifecycle';

const CLEAR_LOCAL_DATA_SQL = `
DELETE FROM cache_folder_chats;
DELETE FROM cache_folders;
DELETE FROM pending_read_states;
DELETE FROM cache_reactions;
DELETE FROM cache_message_media;
DELETE FROM cache_messages;
DELETE FROM cache_chat_members;
DELETE FROM cache_chats;
DELETE FROM cache_profiles;
DELETE FROM sync_state;
DELETE FROM queue_items;
`;

/** Removes queue attachment copies and all account-scoped queue/cache/sync rows. */
export async function clearLocalData(): Promise<void> {
  stopQueueWorker();
  stopSync();

  const db = await getLocalDatabase();
  const queue = createSqliteQueueStore(db);
  const queuedItems = [...(await queue.listUnsent()), ...(await queue.listSent())];

  await deleteQueuedAttachmentFiles(queuedItems);
  await db.execAsync(CLEAR_LOCAL_DATA_SQL);
  notifyQueueChange();
  notifyCacheChange();
}
