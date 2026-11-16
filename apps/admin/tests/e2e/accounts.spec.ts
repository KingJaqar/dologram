import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { database, source } from '../harness/fixture.mts';

const origin = 'http://127.0.0.1:3100';
const password = randomBytes(24).toString('base64url');
const run = randomBytes(4).toString('hex');
const sql = postgres(database, { ssl: false, max: 1, connect_timeout: 5, query_timeout: 10, onnotice: () => {} });
const client = () => createClient(source.SUPABASE_URL, source.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
});

type FixtureName = 'admin' | 'user_a' | 'user_b' | 'user_c' | 'user_g';
const fixtures = new Map<FixtureName, { id: string; email: string }>();

function account(name: FixtureName) {
  const value = fixtures.get(name);
  if (!value) throw Error('Missing disposable fixture account');
  return value;
}

async function createAccount(name: FixtureName, roles: 'admin' | 'user') {
  const email = `phase7-${name}-${run}@fixture.invalid`;
  // A worker restart re-runs beforeAll; reuse the same immutable fixture identity.
  const existing = await sql<{ id: string }[]>`select id from auth.users where email = ${email}`;
  let id = existing[0]?.id;
  if (id === undefined) {
    const { data, error } = await client().auth.admin.createUser({
      email, password, email_confirm: true, role: 'authenticated',
      user_metadata: { username: name, display_name: `Phase 7 ${name}` },
    });
    if (error || !data.user) throw Error('Disposable Auth fixture creation failed');
    id = data.user.id;
  }
  // Only trusted database SQL grants the application role; signup metadata cannot.
  await sql`update public.profiles set roles = ${roles} where user_id = ${id}::uuid`;
  fixtures.set(name, { id, email });
}

async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Username or email', { exact: true }).fill(account('admin').email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/`);
}

test.beforeAll(async () => {
  await createAccount('admin', 'admin');
  await createAccount('user_a', 'user');
  await createAccount('user_b', 'user');
  await createAccount('user_c', 'user');
  await createAccount('user_g', 'user');
});

test.afterAll(async () => { await sql.end({ timeout: 1 }); });

test('ADM-03 lists every account with seven columns, Never sign-in, mixed-case search and the Admin pill', async ({ page }) => {
  await signIn(page);
  await page.goto('/accounts');
  const table = page.getByRole('table', { name: 'Accounts' });
  await expect(table).toBeVisible();
  expect(await table.getByRole('columnheader').allTextContents()).toEqual([
    'Username', 'Display name', 'Email', 'Created', 'Last sign-in', 'Status', 'Premium',
  ]);
  for (const name of ['user_a', 'user_b', 'user_c', 'user_g'] as const) {
    await expect(table).toContainText(name);
  }
  const userA = table.getByRole('row', { name: /user_a/u });
  await expect(userA).toContainText('Never');
  await expect(userA).toContainText('Active');

  await page.getByLabel('Search by username or email').fill('USER_B');
  await expect(page).toHaveURL(/[?&]q=USER_B/u);
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table).toContainText('user_b');

  // Email is the second searchable identity field, also mixed-case and partial.
  await page.getByLabel('Search by username or email').fill('PHASE7-USER_A');
  await expect(page).toHaveURL(/[?&]q=PHASE7-USER_A/u);
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table).toContainText('user_a');

  await page.goto('/accounts');
  const adminRow = page.getByRole('table', { name: 'Accounts' }).getByRole('row', { name: /admin/u });
  await expect(adminRow).toContainText('Admin');
});

test('status chips follow Banned, Must change password, then Active precedence', async ({ page }) => {
  await signIn(page);
  const table = page.getByRole('table', { name: 'Accounts' });
  await page.goto('/accounts?filter=banned');
  await expect(page.getByText('No accounts match', { exact: true })).toBeVisible();

  await sql`update auth.users set banned_until = now() + interval '1 hour'
    where email = ${account('user_c').email}`;
  await sql`update auth.users set raw_app_meta_data = raw_app_meta_data || '{"must_change_password": true}'::jsonb
    where email = ${account('user_a').email}`;
  await sql`update auth.users set banned_until = now() + interval '1 hour',
      raw_app_meta_data = raw_app_meta_data || '{"must_change_password": true}'::jsonb
    where email = ${account('user_g').email}`;

  // Both banned accounts belong to the Banned bucket, even though user_g also carries the flag.
  await page.reload();
  await expect(table.locator('tbody tr')).toHaveCount(2);
  await expect(table).toContainText('user_c');
  await expect(table).toContainText('user_g');

  await page.getByRole('button', { name: 'Must change password', exact: true }).click();
  await expect(page).toHaveURL(/[?&]filter=mustChange/u);
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table).toContainText('user_a');
  await expect(table).not.toContainText('user_g');

  await page.goto('/accounts?filter=active');
  await expect(table).toContainText('user_b');
  for (const name of ['user_a', 'user_c', 'user_g'] as const) {
    await expect(table.getByRole('row', { name: new RegExp(name, 'u') })).toHaveCount(0);
  }
});

test('a row opens its account detail route', async ({ page }) => {
  await signIn(page);
  await page.goto('/accounts?q=user_b');
  const row = page.getByRole('table', { name: 'Accounts' }).getByRole('row', { name: /user_b/u });
  await row.click();
  await expect(page).toHaveURL(`${origin}/accounts/${account('user_b').id}`);
  await expect(page.getByRole('heading', { name: 'Account detail' })).toBeVisible();
});
