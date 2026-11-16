export type WorkerLease = {
  owner: string;
  epoch: string;
  signal: AbortSignal;
  current: () => boolean;
  /** Work must honor signal; the lock is retained until all started work has settled. */
  run: <T>(work: (signal: AbortSignal, current: () => boolean) => Promise<T>) => Promise<T>;
};
export class WorkerLeader {
  private stopped = true;
  private pending: AbortController | undefined;
  private active: AbortController | undefined;
  private release: (() => void) | undefined;
  private request: Promise<void> | undefined;
  private generation = 0;
  private lease: WorkerLease | undefined;

  constructor(private readonly owner: string, private readonly epoch: string,
    private readonly acquired: (lease: WorkerLease) => Promise<void>,
    private readonly failed: (error: unknown) => void,
    private readonly locks: LockManager = navigator.locks,
    private readonly visibility: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'> = document) {}

  current = () => this.lease?.current() === true;
  start() {
    if (!this.stopped) return;
    if (!this.locks) throw new Error('This browser cannot safely coordinate DoloGram tabs. Use a browser with Web Locks enabled.');
    if (typeof BroadcastChannel === 'undefined') throw new Error('This browser cannot synchronize DoloGram tabs. Enable BroadcastChannel or use a supported browser.');
    this.stopped = false;
    this.visibility.addEventListener('visibilitychange', this.changed);
    this.changed();
  }
  private invalidate() {
    ++this.generation;
    this.pending?.abort();
    this.active?.abort();
    this.release?.();
  }
  private changed = () => {
    if (this.visibility.visibilityState !== 'visible') { this.invalidate(); return; }
    if (this.stopped || this.request) return;
    const generation = ++this.generation;
    const pending = new AbortController();
    this.pending = pending;
    const failed = (error: unknown) => {
      if (!pending.signal.aborted && !this.stopped) { this.stopped = true; this.visibility.removeEventListener('visibilitychange', this.changed); this.failed(error); }
    };
    this.request = this.locks.request('dg-worker', { mode: 'exclusive', signal: pending.signal }, async () => {
      if (this.stopped || generation !== this.generation || this.visibility.visibilityState !== 'visible') return;
      const active = new AbortController();
      this.active = active;
      const work = new Set<Promise<unknown>>();
      const released = new Promise<void>((resolve) => { this.release = resolve; });
      const current = () => !this.stopped && generation === this.generation && !active.signal.aborted && this.visibility.visibilityState === 'visible';
      const lease: WorkerLease = {
        owner: this.owner, epoch: this.epoch, signal: active.signal, current,
        run: async <T>(operation: (signal: AbortSignal, current: () => boolean) => Promise<T>) => {
          if (!current()) throw new Error('Worker ownership changed.');
          const task = Promise.resolve().then(() => {
            if (!current()) throw new Error('Worker ownership changed.');
            return operation(active.signal, current);
          });
          work.add(task);
          try {
            const result = await task;
            if (!current()) throw new Error('Worker ownership changed.');
            return result;
          } finally { work.delete(task); }
        },
      };
      this.lease = lease;
      try { await lease.run(() => this.acquired(lease)); await released; }
      catch (error) { failed(error); }
      finally {
        active.abort();
        await Promise.allSettled([...work]);
        this.lease = undefined; this.release = undefined; this.active = undefined;
      }
    }).catch(failed).finally(() => {
      this.request = undefined;
      if (!this.stopped && this.visibility.visibilityState === 'visible') this.changed();
    });
  };
  async stop() {
    this.stopped = true;
    this.visibility.removeEventListener('visibilitychange', this.changed);
    this.invalidate();
    await this.request;
  }
}
