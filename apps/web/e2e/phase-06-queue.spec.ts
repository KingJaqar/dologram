import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import type * as Harness from '../test/queue-harness';
import type { MessageRow, QueueItem } from '@dologram/shared';

declare global {
  interface Window { queueHarness: typeof Harness; queueRuntime: Awaited<ReturnType<typeof Harness.runtime>> }
}
const chat = '11111111-1111-4111-8111-111111111111';
let bundle = '';
test.beforeAll(async () => {
  const result = await build({ entryPoints: [resolve('test/queue-harness.ts')], bundle: true, write: false, format: 'iife', globalName: 'queueHarness', platform: 'browser' });
  bundle = result.outputFiles?.[0]?.text ?? ''; expect(bundle.length).toBeGreaterThan(0);
});
async function open(page: Page) {
  await page.route('http://127.0.0.1:3106/**', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Queue fixture</title>' }));
  await page.goto('http://127.0.0.1:3106/');
  await page.addScriptTag({ content: bundle });
  await page.evaluate(async () => { window.queueRuntime = await window.queueHarness.runtime(); });
}
async function backend(context: BrowserContext) {
  const rows = new Map<string, MessageRow>();
  const calls: { page: Page; method: string; id: string }[] = [];
  let fault: 'none' | 'lost' | 'server' | 'forbidden' | 'unauthorized' = 'none';
  let lost = false;
  let hold: Promise<void> | undefined;
  await context.exposeBinding('queueRequest', async ({ page }, method: string, url: string, body: string, persisted: QueueItem[]) => {
    const id = method === 'POST' ? (JSON.parse(body) as { message_id: string }).message_id : new URL(url).searchParams.get('message_id')?.replace(/^eq\./, '') ?? '';
    calls.push({ page, method, id });
    if (method === 'POST') expect(persisted.find((item) => item.temp_id === id)).toMatchObject({ status: 'sending', row_state: 'unknown' });
    if (hold) await hold;
    if (fault === 'server') return { status: 500, body: { code: 'XX000' } };
    if (fault === 'forbidden') return { status: 403, body: { code: '42501' } };
    if (fault === 'unauthorized') return { status: 401, body: { code: 'PGRST301' } };
    if (method === 'POST') {
      if (rows.has(id)) return { status: 409, body: { code: '23505' } };
      const data = JSON.parse(body) as Pick<MessageRow, 'message_id' | 'chat_id' | 'sender_id' | 'content' | 'reply_to' | 'attachment_count'>;
      const row: MessageRow = { ...data, created_at: '2026-11-15T00:00:00Z', deleted_at: null, edited_at: null, seq: rows.size + 1, sync_seq: rows.size + 1 };
      rows.set(id, row);
      if (fault === 'lost' && !lost) { lost = true; return { status: 0, body: null, lost: true }; }
      return { status: 201, body: row };
    }
    const row = rows.get(id);
    if (!row) return { status: 406, body: { code: 'PGRST116' } };
    if (method === 'PATCH') { row.deleted_at = '2026-11-15T01:00:00Z'; row.content = ''; row.sync_seq++; }
    return { status: 200, body: row };
  });
  return { rows, calls, fault: (value: typeof fault) => { fault = value; }, hold: (value: Promise<void> | undefined) => { hold = value; } };
}
test.beforeEach(async ({ context }) => {
  const problems: string[] = [];
  context.on('page', (page) => {
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) problems.push(message.text()); });
  });
  Reflect.set(context, 'queueProblems', problems);
});
test.afterEach(async ({ context }) => {
  for (const page of context.pages()) await page.evaluate(async () => { if (window.queueRuntime) await window.queueRuntime.close(); });
  expect(Reflect.get(context, 'queueProblems')).toEqual([]);
});
async function enqueue(page: Page, content = 'Retained offline text') {
  return page.evaluate(async ({ chat, content }) => window.queueHarness.enqueueText(window.queueRuntime.store, { chatId: chat, content }), { chat, content });
}

test('offline persistence, lost response, exactly one row and cache-before-sent survive retry', async ({ page, context }) => {
  const api = await backend(context); api.fault('lost'); await open(page);
  await enqueue(page);
  expect(await page.evaluate(() => window.queueRuntime.store.countUnsent())).toBe(1); expect(api.calls).toHaveLength(0);
  await page.evaluate(() => window.queueRuntime.connectivity.set(true));
  await expect.poll(() => page.evaluate(async () => (await window.queueRuntime.store.listUnsent())[0]?.retry_count)).toBe(1);
  expect(api.rows.size).toBe(1);
  await page.evaluate(() => { window.queueRuntime.connectivity.set(false); window.queueRuntime.connectivity.set(true); });
  await expect.poll(() => page.evaluate(async () => (await window.queueRuntime.store.listSent()).length)).toBe(1);
  expect(api.rows.size).toBe(1); expect(api.calls.map((call) => call.method)).toEqual(['POST', 'POST', 'GET']);
  expect(await page.evaluate(async () => (await window.queueRuntime.store.list('messages')).length)).toBe(1);
  expect(await page.evaluate(() => window.queueRuntime.failures)).toEqual([]);
});

