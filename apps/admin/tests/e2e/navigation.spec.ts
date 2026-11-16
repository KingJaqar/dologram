import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { database, source } from '../harness/fixture.mts';

const origin = 'http://127.0.0.1:3100';
const password = randomBytes(24).toString('base64url');
const run = randomBytes(6).toString('hex');
const sql = postgres(database, { ssl: false, max: 1, connect_timeout: 5, query_timeout: 10, onnotice: () => {} });
const client = () => createClient(source.SUPABASE_URL, source.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
});

test.afterAll(async () => { await sql.end({ timeout: 1 }); });

async function signInAdmin(page: Page): Promise<string> {
  const email = `phase5-${run}-${randomBytes(4).toString('hex')}@fixture.invalid`;
  const { data, error } = await client().auth.admin.createUser({ email, password, email_confirm: true, role: 'authenticated' });
  if (error || !data.user) throw Error('Disposable Auth fixture creation failed');
  await sql`update public.profiles set roles = 'admin' where user_id = ${data.user.id}::uuid`;
  await page.goto('/sign-in');
  await page.getByLabel('Username or email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/`);
  return data.user.id;
}

const destinations = [
  { label: 'Accounts', href: '/accounts' },
  { label: 'Maintenance', href: '/maintenance' },
  { label: 'Audit log', href: '/audit' },
  { label: 'Settings check', href: '/settings-check' },
  { label: 'Overview', href: '/' },
] as const;

test('each sidebar destination opens its route and marks itself current', async ({ page }) => {
  await signInAdmin(page);
  const nav = page.getByRole('navigation', { name: 'Admin' });
  await expect(nav.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
  for (const destination of destinations) {
    await nav.getByRole('link', { name: destination.label }).click();
    await expect(page).toHaveURL(`${origin}${destination.href}`);
    await expect(nav.getByRole('link', { name: destination.label })).toHaveAttribute('aria-current', 'page');
    await expect(page).toHaveTitle('DoloGram Admin');
  }
  for (const path of ['/accounts/new', '/accounts/import', '/accounts/22222222-2222-4222-8222-222222222222']) {
    await page.goto(path);
    await expect(nav.getByRole('link', { name: 'Accounts' })).toHaveAttribute('aria-current', 'page');
    await expect(page).toHaveTitle('DoloGram Admin');
  }
});

test('sidebar is 240 wide at 1024 and a labelled 64 rail at 1023 with 32px targets', async ({ page }) => {
  await signInAdmin(page);
  const nav = page.getByRole('navigation', { name: 'Admin' });
  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(nav).toHaveCSS('width', '240px');
  for (const link of await nav.getByRole('link').all()) {
    const box = await link.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(32);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(32);
  }
  const action = await page.getByRole('button', { name: 'Sign out', exact: true }).boundingBox();
  expect(action?.height ?? 0).toBeGreaterThanOrEqual(32);
  expect(action?.width ?? 0).toBeGreaterThanOrEqual(32);
  const accounts = nav.getByRole('link', { name: 'Accounts' });
  const tooltip = accounts.locator('span[aria-hidden="true"]');
  await expect(tooltip).toBeHidden();
  await page.setViewportSize({ width: 1023, height: 800 });
  await expect(nav).toHaveCSS('width', '64px');
  await accounts.hover();
  await expect(tooltip).toBeVisible();
  await page.mouse.move(600, 400);
  await expect(tooltip).toBeHidden();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(nav.getByRole('link', { name: 'Overview' })).toBeFocused();
  await expect(nav.getByRole('link', { name: 'Overview' }).locator('span[aria-hidden="true"]')).toBeVisible();
});

test('keyboard order reaches the skip link, every sidebar item, Sign out and the content', async ({ page }) => {
  await signInAdmin(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${origin}/`);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  for (const label of ['Overview', 'Accounts', 'Maintenance', 'Audit log', 'Settings check']) {
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: label, exact: true })).toBeFocused();
  }
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeFocused();
  await page.getByRole('link', { name: 'Skip to content' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#admin-content')).toBeFocused();
});

test('every admin route stays behind the account session gate', async ({ page, context }) => {
  await signInAdmin(page);
  await context.clearCookies();
  for (const path of ['/', '/accounts', '/accounts/new', '/accounts/import',
    '/accounts/22222222-2222-4222-8222-222222222222', '/maintenance', '/audit', '/settings-check']) {
    await page.goto(path);
    await expect(page).toHaveURL(`${origin}/sign-in`);
  }
});
