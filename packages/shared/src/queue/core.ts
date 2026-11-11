/**
 * The queue state machine (M2-02, M2-03, LS-1 to LS-3, LS-7 to LS-9, D-27, D-77, D-93).
 *
 * Transitions: queued -> sending -> sent | failed. Enqueue writes the item before any network
 * call (LS-1, D-10); a rejected insert whose message_id already exists counts as sent (LS-8); an
 * item that exhausts `maxAttempts` becomes failed and stays visible (LS-7). A rate limit defers
 * the item without counting an attempt (D-77). The store, the clock and the jitter source are all
 * injected, so the machine is tested with a fake clock and a fake network.
 */
import type { ClassifiedError } from '../errors';
import type { DgResult } from '../db/result';
import { nextAttemptAt, rateLimitDelayMs } from './backoff';
import type {
  EnqueueResult,
  LocalQueueStore,
  QueueItem,
  QueueTiming,
  TextQueuePayload,
} from './types';

export type QueueCoreDeps = {
  store: LocalQueueStore;
  timing: QueueTiming;
  /** Epoch milliseconds. */
  now: () => number;
  /** Jitter source in [0, 1). */
  random: () => number;
};

export type AttemptOutcome =
  | { status: 'sent' }
  | { status: 'failed'; retryCount: number }
  | { status: 'retrying'; retryCount: number; nextAttemptAt: number }
  | { status: 'deferred'; retryAfterSec: number };

export type RetryResult = { ok: true; item: QueueItem } | { ok: false; reason: 'missing' | 'notFailed' };

export type DiscardOptions = {
  online: boolean;
  /** Soft-deletes the server row (D-22, D-93). Injected so the core stays platform-free. */
  softDelete: (messageId: string) => Promise<DgResult<unknown>>;
};

export type DiscardResult =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'offline' | 'network' };

export interface QueueCore {
  /** Opens the store schema and returns leftover `sending` items to `queued` (LS-9). */
  init(): Promise<void>;
  enqueue(input: { messageId: string; payload: TextQueuePayload }): Promise<EnqueueResult>;
  listUnsent(): Promise<QueueItem[]>;
  countUnsent(): Promise<number>;
  /**
   * The items that may be attempted now: at most one per chat — the oldest unsent item — because
   * the rows of one chat are inserted strictly in enqueue order (D-93). An item still backing off,
   * in flight or failed blocks later items of its chat.
   */
  nextDueItems(at?: number): Promise<QueueItem[]>;
  /** Marks the item `sending` and returns the stored copy. */
  beginAttempt(item: QueueItem): Promise<QueueItem>;
  /** Persists that the message row exists while attachment work can still be retried. */
  markRowStored(item: QueueItem): Promise<QueueItem>;
  applyResult(item: QueueItem, result: ClassifiedError | null): Promise<AttemptOutcome>;
  /** D-93: Retry resets the count and makes the item due at once. */
  retry(tempId: string): Promise<RetryResult>;
  /** D-93: Discard soft-deletes the server row first when it may exist. */
  discard(tempId: string, options: DiscardOptions): Promise<DiscardResult>;
  /** D-77: a returning connection makes every queued item due at once. */
  makeAllDue(): Promise<void>;
  /** Removes sent items from the local queue. */
  cleanup(): Promise<QueueItem[]>;
}