test('visible sibling enqueues, wakes leader and takes over after hidden owner without duplicate delivery', async ({ page, context }) => {
  const api = await backend(context); await open(page);
  await page.evaluate(() => window.queueRuntime.connectivity.set(true));
  await enqueue(page, 'first'); await expect.poll(() => api.rows.size).toBe(1);
  const sibling = await context.newPage(); await open(sibling);
  await sibling.evaluate(() => window.queueRuntime.connectivity.set(true));
  await enqueue(sibling, 'sibling wakes leader'); await expect.poll(() => api.rows.size).toBe(2);
  expect(api.calls.every((call) => call.page === page)).toBe(true);
  await page.evaluate(() => window.queueRuntime.visibility.set('hidden'));
  const hiddenCalls = api.calls.filter((call) => call.page === page).length;
  const start = Date.now(); await enqueue(sibling, 'after handoff'); await expect.poll(() => api.rows.size, { timeout: 2000 }).toBe(3);
  expect(Date.now() - start).toBeLessThan(2000);
  expect(api.calls.filter((call) => call.page === page)).toHaveLength(hiddenCalls);
  expect(api.calls.at(-1)?.page).toBe(sibling);
  expect(await sibling.evaluate(() => window.queueRuntime.failures)).toEqual([]);
});

test('eight online failures retain work, failed discard retains it, Retry resets, successful discard clears safely', async ({ page, context }) => {
  const api = await backend(context); api.fault('server'); await page.clock.install(); await open(page);
  await enqueue(page); await page.evaluate(() => window.queueRuntime.connectivity.set(true));
  for (let attempt = 1; attempt <= 8; attempt++) {
    await expect.poll(() => page.evaluate(async () => (await window.queueRuntime.store.listUnsent())[0]?.retry_count)).toBe(attempt);
    if (attempt < 8) await page.clock.fastForward(120_000);
  }
  expect(api.calls).toHaveLength(8);
  const retained = await page.evaluate(async () => {
    const item = (await window.queueRuntime.store.listUnsent())[0]; if (!item) throw new Error('Missing');
    const refused = await window.queueRuntime.worker.discard(item.temp_id);
    const retry = await window.queueRuntime.worker.retry(item.temp_id);
    return { refused, retry };
  });
  expect(retained.refused).toEqual({ ok: false, reason: 'server' });
  expect(retained.retry).toMatchObject({ ok: true, item: { retry_count: 0, row_state: 'unknown' } });
  api.fault('none');
  await page.evaluate(() => { window.queueRuntime.connectivity.set(false); window.queueRuntime.connectivity.set(true); });
  await expect.poll(() => api.rows.size).toBe(1);
  await expect.poll(() => page.evaluate(async () => (await window.queueRuntime.store.listSent()).length)).toBe(1);
  const discarded = await page.evaluate(async () => {
    const item = (await window.queueRuntime.store.listSent())[0]; if (!item) throw new Error('Missing');
    return window.queueRuntime.worker.discard(item.temp_id);
  });
  expect(discarded).toEqual({ ok: true }); expect([...api.rows.values()][0]?.deleted_at).not.toBeNull();
  expect(await page.evaluate(async () => (await window.queueRuntime.store.listSent()).length)).toBe(0);
});

test('offline mid-request preserves count; invalid session stops later independent work', async ({ page, context }) => {
  const api = await backend(context); api.fault('server'); await page.clock.install(); await open(page);
  let release: (() => void) | undefined;
  api.hold(new Promise<void>((resolve) => { release = resolve; }));
  await enqueue(page); await page.evaluate(() => window.queueRuntime.connectivity.set(true));
  await expect.poll(() => api.calls.length).toBe(1);
  await page.evaluate(() => window.queueRuntime.connectivity.set(false)); release?.(); api.hold(undefined);
  await expect.poll(() => page.evaluate(async () => (await window.queueRuntime.store.listUnsent())[0]?.status)).toBe('queued');
  expect(await page.evaluate(async () => (await window.queueRuntime.store.listUnsent())[0]?.retry_count)).toBe(0);
  api.fault('unauthorized'); await page.evaluate(() => window.queueRuntime.connectivity.set(true));
  await expect.poll(() => page.evaluate(() => window.queueRuntime.failures.length)).toBe(1);
  const requests = api.calls.length;
  await page.evaluate(async () => { await window.queueHarness.enqueueText(window.queueRuntime.store, { chatId: '33333333-3333-4333-8333-333333333333', content: 'must remain local' }); });
  await page.clock.fastForward(120_000);
  expect(api.calls).toHaveLength(requests);
  expect(await page.evaluate(() => window.queueRuntime.store.countUnsent())).toBe(2);
});

