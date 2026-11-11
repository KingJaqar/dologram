/**
 * Queue state-machine tests (M2-02, M2-03, LS-1 to LS-3, LS-7 to LS-9, D-27, D-77, D-93, T-18).
 * Constants are injected per M2-02's note; D-27's real values are exercised through `config.queue`
 * in the runner tests.
 */
import { describe, expect, it } from 'vitest';
import { createQueueCore } from '../core';
import { backoffDelayMs } from '../backoff';
import { createMemoryStore } from '../memoryStore';
import type { QueueItem, QueueTiming, TextQueuePayload } from '../types';

const TIMING: QueueTiming = {
  timerMs: 15000,
  backoffBaseMs: 2000,
  backoffFactor: 2,
  backoffCapMs: 60000,
  jitter: 0.2,
  maxAttempts: 8,
  maxUnsent: 200,
};

const START = 1_700_000_000_000;

function payload(chatId: string, content = 'hello'): TextQueuePayload {
  return {
    kind: 'text',
    chat_id: chatId,
    sender_id: 'user-a',
    content,
    reply_to: null,
    attachment_count: 0,
    attachments: [],
  };
}

function harness(timing: QueueTiming = TIMING, random: () => number = () => 0.5) {
  let clock = START;
  const store = createMemoryStore();
  const core = createQueueCore({ store, timing, now: () => clock, random });
  return {
    store,
    core,
    now: () => clock,
    advance(ms: number): void {
      clock += ms;
    },
  };
}

