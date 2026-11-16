import { test, expect, chromium, type Page, type BrowserContext } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { database, source, anonKey } from '../harness/fixture.mts';

const origin = 'http://127.0.0.1:3100';
const password = randomBytes(24).toString('base64url');
const run = randomBytes(4).toString('hex');
const sql = postgres(database, { ssl: false, max: 1, connect_timeout: 5, query_timeout: 10, onnotice: () => {} });
const client = () => createClient(source.SUPABASE_URL, source.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
});

type FixtureName = 'admin' | 'existing' | 'forced';
const fixtures = new Map<FixtureName, { id: string; email: string }>();
const PASSWORD_SHAPE = /^[A-HJ-NP-Za-km-z2-9]{16}$/u;
const runtimeErrors = new WeakMap<Page, { count: number }>();
let adminCookies: Awaited<ReturnType<BrowserContext['cookies']>> | undefined;

test.beforeEach(({ page }) => {
  const failures = { count: 0 };
  runtimeErrors.set(page, failures);
  page.on('pageerror', () => { failures.count += 1; });
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') failures.count += 1;
  });
});

test.afterEach(async ({ page }) => {
  // Count only: console payloads can contain credentials and must never be logged.
  const count = runtimeErrors.get(page)?.count;
  await page.goto('about:blank');
  await page.close(); // Prevent failure-context DOM snapshots retaining passwords.
  expect(count).toBe(0);
});

function account(name: FixtureName) {
  const value = fixtures.get(name);
  if (!value) throw Error('Missing disposable fixture account');
  return value;
}

async function createFixture(name: FixtureName, roles: 'admin' | 'user') {
  const email = `phase8-${name}-${run}@fixture.invalid`;
  const existing = await sql<{ id: string }[]>`select id from auth.users where email = ${email}`;
  let id = existing[0]?.id;
  if (id === undefined) {
    const { data, error } = await client().auth.admin.createUser({
      email, password, email_confirm: true, role: 'authenticated',
      user_metadata: { username: `${name}_${run}`, display_name: `Phase 8 ${name}` },
      app_metadata: name === 'forced' ? { must_change_password: true } : {},
    });
    if (error || !data.user) throw Error('Disposable Auth fixture creation failed');
    id = data.user.id;
  }
  await sql`update public.profiles set roles = ${roles} where user_id = ${id}::uuid`;
  fixtures.set(name, { id, email });
}

