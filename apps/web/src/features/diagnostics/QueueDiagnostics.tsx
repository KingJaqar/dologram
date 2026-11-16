'use client';

import { useCallback, useEffect, useState } from 'react';
import { createDgClient, type MessageRow } from '@dologram/shared';
import { Button } from '../../components/Button/Button';
import { IndexedDbStore } from '../../lib/store/IndexedDbStore';
import { useStoreQuery } from '../../lib/store/useStoreQuery';
import { BrowserQueueWorker, enqueueText } from '../../lib/queue/worker';
import { createSupabaseSender } from '../../lib/queue/supabaseSender';

const chat = '11111111-1111-4111-8111-111111111111';
const owner = '22222222-2222-4222-8222-222222222222';
type Fault = 'none' | 'lost response' | 'server' | 'rate limit' | 'forbidden' | 'invalid session';
/** Synthetic transport lives exclusively behind the development module alias. No hosted requests. */
export function QueueDiagnostics() {
  const [runtime, setRuntime] = useState<Awaited<ReturnType<typeof open>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let opened: Awaited<ReturnType<typeof open>> | undefined;
    void open((message) => { if (active) setError(message); }).then((value) => { opened = value; if (active) setRuntime(value); else void value.close(); }, () => { if (active) setError('Could not open synthetic queue storage.'); });
    return () => { active = false; void opened?.close(); };
  }, []);
  return <main><h1>Synthetic queue diagnostics</h1><p>Local fixtures only. No real messages are sent.</p>
    {error && <p role="alert">{error}</p>}{runtime ? <Controls runtime={runtime} report={setError} /> : <p role="status">Opening synthetic queue…</p>}</main>;
}
async function open(report: (message: string) => void) {
  const store = new IndexedDbStore(owner, indexedDB, 'dologram-queue-diagnostics'); await store.init();
  const rows = new Map<string, MessageRow>();
  const listeners = new Set<() => void>();
  let online = false;
  let fault: Fault = 'none';
  let lost = false;
  const client = createDgClient({ url: `https://${crypto.randomUUID()}.queue-diagnostics.invalid`, key: 'synthetic-queue-only',
    storage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
    fetch: async (input, init) => {
      init?.signal?.throwIfAborted();
      const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
      if (!online) throw new TypeError('Synthetic offline');
      if (fault === 'server') return json({ code: 'XX000' }, 500);
      if (fault === 'rate limit') return json({ code: 'DG429', details: '15' }, 429);
      if (fault === 'forbidden') return json({ code: '42501' }, 403);
      if (fault === 'invalid session') return json({ code: 'PGRST301' }, 401);
      const url = new URL(String(input));
      if (init?.method === 'POST') {
        const body: unknown = JSON.parse(String(init.body));
        if (typeof body !== 'object' || body === null || !('message_id' in body) || typeof body.message_id !== 'string') return json({ code: 'invalid' }, 400);
        if (rows.has(body.message_id)) return json({ code: '23505' }, 409);
        const queued = await store.get(body.message_id);
        if (!queued) return json({ code: 'missing' }, 400);
        const row: MessageRow = { message_id: queued.temp_id, chat_id: queued.chat_id, sender_id: owner, content: queued.payload.content,
          reply_to: queued.payload.reply_to, attachment_count: 0, seq: rows.size + 1, sync_seq: rows.size + 1,
          created_at: new Date().toISOString(), deleted_at: null, edited_at: null };
        rows.set(row.message_id, row);
        if (fault === 'lost response' && !lost) { lost = true; throw new TypeError('Synthetic lost response'); }
        return json(row, 201);
      }
      const id = url.searchParams.get('message_id')?.replace(/^eq\./, '');
      const row = id ? rows.get(id) : undefined;
      if (!row) return json({ code: 'PGRST116' }, 406);
      if (init?.method === 'PATCH') { row.deleted_at = new Date().toISOString(); row.content = ''; row.sync_seq++; }
      return json(row);
    } });
  const transport = createSupabaseSender({ client, cache: (row, current) => store.upsertMessage(row, current), invalidSession: () => worker.suspend() });
  const worker = new BrowserQueueWorker(store, transport, () => true, report,
    { connected: () => online, subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; } });
  worker.start();
  return { store, worker, setOnline: (value: boolean) => { online = value; listeners.forEach((listener) => listener()); },
    setFault: (value: Fault) => { fault = value; lost = false; },
    close: async () => { await worker.stop(); store.close(); await client.auth.dispose(); } };
}
function Controls({ runtime, report }: { runtime: Awaited<ReturnType<typeof open>>; report: (value: string | null) => void }) {
  const read = useCallback(async () => ({ unsent: await runtime.store.listUnsent(), sent: await runtime.store.listSent(), cached: (await runtime.store.list('messages')).length }), [runtime]);
  const query = useStoreQuery(runtime.store, read);
  const action = (operation: () => Promise<unknown>) => { void operation().catch(() => report('Queue command failed. Pending work was retained; restore delivery or retry.')); };
  return <>
    <label>Connection <select defaultValue="offline" onChange={(event) => runtime.setOnline(event.target.value === 'online')}><option>offline</option><option>online</option></select></label>
    <label>Fault <select defaultValue="none" onChange={(event) => runtime.setFault(event.target.value as Fault)}>{(['none', 'lost response', 'server', 'rate limit', 'forbidden', 'invalid session'] satisfies Fault[]).map((fault) => <option key={fault}>{fault}</option>)}</select></label>
    <Button onClick={() => action(async () => { const result = await enqueueText(runtime.store, { chatId: chat, content: 'Synthetic queued message' }); if (!result.ok) report('Queue full. Send or discard pending work.'); })}>Enqueue synthetic text</Button>
    {query.status === 'loading' && <p role="status">Reading queue…</p>}
    {query.error && <p role="alert">{query.error}</p>}
    {query.data && <><p role="status">Pending: {query.data.unsent.length}; Sent: {query.data.sent.length}; Cached: {query.data.cached}</p>
      {query.data.unsent.length === 0 && <p>No pending messages.</p>}
      <ul>{[...query.data.unsent, ...query.data.sent].map((item) => <li key={item.temp_id}>{item.status}; attempts: {item.retry_count}; row: {item.row_state}; {item.last_error ?? 'no error'}
        {item.status === 'failed' && <Button onClick={() => action(() => runtime.worker.retry(item.temp_id))}>Retry</Button>}
        {item.status !== 'sent' && <Button onClick={() => action(async () => { const result = await runtime.worker.discard(item.temp_id); if (!result.ok) report(`Discard refused (${result.reason}). Message retained.`); })}>Discard</Button>}
      </li>)}</ul></>}
  </>;
}
