/**
 * Chat list data for AND-03 and AND-04 (M2-08, F2, D-44, D-94).
 *
 * One read of the local cache feeds both screens and the archive count in the header. The list reloads when
 * the sync engine merges rows (a Realtime event or a finished pass), when the screen regains focus
 * and on pull to refresh, which runs a resync (6.4).
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { buildChatList, type ChatListItem, type ChatListSourceRow } from '@dologram/shared';
import { useAuth } from '../auth/AuthProvider';
import { getLocalDatabase } from '../queue/db';
import { subscribeCacheChange } from '../sync/cacheEvents';
import { resyncNow } from '../sync/lifecycle';
import { loadChatListRows } from './query';
import { loadChatListPreferences, type ChatListPreferences } from './preferences';
import { loadChatPreferences } from '../chats/preferences';

export type ChatListData = {
  /** AND-03 rows in D-94 order; archived chats are left out. */
  active: ChatListItem[];
  /** AND-04 rows in D-94 order. */
  archived: ChatListItem[];
  ignored: ChatListItem[];
  /** True until the first read of the cache resolves. */
  loading: boolean;
  /** A read failed; the last successful rows are still shown when there are any. */
  error: boolean;
  /** True while a pull-to-refresh resync runs. */
  refreshing: boolean;
  reload: () => Promise<void>;
  refresh: () => Promise<void>;
};

type LoadedRows = { userId: string; rows: ChatListSourceRow[]; preferences: ChatListPreferences };

// Keep the most recent local snapshot in memory so returning to the tab is instant. The cache is
// keyed by account, so one user's chats can never be rendered for another account.
const recentRowsByUser = new Map<string, LoadedRows>();
// MainHeader and the currently visible list screen both consume this hook. Share the actual
// cache read between them so navigation cannot briefly show two competing snapshots.
const pendingLoadsByUser = new Map<string, Promise<LoadedRows>>();

async function loadSnapshotForUser(userId: string): Promise<LoadedRows> {
  const pending = pendingLoadsByUser.get(userId);
  if (pending) return pending;

  const request = (async () => {
    const db = await getLocalDatabase();
    const rows = await loadChatListRows(db, userId);
    const nextPreferences = await loadChatListPreferences(userId);
    const chatPreferences = await Promise.all(
      rows.map((row) => loadChatPreferences(userId, row.chat.chat_id)),
    );
    const blockedIds = new Set(
      rows
        .filter((_, index) => chatPreferences[index]?.blocked)
        .map((row) => row.chat.chat_id),
    );
    return {
      userId,
      rows: rows.filter((row) => !blockedIds.has(row.chat.chat_id)),
      preferences: nextPreferences,
    };
  })();

  pendingLoadsByUser.set(userId, request);
  try {
    return await request;
  } finally {
    if (pendingLoadsByUser.get(userId) === request) pendingLoadsByUser.delete(userId);
  }
}

export function useChatList(folderChatIds?: readonly string[]): ChatListData {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [loaded, setLoaded] = useState<LoadedRows | null>(() => (
    userId && recentRowsByUser.has(userId)
      ? recentRowsByUser.get(userId) ?? null
      : null
  ));
  const [errorUserId, setErrorUserId] = useState<string | null>(null);
  const error = userId !== null && errorUserId === userId;
  const [refreshing, setRefreshing] = useState(false);
  const inflight = useRef(new Set<string>());
  const reloadRequested = useRef(new Set<string>());
  const currentUserId = useRef(userId);
  currentUserId.current = userId;

  const reload = useCallback(async () => {
    if (!userId) return;
    if (inflight.current.has(userId)) {
      reloadRequested.current.add(userId);
      return;
    }
    inflight.current.add(userId);
    try {
      do {
        reloadRequested.current.delete(userId);
        const snapshot = await loadSnapshotForUser(userId);
        recentRowsByUser.set(userId, snapshot);
        if (currentUserId.current === userId) {
          setLoaded(snapshot);
          setErrorUserId(null);
        }
      } while (reloadRequested.current.has(userId));
    } catch {
      if (currentUserId.current === userId) setErrorUserId(userId);
    } finally {
      inflight.current.delete(userId);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      // Retained, hidden sections catch up on focus instead of rebuilding all three
      // lists for every cache event while another section is animating.
      const unsubscribe = subscribeCacheChange(() => void reload());
      void reload();
      return unsubscribe;
    }, [reload]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await resyncNow();
    } catch {
      // A failed resync keeps the cached list; the next foreground pass or pull retries.
    } finally {
      setRefreshing(false);
      await reload();
    }
  }, [reload]);

  // Rows of a previous account are never shown while the new account loads.
  const snapshot = userId !== null
    ? loaded?.userId === userId
      ? loaded
      : recentRowsByUser.get(userId) ?? null
    : null;
  const rows = snapshot?.rows ?? null;
  const preferences = snapshot?.preferences;

  // Both lists are built from one read and one reference time, so a row cannot show two labels.
  const lists = useMemo(() => {
    if (rows === null || userId === null || !preferences) {
      return { active: [] as ChatListItem[], archived: [] as ChatListItem[], ignored: [] as ChatListItem[] };
    }
    const now = new Date();
    const options = {
      userId,
      now,
      pinnedChatIds: preferences.pinned,
      ignoredChatIds: preferences.ignored,
      unreadChatIds: preferences.unread,
      deletedChatIds: preferences.deleted,
    };
    const active = buildChatList(rows, options);
    const visibleActive = folderChatIds
      ? active.filter((item) => folderChatIds.includes(item.chatId))
      : active;
    return {
      active: visibleActive,
      archived: buildChatList(rows, { ...options, archived: true }),
      ignored: buildChatList(rows, { ...options, ignored: true }),
    };
  }, [folderChatIds, preferences, rows, userId]);

  return {
    active: lists.active,
    archived: lists.archived,
    ignored: lists.ignored,
    loading: rows === null && !error,
    error,
    refreshing,
    reload,
    refresh,
  };
}
