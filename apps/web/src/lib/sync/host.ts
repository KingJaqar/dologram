import { createSyncEngine, type DgClient, type SyncDelivery, type SyncEngine, type SyncSource } from '@dologram/shared';
import { createSupabaseDelivery } from '@dologram/shared/src/sync/supabase';
import type { IndexedDbStore } from '../store/IndexedDbStore';
import type { WorkerLease } from '../worker/leader';
import { webConnectivity } from '../queue/webConnectivity';
import { browserSource } from './source';
import { refreshMetadata } from './metadata';

export type SyncStatus = 'syncing' | 'synced' | 'degraded' | 'offline' | 'paused';
type SyncDependencies = {
  source: (signal: AbortSignal, current: () => boolean) => SyncSource;
  delivery: () => SyncDelivery;
  metadata: (signal: AbortSignal, current: () => boolean) => Promise<void>;
};
/** Runs within the queue worker's existing lease; it never competes for a second owner. */
export class BrowserSyncHost {
  private stopped = false;
  private engine: SyncEngine | undefined;
  private controller: AbortController | undefined;
  private running: Promise<void> | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private failures = 0;
  private needsRetry = false;
  private restartRequested = false;
  private joined = false;
  private unnetwork: (() => void) | undefined;
  private dependencies: SyncDependencies;
  constructor(private readonly store: IndexedDbStore, private readonly lease: WorkerLease, client: DgClient,
    private readonly report: (status: SyncStatus) => void, private readonly valid: () => boolean,
    private readonly connectivity = webConnectivity, dependencies?: SyncDependencies) {
    this.dependencies = dependencies ?? {
      source: (signal, current) => browserSource(client, store.owner, signal, current),
      delivery: () => createSupabaseDelivery(client),
      metadata: (signal, current) => refreshMetadata(client, store, signal, current),
    };
  }
  private current = () => !this.stopped && this.lease.current() && this.valid() && !this.controller?.signal.aborted;
  start() {
    this.lease.signal.addEventListener('abort', this.stop, { once: true });
    this.unnetwork = this.connectivity.subscribe(this.network);
    this.network();
  }
  private network = () => {
    if (!this.connectivity.connected()) {
      this.controller?.abort(); this.engine?.stop(); this.engine = undefined;
      clearTimeout(this.timer); this.timer = undefined; this.report('offline'); return;
    }
    this.failures = 0;
    if (this.running) this.restartRequested = true;
    else this.wake();
  };
  private wake = () => {
    if (this.running || !this.lease.current() || !this.valid() || this.stopped || !this.connectivity.connected()) return;
    clearTimeout(this.timer); this.timer = undefined;
    this.running = this.lease.run(() => this.run()).catch(() => { if (!this.stopped && this.lease.current()) this.report('paused'); }).finally(() => { this.running = undefined; if (this.restartRequested) { this.restartRequested = false; this.needsRetry = false; this.wake(); } else if (this.needsRetry) { this.needsRetry = false; this.schedule(); } });
  };
  private async run() {
    this.controller?.abort(); this.engine?.stop();
    const controller = new AbortController(); this.controller = controller;
    const signal = AbortSignal.any([this.lease.signal, controller.signal]);
    const current = () => this.current() && this.controller === controller && !controller.signal.aborted && this.connectivity.connected();
    this.joined = false;
    let unsubscribe: (() => void) | undefined;
    const delivery = this.dependencies.delivery();
    const wrapped: SyncDelivery = { subscribe: (handlers) => {
      const joinTimer = setTimeout(() => { if (current() && !this.joined) { unsubscribe?.(); this.report('degraded'); this.schedule(); } }, 10_000);
      unsubscribe = delivery.subscribe({ ...handlers, onStatus: (status) => {
        if (!current()) return;
        clearTimeout(joinTimer);
        this.joined = status === 'connected';
        if (!this.joined) { unsubscribe?.(); this.report('degraded'); this.schedule(); }
        else {
          handlers.onStatus(status);
          // A delayed join must also reconcile metadata and publish the recovered state.
          if (!this.running) void this.lease.run(async () => {
            const summary = await this.engine?.resyncAll();
            if (!current()) return;
            await this.dependencies.metadata(signal, current);
            if (!current()) return;
            if (summary && summary.failed === 0) { clearTimeout(this.timer); this.timer = undefined; this.failures = 0; this.needsRetry = false; this.report('synced'); }
            else { this.report('degraded'); this.schedule(); }
          }).catch(() => { if (current()) { this.report('degraded'); this.schedule(); } });
        }
      } });
      return () => { clearTimeout(joinTimer); unsubscribe?.(); };
    } };
    this.engine = createSyncEngine({ store: this.store.syncStore(current), source: this.dependencies.source(signal, current),
      delivery: wrapped, pageSize: 500, maxPages: 100,
      onError: () => { if (current()) { this.report('degraded'); this.schedule(); } } });
    const deadline = setTimeout(() => { controller.abort(); this.engine?.stop(); if (!this.stopped && this.lease.current()) { this.report('degraded'); this.needsRetry = true; } }, 120_000);
    this.report('syncing');
    try {
      const summary = await this.engine.start();
      if (!current()) return;
      await this.dependencies.metadata(signal, current);
      if (!current()) return;
      if (summary.failed > 0 || !this.joined) { this.report('degraded'); this.schedule(); }
      else { clearTimeout(this.timer); this.timer = undefined; this.report('synced'); this.failures = 0; this.needsRetry = false; }
    } catch { if (!this.stopped && this.lease.current()) { this.report('degraded'); this.schedule(); } }
    finally { clearTimeout(deadline); }
  }
  private schedule() {
    if (this.stopped || !this.lease.current() || !this.valid() || !this.connectivity.connected()) return;
    if (this.running) { this.needsRetry = true; return; }
    if (this.timer) return;
    if (this.failures >= 4) { this.engine?.stop(); this.report('paused'); return; }
    const delay = 15_000 * 2 ** this.failures++;
    this.timer = setTimeout(() => { this.timer = undefined; if (this.running) this.schedule(); else this.wake(); }, delay);
  }
  stop = () => {
    this.stopped = true; this.controller?.abort(); this.engine?.stop(); clearTimeout(this.timer);
    this.unnetwork?.(); this.lease.signal.removeEventListener('abort', this.stop);
  };
}
