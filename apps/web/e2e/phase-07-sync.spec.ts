import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import type * as Harness from '../test/sync-harness';
import type { ChatMemberRow, ChatRow, MessageRow, MessageMediaRow, ReactionRow } from '@dologram/shared';

declare global { interface Window { syncHarness: typeof Harness; syncRuntime: Awaited<ReturnType<typeof Harness.runtime>> } }
const chat = '11111111-1111-4111-8111-111111111111';
const owner = '22222222-2222-4222-8222-222222222222';
const date = '2026-11-15T00:00:00Z';
let bundle = '';
test.beforeAll(async () => {
  const result = await build({ entryPoints: [resolve('test/sync-harness.ts')], bundle: true, write: false, format: 'iife', globalName: 'syncHarness', platform: 'browser' });
  bundle = result.outputFiles?.[0]?.text ?? ''; expect(bundle.length).toBeGreaterThan(0);
});
async function open(page: Page) {
  await page.route('http://127.0.0.1:3107/**', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Sync fixture</title>' }));
  await page.goto('http://127.0.0.1:3107/'); await page.addScriptTag({ content: bundle });
  await page.evaluate(async () => { window.syncRuntime = await window.syncHarness.runtime(); });
}
async function backend(context: BrowserContext) {
  const row: ChatRow = { chat_id: chat, created_by: owner, type: 'group', title: 'Fixture', created_at: date, direct_key: null, next_seq: 2000 };
  let chats: ChatRow[] = [row];
  let members: ChatMemberRow[] = [{ chat_id: chat, user_id: owner, archived: false, joined_at: date, last_read_seq: 0, role: 'member', muted_until: null, nickname: null }];
  const messages: MessageRow[] = Array.from({ length: 1201 }, (_, i) => ({ message_id: `m${i + 1}`, chat_id: chat, sender_id: owner, content: `message ${i + 1}`, attachment_count: 0, reply_to: null, seq: i + 1, sync_seq: i + 1, created_at: date, edited_at: null, deleted_at: null }));
  const media: MessageMediaRow[] = [{ media_id: 'media', chat_id: chat, message_id: 'm1', media_type: 'photo', compressed: false, storage_path: `${chat}/media`, sync_seq: 5000, deleted_at: date }];
  const reactions: ReactionRow[] = [{ chat_id: chat, message_id: 'm1', user_id: owner, emoji: '👍', sync_seq: 6000, removed_at: date }];
  let failMembers = false; let failFolders = false;
  const calls: { page: Page; path: string; after: string | null }[] = [];
  let hold: Promise<void> | undefined;
  await context.exposeBinding('syncRequest', async ({ page }, input: string) => {
    const url = new URL(input); const path = url.pathname.split('/').at(-1) ?? '';
    calls.push({ page, path, after: url.searchParams.get('sync_seq') });
    if (hold) await hold;
    const json = (body: unknown, status = 200) => ({ body, status });
    if (path === 'get_chat_member_snapshot') return failMembers ? json({ members, total_count: members.length + 1 }) : json({ members, total_count: members.length });
    if (path === 'chats') {
      const id = url.searchParams.get('chat_id');
      if (id?.startsWith('eq.')) return json(chats.find((r) => r.chat_id === id.slice(3)) ?? null);
      return json(id?.startsWith('gt.') ? [] : chats);
    }
    if (path === 'profiles') return json([]);
    if (path === 'folders') return failFolders ? json({ code: 'XX000' }, 500) : json(url.searchParams.has('folder_id') ? [] : [{ folder_id: 'folder', user_id: owner, name: 'Fixture folder' }]);
    if (path === 'folder_chats') {
      const after = url.searchParams.get('chat_id')?.slice(3) ?? '';
      return json(Array.from({ length: 601 }, (_, i) => ({ folder_id: 'folder', chat_id: `c${String(i).padStart(4, '0')}` })).filter((r) => r.chat_id > after).slice(0, 500));
    }
    const rows = path === 'messages' ? messages : path === 'message_media' ? media : reactions;
    const after = Number(url.searchParams.get('sync_seq')?.slice(3) ?? 0);
    return json(rows.filter((r) => r.sync_seq > after).sort((a, b) => a.sync_seq - b.sync_seq).slice(0, Number(url.searchParams.get('limit') ?? 500)));
  });
  return { calls, messages, media, reactions, members: (value: ChatMemberRow[]) => { members = value; },
    failMembers: (value: boolean) => { failMembers = value; }, failFolders: (value: boolean) => { failFolders = value; },
    chats: (value: ChatRow[]) => { chats = value; }, hold: (value: Promise<void> | undefined) => { hold = value; } };
}
test.beforeEach(async ({ context }) => {
  const problems: string[] = [];
  context.on('page', (page) => { page.on('pageerror', (error) => problems.push(error.message)); page.on('console', (m) => { if (['warning', 'error'].includes(m.type())) problems.push(m.text()); }); });
  Reflect.set(context, 'syncProblems', problems);
});
test.afterEach(async ({ context }) => {
  for (const page of context.pages()) await page.evaluate(async () => { if (window.syncRuntime) await window.syncRuntime.close(); });
  expect(Reflect.get(context, 'syncProblems')).toEqual([]);
});
async function online(page: Page) { await page.evaluate(() => window.syncRuntime.connectivity.set(true)); }
async function synced(page: Page) { await expect.poll(() => page.evaluate(() => window.syncRuntime.statuses.at(-1)), { timeout: 25_000 }).toBe('synced'); }

test('legacy replay restores all IDs beyond page 1, tombstones and >500 folder memberships', async ({ page, context }) => {
  const api = await backend(context); await open(page);
  await page.evaluate(async () => { await window.syncRuntime.store.setCursor(window.syncHarness.chat, 9000); });
  await online(page); await synced(page);
  const actual = await page.evaluate(async () => ({ messages: await window.syncRuntime.store.list('messages'), media: await window.syncRuntime.store.list('media'), reactions: await window.syncRuntime.store.list('reactions'), cursor: await window.syncRuntime.store.getCursor(window.syncHarness.chat), links: await window.syncRuntime.store.list('folder_chats') }));
  expect(actual.messages.sort((a, b) => a.seq - b.seq)).toEqual(api.messages);
  expect(actual.media).toEqual(api.media); expect(actual.reactions).toEqual(api.reactions); expect(actual.cursor).toBe(6000);
  expect(actual.links).toHaveLength(601); expect(actual.links.at(-1)?.chat_id).toBe('c0600');
  expect(api.calls.some((call) => call.after === 'gt.500')).toBe(true);
  await page.evaluate(() => { window.syncRuntime.emit('messages', { ...window.syncHarness.message(1), sync_seq: 9000, content: '', deleted_at: '2026-11-16T00:00:00Z' }); window.syncRuntime.emit('messages', window.syncHarness.message(1)); });
  await expect.poll(() => page.evaluate(async () => (await window.syncRuntime.store.list('messages')).find((r) => r.message_id === 'm1')?.sync_seq)).toBe(9000);
  expect(await page.evaluate(() => window.syncRuntime.store.getCursor(window.syncHarness.chat))).toBe(6000);
});

test('partial roster and failed folders retain cache; confirmed removal and rejoin reconcile', async ({ page, context }) => {
  const api = await backend(context); await open(page); await online(page); await synced(page);
  api.failMembers(true);
  await page.evaluate(() => window.syncRuntime.emit('chat_members', {}, { chat_id: window.syncHarness.chat }));
  await expect.poll(() => page.evaluate(() => window.syncRuntime.statuses.at(-1))).toBe('degraded');
  expect(await page.evaluate(() => window.syncRuntime.store.list('members'))).toHaveLength(1);
  api.failMembers(false); api.failFolders(true);
  expect(await page.evaluate(async () => { try { await window.syncHarness.refreshMetadata(window.syncRuntime.client, window.syncRuntime.store, new AbortController().signal, () => true); return false; } catch { return true; } })).toBe(true);
  expect(await page.evaluate(() => window.syncRuntime.store.list('folder_chats'))).toHaveLength(601);
  api.chats([]);
  await page.evaluate(() => window.syncRuntime.emit('chat_members', {}, { chat_id: window.syncHarness.chat }));
  await expect.poll(() => page.evaluate(() => window.syncRuntime.store.listChatIds())).toEqual([]);
  expect(await page.evaluate(() => window.syncRuntime.store.list('messages'))).toEqual([]);
  api.chats([{ chat_id: chat, created_by: owner, type: 'group', title: 'Rejoined', created_at: date, direct_key: null, next_seq: 2000 }]);
  api.members([{ chat_id: chat, user_id: owner, joined_at: '2026-11-16T00:00:00Z', last_read_seq: 0, role: 'member', archived: true, muted_until: null }]);
  await page.evaluate(() => window.syncRuntime.emit('messages', window.syncHarness.message(1201)));
  await expect.poll(() => page.evaluate(() => window.syncRuntime.store.list('members'))).toMatchObject([{ archived: true, joined_at: '2026-11-16T00:00:00Z' }]);
});

test('one visible owner catches up and broadcasts cache invalidations; stale owner starts no reads', async ({ page, context }) => {
  const api = await backend(context); await open(page); await online(page); await synced(page);
  const sibling = await context.newPage(); await open(sibling); await online(sibling);
  expect(await sibling.evaluate(() => window.syncRuntime.counts().subscriptions)).toBe(0);
  expect(await sibling.evaluate(() => window.syncRuntime.store.list('messages'))).toHaveLength(1201);
  await page.evaluate(() => window.syncRuntime.visibility.set('hidden'));
  await synced(sibling); const hiddenCount = api.calls.filter((call) => call.page === page).length;
  const first = api.messages[0]; if (!first) throw new Error('Missing fixture');
  api.messages.push({ ...first, message_id: 'new', seq: 1202, sync_seq: 7000 });
  await sibling.evaluate(() => { window.syncRuntime.status('SUBSCRIBED'); });
  await expect.poll(() => page.evaluate(async () => (await window.syncRuntime.store.list('messages')).some((r) => r.message_id === 'new'))).toBe(true);
  expect(api.calls.filter((call) => call.page === page)).toHaveLength(hiddenCount);
  expect(await page.evaluate(() => window.syncRuntime.counts().removals)).toBeGreaterThan(0);
});

test('refused joins expose degraded state and bounded 15-second diagnostic catch-up', async ({ page, context }) => {
  const api = await backend(context); await page.clock.install(); await open(page);
  await page.evaluate(() => window.syncRuntime.join('CHANNEL_ERROR')); await online(page);
  await expect.poll(() => page.evaluate(() => window.syncRuntime.statuses.at(-1))).toBe('degraded');
  await expect.poll(() => page.evaluate(async () => (await window.syncRuntime.store.list('folder_chats')).length), { timeout: 25_000 }).toBe(601);
  const count = api.calls.length; await page.clock.runFor(15_000);
  await expect.poll(() => api.calls.length).toBeGreaterThan(count);
  await expect.poll(() => page.evaluate(() => window.syncRuntime.counts().subscriptions)).toBe(2);
  await page.evaluate(() => window.syncRuntime.visibility.set('hidden'));
  const hiddenCount = api.calls.length; await page.clock.runFor(120_000); expect(api.calls.length).toBe(hiddenCount);
});

test('account change during reads fences stale responses and preserves owned data', async ({ page, context }) => {
  const api = await backend(context); await open(page);
  let release = () => {}; const held = new Promise<void>((resolve) => { release = resolve; }); api.hold(held);
  await online(page); await expect.poll(() => api.calls.length).toBeGreaterThan(0);
  await page.evaluate(async () => { window.syncRuntime.invalidate(); const other = new window.syncHarness.IndexedDbStore('other'); await other.init(); other.close(); });
  api.hold(undefined); release();
  await expect.poll(() => page.evaluate(() => window.syncRuntime.counts().removals)).toBeGreaterThan(0);
  expect(await page.evaluate(async () => { const other = new window.syncHarness.IndexedDbStore('other'); const rows = await other.list('messages'); other.close(); return rows; })).toEqual([]);
});

test('real schema-v1 upgrade excludes legacy writers and preserves cached work through reset/restart', async ({ page, context }) => {
  await backend(context); await open(page);
  const result = await page.evaluate(async () => {
    const { store } = window.syncRuntime;
    const queued = window.syncHarness.queueItem('retained-draft', window.syncHarness.owner);
    queued.status = 'failed'; queued.payload.attachment_count = 1;
    queued.payload.attachments = [{ media_id: 'md', media_type: 'file', mime: 'text/plain', size_bytes: 1, local_uri: 'retained-blob', compressed: false }];
    await store.tryInsert(queued, 200, [{ id: 'retained-blob', message_id: queued.temp_id, body: new Uint8Array([42]).buffer, mime: 'text/plain', name: 'retained' }]);
    await store.setCursor(window.syncHarness.chat, 9000);
    await store.upsertMessage(window.syncHarness.message(1));
    await window.syncRuntime.close();
    const req = indexedDB.open('dologram', 2);
    const db = await new Promise<IDBDatabase>((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    const request = <T,>(input: IDBRequest<T>) => new Promise<T>((resolve, reject) => { input.onsuccess = () => resolve(input.result); input.onerror = () => reject(input.error); });
    const names = [...db.objectStoreNames];
    const tx = db.transaction(names, 'readonly');
    const snapshot = await Promise.all(names.map(async (name) => {
      const table = tx.objectStore(name);
      const indexes = [...table.indexNames].map((name) => { const index = table.index(name); return { name, keyPath: index.keyPath, unique: index.unique }; });
      const [values, keys] = await Promise.all([request(table.getAll()), request(table.getAllKeys())]);
      return { name, keyPath: table.keyPath, indexes, values: values as unknown[], keys };
    }));
    db.close();
    await request(indexedDB.deleteDatabase('dologram'));
    const legacyRequest = indexedDB.open('dologram', 1);
    legacyRequest.onupgradeneeded = () => {
      for (const entry of snapshot) {
        const table = legacyRequest.result.createObjectStore(entry.name, { keyPath: entry.keyPath });
        for (const index of entry.indexes) table.createIndex(index.name, index.keyPath, { unique: index.unique });
        entry.values.forEach((value, i) => { if (entry.keyPath) table.put(value); else table.put(value, entry.keys[i]); });
      }
    };
    const legacy = await request(legacyRequest); legacy.close();
    window.syncRuntime = await window.syncHarness.runtime();
    let rejectedLegacy = false;
    try { const old = await request(indexedDB.open('dologram', 1)); old.close(); } catch { rejectedLegacy = true; }
    const upgraded = window.syncRuntime.store;
    await upgraded.upgradeCheckpoints(() => true);
    const reset = await upgraded.getCursor(window.syncHarness.chat);
    await upgraded.setCursor(window.syncHarness.chat, 10);
    await upgraded.upgradeCheckpoints(() => true);
    return { rejectedLegacy, reset, cursor: await upgraded.getCursor(window.syncHarness.chat), queue: await upgraded.get('retained-draft'),
      bytes: [...new Uint8Array((await upgraded.list('blobs'))[0]?.body as ArrayBuffer)], messages: await upgraded.list('messages'),
      snapshotTables: snapshot.length };
  });
  expect(result.rejectedLegacy).toBe(true); expect(result.reset).toBe(0); expect(result.cursor).toBe(10);
  expect(result.queue).toMatchObject({ temp_id: 'retained-draft', status: 'failed' });
  expect(result.bytes).toEqual([42]); expect(result.messages).toMatchObject([{ message_id: 'm1', content: 'message 1' }]);
  expect(result.snapshotTables).toBe(13);
});
