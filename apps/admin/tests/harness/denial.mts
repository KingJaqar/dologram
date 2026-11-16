import { strict as assert } from 'node:assert';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { createAccount, getCreationCapability, recoverAccountCreation } from '@dologram/admin-core';
import { edgeHandlers } from './edge-harness.mts';
import { assertAccountAccess } from '../../../../supabase/functions/_shared/accountAccess.ts';
import { database, source, anonKey } from './fixture.mts';

assert.equal(new URL(database).hostname, '127.0.0.1');
const sql = postgres(database, { ssl: false, max: 1, connect_timeout: 5, query_timeout: 10, onnotice: () => {} });
const settings = { auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) } };
const admin = createClient(source.SUPABASE_URL, source.SUPABASE_SECRET_KEY, settings);
const user = createClient(source.SUPABASE_URL, anonKey, settings);
const run = randomBytes(5).toString('hex');
let stage = 'creation';
let edge: Awaited<ReturnType<typeof edgeHandlers>> | undefined;
try {
  edge = await edgeHandlers();
  async function edgeStatus(token: string, denied: boolean) {
    for (const [index, handler] of (edge?.handlers ?? []).entries()) {
      const response = await handler(new Request('http://isolated.invalid', { method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(index === 0 ? { action: 'list', offset: 0 } : {}) }));
      assert.equal(response.status, denied ? 403 : index === 0 ? 200 : 400, 'Edge access boundary failed');
      if (denied) assert.equal((await response.json()).code, 'MEMO_NOT_ALLOWED');
    }
  }
  const created = await createAccount({ source: 'script', actorUserId: null, email: `denial-${run}@fixture.invalid`, username: `denial_${run}`, displayName: 'Denial boundaries' }, { sql, users: admin.auth.admin });
  assert.equal(created.ok, true, 'Creation failed');
  if (!created.ok) throw Error('No disposable identity');
  const userId = created.userId;
  const signed = await user.auth.signInWithPassword({ email: `denial-${run}@fixture.invalid`, password: created.password });
  assert.equal(signed.error === null && Boolean(signed.data.user), true, 'Disposable sign-in failed');
  assert.throws(() => assertAccountAccess(signed.data.user?.app_metadata ?? {}));
  await edgeStatus(signed.data.session?.access_token ?? '', true);
  await sql`insert into storage.objects(bucket_id,name) values('avatars',${created.userId + '/avatar'})`;
  await sql`insert into realtime.messages(topic,extension,payload) values('phase8','broadcast','{}'::jsonb)`;

  async function visible() {
    return sql.begin(async tx => {
      await tx`select set_config('request.jwt.claim.sub',${userId},true), set_config('request.jwt.claim.role','authenticated',true), set_config('request.jwt.claims',${JSON.stringify({ sub: userId, role: 'authenticated' })},true)`;
      await tx`set local role authenticated`;
      const storage = await tx<{ count: number }[]>`select count(*)::int as count from storage.objects where name=${created.userId + '/avatar'}`;
      const realtime = await tx<{ count: number }[]>`select count(*)::int as count from realtime.messages where topic='phase8'`;
      return { storage: storage[0]?.count, realtime: realtime[0]?.count };
    });
  }
  stage = 'Storage and Realtime RLS';
  const denied = await visible();
  assert.equal(denied.storage === 0 && denied.realtime === 0, true, 'Restricted rows escaped RLS');
  stage = 'RPC denial';
  const search = await user.rpc('search_people', { p_query: 'admin' });
  assert.equal(search.error === null && search.data?.length === 0, true, 'Search bypassed restriction');
  const privacy = await user.rpc('get_my_read_privacy');
  assert.equal(privacy.error?.code === '42501', true, 'Definer RPC bypassed restriction');
  const worker = await user.rpc('memo_claim_reminder_occurrences', { p_limit: 1 });
  assert.equal(worker.error !== null && worker.data === null, true, 'Service worker RPC was exposed');
  stage = 'same password refusal';
  const unchanged = await user.auth.updateUser({ password: created.password });
  assert.equal(unchanged.error !== null && (await user.auth.getUser()).data.user?.app_metadata.must_change_password === true, true, 'Reusing the initial password cleared the restriction');
  stage = 'password clearing';
  const changed = await user.auth.updateUser({ password: randomBytes(24).toString('base64url') });
  assert.equal(changed.error === null, true, 'Password update failed');
  const verified = await user.auth.getUser();
  assert.equal(verified.data.user?.app_metadata.must_change_password === false, true, 'Live flag did not clear');
  assert.doesNotThrow(() => assertAccountAccess(verified.data.user?.app_metadata ?? {}));
  await edgeStatus((await user.auth.getSession()).data.session?.access_token ?? '', false);
  const allowed = await visible();
  assert.equal(allowed.storage === 1 && allowed.realtime === 1, true, 'Access did not recover after password change');
  stage = 'role protection';
  const promotion = await user.from('profiles').update({ roles: 'admin' }).eq('user_id', created.userId);
  assert.equal(promotion.error?.code === '42501', true, 'Self-promotion became possible');
  stage = 'fail-closed capability';
  let detected = false;
  try {
    await sql.begin(async tx => {
      await tx`alter table public.profiles disable row level security`;
      const version = await tx<{ version: number }[]>`select private.admin_creation_contract_version() as version`;
      detected = version[0]?.version === 0;
      throw Error('Rollback isolated capability probe');
    });
  } catch { assert.equal(detected, true, 'Incomplete contract was accepted'); }
  assert.equal((await getCreationCapability(sql)).mutations, 'enabled', 'Probe rollback did not restore contract');
  stage = 'self-service signup';
  const signup = createClient(source.SUPABASE_URL, anonKey, settings);
  const registered = await signup.auth.signUp({ email: `signup-${run}@fixture.invalid`, password: randomBytes(24).toString('base64url'), options: { data: { username: `signup_${run}`, display_name: 'Normal signup' } } });
  stage = registered.error?.code ? `signup ${registered.error.code.replace(/[^a-zA-Z]/gu, ' ')}` : 'self-service signup response';
  assert.equal(registered.error === null && Boolean(registered.data.user), true, 'Normal signup was blocked');
  stage = 'self-service signup profile';
  if (!registered.data.session) stage = 'signup confirmation required';
  const profile = await signup.from('profiles').select('roles').eq('user_id', registered.data.user?.id ?? '');
  if (profile.error?.code) stage = `signup profile ${profile.error.code.replace(/[^a-zA-Z0-9]/gu, ' ')}`;
  if (!profile.error && profile.data?.length === 0) {
    const diagnostics = await sql<{ allowed: boolean; profile: boolean }[]>`select private.account_access_allowed(${registered.data.user?.id ?? ''}::uuid) as allowed, exists(select 1 from public.profiles where user_id=${registered.data.user?.id ?? ''}::uuid) as profile`;
    stage = !registered.data.session ? 'signup confirmation required' : diagnostics[0]?.allowed ? 'signup API identity' : diagnostics[0]?.profile ? 'signup metadata gate' : 'signup profile missing';
  }
  assert.equal(profile.error === null && profile.data?.[0]?.roles === 'user', true, 'Normal signup permissions changed');
  stage = 'stale JWT denial';
  const restricted = await admin.auth.admin.updateUserById(registered.data.user?.id ?? '', { app_metadata: { must_change_password: true } });
  assert.equal(restricted.error === null, true, 'Isolated restriction setup failed');
  const stale = await signup.from('profiles').select('user_id');
  assert.equal(stale.error === null && stale.data?.length === 0, true, 'Stale unrestricted JWT bypassed live denial');
  const current = await signup.auth.getUser();
  assert.throws(() => assertAccountAccess(current.data.user?.app_metadata ?? {}));
  await edgeStatus(registered.data.session?.access_token ?? '', true);
  stage = 'audit-pending password change';
  const pending = await createAccount({ source: 'script', actorUserId: null,
    email: `pending-${run}@fixture.invalid`, username: `pending_${run}`, displayName: 'Pending audit' },
  { sql, users: admin.auth.admin, audit: async () => { throw Error('Synthetic audit outage'); } });
  assert.equal(pending.ok && !pending.auditRecorded, true, 'Audit interruption not exercised');
  if (!pending.ok) throw Error('Missing pending identity');
  const pendingClient = createClient(source.SUPABASE_URL, anonKey, settings);
  assert.equal((await pendingClient.auth.signInWithPassword({ email: `pending-${run}@fixture.invalid`, password: pending.password })).error, null);
  assert.equal((await pendingClient.auth.updateUser({ password: randomBytes(24).toString('base64url') })).error, null);
  assert.equal((await pendingClient.auth.getUser()).data.user?.app_metadata.must_change_password, false);
  assert.equal((await pendingClient.from('profiles').select('user_id')).data?.length, 0);
  assert.equal((await admin.rpc('account_access_allowed', { p_user_id: pending.userId })).data, false);
  const pendingToken = (await pendingClient.auth.getSession()).data.session?.access_token ?? '';
  await edgeStatus(pendingToken, true);
  const recovered = await recoverAccountCreation({ source: 'script', actorUserId: null, operationId: pending.operationId }, { sql });
  assert.equal(recovered.ok && recovered.auditRecorded, true, 'Pending audit recovery failed');
  assert.equal((await pendingClient.from('profiles').select('user_id').eq('user_id', pending.userId)).data?.length, 1);
  await edgeStatus(pendingToken, false);
  console.info('PASS: live Storage/Realtime RLS, RPC and Edge gates, password clearing, role protection, signup and fail-closed capability.');
} catch {
  console.error(`FAIL: denial contract at ${stage}`);
  process.exitCode = 1;
} finally { await edge?.close(); await sql.end({ timeout: 1 }); }
