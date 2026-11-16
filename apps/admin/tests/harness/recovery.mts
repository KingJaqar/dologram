// Disposable Phase 8 core integration only. No hosted configuration is loaded.
import { strict as assert } from 'node:assert';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { createAccount, getAccountCapability, getCreationCapability, mintPasswordDraft, recoverAccountCreation, writeAudit } from '@dologram/admin-core';
import type { AdminUserApi, AuditEvent } from '@dologram/admin-core';
import { anonKey, database, options, source } from './fixture.mts';

assert.equal(new URL(database).hostname, options.isolatedTarget.databaseHost);
assert.equal(new URL(database).port, options.isolatedTarget.databasePort);
assert.equal(new URL(source.SUPABASE_URL).origin, options.isolatedTarget.apiOrigin);
const sql = postgres(database, { ssl: false, max: 1, connect_timeout: 5, query_timeout: 10, onnotice: () => {} });
const client = createClient(source.SUPABASE_URL, source.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
});

const run = randomBytes(5).toString('hex');
const actorUserId = randomUUID();
const sessionId = randomBytes(32).toString('base64url');
const secrets: string[] = [];
let stage = 'production gate';

async function verify(userId: string, operationId: string, forced = true) {
  const rows = await sql<{ roles: string; forced: boolean; saved: number; audits: number }[]>`
    select p.roles, u.raw_app_meta_data -> 'must_change_password' = 'true'::jsonb as forced,
      (select count(*)::int from public.chats c join public.chat_members cm on cm.chat_id = c.chat_id
        where c.type = 'direct' and c.direct_key = p.user_id::text and cm.user_id = p.user_id and cm.role = 'owner') as saved,
      (select count(*)::int from private.admin_audit a where a.event_id = ${operationId}::uuid) as audits
    from public.profiles p join auth.users u on u.id = p.user_id where p.user_id = ${userId}::uuid`;
  assert.equal(rows.length === 1 && rows[0]?.roles === 'user' && rows[0]?.forced === forced
    && rows[0]?.saved === 1 && rows[0]?.audits === 1, true, 'Initialization or idempotent audit check failed');
}

