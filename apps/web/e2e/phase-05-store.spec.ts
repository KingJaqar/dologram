import { expect, test, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import type * as Harness from '../test/store-harness';

declare global {
  interface Window {
    storeHarness: typeof Harness;
    store: InstanceType<typeof Harness.IndexedDbStore>;
    runtime: Awaited<ReturnType<typeof Harness.runtime>>;
    changes: number[];
  }
}
let bundle = '';
test.beforeAll(async () => {
  const result = await build({ entryPoints: [resolve('test/store-harness.ts')], bundle: true, write: false, format: 'iife', globalName: 'storeHarness', platform: 'browser' });
  bundle = result.outputFiles?.[0]?.text ?? '';
  expect(bundle.length).toBeGreaterThan(0);
});
async function open(page: Page) {
  await page.route('http://127.0.0.1:3105/**', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><title>Local store verification</title></head><body></body></html>' }));
  await page.goto('http://127.0.0.1:3105/');
  await page.addScriptTag({ content: bundle });
}
test.beforeEach(async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => { if (['warning', 'error'].includes(message.type())) problems.push(message.text()); });
  Reflect.set(page, 'storeProblems', problems);
  await open(page);
});
test.afterEach(async ({ page }) => { expect(Reflect.get(page, 'storeProblems')).toEqual([]); });

test('real IndexedDB survives reopen, Blob/ArrayBuffer and aborted upgrade', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { IndexedDbStore, queueItem } = window.storeHarness;
    const store = new IndexedDbStore('a'); await store.init();
    const item = queueItem('z');
    item.payload.attachment_count = 2;
    item.payload.attachments = ['blob-data', 'buffer-data'].map((id) => ({ media_id: id, media_type: 'file', mime: 'text/plain', size_bytes: 3, local_uri: id, compressed: false }));
    await store.tryInsert(item, 200, [
      { id: 'blob-data', message_id: 'z', body: new Blob(['abc']), mime: 'text/plain', name: 'blob' },
      { id: 'buffer-data', message_id: 'z', body: new TextEncoder().encode('def').buffer, mime: 'text/plain', name: 'buffer' },
    ]);
    await store.insert(queueItem('a')); await store.setCursor('chat', 19); store.close();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('dologram', 3);
      req.onupgradeneeded = () => { req.result.createObjectStore('rolled_back'); req.transaction?.abort(); };
      req.onerror = () => resolve(); req.onsuccess = () => { req.result.close(); reject(new Error('Upgrade should abort')); };
    });
    const reopened = new IndexedDbStore('a');
    const member = (user_id: string) => ({ chat_id: 'chat', user_id, archived: false, joined_at: '2026-01-01', last_read_seq: 0, muted_until: null, role: 'member' });
    await reopened.replaceMembers('chat', [member('a'), member('b')]);
    await reopened.replaceMembers('chat', [member('b')]);
    const members = (await reopened.list('members')).map((row) => row.user_id);
    const ids = (await reopened.listUnsent()).map((row) => row.temp_id);
    const blobs = await reopened.list('blobs');
    const values = await Promise.all(blobs.map((row) => row.body instanceof Blob ? row.body.text() : new TextDecoder().decode(row.body)));
    const cursor = await reopened.getCursor('chat'); reopened.close();
    return { ids, values, cursor, members };
  });
  expect(result).toEqual({ ids: ['z', 'a'], values: ['abc', 'def'], cursor: 19, members: ['b'] });
});

