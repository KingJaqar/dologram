import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDbStore, type Records } from './IndexedDbStore';
import type { QueueItem } from '@dologram/shared/src/queue/types';
import { createQueueCore } from '@dologram/shared/src/queue/core';
import { config } from '@dologram/shared/src/config';
import { createStoreQuery } from './useStoreQuery';
import { WorkerLeader } from '../worker/leader';

export function item(id: string, owner = 'a'): QueueItem {
  return { temp_id: id, chat_id: 'chat', status: 'queued', retry_count: 0, next_attempt_at: 0, row_may_exist: false, row_state: 'absent', last_error: null, created_at: 1, payload: { kind: 'text', chat_id: 'chat', sender_id: owner, content: 'Retained draft', reply_to: null, attachment_count: 0, attachments: [] } };
}
const opened: IndexedDbStore[] = [];
function setup() {
  const factory = new IDBFactory();
  const open = (owner = 'a') => { const store = new IndexedDbStore(owner, factory); opened.push(store); return store; };
  return { factory, open };
}
afterEach(() => { opened.splice(0).forEach((store) => store.close()); vi.restoreAllMocks(); });
const member = (user: string, chat = 'chat'): Records['members'] => ({ chat_id: chat, user_id: user, archived: false, joined_at: '2026-01-01', last_read_seq: 0, muted_until: null, role: 'member' });