describe('queue core (M2-02)', () => {
  it('writes the item to the store before any delivery attempt (LS-1)', async () => {
    const { core, store } = harness();

    const result = await core.enqueue({ messageId: 'm-1', payload: payload('chat-1') });

    expect(result.ok).toBe(true);
    const stored = store.snapshot();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      temp_id: 'm-1',
      chat_id: 'chat-1',
      status: 'queued',
      retry_count: 0,
      row_may_exist: false,
      row_state: 'absent',
      last_error: null,
    });
  });

  it('refuses the 201st unsent item with a visible reason (D-27, D-93)', async () => {
    const { core } = harness();

    for (let i = 0; i < TIMING.maxUnsent; i += 1) {
      const result = await core.enqueue({ messageId: `m-${i}`, payload: payload('chat-1') });
      expect(result.ok).toBe(true);
    }

    const refused = await core.enqueue({ messageId: 'm-over', payload: payload('chat-1') });
    expect(refused).toEqual({ ok: false, reason: 'queueFull' });
    expect(await core.countUnsent()).toBe(TIMING.maxUnsent);
  });

  it('counts queued, sending and failed items toward the limit (LS-7)', async () => {
    const { core, store } = harness();
    await core.enqueue({ messageId: 'm-1', payload: payload('chat-1') });
    const [item] = await core.listUnsent();
    if (!item) throw new Error('expected an item');
    await store.update({ ...item, status: 'failed' });

    expect(await core.countUnsent()).toBe(1);
  });

  it('offers only the oldest unsent item of each chat (D-93)', async () => {
    const { core } = harness();
    await core.enqueue({ messageId: 'a-1', payload: payload('chat-a') });
    await core.enqueue({ messageId: 'a-2', payload: payload('chat-a') });
    await core.enqueue({ messageId: 'b-1', payload: payload('chat-b') });

    const due = await core.nextDueItems();
    expect(due.map((item) => item.temp_id).sort()).toEqual(['a-1', 'b-1']);
  });

  it('blocks the rest of a chat while its head is backing off or failed', async () => {
    const { core } = harness();
    await core.enqueue({ messageId: 'a-1', payload: payload('chat-a') });
    await core.enqueue({ messageId: 'a-2', payload: payload('chat-a') });

    const [head] = await core.nextDueItems();
    if (!head) throw new Error('expected a due item');
    const outcome = await core.applyResult(head, { kind: 'server', code: 'XX000', status: 500 });
    expect(outcome.status).toBe('retrying');

    expect(await core.nextDueItems()).toEqual([]);

    const stored = await core.listUnsent();
    const first = stored.find((item) => item.temp_id === 'a-1');
    if (!first) throw new Error('expected a-1');
    await core.applyResult(first, { kind: 'server', code: 'XX000', status: 500 });
    // The second failure still blocks the chat; the later item never jumps the queue.
    expect((await core.nextDueItems()).map((item) => item.temp_id)).toEqual([]);
  });

  it('backs off exponentially from the base and caps at 60 s (D-27)', () => {
    const steady = () => 0.5;
    expect(backoffDelayMs(1, TIMING, steady)).toBe(2000);
    expect(backoffDelayMs(2, TIMING, steady)).toBe(4000);
    expect(backoffDelayMs(3, TIMING, steady)).toBe(8000);
    expect(backoffDelayMs(6, TIMING, steady)).toBe(60000);
    expect(backoffDelayMs(30, TIMING, steady)).toBe(60000);
    expect(TIMING.jitter).toBe(0.2);
  });

  it('keeps jitter inside ±20 % (D-27)', () => {
    const low = backoffDelayMs(1, TIMING, () => 0);
    const high = backoffDelayMs(1, TIMING, () => 0.999999);
    expect(low).toBe(1600);
    expect(high).toBeLessThanOrEqual(2400);
    expect(high).toBeGreaterThanOrEqual(2399);
  });

  it('marks a duplicate insert as delivered (LS-8, 23505)', async () => {
    const { core } = harness();
    await core.enqueue({ messageId: 'm-1', payload: payload('chat-1') });
    const [item] = await core.nextDueItems();
    if (!item) throw new Error('expected a due item');

    const sending = await core.beginAttempt(item);
    const outcome = await core.applyResult(sending, { kind: 'delivered' });

    expect(outcome).toEqual({ status: 'sent' });
    expect(await core.listUnsent()).toEqual([]);
    expect(await core.nextDueItems()).toEqual([]);
  });

  it('defers a rate-limited item without counting an attempt (D-77, DG429)', async () => {
    const { core, now } = harness();
    await core.enqueue({ messageId: 'm-1', payload: payload('chat-1') });
    const [item] = await core.nextDueItems();
    if (!item) throw new Error('expected a due item');
    const sending = await core.beginAttempt({ ...item, retry_count: 2 });

    const outcome = await core.applyResult(sending, { kind: 'rateLimited', retryAfterSec: 17 });

    expect(outcome).toEqual({ status: 'deferred', retryAfterSec: 17 });
    const pending = await core.listUnsent();
    expect(pending[0]).toMatchObject({
      status: 'queued',
      retry_count: 2,
      last_error: 'rateLimited',
      next_attempt_at: now() + 17000,
    });
    expect(await core.nextDueItems()).toEqual([]);
  });

  it('fails after maxAttempts and stays visible (LS-7, T-18)', async () => {
    const { core, store, advance } = harness();
    await core.enqueue({ messageId: 'm-1', payload: payload('chat-1') });

    let status: string | undefined;
    for (let attempt = 1; attempt <= TIMING.maxAttempts; attempt += 1) {
      const [item] = await core.nextDueItems();
      if (!item) throw new Error(`expected a due item on attempt ${attempt}`);
      const sending = await core.beginAttempt(item);
      const outcome = await core.applyResult(sending, {
        kind: 'network',
      });
      status = outcome.status;
      // Jump past the cap so the next attempt is always due (D-27 caps at 60 s).
      advance(120000);
    }

    expect(status).toBe('failed');
    const [failed] = store.snapshot();
    expect(failed).toMatchObject({ status: 'failed', retry_count: TIMING.maxAttempts });
    expect(await core.nextDueItems()).toEqual([]);
  });

  it('resets the count on Retry and makes the item due at once (D-93)', async () => {
    const { core, store } = harness();
    const failed: QueueItem = {
      temp_id: 'm-1',
      chat_id: 'chat-1',
      payload: payload('chat-1'),
      status: 'failed',
      retry_count: 8,
      next_attempt_at: START + 60000,
      row_may_exist: true,
      row_state: 'unknown',
      last_error: 'server',
      created_at: START,
    };
    await store.insert(failed);

    const result = await core.retry('m-1');

    expect(result.ok).toBe(true);
    expect(store.snapshot()[0]).toMatchObject({
      status: 'queued',
      retry_count: 0,
      next_attempt_at: START,
      last_error: null,
    });
    expect(await core.nextDueItems()).toHaveLength(1);
  });

  it('returns leftover sending items to queued at startup (LS-9)', async () => {
    const store = createMemoryStore();
    await store.insert({
      temp_id: 'm-1',
      chat_id: 'chat-1',
      payload: payload('chat-1'),
      status: 'sending',
      retry_count: 1,
      next_attempt_at: START,
      row_may_exist: true,
      row_state: 'unknown',
      last_error: null,
      created_at: START,
    });
    const core = createQueueCore({ store, timing: TIMING, now: () => START, random: () => 0.5 });

    await core.init();

    expect(store.snapshot()[0]?.status).toBe('queued');
    expect(store.snapshot()[0]?.retry_count).toBe(1);
  });

  it('makes every queued item due when the connection returns (D-77)', async () => {
    const { core, store, advance } = harness();
    await core.enqueue({ messageId: 'm-1', payload: payload('chat-1') });
    const [item] = await core.listUnsent();
    if (!item) throw new Error('expected an item');
    await store.update({ ...item, next_attempt_at: START + 45000 });
    advance(1000);
    expect(await core.nextDueItems()).toEqual([]);

    await core.makeAllDue();

    expect(await core.nextDueItems()).toHaveLength(1);
  });

  it('discards offline only while the server row cannot exist (D-93)', async () => {
    const { core, store } = harness();
    await core.enqueue({ messageId: 'never-sent', payload: payload('chat-1') });

    const offline = await core.discard('never-sent', {
      online: false,
      softDelete: () => Promise.reject(new Error('must not be called')),
    });
    expect(offline).toEqual({ ok: true });

    await core.enqueue({ messageId: 'attempted', payload: payload('chat-1') });
    const attempted = (await core.listUnsent())[0];
    if (!attempted) throw new Error('expected an item');
    await core.beginAttempt(attempted);

    const refused = await core.discard('attempted', {
      online: false,
      softDelete: () => Promise.reject(new Error('must not be called')),
    });
    expect(refused).toEqual({ ok: false, reason: 'offline' });
    expect(store.snapshot()).toHaveLength(1);
  });

  it('soft-deletes an existing row before discarding it (D-93)', async () => {
    const { core, store } = harness();
    await core.enqueue({ messageId: 'm-1', payload: payload('chat-1') });
    const [item] = await core.listUnsent();
    if (!item) throw new Error('expected an item');
    await core.beginAttempt(item);

    const deleted: string[] = [];
    const result = await core.discard('m-1', {
      online: true,
      softDelete: async (messageId) => {
        deleted.push(messageId);
        return { data: null, error: null };
      },
    });

    expect(result).toEqual({ ok: true });
    expect(deleted).toEqual(['m-1']);
    expect(store.snapshot()).toEqual([]);
  });

  it('keeps the item when the soft delete fails on the network (D-93)', async () => {
    const { core, store } = harness();
    await core.enqueue({ messageId: 'm-1', payload: payload('chat-1') });
    const [item] = await core.listUnsent();
    if (!item) throw new Error('expected an item');
    await core.beginAttempt(item);

    const result = await core.discard('m-1', {
      online: true,
      softDelete: async () => ({ data: null, error: { kind: 'network' } }),
    });

    expect(result).toEqual({ ok: false, reason: 'network' });
    expect(store.snapshot()).toHaveLength(1);
  });
});
