import { test, expect, type Page, type Request as BrowserRequest } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { database, evidence, source, anonKey } from '../harness/fixture.mts';

const origin = 'http://127.0.0.1:3100', cookieName = 'dg_admin_account_v1';
const sql = postgres(database, { ssl: false, max: 1, connect_timeout: 5, query_timeout: 10, onnotice: () => {} });
const client = () => createClient(source.SUPABASE_URL, source.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) } });
const password = randomBytes(24).toString('base64url');
let sequence = 0;
const run = randomBytes(6).toString('hex');
function state(offset = 0, offline = false) { writeFileSync(new URL('state.json', evidence), JSON.stringify({ offset, offline })); }
async function fixture(admin = true) {
  const email = `phase4-${run}-${sequence++}@fixture.invalid`;
  const { data, error } = await client().auth.admin.createUser({ email, password, email_confirm: true, role: 'authenticated', user_metadata: { display_name: 'Disposable Phase 4', roles: 'admin' } });
  if (error || !data.user) throw Error('Disposable Auth fixture creation failed');
  const id = data.user.id;
  const before = await sql`select to_jsonb(p) - 'roles' as profile from public.profiles p where user_id = ${id}::uuid`;
  expect((await sql`select roles from public.profiles where user_id = ${id}::uuid`)[0]?.roles).toBe('user');
  if (admin) await sql`update public.profiles set roles = 'admin' where user_id = ${id}::uuid`;
  return { id, email, before: before[0]?.profile };
}
async function submit(page: Page, email: string, input = password) {
  await page.getByLabel('Username or email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(input);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
async function capture(request: BrowserRequest) {
  const h = await request.allHeaders(), data = request.postDataBuffer();
  if (!h['next-action'] || !h['content-type'] || !data) throw Error('Expected actual server action');
  return { headers: { 'next-action': h['next-action'], 'content-type': h['content-type'], origin } as Record<string, string>, data };
}
function raw(path: string, method = 'GET', headers: Record<string, string> = {}, data?: Buffer) {
  return new Promise<{ status: number; headers: import('node:http').IncomingHttpHeaders; body: string }>((resolve, reject) => {
    const request = httpRequest({ hostname: '127.0.0.1', port: 3115, path, method, headers: { host: '127.0.0.1:3100', ...headers, ...(data ? { 'content-length': data.length } : {}) }, timeout: 15000 }, response => {
      const chunks: Buffer[] = []; let bytes = 0;
      response.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > 1024 * 1024) response.destroy(); else chunks.push(chunk); });
      response.on('end', () => resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks).toString() }));
      response.on('error', () => reject(Error('Isolated response failed')));
    });
    request.on('timeout', () => request.destroy()); request.on('error', () => reject(Error('Isolated request failed'))); request.end(data);
  });
}
test.beforeEach(() => state());
test.afterAll(async () => { state(); await sql.end({ timeout: 1 }); });

test('ordinary account denial, trusted promotion, same identity/data and both themes with safe cookies', async ({ page, context }) => {
  const diagnostics: string[] = [];
  page.on('pageerror', () => diagnostics.push('pageerror'));
  page.on('console', m => { if (['warning', 'error'].includes(m.type())) diagnostics.push(m.text().replaceAll(password, '[fixture]')); });
  const user = await fixture(false);
  await page.goto('/sign-in'); await submit(page, user.email);
  await expect(page.getByRole('status')).toContainText('does not have admin access');
  expect((await context.cookies()).some(c => c.name === cookieName)).toBe(false);
  await sql`update public.profiles set roles = 'admin' where user_id = ${user.id}::uuid`;
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme }); await page.goto('/sign-in');
    await page.evaluate(() => document.fonts.ready);
    const region = page.getByRole('region', { name: 'DoloGram Admin' });
    expect((await region.boundingBox())?.width).toBe(400);
    await page.getByLabel('Username or email').focus(); await page.keyboard.press('Tab'); await expect(page.getByLabel('Password')).toBeFocused();
    const colors = await page.locator('body').evaluate(element => {
      const probe = document.createElement('div'); probe.style.background = 'var(--dg-color-bg-app)'; element.append(probe);
      const result = [getComputedStyle(element).backgroundColor, getComputedStyle(probe).backgroundColor]; probe.remove(); return result;
    });
    expect(colors[0]).toBe(colors[1]);
    await submit(page, user.email); await expect(page).toHaveURL(`${origin}/`);
    await expect(page.getByText(`Signed in as admin (${user.id}).`)).toBeVisible();
    const cookie = (await context.cookies()).find(c => c.name === cookieName);
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/', secure: false, expires: -1 });
    expect(await page.evaluate(() => document.cookie)).not.toContain(cookieName);
    expect((await context.request.get('/api/session')).status()).toBe(200);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await expect(page).toHaveURL(`${origin}/sign-in`);
    expect((await raw('/api/session', 'GET', { cookie: `${cookieName}=${cookie?.value}` })).status).toBe(401);
  }
  const profile = await sql`select to_jsonb(p) - 'roles' as profile from public.profiles p where user_id = ${user.id}::uuid`;
  expect(profile[0]?.profile).toEqual(user.before);
  expect((await sql`select count(*)::int as count from public.chat_members where user_id = ${user.id}::uuid`)[0]?.count).toBe(1);
  const normal = await client().auth.signInWithPassword({ email: user.email, password }); expect(normal.data.user?.id).toBe(user.id);
  expect(diagnostics).toEqual([]);
});

