import { afterEach, expect, it, vi } from 'vitest';
import type { DgClient, SyncCacheStore, SyncSource } from '@dologram/shared';
import type { IndexedDbStore } from '../store/IndexedDbStore';
import type { WorkerLease } from '../worker/leader';
import { BrowserSyncHost, type SyncStatus } from './host';

afterEach(() => vi.useRealTimers());
it('bounds refused join diagnostics to four backoff attempts and cancels all timers on stop', async () => {
  vi.useFakeTimers();
  const noop = async () => {};
  const cache: SyncCacheStore = { init: noop, upgradeCheckpoints: noop, getCursor: async () => 0, setCursor: noop,
    hasChat: async () => false, listChatIds: async () => [], upsertChat: noop, upsertMember: noop, upsertMessage: noop,
    upsertMedia: noop, upsertReaction: noop, upsertProfile: noop, replaceMembers: noop, deleteChat: noop };
  const store = { syncStore: () => cache } as unknown as IndexedDbStore;
  const source: SyncSource = { fetchChats: async () => ({ data: [], error: null }), fetchChat: async () => ({ data: null, error: null }),
    fetchMembers: async () => ({ data: [], error: null }), fetchProfiles: async () => ({ data: [], error: null }),
    fetchMessagesAfter: async () => ({ data: [], error: null }), fetchMediaAfter: async () => ({ data: [], error: null }), fetchReactionsAfter: async () => ({ data: [], error: null }) };
  const controller = new AbortController(); const statuses: SyncStatus[] = [];
  const lease: WorkerLease = { owner: 'a', epoch: 'epoch', signal: controller.signal, current: () => !controller.signal.aborted, run: (work) => work(controller.signal, () => !controller.signal.aborted) };
  const subscriptions = vi.fn();
  const host = new BrowserSyncHost(store, lease, {} as DgClient, (status) => statuses.push(status), () => true,
    { connected: () => true, subscribe: () => () => {} },
    { source: () => source, metadata: noop, delivery: () => ({ subscribe: (handlers) => { subscriptions(); handlers.onStatus('disconnected'); return () => {}; } }) });
  host.start(); await vi.advanceTimersByTimeAsync(0); expect(subscriptions).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(15_000); expect(subscriptions).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(30_000); expect(subscriptions).toHaveBeenCalledTimes(3);
  await vi.advanceTimersByTimeAsync(60_000); expect(subscriptions).toHaveBeenCalledTimes(4);
  await vi.advanceTimersByTimeAsync(120_000); expect(subscriptions).toHaveBeenCalledTimes(5);
  expect(statuses.at(-1)).toBe('paused');
  await vi.advanceTimersByTimeAsync(240_000); expect(subscriptions).toHaveBeenCalledTimes(5);
  controller.abort(); host.stop(); expect(vi.getTimerCount()).toBe(0);
});
