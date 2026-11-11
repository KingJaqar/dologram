/**
 * Delivery runner tests with an injected fetch (M2-03, LS-8, LS-7, D-77, T-09, T-18).
 *
 * The fetch is injected into the real Supabase client and the real `insertMessage` repository, so
 * these tests exercise the exact path the mobile worker uses: a dropped response after the server
 * stored the row (T-09) and every attempt failing up to the D-27 attempt cap (T-18).
 */
import { describe, expect, it } from 'vitest';
import { createDgClient } from '../../db/client';
import { insertMessage } from '../../db/repositories/messages';
import type { ClassifiedError } from '../../errors';
import { config } from '../../config';
import { createQueueCore } from '../core';
import { createQueueRunner } from '../runner';
import { createMemoryStore } from '../memoryStore';
import type { QueueItem, TextQueuePayload } from '../types';

const START = 1_700_000_000_000;
const TIMING = { ...config.queue, maxAttempts: 3 };

const storage = {
  getItem: async (): Promise<string | null> => null,
  setItem: async (): Promise<void> => undefined,
  removeItem: async (): Promise<void> => undefined,
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function payload(content = 'hello'): TextQueuePayload {
  return {
    kind: 'text',
    chat_id: '11111111-1111-4111-8111-111111111111',
    sender_id: '22222222-2222-4222-8222-222222222222',
    content,
    reply_to: null,
    attachment_count: 0,
    attachments: [],
  };
}

/** The message-row insert of M2-03; a duplicate is a delivery, not a failure (LS-8). */
async function makeDeliver(fetchImpl: typeof fetch) {
  const client = createDgClient({ url: 'https://queue.test', key: 'test-key', storage, fetch: fetchImpl });

  return async (item: QueueItem): Promise<ClassifiedError | null> => {
    const { error } = await insertMessage(client, {
      message_id: item.temp_id,
      chat_id: item.chat_id,
      sender_id: item.payload.sender_id,
      content: item.payload.content,
      reply_to: item.payload.reply_to,
      attachment_count: item.payload.attachment_count,
    });
    if (!error) return null;
    return error.kind === 'delivered' ? null : error;
  };
}

function harness(fetchImpl: typeof fetch) {
  let clock = START;
  const store = createMemoryStore();
  const core = createQueueCore({ store, timing: TIMING, now: () => clock, random: () => 0.5 });
  return {
    store,
    core,
    advance(ms: number): void {
      clock += ms;
    },
    async makeRunner() {
      return createQueueRunner({ core, deliver: await makeDeliver(fetchImpl) });
    },
  };
}

describe('queue runner (M2-03)', () => {
  it('does not block later rows when an attachment upload retries after the message row is stored (LS-4, D-93)', async () => {
    let clock = START;
    const store = createMemoryStore();
    const core = createQueueCore({ store, timing: TIMING, now: () => clock, random: () => 0.5 });
    await core.enqueue({ messageId: 'm-1', payload: payload('with attachment') });
    await core.enqueue({ messageId: 'm-2', payload: payload('later text') });
    const calls: string[] = [];
    const runner = createQueueRunner({
      core,
      deliver: async (item) => {
        calls.push(item.temp_id);
        if (item.temp_id === 'm-1') {
          return { error: { kind: 'network' }, rowStored: true };
        }
        return { error: null, rowStored: true };
      },
    });

    const first = await runner.drain();
    expect(first).toMatchObject({ attempted: 1, retrying: 1 });
    expect(store.snapshot().find((item) => item.temp_id === 'm-1')).toMatchObject({ row_state: 'stored' });

    clock += 60000;
    const second = await runner.drain();
    expect(second).toMatchObject({ attempted: 2, sent: 1, retrying: 1 });
    expect(calls).toEqual(['m-1', 'm-1', 'm-2']);
    expect(store.snapshot().find((item) => item.temp_id === 'm-2')?.status).toBe('sent');
  });

  it('delivers an item once when the response is dropped after the insert (T-09, LS-8)', async () => {
    let storedRows = 0;
    const requests: string[] = [];

    const fetchImpl: typeof fetch = async (input) => {
      requests.push(String(input));
      if (storedRows === 0) {
        storedRows = 1; // the server stored the row...
        throw new TypeError('Failed to fetch'); // ...and the response never arrived
      }
      // Second attempt: the client-generated message_id already exists.
      return json(
        {
          code: '23505',
          details: 'Key (message_id)=(m-1) already exists.',
          hint: null,
          message: 'duplicate key value violates unique constraint',
        },
        409,
      );
    };

    const { core, store, advance, makeRunner } = harness(fetchImpl);
    await core.enqueue({ messageId: 'm-1', payload: payload() });
    const runner = await makeRunner();

    const first = await runner.drain();
    expect(first).toEqual({ attempted: 1, sent: 0, failed: 0, retrying: 1, deferred: 0 });
    // The lost response is a network failure (status 0), which counts one attempt (D-77).
    expect(store.snapshot()[0]).toMatchObject({ retry_count: 1, last_error: 'network' });

    advance(60000);
    const second = await runner.drain();

    expect(second).toEqual({ attempted: 1, sent: 1, failed: 0, retrying: 0, deferred: 0 });
    expect(store.snapshot()[0]?.status).toBe('sent');
    expect(storedRows).toBe(1);
    expect(requests).toHaveLength(2);
  });

  it('keeps a failed item visible after the attempt cap (T-18, LS-7)', async () => {
    const fetchImpl: typeof fetch = async () =>
      json({ code: 'XX000', details: null, hint: null, message: 'server exploded' }, 500);

    const { core, store, advance, makeRunner } = harness(fetchImpl);
    await core.enqueue({ messageId: 'm-1', payload: payload() });
    const runner = await makeRunner();

    let attempts = 0;
    for (let i = 0; i < TIMING.maxAttempts; i += 1) {
      const summary = await runner.drain();
      attempts += summary.attempted;
      advance(120000);
    }

    expect(attempts).toBe(TIMING.maxAttempts);
    const [item] = store.snapshot();
    expect(item).toMatchObject({
      status: 'failed',
      retry_count: TIMING.maxAttempts,
      last_error: 'server',
    });
    // Failed items stay visible and keep blocking their chat until retried or discarded (D-93).
    expect(await core.listUnsent()).toHaveLength(1);
    expect(await runner.drain()).toEqual({
      attempted: 0,
      sent: 0,
      failed: 0,
      retrying: 0,
      deferred: 0,
    });
  });

  it('waits for the DG429 retry time without using an attempt (D-77)', async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      if (calls === 1) {
        return json(
          { code: 'DG429', details: '17', hint: null, message: 'rate limit exceeded' },
          400,
        );
      }
      return json(
        [
          {
            message_id: 'm-1',
            chat_id: '11111111-1111-4111-8111-111111111111',
            sender_id: '22222222-2222-4222-8222-222222222222',
            content: 'hello',
            reply_to: null,
            attachment_count: 0,
            created_at: new Date(START).toISOString(),
            edited_at: null,
            deleted_at: null,
            seq: 1,
            sync_seq: 1,
          },
        ],
        201,
      );
    };

    const { core, store, advance, makeRunner } = harness(fetchImpl);
    await core.enqueue({ messageId: 'm-1', payload: payload() });
    const runner = await makeRunner();

    const deferred = await runner.drain();
    expect(deferred).toEqual({ attempted: 1, sent: 0, failed: 0, retrying: 0, deferred: 1 });
    expect(store.snapshot()[0]).toMatchObject({
      status: 'queued',
      retry_count: 0,
      last_error: 'rateLimited',
    });
    expect(await core.nextDueItems()).toEqual([]);

    advance(17000);
    const delivered = await runner.drain();

    expect(delivered).toEqual({ attempted: 1, sent: 1, failed: 0, retrying: 0, deferred: 0 });
    expect(store.snapshot()[0]?.status).toBe('sent');
    expect(store.snapshot()[0]?.retry_count).toBe(0);
  });

  it('makes every queued item due when the connection returns (D-77)', async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return json(
        [
          {
            message_id: 'm-1',
            chat_id: '11111111-1111-4111-8111-111111111111',
            sender_id: '22222222-2222-4222-8222-222222222222',
            content: 'hello',
            reply_to: null,
            attachment_count: 0,
            created_at: new Date(START).toISOString(),
            edited_at: null,
            deleted_at: null,
            seq: 1,
            sync_seq: 1,
          },
        ],
        201,
      );
    };

    const { core, store, makeRunner } = harness(fetchImpl);
    await core.enqueue({ messageId: 'm-1', payload: payload() });
    const [item] = await core.listUnsent();
    if (!item) throw new Error('expected an item');
    await store.update({ ...item, next_attempt_at: START + 45000 });
    const runner = await makeRunner();

    expect(await runner.drain()).toMatchObject({ attempted: 0 });
    // A returning connection becomes due at once; retry_count is untouched (D-77).
    expect(await runner.handleConnectivity(true)).toMatchObject({ attempted: 1, sent: 1 });
    expect(calls).toBe(1);
    expect(store.snapshot()[0]?.retry_count).toBe(0);
  });

  it('never attempts while the device reports no connection', async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return json({}, 500);
    };

    const { core, makeRunner } = harness(fetchImpl);
    await core.enqueue({ messageId: 'm-1', payload: payload() });
    const runner = await makeRunner();

    expect(await runner.handleConnectivity(false)).toEqual({
      attempted: 0,
      sent: 0,
      failed: 0,
      retrying: 0,
      deferred: 0,
    });
    expect(calls).toBe(0);
  });
});