test('live demotion, Auth revocation, ban and session deadline deny the next request', async ({ page, context }) => {
  const user = await fixture(); await page.goto('/sign-in'); await submit(page, user.email); await expect(page).toHaveURL(`${origin}/`);
  await sql`update public.profiles set roles = 'user' where user_id = ${user.id}::uuid`;
  expect((await context.request.get('/api/session')).status()).toBe(401);
  await page.goto('/'); await expect(page).toHaveURL(/sign-in\?reason=access/);
  await sql`update public.profiles set roles = 'admin' where user_id = ${user.id}::uuid`;
  await submit(page, user.email); await expect(page).toHaveURL(`${origin}/`);
  await sql`delete from auth.sessions where user_id = ${user.id}::uuid`;
  expect((await context.request.get('/api/session')).status()).toBe(401);
  await page.goto('/sign-in'); await submit(page, user.email); await expect(page).toHaveURL(`${origin}/`);
  await sql`update auth.users set banned_until = now() + interval '1 hour' where id = ${user.id}::uuid`;
  expect((await context.request.get('/api/session')).status()).toBe(401);
  await sql`update auth.users set banned_until = null where id = ${user.id}::uuid`;
  await page.goto('/sign-in'); await submit(page, user.email); await expect(page).toHaveURL(`${origin}/`);
  await sql`update auth.sessions set not_after = now() - interval '1 second' where user_id = ${user.id}::uuid`;
  expect((await context.request.get('/api/session')).status()).toBe(401);
});

