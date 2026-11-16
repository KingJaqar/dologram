import { createDgClient, type DgClient, type MessageRow } from '@dologram/shared';
import { createSupabaseDelivery } from '@dologram/shared/src/sync/supabase';
import { IndexedDbStore } from '../src/lib/store/IndexedDbStore';
import { BrowserSyncHost, type SyncStatus } from '../src/lib/sync/host';
import { browserSource } from '../src/lib/sync/source';
import { refreshMetadata } from '../src/lib/sync/metadata';
import { BrowserQueueWorker } from '../src/lib/queue/worker';
import { Visibility, queueItem } from './store-harness';
import { Connectivity } from './queue-harness';

export { IndexedDbStore, queueItem, refreshMetadata, browserSource };
export const owner = '22222222-2222-4222-8222-222222222222';
export const chat = '11111111-1111-4111-8111-111111111111';
export const member = { chat_id: chat, user_id: owner, joined_at: '2026-11-15T00:00:00Z', last_read_seq: 0, role: 'member', archived: false, muted_until: null, nickname: null };
export function message(n: number): MessageRow {
  return { message_id: `m${n}`, chat_id: chat, sender_id: owner, content: `message ${n}`, attachment_count: 0, reply_to: null, seq: n, sync_seq: n, created_at: '2026-11-15T00:00:00Z', deleted_at: null, edited_at: null };
}
declare global { interface Window { syncRequest: (url: string) => Promise<{ body: unknown; status: number }> } }
export async function runtime() {
  const store = new IndexedDbStore(owner); await store.init();
  const visibility = new Visibility(); const connectivity = new Connectivity();
  const statuses: SyncStatus[] = []; const failures: string[] = [];
  const listeners = new Map<string, (payload: { new: unknown; old: unknown }) => void>();
  let status: ((value: string) => void) | undefined;
  let join = 'SUBSCRIBED'; let subscriptions = 0; let removals = 0; let valid = true;
  const channel = {
    on: (_event: string, filter: { table: string }, callback: (payload: { new: unknown; old: unknown }) => void) => { listeners.set(filter.table, callback); return channel; },
    subscribe: (callback: (value: string) => void) => { subscriptions++; status = callback; queueMicrotask(() => callback(join)); return channel; },
  };
  const deliveryClient = { channel: () => channel, removeChannel: async () => { removals++; return 'ok'; } } as unknown as DgClient;
  const client = createDgClient({ url: `https://${crypto.randomUUID()}.sync-fixture.invalid`, key: 'synthetic-sync-fixture',
    storage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
    fetch: async (url, init) => {
      init?.signal?.throwIfAborted();
      const response = await window.syncRequest(String(url));
      init?.signal?.throwIfAborted();
      return new Response(JSON.stringify(response.body), { status: response.status, headers: { 'Content-Type': 'application/json' } });
    } });
  let host: BrowserSyncHost | undefined;
  const worker = new BrowserQueueWorker(store, {
    deliver: async () => { throw new Error('Unexpected fixture queue send'); },
    discard: async () => { throw new Error('Unexpected fixture discard'); },
  }, () => valid, (message) => failures.push(message), connectivity, navigator.locks, visibility, (lease) => {
    host?.stop();
    host = new BrowserSyncHost(store, lease, client, (state) => statuses.push(state), () => valid, connectivity, {
      source: (signal, current) => browserSource(client, owner, signal, current),
      delivery: () => createSupabaseDelivery(deliveryClient),
      metadata: (signal, current) => refreshMetadata(client, store, signal, current),
    }); host.start();
  });
  store.onQuiesce = () => { valid = false; host?.stop(); void worker.stop(); };
  worker.start();
  return { store, worker, statuses, failures, client, visibility, connectivity,
    counts: () => ({ subscriptions, removals }),
    join: (next: string) => { join = next; },
    status: (next: string) => status?.(next),
    emit: (table: string, row: unknown, old: unknown = {}) => listeners.get(table)?.({ new: row, old }),
    invalidate: () => { valid = false; host?.stop(); },
    close: async () => { valid = false; host?.stop(); await worker.stop(); store.close(); await client.auth.dispose(); },
  };
}
