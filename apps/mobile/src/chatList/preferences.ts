import AsyncStorage from '@react-native-async-storage/async-storage';
import { notifyCacheChange } from '../sync/cacheEvents';

/** Per-account, per-device organization; server read receipts remain monotonic. */
export type ChatListPreferences = {
  pinned: string[];
  ignored: string[];
  unread: string[];
  deleted: string[];
};
export type ChatListPreference = keyof ChatListPreferences;
const STORAGE_KEY = 'dg.chatListPreferences';
let writes: Promise<unknown> = Promise.resolve();

function normalize(value: unknown): ChatListPreferences {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const ids = (key: ChatListPreference): string[] => Array.isArray(record[key])
    ? record[key].filter((id): id is string => typeof id === 'string') : [];
  return { pinned: ids('pinned'), ignored: ids('ignored'), unread: ids('unread'), deleted: ids('deleted') };
}

async function readAll(): Promise<Record<string, unknown>> {
  const value = await AsyncStorage.getItem(STORAGE_KEY);
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export async function loadChatListPreferences(userId: string): Promise<ChatListPreferences> {
  await writes;
  return normalize((await readAll())[userId]);
}

/** Serialize read/modify/write so actions from mounted screens cannot overwrite each other. */
export function updateChatListPreferences(
  userId: string,
  chatId: string,
  patch: Partial<Record<ChatListPreference, boolean>>,
): Promise<ChatListPreferences> {
  const operation = writes.then(async () => {
    const all = await readAll();
    const current = normalize(all[userId]);
    let changed = false;
    for (const key of Object.keys(patch) as ChatListPreference[]) {
      const ids = new Set(current[key]);
      if (ids.has(chatId) === patch[key]) continue;
      if (patch[key]) ids.add(chatId);
      else ids.delete(chatId);
      current[key] = [...ids];
      changed = true;
    }
    if (changed) {
      all[userId] = current;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      notifyCacheChange();
    }
    return current;
  });
  writes = operation.catch(() => {});
  return operation;
}

export function setChatListPreference(userId: string, chatId: string, preference: ChatListPreference, enabled: boolean) {
  return updateChatListPreferences(userId, chatId, { [preference]: enabled });
}
