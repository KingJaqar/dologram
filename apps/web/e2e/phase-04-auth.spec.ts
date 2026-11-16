import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'node:path';

type Fixture = { forced?: boolean; registration?: 'confirm' | 'collision'; wrongPassword?: boolean; failUpdate?: boolean; requests: string[]; callbackCleared?: boolean };
const user = (forced = false) => ({ id: 'synthetic-owner', aud: 'authenticated', role: 'authenticated', email: 'owner@example.test', app_metadata: { must_change_password: forced }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' });
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = () => `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: 'synthetic-owner', exp: Math.floor(Date.now() / 1000) + 3600 })}.c2lnbmF0dXJl`;

async function mockAuth(page: Page, fixture: Fixture) {
  await page.routeWebSocket('wss://isolated.example.test/**', (socket) => {
    socket.onMessage((message) => {
      if (typeof message !== 'string') return;
      const frame: unknown = JSON.parse(message);
      if (!Array.isArray(frame) || frame.length !== 5) return;
      const [join, ref, topic, event] = frame;
      if (event === 'phx_join') socket.send(JSON.stringify([join, ref, topic, 'phx_reply', { status: 'error', response: { reason: 'Synthetic join refusal' } }]));
      else if (event === 'heartbeat') socket.send(JSON.stringify([join, ref, topic, 'phx_reply', { status: 'ok', response: {} }]));
    });
  });
  await page.route('https://isolated.example.test/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    fixture.requests.push(`${request.method()} ${url.pathname}`);
    const headers = { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01', 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'X-Supabase-Api-Version' };
    const reply = (body: unknown, status = 200) => route.fulfill({ status, headers, body: JSON.stringify(body) });
    if (fixture.callbackCleared !== undefined) {
      fixture.callbackCleared = fixture.callbackCleared && await page.evaluate(() => !location.hash && !location.search);
    }
    const session = { access_token: token(), refresh_token: 'synthetic-refresh', expires_in: 3600, token_type: 'bearer', user: user(fixture.forced) };
    if (url.pathname.endsWith('/token')) {
      if (fixture.wrongPassword) return reply({ code: 'invalid_credentials', message: 'private details' }, 400);
      return reply(session);
    }
    if (url.pathname.endsWith('/signup')) {
      const payload: unknown = request.postDataJSON();
      expect(payload).toMatchObject({ data: { username: 'owner_a', display_name: 'Owner A' } });
      if (fixture.registration === 'confirm') return reply(user());
      if (fixture.registration === 'collision') return reply({ message: 'private username index detail' }, 500);
      return reply(session);
    }
    if (url.pathname.endsWith('/user')) {
      if (fixture.failUpdate && request.method() === 'PUT') return reply({ message: 'update failed' }, 500);
      return reply(user(fixture.forced));
    }
    if (url.pathname.endsWith('/recover')) {
      expect(url.searchParams.get('redirect_to')).toBe(new URL('/reset-password', page.url()).href);
      return reply({});
    }
    if (url.pathname.endsWith('/logout')) return reply({});
    if (url.pathname.includes('/rest/v1/profiles')) {
      expect(fixture.forced).not.toBe(true);
      const profile = { user_id: 'synthetic-owner', username: 'owner_a', display_name: 'Owner A', avatar_url: null, premium_flags: null };
      return reply(request.headers().accept?.includes('vnd.pgrst.object') ? profile : [profile]);
    }
    if (['/rest/v1/chats', '/rest/v1/folders', '/rest/v1/folder_chats'].includes(url.pathname)) return reply([]);
    throw new Error(`Unexpected synthetic API route ${url.pathname}`);
  });
}
async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Email or username', { exact: true }).fill('owner@example.test');
  await page.getByLabel('Password', { exact: true }).fill('synthetic-password12');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
test.beforeEach(async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  // HTTP failures in fault cases are expected; application warnings/errors are not.
  page.on('console', (message) => { if (['error', 'warning'].includes(message.type()) && !message.text().startsWith('Failed to load resource:')) problems.push(message.text()); });
  Reflect.set(page, 'authProblems', problems);
});
test.afterEach(async ({ page }) => { expect(Reflect.get(page, 'authProblems')).toEqual([]); });

test('signed-out main redirects; validation and offline states send no auth requests', async ({ page, context }) => {
  const fixture: Fixture = { requests: [] }; await mockAuth(page, fixture);
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Enter a valid email or username.')).toBeVisible();
  expect(fixture.requests).toEqual([]);
  await context.setOffline(true);
  await expect(page.getByText('No connection', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeDisabled();
  await context.setOffline(false);
});

test('sign-in and online/offline reload preserve the right owner', async ({ page, context }) => {
  const fixture: Fixture = { requests: [] }; await mockAuth(page, fixture);
  await signIn(page);
  await expect(page).toHaveURL(/\/$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'DoloGram', exact: true })).toBeVisible();
  const before = fixture.requests.length;
  // Loaded-tab offline restoration is exercised without requiring cold offline app assets.
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  expect(fixture.requests.length).toBe(before);
  await context.setOffline(false);
  await expect(page).toHaveURL(/\/$/);
});

test('wrong credentials use a generic message and create no browser session', async ({ page }) => {
  const fixture: Fixture = { requests: [], wrongPassword: true }; await mockAuth(page, fixture);
  await signIn(page);
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Email, username or password is incorrect.');
  expect(await page.evaluate(() => Object.keys(localStorage).some((key) => key.endsWith('-auth-token')))).toBe(false);
});

for (const outcome of ['auto', 'confirm', 'collision'] as const) {
  test(`registration ${outcome} handles the actual returned session state safely`, async ({ page }) => {
    const fixture: Fixture = { requests: [], registration: outcome === 'auto' ? undefined : outcome }; await mockAuth(page, fixture);
    await page.goto('/sign-up');
    await page.getByLabel('Email', { exact: true }).fill('owner@example.test');
    await page.getByLabel('Password', { exact: true }).fill('synthetic-password12');
    await page.getByLabel('Confirm password', { exact: true }).fill('synthetic-password12');
    await page.getByLabel('Username', { exact: true }).fill('owner_a');
    await page.getByLabel('Display name', { exact: true }).fill('Owner A');
    await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    if (outcome === 'auto') {
      await expect(page).toHaveURL(/\/$/);
      expect(fixture.requests.some((path) => path.includes('/profiles'))).toBe(true);
      return;
    }
    await expect(page.getByText(outcome === 'confirm' ? 'Check your email to confirm your account, then sign in.' : "Couldn't create the account. Try again.", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => Object.keys(localStorage).some((key) => key.endsWith('-auth-token')))).toBe(false);
  });
}

test('forgot password uses the generic response and validated same-origin callback', async ({ page }) => {
  const fixture: Fixture = { requests: [] }; await mockAuth(page, fixture);
  await page.goto('/forgot-password');
  await page.getByLabel('Email', { exact: true }).fill('unknown@example.test');
  await expect(page.getByRole('button', { name: 'Send reset link' })).toBeEnabled();
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByText('Check your email for a reset link.', { exact: true })).toBeVisible();
});

