import { config, createQueueCore, createQueueRunner, validateMessageText, type QueueCore, type QueueRunner } from '@dologram/shared';
import type { IndexedDbStore } from '../store/IndexedDbStore';
import { WorkerLeader, type WorkerLease } from '../worker/leader';
import type { QueueTransport } from './supabaseSender';
import { webConnectivity } from './webConnectivity';
import { ids } from '../ids';

export function queueCore(store: Parameters<typeof createQueueCore>[0]['store']) {
  return createQueueCore({ store, timing: config.queue, now: Date.now, random: Math.random });
}
export async function enqueueText(store: IndexedDbStore, input: { chatId: string; content: string; replyTo?: string | null }) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(input.chatId) || (input.replyTo != null && !uuid.test(input.replyTo)) || !validateMessageText(input.content, 0).ok) {
    throw new Error('Enter a valid chat and a message of 1–4096 characters.');
  }
  return queueCore(store).enqueue({ messageId: ids.messageId(), payload: {
    kind: 'text', chat_id: input.chatId, sender_id: store.owner, content: input.content,
    reply_to: input.replyTo ?? null, attachment_count: 0, attachments: [], force_low_signal: false,
  } });
}

type Visibility = Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
/** A single visible lease owns recovery and delivery; all queue commands serialize with drains. */
export class BrowserQueueWorker {
  private readonly leader: WorkerLeader;
  private readonly lifetime = new AbortController();
  private lease: WorkerLease | undefined;
  private runner: QueueRunner | undefined;
  private active = false;
  private running = false;
  private pending = false;
  private reconnect = false;
  private connected: boolean;
  private timer: ReturnType<typeof setInterval> | undefined;
  private unsubscribe: (() => void) | undefined;
  private unnetwork: (() => void) | undefined;
  private suspended = false;

  constructor(private readonly store: IndexedDbStore, private readonly transport: QueueTransport,
    private readonly validSession: () => boolean, private readonly failed: (message: string) => void,
    private readonly connectivity = webConnectivity, locks: LockManager = navigator.locks,
    private readonly visibility: Visibility = document,
    private readonly onLease?: (lease: WorkerLease) => void) {
    this.connected = connectivity.connected();
    this.leader = new WorkerLeader(store.owner, store.sessionEpoch, this.acquired, () => {
      this.suspend('Delivery ownership is unavailable. Reload to retry; your pending messages are retained.');
    }, locks, visibility);
    this.locks = locks;
  }
  private readonly locks: LockManager;
  private current = () => this.active && !this.suspended && this.validSession() && this.visibility.visibilityState === 'visible';
  private canAttempt = () => this.current() && this.connectivity.connected() && this.lease?.current() === true;
  suspend = (message = 'Delivery paused. Restore your session to send pending messages.') => {
    this.suspended = true;
    this.failed(message);
  };
  start() {
    this.active = true;
    this.unsubscribe = this.store.subscribe(this.wake);
    this.unnetwork = this.connectivity.subscribe(this.network);
    this.timer = setInterval(this.wake, config.queue.timerMs);
    this.leader.start();
  }
  private acquired = async (lease: WorkerLease) => {
    const core = queueCore(this.store.workerStore(() => lease.current() && this.current()));
    await core.init();
    this.lease = lease;
    this.runner = createQueueRunner({ core, senderId: this.store.owner, canAttempt: this.canAttempt,
      isConnected: this.connectivity.connected,
      deliver: (item) => this.transport.deliver(item, lease.signal, this.canAttempt) });
    lease.signal.addEventListener('abort', () => { if (this.lease === lease) { this.lease = undefined; this.runner = undefined; } }, { once: true });
    this.onLease?.(lease);
    this.wake();
  };
  private network = () => {
    const connected = this.connectivity.connected();
    if (connected && !this.connected) this.reconnect = true;
    this.connected = connected;
    this.wake();
  };
  private wake = () => {
    if (!this.canAttempt()) return;
    this.pending = true;
    if (!this.running) void this.drain();
  };
  private async exclusive<T>(signal: AbortSignal, operation: () => Promise<T>): Promise<T> {
    // Settle callback failures inside Web Locks, including expected fenced cancellations.
    // Firefox otherwise reports the rejected callback as an uncaught exception.
    const result = await this.locks.request('dg-queue-operation', { signal }, async () => {
      try { return { ok: true as const, value: await operation() }; }
      catch (error) { return { ok: false as const, error }; }
    });
    if (!result.ok) throw result.error;
    return result.value;
  }
  private async drain() {
    this.running = true;
    const initialLease = this.lease;
    try {
      while (this.pending && this.canAttempt()) {
        this.pending = false;
        const lease = this.lease;
        const runner = this.runner;
        if (!lease || !runner) break;
        await lease.run(async () => {
          await this.exclusive(AbortSignal.any([lease.signal, AbortSignal.timeout(10_000)]), async () => {
            if (!this.canAttempt()) return;
            if (this.reconnect) { this.reconnect = false; await runner.handleConnectivity(true); }
            else await runner.drain();
          });
        });
      }
    } catch {
      if (this.lease === initialLease && this.lease?.current() && this.current()) this.suspend('Delivery paused because browser storage or the connection failed. Retry delivery; pending messages are retained.');
    } finally { this.running = false; if (this.pending && this.canAttempt()) this.wake(); }
  }
  private async command<T>(operation: (core: QueueCore, signal: AbortSignal, current: () => boolean) => Promise<T>) {
    if (!this.current()) throw new Error('Delivery is paused. Restore your session or return to this tab.');
    const abort = new AbortController();
    const changed = () => { if (this.visibility.visibilityState !== 'visible') abort.abort(); };
    this.visibility.addEventListener('visibilitychange', changed);
    const signal = AbortSignal.any([abort.signal, this.lifetime.signal, AbortSignal.timeout(10_000)]);
    const current = () => this.current() && !signal.aborted;
    try {
      return await this.exclusive(signal, async () => {
        if (!current()) throw new Error('Queue command interrupted. Your message is retained.');
        return operation(queueCore(this.store.workerStore(current)), signal, current);
      });
    } finally { this.visibility.removeEventListener('visibilitychange', changed); }
  }
  retry(id: string) { return this.command((core) => core.retry(id)); }
  discard(id: string) {
    return this.command((core, signal, current) => core.discard(id, { online: this.connectivity.connected(), softDelete: async () => {
      const item = await this.store.get(id);
      if (!item || item.payload.sender_id !== this.store.owner) throw new Error('Queued message unavailable.');
      return this.transport.discard(item, signal, current);
    } }));
  }
  async stop() {
    this.active = false;
    this.lifetime.abort();
    clearInterval(this.timer);
    this.unsubscribe?.(); this.unnetwork?.();
    await this.leader.stop();
  }
}
