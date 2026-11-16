import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import Papa from 'papaparse';
import { database, source, anonKey } from '../harness/fixture.mts';

const origin = 'http://127.0.0.1:3100';
const password = randomBytes(24).toString('base64url');
const suffix = randomBytes(4).toString('hex');
const adminEmail = `csv-admin-${suffix}@fixture.invalid`;
const sql = postgres(database, { ssl: false, max: 1, connect_timeout: 5, query_timeout: 10, onnotice: () => {} });
const client = (key: string) => createClient(source.SUPABASE_URL, key, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
});
let actorId = '';
let cookies: Awaited<ReturnType<BrowserContext['cookies']>> | undefined;
const errors = new WeakMap<Page, { count: number }>();
test.beforeAll(async () => {
  const result = await client(source.SUPABASE_SECRET_KEY).auth.admin.createUser({
    email: adminEmail, password, email_confirm: true, role: 'authenticated',
    user_metadata: { username: `csvadmin_${suffix}`, display_name: 'CSV Admin Fixture' },
  });
  if (result.error || !result.data.user) throw Error('Disposable CSV admin creation failed');
  actorId = result.data.user.id;
  await sql`update public.profiles set roles = 'admin' where user_id = ${actorId}::uuid`;
});
test.afterAll(async () => { await sql.end({ timeout: 1 }); });
test.beforeEach(({ page }) => {
  const record = { count: 0 };
  errors.set(page, record);
  page.on('pageerror', () => { record.count += 1; });
  page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') record.count += 1; });
});
test.afterEach(async ({ page }) => {
  const count = errors.get(page)?.count;
  await page.goto('about:blank');
  await page.close(); // Never retain failure DOM contexts containing one-time passwords.
  expect(count).toBe(0);
});
async function signIn(page: Page) {
  if (cookies) await page.context().addCookies(cookies);
  else {
    await page.goto('/sign-in');
    await page.getByLabel('Username or email', { exact: true }).fill(adminEmail);
    try { await page.getByLabel('Password', { exact: true }).fill(password); }
    catch { throw Error('Disposable secret input failed'); }
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(`${origin}/`);
    cookies = await page.context().cookies(origin);
  }
  await page.goto('/accounts/import');
}
async function file(page: Page, text: string) {
  await page.getByLabel('Choose CSV file').setInputFiles({ name: 'accounts.csv', mimeType: 'text/csv', buffer: Buffer.from(text) });
}