describe('durable owned store', () => {
  it('fences delivered cache writes and retains a newer tombstone over a delayed insert response', async () => {
    const { open } = setup(); const store = open(); await store.init();
    const row: Records['messages'] = { message_id: 'm', chat_id: 'chat', sender_id: 'a', content: 'text', attachment_count: 0,
      reply_to: null, seq: 1, sync_seq: 1, created_at: '2026-11-15T00:00:00Z', edited_at: null, deleted_at: null };
    await store.upsertMessage({ ...row, content: '', sync_seq: 2, deleted_at: '2026-11-15T01:00:00Z' });
    await store.upsertMessage(row, () => true);
    expect(await store.list('messages')).toMatchObject([{ content: '', sync_seq: 2 }]);
    await expect(store.upsertMessage({ ...row, sync_seq: 3 }, () => false)).rejects.toThrow('ownership');
    expect(await store.list('messages')).toMatchObject([{ content: '', sync_seq: 2 }]);
  });
  it('reopens queue, ArrayBuffers, cache/cursors, complete members and stable insertion order', async () => {
    const { open } = setup(); const a = open(); await a.init();
    const first = item('z'); first.payload.attachment_count = 1;
    first.payload.attachments = [{ media_id: 'media', media_type: 'file', mime: 'text/plain', size_bytes: 2, local_uri: 'blob:durable', compressed: false }];
    await a.tryInsert(first, 200, [{ id: 'blob:durable', message_id: 'z', body: new Uint8Array([4, 5]).buffer, mime: 'text/plain', name: 'file' }]);
    await a.insert(item('a')); await a.setCursor('chat', 8); await a.setCursor('chat', 2);
    await a.replaceMembers('chat', [member('a'), member('b')]);
    await a.replaceMembers('other', [member('c', 'other')]);
    await a.replaceMembers('chat', [member('b')]);
    a.close(); const reopened = open();
    expect((await reopened.listUnsent()).map((row) => row.temp_id)).toEqual(['z', 'a']);
    expect(await reopened.getCursor('chat')).toBe(8);
    expect((await reopened.list('members')).map((row) => row.user_id).sort()).toEqual(['b', 'c']);
    const blobs = await reopened.list('blobs'); expect(new Uint8Array(blobs[0]?.body as ArrayBuffer)).toEqual(new Uint8Array([4, 5]));
    await expect(reopened.replaceMembers('chat', [member('x', 'bad')])).rejects.toThrow('Invalid member');
    expect((await reopened.list('members')).length).toBe(2);
  });
  it('serializes 199/200/201 admission across clients and shared core without losing order', async () => {
    const { open } = setup(); const a = open(); const b = open(); await Promise.all([a.init(), b.init()]);
    for (let n = 0; n < 199; n++) await a.insert(item(`seed-${n}`));
    const core = (store: IndexedDbStore) => createQueueCore({ store, timing: config.queue, now: () => 1, random: () => 0 });
    const results = await Promise.all([core(a).enqueue({ messageId: 'race-a', payload: item('x').payload }), core(b).enqueue({ messageId: 'race-b', payload: item('x').payload })]);
    expect(results.filter((result) => result.ok)).toHaveLength(1); expect(await a.countUnsent()).toBe(200);
    expect((await b.listUnsent()).slice(0, 2).map((row) => row.temp_id)).toEqual(['seed-0', 'seed-1']);
    await expect(a.insert(item('201'))).rejects.toThrow('queue is full');
  });
  it('fences account changes, sign-out and old callbacks, and never exposes another owner', async () => {
    const { open } = setup(); const a = open(); await a.insert(item('private-a'));
    const b = open('b'); await b.init();
    expect(await b.listUnsent()).toEqual([]);
    await expect(a.get('private-a')).rejects.toThrow(/account changed|closed/);
    await expect(b.insert(item('wrong-owner'))).rejects.toThrow('Invalid queue');
    await b.insert(item('private-b', 'b')); await b.clearAccount();
    const next = open('a'); expect((await next.listUnsent()).map((row) => row.temp_id)).toEqual(['private-a']);
    await expect(b.insert(item('late', 'b'))).rejects.toThrow('closed');
  });
  it('requires visible exclusive recovery and preserves a live sending row', async () => {
    const { open } = setup(); const a = open(); await a.insert({ ...item('sending'), status: 'sending' });
    const b = open(); await b.init(); await expect(b.resetSending()).rejects.toThrow('exclusive');
    expect((await a.get('sending'))?.status).toBe('sending');
    let current = true; const worker = a.workerStore(() => current); await worker.resetSending();
    expect((await a.get('sending'))?.status).toBe('queued');
    current = false; await expect(worker.resetSending()).rejects.toThrow('exclusive');
    await expect(worker.update({ ...item('sending'), status: 'sent' })).rejects.toThrow('ownership');
  });
  it('rolls back queue/blob interruption and quota failures, retaining caller draft and notifications', async () => {
    const { open } = setup(); const a = open(); await a.init(); const changed = vi.fn(); a.subscribe(changed);
    const draft = item('draft'); draft.payload.attachment_count = 1;
    draft.payload.attachments = [{ media_id: 'm', media_type: 'file', mime: 'text/plain', size_bytes: 1, local_uri: 'durable', compressed: false }];
    const before = structuredClone(draft);
    const original = IDBObjectStore.prototype.add;
    vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, ...args) {
      if (this.name === 'blobs') throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return original.apply(this, args);
    });
    await expect(a.tryInsert(draft, 200, [{ id: 'durable', message_id: 'draft', body: new Uint8Array([1]).buffer, mime: 'text/plain', name: 'file' }])).rejects.toThrow('Your draft has been kept');
    expect(draft).toEqual(before); expect(await a.listUnsent()).toEqual([]); expect(await a.list('blobs')).toEqual([]); expect(changed).not.toHaveBeenCalled();
  });
  it('rejects newer schema and unknown-owner populated stores without changing their data', async () => {
    const { factory, open } = setup(); const a = open(); await a.init(); a.close();
    const raw = await new Promise<IDBDatabase>((resolve) => { const req = factory.open('dologram', 2); req.onsuccess = () => resolve(req.result); });
    await new Promise<void>((resolve) => { const tx = raw.transaction(['metadata', 'messages'], 'readwrite'); tx.objectStore('metadata').delete('identity'); tx.objectStore('messages').put({ owner: 'unknown', key: 'secret' }); tx.oncomplete = () => resolve(); });
    raw.close(); await expect(open('b').init()).rejects.toThrow('quarantined');
    const newer = await new Promise<IDBDatabase>((resolve) => { const req = factory.open('dologram', 3); req.onsuccess = () => resolve(req.result); }); newer.close();
    await expect(open().init()).rejects.toThrow('newer');
  });
  it('notifies after commit only and clears linked cache rows atomically', async () => {
    const { open } = setup(); const a = open(); await a.init();
    const reads: Promise<number>[] = []; const unsubscribe = a.subscribe(() => { reads.push(a.getCursor('chat')); });
    await a.setCursor('chat', 42); expect(await Promise.all(reads)).toEqual([42]);
    await a.replaceMembers('chat', [member('a')]); await a.deleteChat('chat');
    expect(await a.getCursor('chat')).toBe(0); expect(await a.list('members')).toEqual([]);
    await Promise.all(reads); unsubscribe();
  });
});

it('query snapshots stay stable, reject stale reads and dispose without publishing', async () => {
  const { open } = setup(); const a = open(); await a.init();
  const pending: ((value: string) => void)[] = [];
  const query = createStoreQuery(a, () => new Promise<string>((resolve) => pending.push(resolve)));
  const unsubscribe = query.start(); const initial = query.getSnapshot(); expect(query.getSnapshot()).toBe(initial);
  query.refresh(); pending[1]?.('new'); await Promise.resolve(); expect(query.getSnapshot().data).toBe('new');
  const newer = query.getSnapshot(); pending[0]?.('stale'); await Promise.resolve(); expect(query.getSnapshot()).toBe(newer);
  query.refresh(); unsubscribe(); pending[2]?.('disposed'); await Promise.resolve(); expect(query.getSnapshot()).toBe(newer);
});

