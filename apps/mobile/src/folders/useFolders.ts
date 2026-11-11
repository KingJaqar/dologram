import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  addChatToFolder,
  createFolder as createRemoteFolder,
  deleteFolder as deleteRemoteFolder,
  dgTrim,
  listMyFolderChats,
  listMyFolders,
  removeChatFromFolder,
  renameFolder as renameRemoteFolder,
  type ClassifiedError,
} from '@dologram/shared';
import { useAuth } from '../auth/AuthProvider';
import { ids } from '../lib/ids';
import { supabase } from '../lib/supabase';
import { getLocalDatabase } from '../queue/db';
import { notifyCacheChange, subscribeCacheChange } from '../sync/cacheEvents';
import { useNetState } from '../net/netState';
import { loadCachedFolders, replaceCachedFolders, type LocalFolder } from './cache';

export type FolderState = {
  folders: LocalFolder[];
  chatIdsByFolder: ReadonlyMap<string, readonly string[]>;
  loading: boolean;
  refreshing: boolean;
  error: boolean;
  reload: () => Promise<void>;
  refresh: () => Promise<boolean>;
  create: (name: string) => Promise<ClassifiedError | null>;
  rename: (folderId: string, name: string) => Promise<ClassifiedError | null>;
  remove: (folderId: string) => Promise<ClassifiedError | null>;
  setChats: (folderId: string, chatIds: readonly string[]) => Promise<ClassifiedError | null>;
};

function failure(error: ClassifiedError | null): ClassifiedError | null {
  return error;
}

const unexpectedFailure: ClassifiedError = { kind: 'server', code: null, status: null };

export function useFolders(): FolderState {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const net = useNetState();
  const [folders, setFolders] = useState<LocalFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const inflight = useRef(false);

  const readLocal = useCallback(async () => {
    if (!userId) {
      setFolders([]);
      setLoading(false);
      return;
    }
    const db = await getLocalDatabase();
    setFolders(await loadCachedFolders(db, userId));
    setLoading(false);
  }, [userId]);

  const refresh = useCallback(async (): Promise<boolean> => {
    if (!userId || inflight.current) return false;
    inflight.current = true;
    setRefreshing(true);
    try {
      await readLocal();
      if (!net.isConnected) {
        setError(false);
        return true;
      }
      const remoteFolders = await listMyFolders(supabase);
      if (remoteFolders.error) {
        setError(true);
        return false;
      }
      const remoteChats = await listMyFolderChats(supabase);
      if (remoteChats.error) {
        setError(true);
        return false;
      }
      const db = await getLocalDatabase();
      await replaceCachedFolders(db, userId, remoteFolders.data, remoteChats.data);
      setFolders(await loadCachedFolders(db, userId));
      setError(false);
      notifyCacheChange();
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      setRefreshing(false);
      inflight.current = false;
    }
  }, [net.isConnected, readLocal, userId]);

  const reload = useCallback(async () => {
    try {
      await readLocal();
    } catch {
      setError(true);
      setLoading(false);
    }
  }, [readLocal]);

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = subscribeCacheChange(() => void reload());
      void refresh();
      return unsubscribe;
    }, [refresh, reload]),
  );

  const create = useCallback(
    async (name: string): Promise<ClassifiedError | null> => {
      if (!userId || !net.isConnected) return { kind: 'network' };
      try {
        const result = await createRemoteFolder(supabase, {
          folder_id: ids.folderId(),
          user_id: userId,
          name: dgTrim(name),
        });
        if (result.error) return failure(result.error);
        await refresh();
        return null;
      } catch {
        return unexpectedFailure;
      }
    },
    [net.isConnected, refresh, userId],
  );

  const rename = useCallback(
    async (folderId: string, name: string): Promise<ClassifiedError | null> => {
      if (!net.isConnected) return { kind: 'network' };
      try {
        const result = await renameRemoteFolder(supabase, folderId, dgTrim(name));
        if (result.error) return failure(result.error);
        await refresh();
        return null;
      } catch {
        return unexpectedFailure;
      }
    },
    [net.isConnected, refresh],
  );

  const remove = useCallback(
    async (folderId: string): Promise<ClassifiedError | null> => {
      if (!net.isConnected) return { kind: 'network' };
      try {
        const result = await deleteRemoteFolder(supabase, folderId);
        if (result.error) return failure(result.error);
        await refresh();
        return null;
      } catch {
        return unexpectedFailure;
      }
    },
    [net.isConnected, refresh],
  );

  const setChats = useCallback(
    async (folderId: string, chatIds: readonly string[]): Promise<ClassifiedError | null> => {
      if (!net.isConnected) return { kind: 'network' };
      try {
        const current = folders.find((folder) => folder.folder_id === folderId)?.chatIds ?? [];
        const wanted = new Set(chatIds);
        const currentSet = new Set(current);
        for (const chatId of chatIds) {
          if (currentSet.has(chatId)) continue;
          const result = await addChatToFolder(supabase, folderId, chatId);
          if (result.error) return failure(result.error);
        }
        for (const chatId of current) {
          if (wanted.has(chatId)) continue;
          const result = await removeChatFromFolder(supabase, folderId, chatId);
          if (result.error) return failure(result.error);
        }
        await refresh();
        return null;
      } catch {
        return unexpectedFailure;
      }
    },
    [folders, net.isConnected, refresh],
  );

  const chatIdsByFolder = useMemo(() => {
    const map = new Map<string, readonly string[]>();
    for (const folder of folders) map.set(folder.folder_id, folder.chatIds);
    return map;
  }, [folders]);

  return { folders, chatIdsByFolder, loading, refreshing, error, reload, refresh, create, rename, remove, setChats };
}
