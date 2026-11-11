/**
 * Sync lifecycle (M2-05, 6.4, 7.1 Channel drops, D-40, D-43, D-91).
 *
 * The engine runs only for a signed-in user, only while the app is in the foreground and the
 * device reports a connection. Entering the foreground or regaining a connection re-subscribes
 * the Realtime channel and runs a full resync, so a dropped channel or a backgrounded app cannot
 * leave the cache behind. A background app unsubscribes; the queue worker keeps its own schedule.
 */
import { AppState } from 'react-native';
import { config, createSyncEngine, type SyncEngine, type SyncSummary } from '@dologram/shared';
import { supabase } from '../lib/supabase';
import { subscribeNetState } from '../net/netState';
import { getLocalDatabase } from '../queue/db';
import { notifyCacheChange } from './cacheEvents';
import { createSqliteCacheStore } from './cacheStore';
import { createSupabaseDelivery, createSupabaseSyncSource } from './source';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error';

export type SyncStatus = {
  state: SyncState;
  /** Result of the last completed pass; null before the first one or after a hard failure. */
  summary: SyncSummary | null;
};

export type SyncHandle = { stop: () => void };

let currentStatus: SyncStatus = { state: 'idle', summary: null };
const statusListeners = new Set<(status: SyncStatus) => void>();

export function getSyncStatus(): SyncStatus {
  return currentStatus;
}

export function subscribeSyncStatus(listener: (status: SyncStatus) => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

function setSyncStatus(next: SyncStatus): void {
  currentStatus = next;
  for (const listener of statusListeners) listener(next);
}

let activeHandle: SyncHandle | null = null;
let activeEngine: SyncEngine | null = null;

/** Enqueues one catch-up pass on the running engine; used by the dev-tools screen (D-160). */
export async function resyncNow(): Promise<void> {
  const engine = activeEngine;
  if (!engine) return;
  setSyncStatus({ state: 'syncing', summary: currentStatus.summary });
  try {
    const summary = await engine.resyncAll();
    setSyncStatus({ state: summary.failed > 0 ? 'error' : 'synced', summary });
  } catch {
    setSyncStatus({ state: 'error', summary: null });
  } finally {
    notifyCacheChange();
  }
}

export function startSync(): SyncHandle {
  if (activeHandle) return activeHandle;

  let stopped = false;
  let starting = false;
  let foreground = AppState.currentState === 'active';
  let connected = false;
  let engine: SyncEngine | null = null;

  function stop(): void {
    if (stopped) return;
    stopped = true;
    engine?.stop();
    unsubscribeNet();
    appStateSubscription.remove();
    activeEngine = null;
    if (activeHandle === handle) activeHandle = null;
    setSyncStatus({ state: 'idle', summary: null });
  }

  const handle: SyncHandle = { stop };
  activeHandle = handle;

  async function run(): Promise<void> {
    if (stopped || starting || !foreground || !connected || !engine) return;
    starting = true;
    setSyncStatus({ state: 'syncing', summary: currentStatus.summary });
    try {
      const summary = await engine.start();
      if (!stopped) {
        setSyncStatus({ state: summary.failed > 0 ? 'error' : 'synced', summary });
      }
    } catch {
      if (!stopped) setSyncStatus({ state: 'error', summary: null });
    } finally {
      starting = false;
      // The chat list reads the same database, so a finished pass repaints it (M2-08).
      notifyCacheChange();
    }
  }

  const unsubscribeNet = subscribeNetState((state) => {
    const wasConnected = connected;
    connected = state.isConnected;
    if (!stopped && connected && !wasConnected) void run();
  });

  const appStateSubscription = AppState.addEventListener('change', (next) => {
    const wasForeground = foreground;
    foreground = next === 'active';
    if (stopped) return;
    if (!foreground) {
      // 6.4: the channel and its events are only needed while the chat list is usable.
      engine?.stop();
      return;
    }
    if (!wasForeground) void run();
  });

  getLocalDatabase()
    .then((db) => {
      if (stopped) return;
      engine = createSyncEngine({
        store: createSqliteCacheStore(db),
        source: createSupabaseSyncSource(supabase),
        delivery: createSupabaseDelivery(supabase),
        pageSize: config.sync.pageSize,
        onError: () => {
          if (!stopped) setSyncStatus({ state: 'error', summary: currentStatus.summary });
        },
        onChange: () => notifyCacheChange(),
      });
      activeEngine = engine;
      void run();
    })
    .catch(() => {
      if (!stopped) setSyncStatus({ state: 'error', summary: null });
    });

  return handle;
}

/** Stops the process-wide sync lifecycle before local data is wiped (D-109). */
export function stopSync(): void {
  activeHandle?.stop();
}