test('two tabs atomically admit 199/200/201 and refresh committed siblings within one second', async ({ page, context }) => {
  const sibling = await context.newPage(); await open(sibling);
  try {
    await page.evaluate(async () => {
      window.store = new window.storeHarness.IndexedDbStore('a'); await window.store.init();
      for (let n = 0; n < 199; n++) await window.store.insert(window.storeHarness.queueItem(`seed-${n}`));
    });
    await sibling.evaluate(async () => {
      window.store = new window.storeHarness.IndexedDbStore('a'); await window.store.init();
      window.changes = []; window.store.subscribe(() => window.changes.push(Date.now()));
    });
    const at = Date.now();
    const results = await Promise.all([
      page.evaluate(() => window.store.tryInsert(window.storeHarness.queueItem('race-a'), 200)),
      sibling.evaluate(() => window.store.tryInsert(window.storeHarness.queueItem('race-b'), 200)),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    await expect.poll(() => sibling.evaluate(() => window.changes.length), { timeout: 1000 }).toBeGreaterThan(0);
    expect(await sibling.evaluate(() => Math.min(...window.changes))).toBeLessThan(at + 1000);
    expect(await page.evaluate(() => window.store.countUnsent())).toBe(200);
    expect(await sibling.evaluate(async () => (await window.store.listUnsent()).slice(0, 2).map((row) => row.temp_id))).toEqual(['seed-0', 'seed-1']);
    await sibling.evaluate(() => { window.changes = []; });
    const committed = Date.now(); await page.evaluate(() => window.store.setCursor('broadcast', 27));
    await expect.poll(() => sibling.evaluate(() => window.changes.length), { timeout: 1000 }).toBeGreaterThan(0);
    expect(await sibling.evaluate(() => Math.min(...window.changes))).toBeLessThan(committed + 1000);
    expect(await sibling.evaluate(() => window.store.getCursor('broadcast'))).toBe(27);
  } finally { await sibling.close(); }
});

test('visible leadership waits for abort settlement, fences old callbacks and recovers after crash', async ({ page, context }) => {
  const sibling = await context.newPage(); await open(sibling);
  try {
    await page.evaluate(async () => { window.runtime = await window.storeHarness.runtime(); });
    await expect.poll(() => page.evaluate(() => window.runtime.leases.length)).toBe(1);
    await sibling.evaluate(async () => { window.runtime = await window.storeHarness.runtime(); });
    expect(await sibling.evaluate(() => window.runtime.leases.length)).toBe(0);
    await page.evaluate(async () => {
      await window.runtime.store.insert(window.storeHarness.queueItem('recover'));
      const lease = window.runtime.leases[0]; if (!lease) throw new Error('Missing lease');
      await window.runtime.store.workerStore(lease.current).update({ ...window.storeHarness.queueItem('recover'), status: 'sending' });
      void lease.run((signal) => new Promise<void>((resolve) => { signal.addEventListener('abort', () => setTimeout(resolve, 60), { once: true }); })).catch(() => undefined);
    });
    const at = Date.now();
    await page.evaluate(() => window.runtime.visibility.set('hidden'));
    await expect.poll(() => sibling.evaluate(() => window.runtime.leases.length), { timeout: 2000 }).toBe(1);
    expect(Date.now() - at).toBeLessThan(2000);
    expect(await sibling.evaluate(async () => (await window.runtime.store.get('recover'))?.status)).toBe('queued');
    expect(await page.evaluate(async () => {
      const lease = window.runtime.leases[0]; if (!lease) throw new Error('Missing lease');
      try { await window.runtime.store.workerStore(lease.current).update({ ...window.storeHarness.queueItem('recover'), status: 'sent' }); return false; } catch { return true; }
    })).toBe(true);
    await page.evaluate(() => window.runtime.visibility.set('visible'));
    await sibling.close();
    await expect.poll(() => page.evaluate(() => window.runtime.leases.length), { timeout: 2000 }).toBe(2);
    expect(await page.evaluate(() => window.runtime.failures)).toEqual([]);
    await page.evaluate(async () => { await window.runtime.leader.stop(); window.runtime.store.close(); });
  } finally { if (!sibling.isClosed()) await sibling.close(); }
});

test('quota/interruption retains draft and atomically rolls back blobs and queue', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const store = new window.storeHarness.IndexedDbStore('a'); await store.init();
    const draft = window.storeHarness.queueItem('draft'); draft.payload.attachment_count = 1;
    draft.payload.attachments = [{ media_id: 'm', media_type: 'file', mime: 'text/plain', size_bytes: 3, local_uri: 'blob', compressed: false }];
    const original = IDBObjectStore.prototype.add;
    let failed = false;
    IDBObjectStore.prototype.add = function (...args: Parameters<typeof original>) {
      if (this.name === 'blobs') throw new DOMException('Full', 'QuotaExceededError');
      return original.apply(this, args);
    };
    try { await store.tryInsert(draft, 200, [{ id: 'blob', message_id: 'draft', body: new Blob(['abc']), mime: 'text/plain', name: 'draft-file' }]); }
    catch { failed = true; }
    finally { IDBObjectStore.prototype.add = original; }
    const rows = await store.listUnsent(); const blobs = await store.list('blobs'); store.close();
    return { failed, rows: rows.length, blobs: blobs.length, text: draft.payload.content, files: draft.payload.attachments.length };
  });
  expect(result).toEqual({ failed: true, rows: 0, blobs: 0, text: 'Retained draft', files: 1 });
});

