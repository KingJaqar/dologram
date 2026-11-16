'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { IndexedDbStore } from './IndexedDbStore';

type Snapshot<T> = { status: 'loading'; data: undefined; error: null } | { status: 'ready'; data: T; error: null } | { status: 'error'; data: T | undefined; error: string };
export function createStoreQuery<T>(store: IndexedDbStore, read: () => Promise<T>) {
  const initial: Snapshot<T> = { status: 'loading', data: undefined, error: null };
  let snapshot: Snapshot<T> = initial;
  let revision = 0;
  let active = false;
  const listeners = new Set<() => void>();
  const refresh = () => {
    const at = ++revision;
    void read().then((data) => {
      if (!active || at !== revision) return;
      snapshot = { status: 'ready', data, error: null };
      listeners.forEach((listener) => listener());
    }, () => {
      if (!active || at !== revision) return;
      snapshot = { status: 'error', data: snapshot.data, error: 'Could not read browser storage. Reload or retry after freeing storage.' };
      listeners.forEach((listener) => listener());
    });
  };
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start: () => { active = true; const unsubscribe = store.subscribe(refresh); refresh(); return () => { active = false; ++revision; unsubscribe(); }; },
    refresh,
  };
}
/** Memoize read at the caller; snapshots change only after committed invalidation/read. */
export function useStoreQuery<T>(store: IndexedDbStore, read: () => Promise<T>) {
  const query = useMemo(() => createStoreQuery(store, read), [store, read]);
  useEffect(() => query.start(), [query]);
  return { ...useSyncExternalStore(query.subscribe, query.getSnapshot, query.getServerSnapshot), retry: query.refresh };
}
