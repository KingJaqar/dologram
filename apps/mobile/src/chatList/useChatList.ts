/**
 * Chat list data for AND-03 and AND-04 (M2-08, F2, D-44, D-94).
 *
 * One read of the local cache feeds both screens and the archive count in the header. The list reloads when
 * the sync engine merges rows (a Realtime event or a finished pass), when the screen regains focus
 * and on pull to refresh, which runs a resync (6.4).
 */
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useFocusEffect } from 'expo-router';
import { buildChatList, type ChatListItem } from '@dologram/shared';
import { useAuth } from '../auth/AuthProvider';
import { getLocalDatabase } from '../queue/db';
import { subscribeCacheChange } from '../sync/cacheEvents';
import { resyncNow } from '../sync/lifecycle';
import { loadChatListRows } from './query';
import { loadChatListPreferences } from './preferences';
import { getStarredState, subscribeStarredState } from './starredState';
import { readStartupSnapshot, recentRowsByUser, saveStartupSnapshot, snapshotGeneration, type LoadedRows } from './startupSnapshot';
import { loadBlockedChatIds } from '../chats/preferences';
import { useMemos } from '../memos/useMemos';
import { combineMemoConversations } from '../memos/conversations';

export type ChatListData = {
  /** AND-03 rows in D-94 order; archived chats are left out. */
  active: ChatListItem[];
  /** AND-04 rows in D-94 order. */
  archived: ChatListItem[];
  ignored: ChatListItem[];
  /** Chats blocked locally on this device. */
  blocked: ChatListItem[];
  /** True until the first read of the cache resolves. */
  loading: boolean;
  /** A read failed; the last successful rows are still shown when there are any. */
  error: boolean;
  /** True while a pull-to-refresh resync runs. */
  refreshing: boolean;
  reload: () => Promise<void>;
  refresh: () => Promise<void>;
};

// MainHeader and the currently visible list screen both consume this hook. Share the actual
// cache read between them so navigation cannot briefly show two competing snapshots.
const pendingLoadsByUser = new Map<string, Promise<LoadedRows>>();

async function loadSnapshotForUser(userId: string): Promise<LoadedRows> {
  const key = `${snapshotGeneration()}:${userId}`;
  const pending = pendingLoadsByUser.get(key);
  if (pending) return pending;

  const request = (async () => {
    const [rows, nextPreferences] = await Promise.all([
      getLocalDatabase().then((db) => loadChatListRows(db, userId)),
      loadChatListPreferences(userId),
    ]);
    const blockedIds = await loadBlockedChatIds(userId, rows.map((row) => row.chat.chat_id));
    return {
      userId,
      rows: rows.filter((row) => !blockedIds.has(row.chat.chat_id)),
      blockedRows: rows.filter((row) => blockedIds.has(row.chat.chat_id)),
      preferences: nextPreferences,
    };
  })();

  pendingLoadsByUser.set(key, request);
  try {
    return await request;
  } finally {
    if (pendingLoadsByUser.get(key) === request) pendingLoadsByUser.delete(key);
  }
}

export function useChatList(folderChatIds?: readonly string[]): ChatListData {
  const memoRows = useMemos();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const starred = useSyncExternalStore(subscribeStarredState, getStarredState).get(userId ?? '');

  const [loaded, setLoaded] = useState<LoadedRows | null>(() => (
    userId && recentRowsByUser.has(userId)
      ? recentRowsByUser.get(userId) ?? null
      : null
  ));
  const [errorUserId, setErrorUserId] = useState<string | null>(null);
  const error = userId !== null && errorUserId === userId;
  const [refreshingUserId, setRefreshingUserId] = useState<string | null>(null);
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
    const generation = snapshotGeneration();
    let authoritative = false;
    // Only cold starts need disk hydration. Never let it replace a newer database read.
    const startup = recentRowsByUser.has(userId) ? Promise.resolve() : readStartupSnapshot(userId).then((snapshot) => {
      if (!snapshot || authoritative || snapshotGeneration() !== generation) return;
      const latest = recentRowsByUser.get(userId) ?? snapshot;
      recentRowsByUser.set(userId, latest);
      if (currentUserId.current === userId) setLoaded(latest);
    });
    try {
      do {
        reloadRequested.current.delete(userId);
        const snapshot = await loadSnapshotForUser(userId);
        authoritative = true;
        if (snapshotGeneration() !== generation) return;
        recentRowsByUser.set(userId, snapshot);
        saveStartupSnapshot(snapshot, generation);
        if (currentUserId.current === userId) {
          setLoaded(snapshot);
          setErrorUserId(null);
        }
      } while (reloadRequested.current.has(userId));
    } catch {
      await startup;
      if (currentUserId.current === userId && snapshotGeneration() === generation) setErrorUserId(userId);
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
    if (!userId) return;
    setRefreshingUserId(userId);
    try {
      await resyncNow();
    } catch {
      // A failed resync keeps the cached list; the next foreground pass or pull retries.
    } finally {
      setRefreshingUserId((current) => current === userId ? null : current);
      await reload();
    }
  }, [reload, userId]);

  // Rows of a previous account are never shown while the new account loads.
  const snapshot = userId !== null
    ? loaded?.userId === userId
      ? loaded
      : recentRowsByUser.get(userId) ?? null
    : null;
  const rows = snapshot?.rows ?? null;
  const blockedRows = snapshot?.blockedRows ?? null;
  const preferences = snapshot?.preferences;

  // Both lists are built from one read and one reference time, so a row cannot show two labels.
  const lists = useMemo(() => {
    if (rows === null || userId === null || !preferences) {
      return {
        active: [] as ChatListItem[],
        archived: [] as ChatListItem[],
        ignored: [] as ChatListItem[],
        blocked: [] as ChatListItem[],
      };
    }
    const now = new Date();
    const pinned = new Set(preferences.pinned);
    starred?.forEach((enabled, chatId) => {
      if (enabled) pinned.add(chatId);
      else pinned.delete(chatId);
    });
    const options = {
      userId,
      now,
      pinnedChatIds: [...pinned],
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
      blocked: blockedRows === null ? [] : buildChatList(blockedRows, { ...options, blocked: true }),
    };
  }, [blockedRows, folderChatIds, preferences, rows, starred, userId]);

  const conversations = useMemo(() => ({
    active: combineMemoConversations(lists.active, memoRows.memos.filter((memo) => memo.account_id === userId), 'active', folderChatIds),
    archived: combineMemoConversations(lists.archived, memoRows.memos.filter((memo) => memo.account_id === userId), 'archived'),
    ignored: combineMemoConversations(lists.ignored, memoRows.memos.filter((memo) => memo.account_id === userId), 'ignored'),
    blocked: lists.blocked,
  }), [lists, memoRows.memos, folderChatIds, userId]);

  return {
    ...conversations,
    loading: rows === null && blockedRows === null && !error,
    error,
    refreshing: userId !== null && refreshingUserId === userId,
    reload,
    refresh,
  };
}