test('sign-out clears logically before blocked deletion, fences A and isolates B', async ({ page, context }) => {
  const sibling = await context.newPage(); await open(sibling);
  try {
    await page.evaluate(async () => { window.store = new window.storeHarness.IndexedDbStore('a'); await window.store.insert(window.storeHarness.queueItem('private')); });
    await sibling.evaluate(async () => {
      const req = indexedDB.open('dologram', 2);
      await new Promise<void>((resolve) => { req.onsuccess = () => { Reflect.set(window, 'blockingDb', req.result); resolve(); }; });
    });
    expect(await page.evaluate(() => window.store.wipe())).toBe('retained');
    await sibling.evaluate(() => { const db = Reflect.get(window, 'blockingDb') as IDBDatabase; db.close(); });
    const result = await page.evaluate(async () => {
      const b = new window.storeHarness.IndexedDbStore('b'); await b.init();
      let fenced = false; try { await window.store.insert(window.storeHarness.queueItem('late')); } catch { fenced = true; }
      const rows = await b.listUnsent(); b.close(); return { fenced, rows };
    });
    expect(result).toEqual({ fenced: true, rows: [] });
  } finally { await sibling.close(); }
});

test('blocked opening times out without exposing data or leaving a usable late handle', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const initial = new window.storeHarness.IndexedDbStore('a'); await initial.insert(window.storeHarness.queueItem('private')); initial.close();
    const raw = await new Promise<IDBDatabase>((resolve) => { const req = indexedDB.open('dologram', 2); req.onsuccess = () => resolve(req.result); });
    const upgrade = indexedDB.open('dologram', 3);
    const finished = new Promise<void>((resolve) => { upgrade.onsuccess = () => { upgrade.result.close(); resolve(); }; });
    const blocked = new window.storeHarness.IndexedDbStore('b');
    let message = ''; try { await blocked.init(); } catch (error) { message = error instanceof Error ? error.message : ''; }
    raw.close(); await finished; blocked.close();
    return message;
  });
  expect(result).toContain('storage is blocked');
});

test('owner/epoch messages reject foreign scopes and quiesce sibling leadership before B opens', async ({ page, context }) => {
  const sibling = await context.newPage(); await open(sibling);
  try {
    await page.evaluate(async () => { window.runtime = await window.storeHarness.runtime(); });
    await expect.poll(() => page.evaluate(() => window.runtime.leases.length)).toBe(1);
    await sibling.evaluate(async () => { window.store = new window.storeHarness.IndexedDbStore('a'); await window.store.init(); });
    await page.evaluate(() => { window.changes = []; window.runtime.store.subscribe(() => window.changes.push(Date.now())); });
    await sibling.evaluate(() => {
      const channel = new BroadcastChannel('dg-store');
      channel.postMessage({ kind: 'quiesce', owner: 'foreign', epoch: window.store.sessionEpoch });
      channel.postMessage({ kind: 'quiesce', owner: 'a', epoch: 'stale' });
      channel.postMessage({ kind: 'changed', owner: 'a', epoch: window.store.sessionEpoch }); channel.close();
    });
    await expect.poll(() => page.evaluate(() => window.changes.length)).toBe(1);
    expect(await page.evaluate(() => window.runtime.leases[0]?.current())).toBe(true);
    expect(await sibling.evaluate(() => window.store.wipe())).toBe('deleted');
    await expect.poll(() => page.evaluate(() => window.runtime.leases[0]?.current())).toBe(false);
    expect(await page.evaluate(async () => {
      const lease = window.runtime.leases[0]; if (!lease) throw new Error('Missing lease');
      try { await lease.run(async () => 'forbidden'); return false; } catch { return true; }
    })).toBe(true);
    await sibling.evaluate(async () => {
      window.store = new window.storeHarness.IndexedDbStore('b'); await window.store.init();
      await window.store.insert(window.storeHarness.queueItem('b-private', 'b'));
    });
    expect(await sibling.evaluate(async () => (await window.store.listUnsent()).map((row) => row.temp_id))).toEqual(['b-private']);
  } finally { await sibling.close(); }
});