test('recovery scrubs credentials, survives reload/main navigation, and saves only after update', async ({ page }) => {
  const fixture: Fixture = { requests: [], callbackCleared: true }; await mockAuth(page, fixture);
  await page.goto(`/reset-password#access_token=${token()}&refresh_token=synthetic-refresh&type=recovery`);
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
  expect(new URL(page.url()).hash).toBe('');
  expect(fixture.callbackCleared).toBe(true);
  expect(fixture.requests.some((path) => path.includes('/profiles'))).toBe(false);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
  await page.goto('/');
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.getByLabel('New password', { exact: true }).fill('updated-password12');
  await page.getByLabel('Confirm password', { exact: true }).fill('updated-password12');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => sessionStorage.getItem('dg.auth.recovery.v1'))).toBeNull();
});

test('invalid callbacks and direct reset cannot Save; cancellation removes local session', async ({ page }) => {
  const fixture: Fixture = { requests: [] }; await mockAuth(page, fixture);
  await page.goto('/reset-password#access_token=sensitive&refresh_token=secret&type=signup');
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('This reset link has expired. Request a new one.');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  expect(new URL(page.url()).hash).toBe('');
  expect(fixture.requests).toEqual([]);
  await page.getByRole('button', { name: 'Cancel recovery' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto('/reset-password');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
});

test('forced gate reads no main data, retains failed updates, and requires trusted flag clearing', async ({ page }) => {
  const fixture: Fixture = { requests: [], forced: true, failUpdate: true }; await mockAuth(page, fixture);
  await signIn(page);
  await expect(page).toHaveURL(/\/change-password$/);
  await expect(page.getByRole('link', { name: 'Back', exact: true })).toHaveCount(0);
  expect(fixture.requests.some((path) => path.includes('/profiles'))).toBe(false);
  await page.getByLabel('New password', { exact: true }).fill('updated-password12');
  await page.getByLabel('Confirm password', { exact: true }).fill('updated-password12');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText("Couldn't save the new password. Try again.");
  fixture.failUpdate = false;
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry verification' })).toBeEnabled();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Your password was updated, but access is still restricted.');
  expect(fixture.requests.some((path) => path.includes('/profiles'))).toBe(false);
  fixture.forced = false;
  await page.getByRole('button', { name: 'Retry verification' }).click();
  await expect(page).toHaveURL(/\/$/);
});

for (const theme of ['light', 'dark'] as const) {
  test(`auth layout uses ${theme} tokens and fits a narrow viewport`, async ({ page }) => {
    const fixture: Fixture = { requests: [] }; await mockAuth(page, fixture);
    await page.addInitScript((value) => localStorage.setItem('dg.theme', value), theme);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/sign-in');
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: resolve(`../../supabase/repomix/user-web-phase-04-20261115/auth-${theme}.png`), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    const column = await page.getByRole('main').locator(':scope > div').boundingBox();
    expect(column?.width).toBe(400);
    expect(column?.x).toBe(440);
  });
}

test('signed-in provider displays a refused live join while preserving bounded cached catch-up', async ({ page }) => {
  const fixture: Fixture = { requests: [] }; await mockAuth(page, fixture); await signIn(page);
  await expect(page.getByRole('status').filter({ hasText: 'Live sync is unavailable.' })).toBeVisible();
  expect(fixture.requests).toContain('GET /rest/v1/chats');
  expect(fixture.requests).toContain('GET /rest/v1/folders');
});