async function signIn(page: Page) {
  // All cases still pass the live role/session guards. Reuse the authenticated
  // fixture rather than exhausting the production five-attempt account limit.
  if (adminCookies) {
    await page.context().addCookies(adminCookies);
    await page.goto('/');
    await expect(page).toHaveURL(`${origin}/`);
    return;
  }
  await page.goto('/sign-in');
  await page.getByLabel('Username or email', { exact: true }).fill(account('admin').email);
  await fillSecret(page, 'Password', password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/`);
  adminCookies = await page.context().cookies(origin);
}

async function fillSecret(page: Page, label: string, value: string) {
  try { await page.getByLabel(label, { exact: true }).fill(value); }
  catch { throw Error('Secret input could not be completed.'); }
}

async function generatedPassword(page: Page) {
  const field = page.getByRole('textbox', { name: 'Generated password' });
  await expect(field).toBeVisible();
  const value = await field.inputValue();
  expect(PASSWORD_SHAPE.test(value)).toBe(true);
  return value;
}

async function fill(page: Page, values: { email: string; username: string; displayName: string }) {
  await page.getByLabel('Email', { exact: true }).fill(values.email);
  await page.getByLabel('Username', { exact: true }).fill(values.username);
  await page.getByLabel('Display name', { exact: true }).fill(values.displayName);
}

test.beforeAll(async () => {
  await createFixture('admin', 'admin');
  await createFixture('existing', 'user');
  await createFixture('forced', 'user');
});

test.afterAll(async () => { await sql.end({ timeout: 1 }); });

test('ADM-04 single screen offers Single/CSV tabs and a 16-character server password', async ({ page }) => {
  await signIn(page);
  await page.goto('/accounts/new');
  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  const tabs = page.getByRole('tablist', { name: 'Create account mode' });
  await expect(tabs.getByRole('tab', { name: 'Single' })).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.getByRole('tab', { name: 'CSV' })).toHaveAttribute('href', '/accounts/import');

  const first = await generatedPassword(page);
  await page.getByRole('button', { name: 'Regenerate' }).click();
  await expect.poll(async () => (await page.getByRole('textbox', { name: 'Generated password' }).inputValue()) !== first)
    .toBe(true);
  expect(PASSWORD_SHAPE.test(await generatedPassword(page))).toBe(true);
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('');
  const displayName = '😀'.repeat(64);
  await fill(page, { email: `unicode-${run}@fixture.invalid`, username: `unicode_${run}`, displayName });
  expect((await page.getByLabel('Display name', { exact: true }).inputValue()) === displayName).toBe(true);
});

test('a 4-character username is refused with a field error and Create stays disabled', async ({ page }) => {
  await signIn(page);
  await page.goto('/accounts/new');
  await generatedPassword(page);
  await fill(page, { email: `new-${run}@fixture.invalid`, username: 'abcd', displayName: 'New Account' });
  await page.getByLabel('Display name', { exact: true }).click();
  await expect(page.getByText(/Username must be 5 to 32 characters/u)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create' })).toBeDisabled();
});

test('enabled ADM-04 returns duplicate email on its field without creating another account', async ({ page }) => {
  await signIn(page);
  await page.goto('/accounts/new');
  await generatedPassword(page);
  await fill(page, { email: account('existing').email, username: `unique_${run}`, displayName: 'Duplicate Email' });
  await expect(page.getByRole('button', { name: 'Create' })).toBeEnabled();
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('An account with this email already exists.')).toBeVisible();
  await expect(page.getByText('Account created.')).toHaveCount(0);
});

test('direct create action refuses duplicate email and invalid username with field errors, and refuses role input', async ({ page }) => {
  await signIn(page);
  await page.goto('/accounts/new');
  const manifest = JSON.parse(readFileSync('.next/server/server-reference-manifest.json', 'utf8')) as {
    node: Record<string, { filename: string; exportedName: string }>;
  };
  const action = Object.entries(manifest.node).find(([, entry]) =>
    entry.filename.endsWith('/accounts/new/actions.ts') && entry.exportedName === 'createAccount');
  if (!action) throw Error('Missing compiled create action');
  const actionId = action[0];
  const input = { email: account('existing').email, username: `unique_${run}`,
    displayName: 'Duplicate Email', passwordDraftId: randomUUID() };
  async function submit(details: object) {
    const response = await page.request.post('/accounts/new', {
      headers: { 'Next-Action': actionId, Origin: origin,
        Accept: 'text/x-component', 'Content-Type': 'text/plain;charset=UTF-8' },
      data: JSON.stringify([details]),
    });
    expect(response.ok()).toBe(true);
    return response.text();
  }
  const duplicate = await submit(input);
  expect(duplicate).toContain('"field":"email"');
  expect(duplicate).toContain('An account with this email already exists.');
  const invalid = await submit({ ...input, username: 'abcd' });
  expect(invalid).toContain('"field":"username"');
  expect(invalid).toContain('Username must be 5 to 32 characters');
  expect(await submit({ ...input, roles: 'admin' })).toContain('The account details are not valid.');
});

test('ADM-04 creates from its server draft and lists the account as Must change password without auditing plaintext', async ({ page }) => {
  await signIn(page);
  await page.goto('/accounts/new');
  const preview = await generatedPassword(page);
  const email = `created-${run}@fixture.invalid`;
  const username = `created_${run}`;
  await fill(page, { email, username, displayName: 'Created Account' });
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Account created.')).toBeVisible();
  expect((await page.getByRole('textbox', { name: 'Generated password' }).inputValue()) === preview).toBe(true);
  await expect(page.getByRole('link', { name: 'Open account' })).toHaveAttribute('href', /\/accounts\/[0-9a-f-]+$/u);
  const created = await sql<{ count: number }[]>`select count(*)::int as count from auth.users where email = ${email}`;
  expect(created[0]?.count).toBe(1);
  const audited = await sql<{ count: number }[]>`
    select count(*)::int as count from private.admin_audit where detail::text like ${`%${preview}%`}`;
  expect(audited[0]?.count).toBe(0);
  await page.goto(`/accounts?q=${username}`);
  await expect(page.getByRole('row').filter({ hasText: username })).toContainText('Must change password');
});

test('AB-02 contract: forced accounts read no rows and Auth password change clears the live flag', async () => {
  const user = createClient(source.SUPABASE_URL, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
  });
  const signedIn = await user.auth.signInWithPassword({ email: account('forced').email, password });
  expect(signedIn.error === null).toBe(true);
  expect(signedIn.data.user?.app_metadata.must_change_password).toBe(true);
  const read = await user.from('profiles').select('user_id').eq('user_id', account('forced').id);
  expect(read.error === null).toBe(true);
  expect(read.data?.length).toBe(0);
  const forged = await user.auth.updateUser({ data: { must_change_password: false } });
  expect(forged.error === null).toBe(true);
  expect((await user.auth.getUser()).data.user?.app_metadata.must_change_password).toBe(true);
  expect((await user.from('profiles').select('user_id')).data?.length).toBe(0);
  const changed = await user.auth.updateUser({ password: randomBytes(24).toString('base64url') });
  expect(changed.error === null).toBe(true);
  expect((await user.auth.getUser()).data.user?.app_metadata.must_change_password).toBe(false);
  expect((await user.from('profiles').select('user_id').eq('user_id', account('forced').id)).data?.length).toBe(1);
});

test('actual provisioning entry points refuse redirected password delivery before creating accounts', async () => {
  const repo = resolve('../..');
  const npmCli = resolve(process.execPath, '../node_modules/npm/bin/npm-cli.js');
  const email = `script-${run}@fixture.invalid`;
  const single = spawnSync(process.execPath, [npmCli, 'run', 'create-user', '--',
    '--email', email, '--username', `script_${run}`, '--display-name', 'Script User'], {
    cwd: repo, env: { ...process.env, ...source }, encoding: 'utf8', timeout: 15000,
  });
  expect(single.status).toBe(1);
  expect(single.stderr).toContain('Use an interactive terminal');
  expect(single.stdout).not.toContain('Generated password:');
  const batch = spawnSync('powershell.exe', ['-NoProfile', '-File', 'scripts/create-accounts.ps1', '-Csv',
    'apps/admin/tests/fixtures/phase8-provisioning.csv'], {
    cwd: repo, env: { ...process.env, ...source }, encoding: 'utf8', timeout: 15000,
  });
  expect(batch.status).toBe(1);
  expect(batch.stderr).toContain('Use an interactive terminal');
  expect(batch.stdout).not.toContain('Generated password:');
  const rows = await sql<{ count: number }[]>`select count(*)::int as count from auth.users where email = ${email}`;
  expect(rows[0]?.count).toBe(0);
});

test('source-matched core recovers uncertain creation and initialization without another account or password rotation', () => {
  const recovered = spawnSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', 'tests/harness/recovery.mts'], {
    cwd: resolve('.'), encoding: 'utf8', timeout: 30000,
  });
  // Report only the fixed success sentinel; generated credentials and assertion
  // payloads are never attached to browser diagnostics.
  if (recovered.status !== 0) throw Error(recovered.stderr.match(/^FAIL: isolated recovery at [a-zA-Z ]+$/mu)?.[0] ?? 'Isolated recovery subprocess failed');
  expect(recovered.status === 0 && recovered.stdout.includes('PASS: isolated creation recovery')).toBe(true);
});

test('the forced-password contract covers Storage, Realtime, definer RPCs, Edge gates and normal signup', () => {
  const result = spawnSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', 'tests/harness/denial.mts'], {
    cwd: resolve('.'), encoding: 'utf8', timeout: 30000,
  });
  if (result.status !== 0) throw Error(result.stderr.match(/^FAIL: denial contract at [a-zA-Z0-9 -]+$/mu)?.[0] ?? 'Isolated denial subprocess failed');
  expect(result.stdout.includes('PASS: live Storage/Realtime RLS')).toBe(true);
});

test('a real ADM-04 account signs into the approved W source and must change its password before API access', async ({ page }) => {
  await signIn(page);
  await page.goto('/accounts/new');
  const initial = await generatedPassword(page);
  const email = `web-${run}@fixture.invalid`;
  await fill(page, { email, username: `web_${run}`, displayName: 'W first password' });
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Account created.')).toBeVisible();
  const webBrowser = await chromium.launch({ channel: 'chrome' });
  try {
    const web = await webBrowser.newPage({ proxy: { server: 'http://127.0.0.1:3114', bypass: '127.0.0.1' } });
    let errors = 0;
    const transport: { path: string; status: number }[] = [];
    web.on('pageerror', () => { errors += 1; });
    web.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') errors += 1; });
    // Transport alias only: every Auth/Data API response comes from the owned
    // real services. The W client keeps its production HTTPS/public-key checks.
    await web.route('https://phase8-backend.fixture.invalid/**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const response = await web.request.fetch(`http://127.0.0.1:3120${url.pathname}${url.search}`, {
        method: request.method(), headers: request.headers(), data: request.postDataBuffer() ?? undefined,
        timeout: 10000,
      });
      transport.push({ path: url.pathname, status: response.status() });
      await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': '*' } });
    });
    // Realtime networking is tested separately; this flow exercises Auth/REST.
    await web.routeWebSocket('wss://phase8-backend.fixture.invalid/**', socket => {
      socket.onMessage(message => {
        if (typeof message !== 'string') return;
        const frame: unknown = JSON.parse(message);
        if (!Array.isArray(frame) || frame.length !== 5) return;
        const [join, ref, topic, event] = frame;
        if (event === 'phx_join') socket.send(JSON.stringify([join, ref, topic, 'phx_reply', { status: 'error', response: { reason: 'Realtime outside this Auth flow' } }]));
        else if (event === 'heartbeat') socket.send(JSON.stringify([join, ref, topic, 'phx_reply', { status: 'ok', response: {} }]));
      });
    });
    await web.goto('http://127.0.0.1:3116/sign-in');
    await web.getByLabel('Email or username', { exact: true }).fill(email);
    await fillSecret(web, 'Password', initial);
    await web.getByRole('button', { name: 'Sign in', exact: true }).click();
    try { await expect(web).toHaveURL('http://127.0.0.1:3116/change-password'); }
    catch { throw Error(`W sign-in transport statuses: ${JSON.stringify(transport)}`); }
    const updated = randomBytes(24).toString('base64url');
    await fillSecret(web, 'New password', updated);
    await fillSecret(web, 'Confirm password', updated);
    await web.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(web).toHaveURL('http://127.0.0.1:3116/');
    await expect(web.getByRole('heading', { name: 'DoloGram', exact: true })).toBeVisible();
    const state = await sql<{ clear: boolean }[]>`select raw_app_meta_data -> 'must_change_password' = 'false'::jsonb as clear from auth.users where email = ${email}`;
    expect(state[0]?.clear).toBe(true);
    expect(errors).toBe(0);
  } finally {
    try {
      for (const context of webBrowser.contexts()) for (const open of context.pages()) {
        if (!open.isClosed()) await open.goto('about:blank', { timeout: 3000 });
      }
    } finally { await webBrowser.close(); }
  }
});
