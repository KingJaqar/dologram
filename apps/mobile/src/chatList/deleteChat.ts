import { updateChatListPreferences } from './preferences';

/** Deletion is private to this device. A resync must not restore the deleted list entry. */
export async function deleteChatFromDevice(userId: string, chatId: string): Promise<void> {
  await updateChatListPreferences(userId, chatId, { deleted: true, ignored: false, pinned: false, unread: false });
}
