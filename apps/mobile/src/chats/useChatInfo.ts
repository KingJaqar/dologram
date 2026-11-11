/**
 * Data for AND-12 (M2-07, D-91).
 *
 * One cache read per reload, repeated when the sync engine merges rows and when the screen regains
 * focus. A chat that is not cached (removed, or not synced yet) reports `notFound` so the screen can
 * offer Retry, which runs a resync first.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { buildChatInfo, type ChatInfoModel, type ChatMemberRow } from '@dologram/shared';
import { useAuth } from '../auth/AuthProvider';
import { getLocalDatabase } from '../queue/db';
import { subscribeCacheChange } from '../sync/cacheEvents';
import { resyncNow } from '../sync/lifecycle';
import { loadChatInfoSource } from './infoQuery';

export type ChatInfoData = {
  loading: boolean;
  error: boolean;
  /** Cached chat info, or null when the chat is not in the cache. */
  info: ChatInfoModel | null;
  reload: () => Promise<void>;
  /** Resyncs and reloads; used by Retry and after a membership change. */
  refresh: () => Promise<void>;
  applyMember: (member: ChatMemberRow) => void;
};

type Loaded = { chatId: string; userId: string; info: ChatInfoModel | null };

export function useChatInfo(chatId: string | undefined): ChatInfoData {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [errorScope, setErrorScope] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const request = useRef(0);
  const scope = `${userId}:${chatId}`;
  const error = errorScope === scope;
  const currentScope = useRef(scope);
  currentScope.current = scope;

  const reload = useCallback(async () => {
    if (!chatId || !userId) return;
    const generation = ++request.current;
    try {
      const db = await getLocalDatabase();
      const source = await loadChatInfoSource(db, chatId);
      if (generation !== request.current || currentScope.current !== scope) return;
      setLoaded({
        chatId,
        userId,
        info:
          source.chat === null
            ? null
            : buildChatInfo({
                chat: source.chat,
                members: source.members,
                profiles: source.profiles,
                userId,
              }),
      });
      setErrorScope(null);
    } catch {
      if (generation === request.current && currentScope.current === scope) setErrorScope(scope);
    }
  }, [chatId, userId, scope]);

  useEffect(() => subscribeCacheChange(() => void reload()), [reload]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await resyncNow();
    } catch {
      // A failed resync keeps the cached chat; Retry stays available.
    } finally {
      setRefreshing(false);
      await reload();
    }
  }, [refreshing, reload]);

  const matches = loaded !== null && loaded.chatId === chatId && loaded.userId === userId;
  const info = matches ? loaded.info : null;

  const applyMember = useCallback((member: ChatMemberRow) => {
    if (member.user_id !== userId || member.chat_id !== chatId) return;
    // Invalidate older reads so they cannot undo the confirmed mutation.
    ++request.current;
    setLoaded((current) => current?.userId === userId && current.chatId === chatId && current.info ? {
      ...current,
      info: {
        ...current.info,
        archived: member.archived,
        muted: member.muted_until === 'infinity' || (member.muted_until !== null && Date.parse(member.muted_until) > Date.now()),
      },
    } : current);
  }, [chatId, userId]);

  return {
    loading: !matches && !error,
    error,
    info,
    reload,
    refresh,
    applyMember,
  };
}
