/**
 * Sync lifecycle (M2-05, 6.4, 7.1 Channel drops, D-40, D-43, D-91).
 *
 * The engine runs only for a signed-in user, only while the app is in the foreground and the
 * device reports a connection. Entering the foreground or regaining a connection re-subscribes
 * the Realtime channel and runs a full resync, so a dropped channel or a backgrounded app cannot
 * leave the cache behind. A background app unsubscribes; the queue worker keeps its own schedule.
 */
import { AppState } from 'react-native';
import { config, createSyncEngine, markChatRead as persistChatRead, type SyncEngine, type SyncSummary } from '@dologram/shared';
import { supabase } from '../lib/supabase';
import { subscribeNetState } from '../net/netState';
import { getLocalDatabase } from '../queue/db';
import { notifyCacheChange } from './cacheEvents';
import { createSqliteCacheStore } from './cacheStore';
import { createSupabaseDelivery, createSupabaseSyncSource } from './source';
import { flushPendingReadStates } from '../chat/readState';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error';

export type SyncStatus = {
  state: SyncState;
  /** Result of the last completed pass; null before the first one or after a hard failure. */
  summary: SyncSummary | null;
};

export type SyncHandle = { stop: () => void; pause: () => () => void };

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
    if (engine === activeEngine) setSyncStatus({ state: summary.failed > 0 ? 'error' : 'synced', summary });
  } catch {
    if (engine === activeEngine) setSyncStatus({ state: 'error', summary: null });
  } finally {
    if (engine === activeEngine) notifyCacheChange();
  }
}

export async function resyncChatNow(chatId: string): Promise<void> {
  const engine = activeEngine;
  if (!engine) return;
  await engine.resyncChat(chatId);
  if (engine === activeEngine) notifyCacheChange();
}

export function startSync(userId: string): SyncHandle {
  if (activeHandle) return activeHandle;

  let stopped = false;
  let paused = false;
  let starting = false;
  let runRequested = false;
  const readRetryBudget = new Map<string, { attempts: number; lastReason: string | null; consecutiveFailures: number }>();
  let foreground = AppState.currentState === 'active';
  let connected = false;
  let engine: SyncEngine | null = null;
  let localDb: Awaited<ReturnType<typeof getLocalDatabase>> | null = null;

  function stop(): void {
    if (stopped) return;
    stopped = true;
    engine?.stop();
    readRetryBudget.clear();
    unsubscribeNet();
    appStateSubscription.remove();
    activeEngine = null;
    if (activeHandle === handle) activeHandle = null;
    setSyncStatus({ state: 'idle', summary: null });
  }

  const handle: SyncHandle = {
    stop,
    pause() {
      paused = true;
      engine?.stop();
      activeEngine = null;
      return () => {
        if (stopped) return;
        paused = false;
        activeEngine = engine;
        void run();
      };
    },
  };
  activeHandle = handle;

  async function run(): Promise<void> {
    if (stopped || paused || !foreground || !connected || !engine) return;
    if (starting) {
      runRequested = true;
      return;
    }
    starting = true;
    setSyncStatus({ state: 'syncing', summary: currentStatus.summary });
    try {
      const summary = await engine.start();
      if (!stopped && !paused && localDb && foreground && connected) {
        await flushPendingReadStates(
          localDb,
          userId,
          (chatId, seq, membershipJoinedAt, signal) => persistChatRead(supabase, chatId, seq, membershipJoinedAt, signal),
          async () => false,
          {
            isActive: () => !stopped && !paused && foreground && connected,
            retryBudget: readRetryBudget,
            onMembershipChanged: async (chatId) => {
              if (!stopped && !paused && engine) await engine.resyncChat(chatId);
            },
          },
        );
      }
      if (!stopped && !paused) {
        setSyncStatus({ state: summary.failed > 0 ? 'error' : 'synced', summary });
      }
    } catch {
      if (!stopped && !paused) setSyncStatus({ state: 'error', summary: null });
    } finally {
      starting = false;
      // The chat list reads the same database, so a finished pass repaints it (M2-08).
      if (!stopped && !paused) notifyCacheChange();
      if (runRequested) {
        runRequested = false;
        void run();
      }
    }
  }

  const unsubscribeNet = subscribeNetState((state) => {
    const wasConnected = connected;
    connected = state.isConnected;
    if (!stopped && connected && !wasConnected) {
      readRetryBudget.clear();
      void run();
    }
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
    if (!wasForeground) {
      readRetryBudget.clear();
      void run();
    }
  });

  getLocalDatabase()
    .then((db) => {
      if (stopped) return;
      localDb = db;
      engine = createSyncEngine({
        store: createSqliteCacheStore(db, userId),
        source: createSupabaseSyncSource(supabase, userId),
        delivery: createSupabaseDelivery(supabase),
        pageSize: config.sync.pageSize,
        onError: () => {
          if (!stopped) setSyncStatus({ state: 'error', summary: currentStatus.summary });
        },
        onChange: () => notifyCacheChange(),
        onMetadataChange: notifyCacheChange,
      });
      if (!paused) activeEngine = engine;
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

export function pauseSyncForAccountSwitch(): () => void {
  return activeHandle?.pause() ?? (() => {});
}
