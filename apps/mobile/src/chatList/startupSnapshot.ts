import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChatListSourceRow } from '@dologram/shared';
import type { ChatListPreferences } from './preferences';
import { clearStarredState } from './starredState';

export type LoadedRows = {
  userId: string;
  rows: ChatListSourceRow[];
  blockedRows: ChatListSourceRow[];
  preferences: ChatListPreferences;
};

export const CHAT_LIST_SNAPSHOT_PREFIX = 'dg.chatListSnapshot.v1:';
export const recentRowsByUser = new Map<string, LoadedRows>();
/** Process-local: a fresh app launch shows the loader once, even with a disk snapshot. */
export const chatListLaunches = new Set<string>();
let generation = 0;
let writes: Promise<unknown> = Promise.resolve();
export const snapshotGeneration = () => generation;

/** A small independent read can finish while SQLite is opening or merging sync rows. */
export async function readStartupSnapshot(userId: string): Promise<LoadedRows | null> {
  try {
    const value = await AsyncStorage.getItem(CHAT_LIST_SNAPSHOT_PREFIX + userId);
    if (!value) return null;
    const snapshot: LoadedRows = JSON.parse(value);
    if (snapshot.userId !== userId || !Array.isArray(snapshot.rows)
      || !Array.isArray(snapshot.blockedRows) || !snapshot.preferences) return null;
    for (const key of ['pinned', 'ignored', 'unread', 'deleted'] as const) {
      if (!Array.isArray(snapshot.preferences[key])
        || !snapshot.preferences[key].every((id) => typeof id === 'string')) return null;
    }
    for (const row of [...snapshot.rows, ...snapshot.blockedRows]) {
      if (!row?.chat || typeof row.chat.chat_id !== 'string'
        || row.myMember?.user_id !== userId || row.myMember.chat_id !== row.chat.chat_id) return null;
    }
    return snapshot;
  } catch {
    return null;
  }
}

/** Persistence is best effort and never delays displaying fresh local rows. */
export function saveStartupSnapshot(snapshot: LoadedRows, expectedGeneration: number): void {
  writes = writes.catch(() => undefined).then(async () => {
    if (generation !== expectedGeneration) return;
    await AsyncStorage.setItem(CHAT_LIST_SNAPSHOT_PREFIX + snapshot.userId, JSON.stringify(snapshot));
  }).catch(() => undefined);
}

export async function clearChatListSnapshots(): Promise<void> {
  generation += 1;
  clearStarredState();
  recentRowsByUser.clear();
  chatListLaunches.clear();
  await writes;
  const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(CHAT_LIST_SNAPSHOT_PREFIX));
  if (keys.length) await AsyncStorage.multiRemove(keys);
}
