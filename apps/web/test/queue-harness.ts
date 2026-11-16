import { createDgClient, type QueueItem } from '@dologram/shared';
import { IndexedDbStore } from '../src/lib/store/IndexedDbStore';
import { BrowserQueueWorker, enqueueText } from '../src/lib/queue/worker';
import { createSupabaseSender } from '../src/lib/queue/supabaseSender';
import { Visibility } from './store-harness';

export { enqueueText };
declare global {
  interface Window {
    queueRequest: (method: string, url: string, body: string, persisted: QueueItem[]) => Promise<{ status: number; body: unknown; lost?: boolean }>;
  }
}
export class Connectivity extends EventTarget {
  online = false;
  connected = () => this.online;
  subscribe = (listener: () => void) => { this.addEventListener('changed', listener); return () => this.removeEventListener('changed', listener); };
  set(online: boolean) { this.online = online; this.dispatchEvent(new Event('changed')); }
}
export async function runtime(owner = '22222222-2222-4222-8222-222222222222') {
  const store = new IndexedDbStore(owner); await store.init();
  const connectivity = new Connectivity();
  const visibility = new Visibility();
  let valid = true;
  const failures: string[] = [];
  const client = createDgClient({ url: 'https://browser-queue.test', key: 'synthetic',
    storage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
    fetch: async (url, init) => {
      init?.signal?.throwIfAborted();
      const response = await window.queueRequest(init?.method ?? 'GET', String(url), String(init?.body ?? ''), await store.listUnsent());
      init?.signal?.throwIfAborted();
      if (response.lost) throw new TypeError('Injected lost response');
      return new Response(JSON.stringify(response.body), { status: response.status, headers: { 'Content-Type': 'application/json' } });
    } });
  const transport = createSupabaseSender({ client, cache: (row, current) => store.upsertMessage(row, current), invalidSession: () => worker.suspend() });
  const worker = new BrowserQueueWorker(store, transport, () => valid, (message) => failures.push(message), connectivity, navigator.locks, visibility);
  store.onQuiesce = () => { valid = false; void worker.stop(); };
  worker.start();
  return { store, worker, connectivity, visibility, failures, invalidate: () => { valid = false; },
    close: async () => { await worker.stop(); store.close(); await client.auth.dispose(); } };
}
