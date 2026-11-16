import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDgClient, config, createQueueCore, createQueueRunner, type DgClient, type MessageRow, type QueueItem } from '@dologram/shared';
import { createMemoryStore } from '@dologram/shared/src/queue/memoryStore';
import { createSupabaseSender } from './supabaseSender';

const clients: DgClient[] = [];
afterEach(async () => { for (const client of clients.splice(0)) { await client.auth.initialize(); await client.auth.dispose(); } });
function row(item: QueueItem): MessageRow {
  return { message_id: item.temp_id, chat_id: item.chat_id, sender_id: item.payload.sender_id, content: item.payload.content,
    attachment_count: item.payload.attachment_count, reply_to: item.payload.reply_to, created_at: '2026-11-15T00:00:00Z', deleted_at: null, edited_at: null, seq: 1, sync_seq: 1 };
}
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }
async function setup(transport: typeof fetch) {
  const client = createDgClient({ url: `https://${crypto.randomUUID()}.test`, key: 'synthetic',
    storage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} }, fetch: transport });
  clients.push(client);
  const store = createMemoryStore(); let now = 1000;
  const core = createQueueCore({ store, timing: config.queue, now: () => now, random: () => 0.5 });
  await core.enqueue({ messageId: 'message', payload: { kind: 'text', chat_id: 'chat', sender_id: 'owner', content: 'retained', reply_to: null,
    attachment_count: 0, attachments: [], force_low_signal: false } });
  const item = await store.get('message'); if (!item) throw new Error('Missing fixture');
  const cache = vi.fn<(row: MessageRow, current: () => boolean) => Promise<void>>(async () => {});
  const invalidSession = vi.fn();
  const sender = createSupabaseSender({ client, cache, invalidSession });
  return { client, store, core, item, cache, invalidSession, sender, due: () => { now += 120_000; } };
}
describe('verified browser sender', () => {
  it('persists before HTTP, recovers a lost insert response with exactly one row and durable cache before sent', async () => {
    const rows = new Map<string, MessageRow>(); let posts = 0;
    const h = await setup(async (_input, init) => {
      expect(h.store.snapshot()[0]).toMatchObject({ status: 'sending', row_state: 'unknown' });
      if (init?.method === 'POST') {
        posts++;
        if (rows.has('message')) return json({ code: '23505' }, 409);
        rows.set('message', row(h.item)); throw new TypeError('Lost response after commit');
      }
      return json(rows.get('message'));
    });
    const runner = createQueueRunner({ core: h.core, deliver: (item) => h.sender.deliver(item, new AbortController().signal, () => true) });
    await runner.drain(); expect(h.store.snapshot()[0]).toMatchObject({ status: 'queued', retry_count: 1 });
    h.due(); await runner.drain();
    expect(rows.size).toBe(1); expect(posts).toBe(2); expect(h.cache).toHaveBeenCalledWith(row(h.item), expect.any(Function));
    expect(h.store.snapshot()[0]).toMatchObject({ status: 'sent', row_state: 'stored' });
  });
  it('rejects a duplicate ID owned by another sender without marking sent or caching', async () => {
    const h = await setup(async (_input, init) => init?.method === 'POST' ? json({ code: '23505' }, 409) : json({ ...row(h.item), sender_id: 'other' }));
    const result = await h.sender.deliver(h.item, new AbortController().signal, () => true);
    expect(result).toMatchObject({ rowStored: false, error: { kind: 'server', permanent: true } }); expect(h.cache).not.toHaveBeenCalled();
  });
  it('continues attachment work after duplicate confirmation and on a stored-row retry without another insert', async () => {
    const methods: string[] = [];
    const h = await setup(async (_input, init) => { methods.push(init?.method ?? 'GET'); return init?.method === 'POST' ? json({ code: '23505' }, 409) : json(row(h.item)); });
    h.item.payload.attachment_count = 1;
    h.item.payload.attachments = [{ media_id: 'media', media_type: 'file', mime: 'text/plain', size_bytes: 1, local_uri: 'blob', compressed: false }];
    const upload = vi.fn(async () => ({ kind: 'network' as const }));
    const sender = createSupabaseSender({ client: h.client, cache: h.cache, invalidSession: h.invalidSession, deliverAttachments: upload });
    expect(await sender.deliver(h.item, new AbortController().signal, () => true)).toMatchObject({ rowStored: true, error: { kind: 'network' } });
    h.item.row_state = 'stored';
    await sender.deliver(h.item, new AbortController().signal, () => true);
    expect(upload).toHaveBeenCalledTimes(2); expect(methods).toEqual(['POST', 'GET', 'GET']);
  });
  it('suspends invalid sessions and retains RLS zero-row discard responses', async () => {
    let forbidden = true;
    const h = await setup(async () => forbidden ? json({ code: 'PGRST301' }, 401) : json({ code: 'PGRST116' }, 406));
    expect(await h.sender.deliver(h.item, new AbortController().signal, () => true)).toMatchObject({ error: { status: 401 } });
    expect(h.invalidSession).toHaveBeenCalledTimes(1); forbidden = false;
    expect(await h.sender.discard(h.item, new AbortController().signal, () => true)).toMatchObject({ error: { status: 406 } });
    expect(h.cache).not.toHaveBeenCalled();
  });
  it('fences stale ownership and cache failures without claiming delivery', async () => {
    const h = await setup(async () => json(row(h.item)));
    await expect(h.sender.deliver(h.item, new AbortController().signal, () => false)).rejects.toThrow('ownership');
    const sender = createSupabaseSender({ client: h.client, cache: async () => { throw new Error('quota'); }, invalidSession: h.invalidSession });
    await expect(sender.deliver(h.item, new AbortController().signal, () => true)).rejects.toThrow('quota');
    expect(h.store.snapshot()[0]?.status).toBe('queued');
  });
});
