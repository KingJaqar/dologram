import { describe, expect, it, vi } from 'vitest';
import { config } from '../../config';
import { createQueueCore } from '../core';
import { createMemoryStore } from '../memoryStore';
import { createQueueRunner } from '../runner';
import type { ClassifiedError } from '../../errors';

function setup() {
  let now = 1000;
  const store = createMemoryStore();
  const core = createQueueCore({ store, timing: config.queue, now: () => now, random: () => 0.5 });
  const enqueue = (id = 'a', chat = 'chat') => core.enqueue({ messageId: id, payload: {
    kind: 'text', chat_id: chat, sender_id: 'owner', content: 'kept', reply_to: null, attachment_count: 0, attachments: [], force_low_signal: false,
  } });
  return { store, core, enqueue, due: () => { now += 120_000; } };
}
describe('queue recovery gates', () => {
  it('keeps failure injection active for eight connected failures, then Retry resets and retains row uncertainty', async () => {
    const h = setup(); await h.enqueue();
    const deliver = vi.fn(async (): Promise<ClassifiedError> => ({ kind: 'network' }));
    const runner = createQueueRunner({ core: h.core, deliver, isConnected: () => true });
    for (let attempt = 1; attempt <= 8; attempt++) {
      await runner.drain();
      expect(h.store.snapshot()[0]).toMatchObject({ retry_count: attempt, status: attempt === 8 ? 'failed' : 'queued' });
      h.due();
    }
    await runner.drain(); expect(deliver).toHaveBeenCalledTimes(8);
    expect(await h.core.retry('a')).toMatchObject({ ok: true, item: { retry_count: 0, status: 'queued', row_state: 'unknown', row_may_exist: true } });
  });
  it('does not consume offline mid-request failures or rate-limit waits', async () => {
    const h = setup(); await h.enqueue(); let connected = true;
    const runner = createQueueRunner({ core: h.core, isConnected: () => connected,
      deliver: async () => { connected = false; throw new TypeError('Disconnected'); } });
    await runner.drain(); expect(h.store.snapshot()[0]).toMatchObject({ retry_count: 0, status: 'queued', row_state: 'unknown' });
    connected = true; h.due();
    const limited = createQueueRunner({ core: h.core, deliver: async () => ({ kind: 'rateLimited', retryAfterSec: 60 }) });
    await limited.drain(); expect(h.store.snapshot()[0]).toMatchObject({ retry_count: 0, status: 'queued', last_error: 'rateLimited' });
    expect(await h.core.nextDueItems()).toEqual([]);
  });
  it('retains permanent failures immediately and permits independent chats while failed rows block their chat', async () => {
    const h = setup(); await h.enqueue('a'); await h.enqueue('b'); await h.enqueue('c', 'other');
    const attempted: string[] = [];
    const runner = createQueueRunner({ core: h.core, deliver: async (item) => {
      attempted.push(item.temp_id); return { kind: 'server', status: 403, code: '42501', permanent: true };
    } });
    await runner.drain(); await runner.drain();
    expect(attempted).toEqual(['a', 'c']);
    expect(h.store.snapshot()[0]).toMatchObject({ status: 'failed', retry_count: 0 });
    expect(await h.core.nextDueItems()).toEqual([]);
  });
  it.each([
    { kind: 'server', code: '42501', status: 403 },
    { kind: 'server', code: 'PGRST116', status: 406 },
    { kind: 'server', code: null, status: 500 },
    { kind: 'network' },
  ] satisfies ClassifiedError[])('retains uncertain work on rejected discard: $kind $status', async (error) => {
    const h = setup(); await h.enqueue(); const item = await h.store.get('a'); if (!item) throw new Error('Missing fixture');
    await h.core.beginAttempt(item);
    expect((await h.core.discard('a', { online: true, softDelete: async () => ({ data: null, error }) })).ok).toBe(false);
    expect(h.store.snapshot()).toHaveLength(1);
    expect(h.store.snapshot()[0]?.row_state).toBe('unknown');
  });
  it('retains thrown timeout discard and fences a leadership change after the durable sending write', async () => {
    const h = setup(); await h.enqueue(); const item = await h.store.get('a'); if (!item) throw new Error('Missing fixture');
    await h.core.beginAttempt(item);
    expect(await h.core.discard('a', { online: true, softDelete: async () => { throw new Error('Timeout'); } })).toEqual({ ok: false, reason: 'network' });
    await h.store.resetSending();
    let current = true;
    const original = h.core.beginAttempt;
    h.core.beginAttempt = async (queued) => { const sending = await original(queued); current = false; return sending; };
    const deliver = vi.fn(async () => null);
    await createQueueRunner({ core: h.core, canAttempt: () => current, deliver }).drain();
    expect(deliver).not.toHaveBeenCalled();
    expect(h.store.snapshot()[0]?.status).toBe('sending');
    await h.core.init(); expect(h.store.snapshot()[0]?.status).toBe('queued');
  });
});