try {
  assert.equal(getAccountCapability().mutations, 'disabled', 'Later mutations were enabled');
  assert.equal((await getCreationCapability(sql)).mutations, 'enabled', 'Migration contract was not verified');
  stage = 'lost Auth response';
  // The provider commits but its response is lost. Recovery must not call it again.
  const draft = mintPasswordDraft({ sessionId });
  secrets.push(draft.password);
  let creates = 0;
  const users: AdminUserApi = { async createUser(request) {
    creates += 1;
    const response = await client.auth.admin.createUser(request);
    assert.equal(response.error === null && Boolean(response.data.user), true, 'Disposable Auth creation failed');
    throw new Error('Synthetic lost response');
  } };
  const unknown = await createAccount({ email: `lost-${run}@fixture.invalid`, username: `lost_${run}`, displayName: 'Lost response',
    actorUserId, sessionId, passwordDraftId: draft.passwordDraftId, source: 'admin' }, { sql, users });
  assert.equal(!unknown.ok && unknown.operationId === draft.passwordDraftId, true, 'Operation identity was lost');
  const recoveryInput = { operationId: draft.passwordDraftId, actorUserId, sessionId, source: 'admin' };
  stage = 'operation reconciliation';
  const foreign = await recoverAccountCreation({ ...recoveryInput, sessionId: 'foreign' }, { sql });
  assert.equal(foreign.ok, false, 'Foreign session was accepted');
  const recovered = await recoverAccountCreation(recoveryInput, { sql });
  assert.equal(recovered.ok && recovered.auditRecorded, true, 'Committed operation recovery failed');
  if (!recovered.ok) throw Error('Missing recovered identity');
  const before = await sql<{ hash: string }[]>`select encrypted_password as hash from auth.users where id = ${recovered.userId}::uuid`;
  const repeated = await recoverAccountCreation(recoveryInput, { sql });
  const after = await sql<{ hash: string }[]>`select encrypted_password as hash from auth.users where id = ${recovered.userId}::uuid`;
  assert.equal(repeated.ok && creates === 1 && before[0]?.hash === after[0]?.hash, true, 'Recovery repeated creation or changed a password');
  await verify(recovered.userId, draft.passwordDraftId);

  // A fixture-only missing trigger models the partial initialization boundary.
  // Re-enable it before recovery; the source-matched function must initialize
  // the existing identity. No existing/hosted trigger is touched by this helper.
  const nextDraft = mintPasswordDraft({ sessionId });
  stage = 'partial initialization';
  secrets.push(nextDraft.password);
  let partial: Awaited<ReturnType<typeof createAccount>>;
  await sql`alter table auth.users disable trigger on_auth_user_profile_sync`;
  try {
    partial = await createAccount({ email: `partial-${run}@fixture.invalid`, username: `partial_${run}`, displayName: 'Partial initialization',
      actorUserId, sessionId, passwordDraftId: nextDraft.passwordDraftId, source: 'admin' }, { sql, users: client.auth.admin });
    const incomplete = createClient(source.SUPABASE_URL, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    assert.equal((await incomplete.auth.signInWithPassword({ email: `partial-${run}@fixture.invalid`, password: nextDraft.password })).error, null);
    assert.equal((await incomplete.auth.updateUser({ password: randomBytes(24).toString('base64url') })).error, null);
    assert.equal((await incomplete.auth.getUser()).data.user?.app_metadata.must_change_password, false);
    assert.equal((await incomplete.from('profiles').select('user_id')).data?.length, 0);
  } finally { await sql`alter table auth.users enable trigger on_auth_user_profile_sync`; }
  assert.equal(!partial.ok && Boolean(partial.userId) && partial.operationId === nextDraft.passwordDraftId, true, 'Partial identity was not retained');
  if (partial.ok || !partial.userId) throw Error('Missing partial identity');
  const changedHash = await sql<{ hash: string }[]>`select encrypted_password as hash from auth.users where id=${partial.userId}::uuid`;
  const initialized = await recoverAccountCreation({ ...recoveryInput, operationId: nextDraft.passwordDraftId }, { sql });
  assert.equal(initialized.ok && initialized.auditRecorded, true, 'Initialization did not resume');
  if (!initialized.ok) throw Error('Missing initialized identity');
  const recoveredHash = await sql<{ hash: string }[]>`select encrypted_password as hash from auth.users where id=${initialized.userId}::uuid`;
  assert.equal(recoveredHash[0]?.hash === changedHash[0]?.hash, true, 'Initialization recovery rotated the changed password');
  await verify(initialized.userId, nextDraft.passwordDraftId, false);

  // An audit commit followed by a lost acknowledgement must remain one row.
  const committedThenLost = async (event: AuditEvent) => { await writeAudit(event, sql); throw Error('Synthetic audit acknowledgement loss'); };
  stage = 'script audit recovery';
  const scripted = await createAccount({ email: `scripted-${run}@fixture.invalid`, username: `scripted_${run}`, displayName: 'Script source',
    actorUserId: null, source: 'script' }, { sql, users: client.auth.admin, audit: committedThenLost });
  assert.equal(scripted.ok && !scripted.auditRecorded, true, 'Audit uncertainty was not reported');
  if (!scripted.ok) throw Error('Missing script identity');
  secrets.push(scripted.password);
  stage = 'script operation reconciliation';
  const scriptRecovery = await recoverAccountCreation({ operationId: scripted.operationId, actorUserId: null, source: 'script' }, { sql });
  assert.equal(scriptRecovery.ok && scriptRecovery.auditRecorded && !('password' in scriptRecovery), true, 'Script audit recovery failed');
  stage = 'script initialization verification';
  await verify(scripted.userId, scripted.operationId);
  stage = 'script source audit';
  const sourceRows = await sql<{ matches: boolean }[]>`
    select detail ->> 'source' = 'script' as matches from private.admin_audit where event_id = ${scripted.operationId}::uuid`;
  assert.equal(sourceRows[0]?.matches === true, true, 'Script source was not audited');
  stage = 'audit plaintext exclusion';
  const leaks = await sql<{ leaked: boolean }[]>`
    select exists (select 1 from private.admin_audit a cross join unnest(${secrets}::text[]) p(password)
      where strpos(a.detail::text, p.password) > 0) as leaked`;
  assert.equal(leaks[0]?.leaked === false, true, 'Password appeared in audit');
  console.info('PASS: isolated creation recovery, session binding, initialization, unchanged password, script audit idempotence and audit plaintext exclusion; verified migration enables creation only.');
} catch (error) {
  const code = (error as { code?: unknown } | null)?.code;
  console.error(`FAIL: isolated recovery at ${stage}`);
  if (typeof code === 'string' && /^[0-9A-Z]{5}$/u.test(code)) console.error(`SQLSTATE: ${code}`);
  process.exitCode = 1;
} finally { secrets.length = 0; await sql.end({ timeout: 1 }); }
