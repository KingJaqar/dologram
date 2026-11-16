import { it, expect, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createDgClient } from '@dologram/shared';
import { IndexedDbStore } from '../store/IndexedDbStore';
import { browserSource } from './source';
import { refreshMetadata } from './metadata';

it('paginates >500 chats and folders before pruning, and rejects partial/failed metadata', async () => {
  const store = new IndexedDbStore('owner', new IDBFactory()); await store.init();
  const ids = Array.from({ length: 601 }, (_, i) => String(i).padStart(4, '0'));
  const folders = ids.map((id) => ({ folder_id: id, user_id: 'owner', name: `Folder ${id}` }));
  let fail = false;
  const client = createDgClient({ url: 'https://metadata-fixture.invalid', key: 'synthetic',
    storage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
    fetch: async (input, init) => {
      init?.signal?.throwIfAborted();
      const url = new URL(String(input)); const table = url.pathname.split('/').at(-1);
      const after = url.searchParams.get(table === 'chats' ? 'chat_id' : 'folder_id')?.replace(/^gt\./, '') ?? '';
      if (fail && table === 'folders' && after) return new Response('{}', { status: 500 });
      const rows = table === 'folders' ? folders.filter((row) => row.folder_id > after).slice(0, 500)
        : table === 'chats' ? ids.filter((id) => id > after).slice(0, 500).map((id) => ({ chat_id: id, created_by: 'owner', created_at: '2026-11-15T00:00:00Z', type: 'group', title: id, direct_key: null, next_seq: 1 }))
        : [];
      return new Response(JSON.stringify(rows), { headers: { 'Content-Type': 'application/json' } });
    } });
  const controller = new AbortController();
  try {
    const chats = await browserSource(client, 'owner', controller.signal, () => true).fetchChats();
    expect(chats.error).toBeNull(); expect(chats.data?.map((row) => row.chat_id)).toEqual(ids);
    await refreshMetadata(client, store, controller.signal, () => true);
    expect(await store.list('folders')).toEqual(folders);
    fail = true;
    await expect(refreshMetadata(client, store, controller.signal, () => true)).rejects.toThrow('retained');
    expect(await store.list('folders')).toEqual(folders);
    await expect(refreshMetadata(client, store, controller.signal, () => false)).rejects.toThrow('incomplete');
    expect(await store.list('folders')).toEqual(folders);
  } finally { controller.abort(); store.close(); await client.auth.dispose(); }
});

it('fails closed for malformed sync REST rows and stale ownership before reading', async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify([{ message_id: 'm', chat_id: 'c', sync_seq: Number.NaN }]), { headers: { 'Content-Type': 'application/json' } }));
  const client = createDgClient({ url: 'https://sync-validation-fixture.invalid', key: 'synthetic', storage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} }, fetch });
  try {
    const source = browserSource(client, 'owner', new AbortController().signal, () => true);
    expect((await source.fetchMessagesAfter('c', 0, 500)).error).toMatchObject({ kind: 'server', status: 502 });
    expect(() => browserSource(client, 'owner', new AbortController().signal, () => false).fetchChats()).toThrow('ownership');
    expect(fetch).toHaveBeenCalledTimes(1);
  } finally { await client.auth.dispose(); }
});