test('AT-08 rejects101 rows, wrong/duplicate headers and oversized files with Create disabled', async ({ page }) => {
  await signIn(page);
  await file(page, 'email,username,display_name\n' + Array.from({ length: 101 }, (_, i) => `u${i}@example.test,user_${i},User`).join('\n'));
  await expect(page.getByText('A CSV can have at most 100 rows.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeDisabled();
  for (const header of ['email;username;display_name', 'email,email,display_name', 'email,username,display_name,extra']) {
    await file(page, header + '\none@example.test,one_user,One');
    await expect(page.getByText('The CSV needs the columns email, username and display_name.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeDisabled();
  }
  await file(page, 'x'.repeat(256 * 1024 + 1));
  await expect(page.getByText('Choose a CSV file of at most 256 KiB.')).toBeVisible();
});

test('T-46 creates exactly3 accounts with Saved Messages, safe audit and a one-time CSV that clears on navigation', async ({ page }) => {
  await signIn(page);
  await file(page, readFileSync('tests/fixtures/t46.csv', 'utf8'));
  await expect(page.getByText('3 valid, 1 invalid rows')).toBeVisible();
  const invalid = page.getByRole('row').filter({ hasText: 't46bad@example.test' });
  await expect(invalid).toContainText('Username must be 5 to 32 characters');
  const invalidFill = await invalid.evaluate(element => getComputedStyle(element).backgroundColor);
  expect(invalidFill === 'rgba(0, 0, 0, 0)').toBe(false);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Create 3 accounts?' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByText('Import complete.')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download as CSV' }).click();
  const download = await downloadPromise;
  expect(/^dologram-accounts-\d{4}-\d{2}-\d{2}\.csv$/u.test(download.suggestedFilename())).toBe(true);
  const stream = await download.createReadStream();
  if (!stream) throw Error('Download stream missing');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const csv = Papa.parse<{ email: string; password: string }>(Buffer.concat(chunks).toString('utf8'), { header: true });
  expect(csv.errors.length === 0 && csv.data.length === 3).toBe(true);
  const accounts = await sql<{ id: string }[]>`select id::text from auth.users where email in ('t46a@example.test','t46b@example.test','t46c@example.test','t46bad@example.test')`;
  expect(accounts.length).toBe(3);
  for (const row of csv.data) {
    expect(/^[A-HJ-NP-Za-km-z2-9]{16}$/u.test(row.password)).toBe(true);
    const user = client(anonKey);
    const signed = await user.auth.signInWithPassword({ email: row.email, password: row.password });
    expect(signed.error === null).toBe(true);
    const changed = await user.auth.updateUser({ password: randomBytes(24).toString('base64url') });
    expect(changed.error === null).toBe(true);
    const id = signed.data.user?.id;
    if (!id) throw Error('Created fixture identity missing');
    const saved = await user.from('chats').select('chat_id').eq('direct_key', id);
    expect(saved.error === null && saved.data?.length === 1).toBe(true);
    const leaked = await sql<{ count: number }[]>`select count(*)::int as count from private.admin_audit where detail::text like ${`%${row.password}%`}`;
    expect(leaked[0]?.count).toBe(0);
  }
  const audit = await sql<{ action: string; detail: { created?: number; invalid?: number; total?: number } }[]>`
    select action, detail from private.admin_audit where actor_user_id = ${actorId}::uuid and action in ('account.create','account.import_csv')`;
  expect(audit.filter(row => row.action === 'account.create').length).toBe(3);
  expect(audit.filter(row => row.action === 'account.import_csv').length).toBe(1);
  expect(audit.find(row => row.action === 'account.import_csv')?.detail).toEqual({ created: 3, invalid: 1, total: 4 });
  await page.goto('/accounts');
  await page.goto('/accounts/import');
  await expect(page.getByRole('table', { name: 'Import results' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Download as CSV' })).toHaveCount(0);
});

test('compiled actions revalidate structure and session identity; replay cannot recreate or recover a password', async ({ page }) => {
  await signIn(page);
  const manifest = JSON.parse(readFileSync('.next/server/server-reference-manifest.json', 'utf8')) as { node: Record<string, { filename: string; exportedName: string }> };
  function action(name: string) {
    const found = Object.entries(manifest.node).find(([, entry]) => entry.exportedName === name && entry.filename.endsWith(`/accounts/${name === 'createAccount' ? 'new' : 'import'}/actions.ts`));
    if (!found) throw Error('Missing compiled CSV action');
    return found[0];
  }
  async function post(name: string, input: unknown) {
    const response = await page.request.post('/accounts/import', { headers: { 'Next-Action': action(name), Origin: origin, Accept: 'text/x-component', 'Content-Type': 'text/plain;charset=UTF-8' }, data: JSON.stringify([input]) });
    expect(response.ok()).toBe(true);
    return response.text();
  }
  const input = { headers: ['email', 'username', 'display_name'], rows: [{ email: `replay-${suffix}@example.test`, username: `replay_${suffix}`, display_name: 'Replay' }] };
  expect((await post('validateCsv', { ...input, rows: [{ ...input.rows[0], roles: 'admin' }] })).includes('"ok":false')).toBe(true);
  const requestId = randomUUID();
  const begun = await post('beginCsvImport', { requestId, input });
  const id = begun.match(/"importId":"([0-9a-f-]+)"/u)?.[1];
  if (!id) throw Error('No CSV operation acknowledgement');
  expect((await post('beginCsvImport', { requestId, input })).includes(id)).toBe(true);
  expect((await post('createAccount', { importId: id, row: 1, email: 'forged@example.test' })).includes('"ok":false')).toBe(true);
  const created = await post('createAccount', { importId: id, row: 1 });
  expect(created.includes('"password":')).toBe(true);
  const replay = await post('createAccount', { importId: id, row: 1 });
  expect(replay.includes('one-time password is no longer available')).toBe(true);
  expect(replay.includes('"password":')).toBe(false);
  await post('finishCsvImport', id);
  await post('finishCsvImport', id);
  const count = await sql<{ count: number }[]>`select count(*)::int as count from auth.users where email = ${input.rows[0]?.email ?? ''}`;
  expect(count[0]?.count).toBe(1);
  const summaries = await sql<{ count: number }[]>`select count(*)::int as count from private.admin_audit where event_id = ${id}::uuid and action = 'account.import_csv'`;
  expect(summaries[0]?.count).toBe(1);
  // A second verified local session for the same account cannot own this import.
  await page.context().clearCookies();
  cookies = undefined;
  await signIn(page);
  expect((await post('createAccount', { importId: id, row: 1 })).includes('"ok":false')).toBe(true);
});