test('metadata/signup/table/RPC cannot self-promote; admin remains a normal profile client', async () => {
  const user = await fixture(false), c = client();
  const login = await c.auth.signInWithPassword({ email: user.email, password }); expect(login.error).toBeNull();
  const metadata = await c.auth.updateUser({ data: { roles: 'admin', role: 'service_role' } }); expect(metadata.error).toBeNull();
  expect((await sql`select roles from public.profiles where user_id = ${user.id}::uuid`)[0]?.roles).toBe('user');
  const denied = await c.from('profiles').update({ roles: 'admin' }).eq('user_id', user.id); expect(denied.error?.code).toBe('42501');
  const rpc = await c.rpc('guard_profile_roles'); expect(rpc.error).not.toBeNull();
  await sql`update public.profiles set roles = 'admin' where user_id = ${user.id}::uuid`;
  const normal = await c.from('profiles').select('user_id,roles').eq('user_id', user.id).single(); expect(normal.data?.user_id).toBe(user.id);
  expect((await c.from('profiles').update({ display_name: 'Normal edit' }).eq('user_id', user.id)).error).toBeNull();
  expect((await c.from('profiles').update({ roles: 'user' }).eq('user_id', user.id)).error?.code).toBe('42501');
  const anon = createClient(source.SUPABASE_URL, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const signup = await anon.auth.signUp({ email: `signup-${run}@fixture.invalid`, password, options: { data: { roles: 'admin' } } });
  expect(signup.error).toBeNull();
  expect((await sql`select roles from public.profiles where user_id = ${signup.data.user?.id ?? ''}::uuid`)[0]?.roles).toBe('user');
});

test('forged/old cookies and direct RSC/API requests fail; no production test endpoints', async ({ context }) => {
  const manifest = readFileSync('.next/server/app-paths-manifest.json', 'utf8');
  expect(manifest).not.toMatch(/harness|test-clock|age-session|expire-lockout/);
  for (const cookie of ['', 'dg_admin_session=legacy', `${cookieName}=${'A'.repeat(43)}`]) {
    const response = await raw('/', 'GET', { cookie }); expect(response.status).toBe(307);
    expect(response.headers.location).toContain('/sign-in');
    const rsc = await raw('/', 'GET', { cookie, rsc: '1' }); expect(rsc.body).not.toContain('Signed in as admin');
    expect((await raw('/api/session', 'GET', { cookie })).status).toBe(401);
  }
  expect((await context.request.get('/unlock', { maxRedirects: 0 })).headers().location).toContain('/sign-in');
  for (const path of ['/api/test-clock', '/api/age-session']) expect((await raw(path)).status).toBe(401);
});

test('actual action replays enforce Host/Origin before sign-in/sign-out and bound per-account attempts', async ({ page, context }) => {
  const user = await fixture(); await page.goto('/sign-in');
  const outgoing = page.waitForRequest(r => r.method() === 'POST'); await submit(page, user.email);
  const signing = await capture(await outgoing); await expect(page).toHaveURL(`${origin}/`);
  const cookie = (await context.cookies()).find(c => c.name === cookieName); if (!cookie) throw Error('Missing cookie');
  const leaving = page.waitForRequest(r => r.method() === 'POST'); await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  const logout = await capture(await leaving); await expect(page).toHaveURL(`${origin}/sign-in`);
  for (const [path, captured] of [['/sign-in', signing], ['/', logout]] as const) {
    for (const originValue of [undefined, 'http://127.0.0.1:3199']) {
      const headers: Record<string, string> = { ...captured.headers, cookie: `${cookieName}=${cookie.value}` };
      if (originValue === undefined) delete headers.origin; else headers.origin = originValue;
      const result = await raw(path, 'POST', headers, captured.data); expect(result.status).toBe(403); expect(result.headers['set-cookie']).toBeUndefined();
    }
  }
  for (const path of ['/', '/sign-in', '/_next/static/test.js', '/api/session']) expect((await raw(path, 'GET', { host: 'evil.test', 'x-forwarded-host': '127.0.0.1:3100' })).status).toBe(421);
  const bad = Buffer.from(signing.data.toString().replaceAll(password, 'synthetic-wrong'));
  for (let i = 0; i < 4; i++) expect((await raw('/sign-in', 'POST', signing.headers, bad)).headers['set-cookie']).toBeUndefined();
  const limited = await raw('/sign-in', 'POST', signing.headers, signing.data); expect(limited.headers['set-cookie']).toBeUndefined(); expect(limited.body).toContain('Too many sign-in attempts');
  const other = await fixture(); await submit(page, other.email); await expect(page).toHaveURL(`${origin}/`);
});

test('eight-hour idle/passive bounds, explicit navigation extension, outage denial and offline local sign-out', async ({ page, context }) => {
  const user = await fixture(); await page.goto('/sign-in'); await submit(page, user.email); await expect(page).toHaveURL(`${origin}/`);
  state(8 * 3600 * 1000 - 10000); expect((await context.request.get('/api/session')).status()).toBe(200);
  state(8 * 3600 * 1000 + 1000); expect((await context.request.get('/api/session')).status()).toBe(401);
  state(); await page.goto('/sign-in'); await submit(page, user.email); await expect(page).toHaveURL(`${origin}/`);
  state(7 * 3600 * 1000);
  expect((await raw('/', 'GET', { cookie: (await context.cookies()).map(c => `${c.name}=${c.value}`).join('; '), 'sec-fetch-user': '?1', 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' })).status).toBe(200);
  state(9 * 3600 * 1000); expect((await context.request.get('/api/session')).status()).toBe(200);
  const old = (await context.cookies()).find(c => c.name === cookieName)?.value;
  state(9 * 3600 * 1000, true); expect((await context.request.get('/api/session')).status()).toBe(401);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await expect(page).toHaveURL(`${origin}/sign-in`);
  expect((await context.cookies()).some(c => c.name === cookieName)).toBe(false);
  await submit(page, user.email); await expect(page.getByRole('status')).toContainText('unavailable');
  state(); expect((await raw('/api/session', 'GET', { cookie: `${cookieName}=${old}` })).status).toBe(401);
});