test('two-tab admission honors capacity and invalidated accounts initiate no requests', async ({ page, context }) => {
  const api = await backend(context); await open(page); const sibling = await context.newPage(); await open(sibling);
  const results = await Promise.all([page, sibling].map((tab) => tab.evaluate(async (chat) => {
    const outcomes = await Promise.all(Array.from({ length: 101 }, (_, index) => window.queueHarness.enqueueText(window.queueRuntime.store, { chatId: chat, content: `pending ${index}` })));
    return outcomes.filter((result) => result.ok).length;
  }, chat)));
  expect(results.reduce((sum, value) => sum + value, 0)).toBe(200);
  await page.evaluate(() => { window.queueRuntime.invalidate(); window.queueRuntime.connectivity.set(true); });
  await sibling.evaluate(() => { window.queueRuntime.invalidate(); window.queueRuntime.connectivity.set(true); });
  expect(api.calls).toHaveLength(0);
  expect(await page.evaluate(() => window.queueRuntime.store.countUnsent())).toBe(200);
});

test('interrupted hidden request settles before handoff, then recovers an uncertain committed row once', async ({ page, context }) => {
  const api = await backend(context); await open(page);
  let release: (() => void) | undefined;
  api.hold(new Promise<void>((resolve) => { release = resolve; }));
  await enqueue(page); await page.evaluate(() => window.queueRuntime.connectivity.set(true));
  await expect.poll(() => api.calls.length).toBe(1);
  const sibling = await context.newPage(); await open(sibling);
  await sibling.evaluate(() => window.queueRuntime.connectivity.set(true));
  await page.evaluate(() => window.queueRuntime.visibility.set('hidden'));
  expect(api.calls).toHaveLength(1);
  api.hold(undefined); release?.();
  await expect.poll(() => sibling.evaluate(async () => (await window.queueRuntime.store.listSent()).length), { timeout: 2000 }).toBe(1);
  expect(api.rows.size).toBe(1);
  expect(api.calls.filter((call) => call.page === page)).toHaveLength(1);
  expect(api.calls.map((call) => call.method)).toEqual(['POST', 'POST', 'GET']);
  expect(await sibling.evaluate(() => window.queueRuntime.failures)).toEqual([]);
});

test('stored-row attachment work and blobs survive rejection; only confirmed discard removes the blob', async ({ page, context }) => {
  const api = await backend(context); await open(page); await enqueue(page);
  await page.evaluate(async () => {
    const { store } = window.queueRuntime;
    const item = (await store.listUnsent())[0]; if (!item) throw new Error('Missing');
    await store.delete(item.temp_id);
    item.payload.attachment_count = 1;
    item.payload.attachments = [{ media_id: 'media', media_type: 'file', mime: 'text/plain', size_bytes: 3, local_uri: 'owned-blob', compressed: false }];
    await store.tryInsert(item, 200, [{ id: 'owned-blob', message_id: item.temp_id, body: new Blob(['abc']), name: 'file', mime: 'text/plain' }]);
    window.queueRuntime.connectivity.set(true);
  });
  await expect.poll(() => page.evaluate(async () => (await window.queueRuntime.store.listUnsent())[0]?.status)).toBe('failed');
  expect(api.rows.size).toBe(1);
  expect(await page.evaluate(async () => (await window.queueRuntime.store.listUnsent())[0]?.row_state)).toBe('stored');
  api.fault('forbidden');
  const discard = () => page.evaluate(async () => {
    const item = (await window.queueRuntime.store.listUnsent())[0]; if (!item) throw new Error('Missing');
    return window.queueRuntime.worker.discard(item.temp_id);
  });
  expect(await discard()).toEqual({ ok: false, reason: 'server' });
  expect(await page.evaluate(async () => (await window.queueRuntime.store.list('blobs')).length)).toBe(1);
  api.fault('none'); expect(await discard()).toEqual({ ok: true });
  expect(await page.evaluate(async () => (await window.queueRuntime.store.list('blobs')).length)).toBe(0);
  expect(await page.evaluate(() => window.queueRuntime.store.countUnsent())).toBe(0);
});
