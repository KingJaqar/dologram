import { expect, test, type Page } from '@playwright/test';

// All auth/metadata/Realtime traffic terminates in runner-owned local fixtures.
const user = { id: 'shell-owner', aud: 'authenticated', role: 'authenticated', email: 'shell@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const problems = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  problems.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (['warning', 'error'].includes(message.type())) errors.push(message.text()); });
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
    const reply = (body: unknown) => route.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'X-Supabase-Api-Version': '2024-01-01' }, body: JSON.stringify(body) });
    if (url.pathname === '/auth/v1/token') {
      const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })}.c2lnbmF0dXJl`;
      return reply({ access_token: token, refresh_token: 'local-shell-refresh', expires_in: 3600, token_type: 'bearer', user });
    }
    if (url.pathname === '/auth/v1/user') return reply(user);
    if (url.pathname === '/rest/v1/profiles') {
      const profile = { user_id: user.id, username: 'shell_owner', display_name: 'Shell Owner', avatar_url: null, premium_flags: null };
      return reply(route.request().headers().accept?.includes('vnd.pgrst.object') ? profile : [profile]);
    }
    if (['/rest/v1/chats', '/rest/v1/folders', '/rest/v1/folder_chats'].includes(url.pathname)) return reply([]);
    throw new Error(`Unexpected shell fixture API: ${url.pathname}`);
  });
});
test.afterEach(async ({ page }) => { expect(problems.get(page)).toEqual([]); });

async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Email or username', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('local-shell-password12');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Chat list', exact: true })).toBeVisible();
}

test('CSS breakpoints give 767 single column, 768 rail/360 list, and 1280 rail/400 list', async ({ page }) => {
  await page.setViewportSize({ width: 767, height: 900 });
  await signIn(page);
  const rail = page.getByRole('navigation', { name: 'Main', exact: true });
  const tabs = page.getByRole('navigation', { name: 'Chat tabs' });
  const list = page.getByRole('region', { name: 'Chat list' });
  await expect(rail).toBeHidden();
  await expect(tabs).toBeVisible();
  await expect(list).toHaveCSS('width', '767px');
  await expect(tabs).toHaveCSS('height', '56px');
  await expect(page.getByText('Select a chat', { exact: true })).toBeHidden();
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(rail).toBeVisible();
  await expect(rail).toHaveCSS('width', '72px');
  await expect(tabs).toBeHidden();
  await expect(list).toHaveCSS('width', '360px');
  await expect(list).toHaveCSS('border-right-width', '1px');
  await expect(page.getByText('Select a chat', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(list).toHaveCSS('width', '400px');
  await page.reload();
  await expect(list).toHaveCSS('width', '400px');
  await expect(page).toHaveTitle('DoloGram');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('rail New menu opens each dialog and restores its persistent trigger', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await signIn(page);
  const trigger = page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('button', { name: 'New', exact: true });
  await trigger.click();
  const menu = page.getByRole('menu', { name: 'New', exact: true });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'New chat', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'New chat', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'New group', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close New group', exact: true }).click();
  await expect(trigger).toBeFocused();
});

test('mobile New stacks sheet/dialog with one Back per overlay and safe resize cleanup', async ({ page }) => {
  await page.setViewportSize({ width: 767, height: 900 });
  await signIn(page);
  const trigger = page.getByRole('navigation', { name: 'Chat tabs' }).getByRole('button', { name: 'New', exact: true });
  const length = await page.evaluate(() => history.length);
  await trigger.click();
  const sheet = page.getByRole('dialog', { name: 'New', exact: true });
  await expect(sheet).toBeVisible();
  const choice = sheet.getByRole('button', { name: 'New chat', exact: true });
  await choice.click();
  await expect(page.getByRole('dialog', { name: 'New chat', exact: true })).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBe(length + 2);
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'New chat', exact: true })).toHaveCount(0);
  await expect(sheet).toBeVisible();
  await expect(choice).toBeFocused();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('[inert]')).toHaveCount(0);
  await expect.poll(() => page.locator('body').evaluate((node) => node.style.overflow)).toBe('');
});

test('Settings Back/Forward preserves Next history, focus and subsequent route navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page);
  const trigger = page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('button', { name: 'Profile and settings' });
  await page.evaluate(() => history.replaceState({ ...history.state, shellMarker: 'kept' }, '', location.href));
  const before = await page.evaluate(() => ({ length: history.length, tree: history.state.__PRIVATE_NEXTJS_INTERNALS_TREE, na: history.state.__NA }));
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBe(before.length + 1);
  expect(await page.evaluate(() => ({ tree: history.state.__PRIVATE_NEXTJS_INTERNALS_TREE, na: history.state.__NA }))).toEqual({ tree: before.tree, na: before.na });
  await page.goBack();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page).toHaveURL(/\/$/);
  await page.goForward();
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBe(before.length + 1);
  expect(await page.evaluate(() => history.state.shellMarker)).toBe('kept');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  // Phase 10 replaced the placeholder Archive link with the cached list; this fixture has no chats.
  await page.goto('/archive');
  await expect(page.getByRole('heading', { name: 'Archived', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(dialog).toHaveCount(0);
  expect(await page.locator('[inert]').count()).toBe(0);
});

test('keyboard order reaches rail, list then chat; account themes apply to shell', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'DoloGram, chats' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('link', { name: 'Chats', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('button', { name: 'New', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Profile and settings' }).first()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'New chat', exact: true })).toBeFocused();
  expect(await page.locator('[tabindex]').evaluateAll((nodes) => nodes.some((node) => Number(node.getAttribute('tabindex')) > 0))).toBe(false);
  await page.emulateMedia({ colorScheme: 'light' });
  const light = await page.getByRole('main').evaluate((node) => getComputedStyle(node).backgroundColor);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => page.getByRole('main').evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe(light);
});

test('mobile chat hides list/tabs, shows route id and returns to list; Chats scrolls list to top', async ({ page }) => {
  await page.setViewportSize({ width: 767, height: 900 });
  await signIn(page);
  await page.goto('/chat/local-chat-id');
  await expect(page.getByRole('region', { name: 'Chat', exact: true }).getByRole('heading', { name: 'local-chat-id' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Chat tabs' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Chat list' })).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Main', exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  const list = page.getByRole('region', { name: 'Chat list' });
  // Synthetic overflow exercises the real scroll container without later-phase chat fixtures.
  await list.evaluate((node) => {
    const scroller = node.lastElementChild;
    if (!(scroller instanceof HTMLElement)) throw new Error('Missing list scroller');
    const content = document.createElement('div'); content.style.height = '2000px'; scroller.append(content); scroller.scrollTop = 800;
  });
  expect(await list.evaluate((node) => node.lastElementChild?.scrollTop)).toBe(800);
  await page.getByRole('navigation', { name: 'Chat tabs' }).getByRole('link', { name: 'Chats', exact: true }).click();
  await expect.poll(() => list.evaluate((node) => node.lastElementChild?.scrollTop)).toBe(0);
});

test('new archive/chat routes retain signed-out guards', async ({ page }) => {
  await page.goto('/archive');
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto('/chat/local-chat-id');
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole('navigation', { name: 'Main', exact: true })).toHaveCount(0);
});
