import { expect, test, type Page } from '@playwright/test';

// All auth/metadata/Realtime traffic terminates in runner-owned local fixtures.
const user = { id: 'settings-owner', aud: 'authenticated', role: 'authenticated', email: 'settings@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const problems = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  problems.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  // HTTP/offline transport failures are expected fault cases; application warnings/errors are not.
  page.on('console', (message) => { if (['warning', 'error'].includes(message.type()) && !message.text().startsWith('Failed to load resource:')) errors.push(message.text()); });
  await page.routeWebSocket('wss://isolated.example.test/**', (socket) => {
    socket.onMessage((message) => {
      if (typeof message !== 'string') return;
      const frame: unknown = JSON.parse(message);
      if (!Array.isArray(frame) || frame.length !== 5) return;
      const [join, ref, topic, event] = frame;
      if (event === 'phx_join') socket.send(JSON.stringify([join, ref, topic, 'phx_reply', { status: 'error', response: { reason: 'Local fixture' } }]));
      if (event === 'heartbeat') socket.send(JSON.stringify([join, ref, topic, 'phx_reply', { status: 'ok', response: {} }]));
    });
  });
  await page.route('https://**/*', async (route) => {
    const url = new URL(route.request().url());
    expect(url.origin).toBe('https://isolated.example.test');
    const reply = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'X-Supabase-Api-Version': '2024-01-01' }, body: JSON.stringify(body) });
    if (url.pathname === '/auth/v1/token') {
      const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })}.c2lnbmF0dXJl`;
      return reply({ access_token: token, refresh_token: 'local-settings-refresh', expires_in: 3600, token_type: 'bearer', user });
    }
    if (url.pathname === '/auth/v1/user') return reply(user);
    if (url.pathname === '/auth/v1/logout') return reply({});
    if (url.pathname === '/rest/v1/profiles') {
      const profile = { user_id: user.id, username: 'settings_owner', display_name: 'Settings Owner', avatar_url: null, premium_flags: null };
      return reply(route.request().headers().accept?.includes('vnd.pgrst.object') ? profile : [profile]);
    }
    if (['/rest/v1/chats', '/rest/v1/folders', '/rest/v1/folder_chats'].includes(url.pathname)) return reply([]);
    throw new Error(`Unexpected settings fixture API: ${url.pathname}`);
  });
});
test.afterEach(async ({ page }) => { expect(problems.get(page)).toEqual([]); });

async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Email or username', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('local-settings-password12');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Chat list', exact: true })).toBeVisible();
}

async function openSettings(page: Page) {
  await page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('button', { name: 'Profile and settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Writes this owner's queued records the way the account store reads them. */
async function seedQueue(page: Page, count: number) {
  await page.evaluate(async (input) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('dologram', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('queue', 'readwrite');
        const store = tx.objectStore('queue');
        for (let index = 0; index < input.count; index++) {
          const temp = crypto.randomUUID();
          const chat = '9c1f0f4a-0000-4000-8000-000000000001';
          // Due far in the future: the warning counts unsent work without the worker delivering it.
          const value = { temp_id: temp, chat_id: chat, status: 'queued', retry_count: 0, next_attempt_at: Date.now() + 3_600_000, row_may_exist: false, row_state: 'absent', last_error: null, created_at: Date.now(),
            payload: { kind: 'text', chat_id: chat, sender_id: input.owner, content: 'Offline draft', reply_to: null, attachment_count: 0, attachments: [] } };
          store.add({ owner: input.owner, key: temp, chat, message: '', status: 'queued', order: index + 1, seq: 0, time: value.created_at, value });
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, { owner: user.id, count });
}

/** Reopened browser storage: physical deletion, or no owned queue/cache/blob rows when retained. */
function inspectStorage(page: Page) {
  return page.evaluate(async (owner) => {
    const names = (await indexedDB.databases()).map((entry) => entry.name);
    const theme = localStorage.getItem('dg.theme');
    const sessionKeys = Object.keys(localStorage).filter((key) => key.endsWith('-auth-token'));
    if (!names.includes('dologram')) return { deleted: true, owned: 0, theme, sessionKeys };
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('dologram', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const tables = ['queue', 'chats', 'members', 'messages', 'media', 'reactions', 'profiles', 'folders', 'folder_chats', 'sync_state', 'pending_reads', 'blobs'];
      let owned = 0;
      for (const table of tables) {
        const rows: unknown = await new Promise((resolve, reject) => {
          const request = db.transaction(table).objectStore(table).index('owner').getAll(owner);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        owned += Array.isArray(rows) ? rows.length : 0;
      }
      return { deleted: false, owned, theme, sessionKeys };
    } finally { db.close(); }
  }, user.id);
}

test('theme choice applies at once, survives a reload and System follows the platform', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page);
  const dialog = await openSettings(page);
  await expect(dialog.getByRole('radio', { name: 'System', exact: true })).toBeChecked();
  await expect(dialog.getByText('Settings Owner', { exact: true })).toBeVisible();
  await expect(dialog.getByText('@settings_owner', { exact: true })).toBeVisible();
  await expect(dialog.getByText(/^DoloGram \S+ \(\S+\)$/)).toBeVisible();
  await expect(dialog.getByText('Force Low Signal Mode')).toHaveCount(0);
  await expect(dialog.getByText(/notifications|app lock/i)).toHaveCount(0);

  await dialog.getByRole('radio', { name: 'Dark', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => page.getByRole('main').evaluate((node) => getComputedStyle(node).backgroundColor)).toBe('rgb(29, 28, 28)');
  expect(await page.evaluate(() => localStorage.getItem('dg.theme'))).toBe('dark');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => page.getByRole('main').evaluate((node) => getComputedStyle(node).backgroundColor)).toBe('rgb(29, 28, 28)');

  await page.emulateMedia({ colorScheme: 'light' });
  const reopened = await openSettings(page);
  await reopened.getByRole('radio', { name: 'System', exact: true }).check();
  expect(await page.locator('html').getAttribute('data-theme')).toBeNull();
  await expect.poll(() => page.getByRole('main').evaluate((node) => getComputedStyle(node).backgroundColor)).toBe('rgb(237, 232, 208)');
  expect(await page.evaluate(() => localStorage.getItem('dg.theme'))).toBe('system');
});

test('two unsent items warn, then sign-out leaves no owned records, keeps dg.theme and shows sign-in', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page);
  await seedQueue(page, 2);
  const dialog = await openSettings(page);
  await dialog.getByRole('radio', { name: 'Dark', exact: true }).check();
  await dialog.getByRole('button', { name: 'Sign out', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Sign out?', exact: true });
  await expect(confirm).toBeVisible();
  await expect(confirm.getByText('2 unsent messages will be lost', { exact: true })).toBeVisible();
  await confirm.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect.poll(async () => (await inspectStorage(page)).owned).toBe(0);
  expect(await inspectStorage(page)).toMatchObject({ theme: 'dark', sessionKeys: [] });
});

test('offline sign-out without unsent items warns about nothing and reaches sign-in', async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page);
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  const dialog = await openSettings(page);
  const change = dialog.getByRole('button', { name: 'Change password', exact: true });
  await expect(change).toBeDisabled();
  await expect(change).toHaveAccessibleDescription('No connection');
  await dialog.getByRole('button', { name: 'Sign out', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Sign out?', exact: true });
  await expect(confirm.getByText('Are you sure you want to sign out?', { exact: true })).toBeVisible();
  await confirm.getByRole('button', { name: 'Sign out', exact: true }).click();
  // Local sign-out completes offline; the route change waits for the app's own assets (C-5).
  await expect(page.getByRole('status')).toHaveText('Signed out on this browser. Reconnect to sign in.');
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect.poll(async () => (await inspectStorage(page)).owned).toBe(0);
});