export function createQueueCore({ store, timing, now, random }: QueueCoreDeps): QueueCore {
  async function init(): Promise<void> {
    await store.init();
    await store.resetSending();
  }

  async function enqueue(input: {
    messageId: string;
    payload: TextQueuePayload;
  }): Promise<EnqueueResult> {
    const unsent = await store.countUnsent();
    if (unsent >= timing.maxUnsent) {
      return { ok: false, reason: 'queueFull' };
    }

    const at = now();
    const item: QueueItem = {
      temp_id: input.messageId,
      chat_id: input.payload.chat_id,
      payload: input.payload,
      status: 'queued',
      retry_count: 0,
      next_attempt_at: at,
      row_may_exist: false,
      row_state: 'absent',
      last_error: null,
      created_at: at,
    };
    await store.insert(item);
    return { ok: true, item };
  }

  async function nextDueItems(at: number = now()): Promise<QueueItem[]> {
    const unsent = await store.listUnsent();
    const blockedChats = new Set<string>();
    const due: QueueItem[] = [];

    for (const item of unsent) {
      if (blockedChats.has(item.chat_id)) continue;
      // Once the message row is stored, attachment retries do not block later message rows.
      if (item.row_state !== 'stored') blockedChats.add(item.chat_id);
      if (item.status === 'queued' && item.next_attempt_at <= at) {
        due.push(item);
      }
    }

    return due;
  }

  async function beginAttempt(item: QueueItem): Promise<QueueItem> {
    // Once an insert has been attempted the row may exist on the server, so Discard must
    // soft-delete it and therefore needs a connection (LS-7, D-93).
    const sending: QueueItem = {
      ...item,
      status: 'sending',
      row_may_exist: true,
      row_state: item.row_state === 'stored' ? 'stored' : 'unknown',
    };
    await store.update(sending);
    return sending;
  }

  async function markRowStored(item: QueueItem): Promise<QueueItem> {
    const stored = { ...item, row_may_exist: true, row_state: 'stored' as const };
    await store.update(stored);
    return stored;
  }

  async function applyResult(
    item: QueueItem,
    result: ClassifiedError | null,
  ): Promise<AttemptOutcome> {
    const at = now();

    // A null result is a stored row; `delivered` is the 23505 case: the message_id already exists,
    // so the row is stored and the item is sent (LS-8).
    if (result === null || result.kind === 'delivered') {
      await store.update({ ...item, status: 'sent', last_error: null, row_may_exist: true, row_state: 'stored' });
      return { status: 'sent' };
    }

    if (result.kind === 'rateLimited') {
      // D-77: not an attempt, so retry_count is unchanged and the item keeps its place.
      await store.update({
        ...item,
        status: 'queued',
        last_error: 'rateLimited',
        next_attempt_at: at + rateLimitDelayMs(result.retryAfterSec),
      });
      return { status: 'deferred', retryAfterSec: result.retryAfterSec };
    }

    if (result.kind === 'deferred') {
      await store.update({
        ...item,
        status: 'queued',
        last_error: 'waitingWifi',
        next_attempt_at: at + timing.timerMs,
      });
      return { status: 'deferred', retryAfterSec: Math.ceil(timing.timerMs / 1000) };
    }

    const retryCount = item.retry_count + 1;
    const kind = result.kind === 'network' ? 'network' : 'server';

    if (retryCount >= timing.maxAttempts) {
      await store.update({
        ...item,
        status: 'failed',
        retry_count: retryCount,
        last_error: kind,
        next_attempt_at: at,
      });
      return { status: 'failed', retryCount };
    }

    const due = nextAttemptAt(retryCount, timing, at, random);
    await store.update({
      ...item,
      status: 'queued',
      retry_count: retryCount,
      last_error: kind,
      next_attempt_at: due,
    });
    return { status: 'retrying', retryCount, nextAttemptAt: due };
  }

  async function retry(tempId: string): Promise<RetryResult> {
    const item = await store.get(tempId);
    if (!item) return { ok: false, reason: 'missing' };
    if (item.status !== 'failed') return { ok: false, reason: 'notFailed' };

    const reset: QueueItem = {
      ...item,
      status: 'queued',
      retry_count: 0,
      next_attempt_at: now(),
      last_error: null,
    };
    await store.update(reset);
    return { ok: true, item: reset };
  }

  async function discard(tempId: string, options: DiscardOptions): Promise<DiscardResult> {
    const item = await store.get(tempId);
    if (!item) return { ok: false, reason: 'missing' };

    if (item.row_state !== 'absent' || item.row_may_exist) {
      if (!options.online) return { ok: false, reason: 'offline' };
      const { error } = await options.softDelete(item.temp_id);
      // A missing row is already discarded; only a network failure leaves the item in place.
      if (error && error.kind === 'network') return { ok: false, reason: 'network' };
    }

    await store.delete(tempId);
    return { ok: true };
  }

  async function makeAllDue(): Promise<void> {
    await store.makeAllDue(now());
  }

  async function cleanup(): Promise<QueueItem[]> {
    const sent = await store.listSent();
    await store.deleteSent();
    return sent;
  }

  return {
    init,
    enqueue,
    listUnsent: () => store.listUnsent(),
    countUnsent: () => store.countUnsent(),
    nextDueItems,
    beginAttempt,
    markRowStored,
    applyResult,
    retry,
    discard,
    makeAllDue,
    cleanup,
  };
}
