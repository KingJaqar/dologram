import { test, expect, type Page } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { anonKey, database, source } from '../harness/fixture.mts';

const origin = 'http://127.0.0.1:3100';
const password = randomBytes(24).toString('base64url');
const run = randomBytes(6).toString('hex');
const sql = postgres(database, { ssl: false, max: 1, connect_timeout: 5, query_timeout: 10, onnotice: () => {} });
const client = () => createClient(source.SUPABASE_URL, source.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
});

test.afterAll(async () => { await sql.end({ timeout: 1 }); });

async function createAccount(roles: 'admin' | 'user') {
  const email = `phase6-${roles}-${run}-${randomBytes(4).toString('hex')}@fixture.invalid`;
  const { data, error } = await client().auth.admin.createUser({ email, password, email_confirm: true, role: 'authenticated' });
  if (error || !data.user) throw Error('Disposable Auth fixture creation failed');
  await sql`update public.profiles set roles = ${roles} where user_id = ${data.user.id}::uuid`;
  return { id: data.user.id, email };
}

async function signIn(page: Page, email: string) {
  await page.goto('/sign-in');
  await page.getByLabel('Username or email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/`);
}

test('a verified admin sign-in writes one session.unlock row that ADM-07 shows newest first', async ({ page }) => {
  const { id, email } = await createAccount('admin');
  await signIn(page, email);
  const rows = await sql`select action, result, actor_user_id from private.admin_audit
    where actor_user_id = ${id}::uuid order by at desc, id desc`;
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ action: 'session.unlock', result: 'success' });

  await page.goto('/audit');
  const table = page.getByRole('table', { name: 'Audit log' });
  await expect(table).toBeVisible();
  const firstRow = table.locator('tbody tr').first();
  await expect(firstRow).toContainText('session.unlock');
  await expect(firstRow).toContainText('Success');
});

test('the action filter shows only that action and 51 rows span two pages', async ({ page }) => {
  const { id, email } = await createAccount('admin');
  await signIn(page, email);
  await sql`insert into private.admin_audit (event_id, actor_user_id, action, result, detail, at)
    select gen_random_uuid(), ${id}::uuid, 'session.unlock', 'success', '{}'::jsonb,
           now() - (interval '1 minute' * series)
    from generate_series(1, 51) as series`;
  await sql`insert into private.admin_audit (event_id, actor_user_id, action, result, detail)
    values (${randomUUID()}::uuid, null, 'session.lockout', 'failed', '{}'::jsonb)`;
  const counted = await sql<{ total: number }[]>`select count(*)::int as total
    from private.admin_audit where action = 'session.unlock'`;
  const total = counted[0]?.total ?? 0;

  await page.goto(`/audit?action=${encodeURIComponent('session.unlock')}`);
  const table = page.getByRole('table', { name: 'Audit log' });
  await expect(page.getByText(`1-50 of ${total}`, { exact: true })).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(50);
  await expect(table).not.toContainText('session.lockout');

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page).toHaveURL(/[?&]page=2/u);
  await expect(page.getByText(`51-${total} of ${total}`, { exact: true })).toBeVisible();
  await expect(table.locator('tbody tr').first()).toContainText('session.unlock');
});

test('a normal user session cannot read the private audit trail through the Data API', async () => {
  const { email } = await createAccount('user');
  const { data, error } = await client().auth.signInWithPassword({ email, password });
  expect(error).toBeNull();
  const token = data.session?.access_token;
  expect(token).toBeTruthy();
  const response = await fetch('http://127.0.0.1:3120/rest/v1/admin_audit?select=*', {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  expect(response.ok).toBe(false);
  expect(await response.text()).not.toContain('session.unlock');
});