it('reports unsupported worker coordination as an explicit capability error', () => {
  const leader = new WorkerLeader('a', 'epoch', async () => undefined, vi.fn());
  expect(() => leader.start()).toThrow('Web Locks');
});


it('atomically resets inflated legacy checkpoints once; interruption retains rows, queue and blobs', async () => {
  const { open } = setup(); const store = open(); await store.init();
  await store.setCursor('chat', 9000);
  const queued = item('draft'); queued.payload.attachment_count = 1;
  queued.payload.attachments = [{ media_id: 'md', media_type: 'file', mime: 'text/plain', size_bytes: 1, local_uri: 'blob', compressed: false }];
  await store.tryInsert(queued, 200, [{ id: 'blob', message_id: 'draft', body: new Uint8Array([42]).buffer, mime: 'text/plain', name: 'retained' }]);
  const original = IDBObjectStore.prototype.put;
  const fault = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
    if (this.name === 'metadata' && Array.isArray(args[1]) && args[1][0] === 'sync-version') throw new DOMException('Interrupted', 'AbortError');
    return original.apply(this, args);
  });
  await expect(store.upgradeCheckpoints(() => true)).rejects.toThrow();
  expect(await store.getCursor('chat')).toBe(9000);
  fault.mockRestore();
  await store.upgradeCheckpoints(() => true);
  expect(await store.getCursor('chat')).toBe(0);
  await store.setCursor('chat', 10);
  store.close(); const restarted = open(); await restarted.upgradeCheckpoints(() => true);
  expect(await restarted.getCursor('chat')).toBe(10);
  expect(await restarted.get('draft')).toEqual(queued);
  expect(new Uint8Array((await restarted.list('blobs'))[0]?.body as ArrayBuffer)).toEqual(new Uint8Array([42]));
  await expect(restarted.syncStore(() => false).setCursor('chat', 20)).rejects.toThrow('ownership');
  expect(await restarted.getCursor('chat')).toBe(10);
});

it('keeps newer media/reaction tombstones and removes only orphan blobs after confirmed removal', async () => {
  const { open, factory } = setup(); const store = open(); await store.init();
  const media: Records['media'] = { media_id: 'md', message_id: 'm', chat_id: 'chat', media_type: 'file', compressed: false, storage_path: 'chat/md', sync_seq: 5, deleted_at: '2026-11-16T00:00:00Z' };
  const reaction: Records['reactions'] = { message_id: 'm', chat_id: 'chat', user_id: 'a', emoji: '👍', sync_seq: 6, removed_at: '2026-11-16T00:00:00Z' };
  await store.upsertMedia(media); await store.upsertMedia({ ...media, sync_seq: 1, deleted_at: null });
  await store.upsertReaction(reaction); await store.upsertReaction({ ...reaction, sync_seq: 2, removed_at: null });
  expect(await store.list('media')).toEqual([media]); expect(await store.list('reactions')).toEqual([reaction]);
  const queued = item('retained'); queued.payload.attachment_count = 1;
  queued.payload.attachments = [{media_id: 'md', media_type: 'file', mime: 'text/plain', size_bytes: 1, local_uri: 'owned-blob', compressed: false}];
  await store.tryInsert(queued, 200, [{id: 'owned-blob', message_id: 'retained', body: new Uint8Array([1]).buffer, mime: 'text/plain', name: 'retained'}]);
  const raw = await new Promise<IDBDatabase>((resolve, reject) => { const req = factory.open('dologram', 2); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
  await new Promise<void>((resolve, reject) => {
    const tx = raw.transaction(['blobs', 'pending_reads'], 'readwrite');
    const envelope = {owner: 'a', chat: 'chat', message: 'orphan', status: '', order: 0, seq: 0, time: 0};
    tx.objectStore('blobs').put({...envelope, key: 'orphan-blob', value: {id: 'orphan-blob', message_id: 'orphan', body: new ArrayBuffer(1), mime: 'text/plain', name: 'orphan'}});
    tx.objectStore('pending_reads').put({...envelope, key: 'chat', value: {chat_id: 'chat', seq: 5}});
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
  }); raw.close();
  await store.deleteChat('chat'); expect(await store.list('media')).toEqual([]); expect(await store.list('reactions')).toEqual([]);
  expect(await store.list('pending_reads')).toEqual([]);
  expect((await store.list('blobs')).map((row) => row.id)).toEqual(['owned-blob']);
  expect(await store.get('retained')).toEqual(queued);
  await expect(store.replaceMembers('chat', [])).rejects.toThrow('Invalid member');
});
