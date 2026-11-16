import { describe, expect, it } from 'vitest';
import type { Sql } from 'postgres';
import { AdminDbError } from '../db.ts';
import { consumePasswordDraft, isGeneratedPassword, mintPasswordDraft, PASSWORD_DRAFT_TTL_MS } from '../passwords.ts';
import { createAccount, type AdminCreateUserRequest, type AdminUserApi, type CreateAccountDeps } from './createAccount.ts';
import { getAccountCapability } from './modes.ts';

const USER_ID = '50000000-0000-4000-8000-00000000000a';
const ACTOR = '40000000-0000-4000-8000-00000000000a';
const enabled: CreateAccountDeps['capability'] = Object.freeze({
  passwordFlag: 'trigger', banFallback: 'none', mutations: 'enabled', prerequisite: undefined,
});

function stubSql(options: { usernameTaken?: boolean; emailTaken?: boolean; profileMissing?: boolean; fail?: unknown } = {}) {
  const calls: unknown[][] = [];
  const tag = (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push([strings.join(' ? '), ...values]);
    if (options.fail !== undefined) return Promise.reject(options.fail);
    if (calls.length === 1) return Promise.resolve(options.usernameTaken ? [{ taken: 1 }] : []);
    if (calls.length === 2) return Promise.resolve(options.emailTaken ? [{ taken: 1 }] : []);
    return Promise.resolve(options.profileMissing ? [] : [{ user_id: USER_ID }]);
  };
  return { sql: Object.assign(tag, { json: (value: unknown) => JSON.stringify(value) }) as unknown as Sql, calls };
}

function stubUsers(outcome: { id?: string; error?: { code?: string; status?: number }; throw?: boolean } = {}) {
  const requests: AdminCreateUserRequest[] = [];
  const users: AdminUserApi = {
    async createUser(request) {
      requests.push(request);
      if (outcome.throw) throw new Error('provider detail');
      return {
        data: { user: outcome.error ? null : { id: outcome.id ?? USER_ID } },
        error: outcome.error ?? null,
      };
    },
  };
  return { users, requests };
}

const details = { email: 'New_User@Example.com', username: 'new_user', displayName: '  New User  ', actorUserId: ACTOR };

function deps(overrides: CreateAccountDeps = {}): CreateAccountDeps {
  return { sql: stubSql().sql, users: stubUsers().users, capability: enabled, audit: async () => undefined, ...overrides };
}

describe('createAccount validation and pre-checks', () => {
  it('refuses a 4-character username, a malformed email and a blank display name before any query', async () => {
    const sql = stubSql();
    const users = stubUsers();
    const dependencies = { sql: sql.sql, users: users.users, capability: enabled, audit: async () => undefined };
    const base = { source: 'script' as const, actorUserId: null };
    expect(await createAccount({ ...base, email: 'user@example.com', username: 'abcd', displayName: 'Name' }, dependencies))
      .toMatchObject({ ok: false, field: 'username' });
    expect(await createAccount({ ...base, email: 'not-an-email', username: 'valid_name', displayName: 'Name' }, dependencies))
      .toMatchObject({ ok: false, field: 'email' });
    expect(await createAccount({ ...base, email: 'user@example.com', username: 'valid_name', displayName: '   ' }, dependencies))
      .toMatchObject({ ok: false, field: 'displayName' });
    expect(sql.calls).toHaveLength(0);
    expect(users.requests).toHaveLength(0);
  });

  it('refuses caller-chosen passwords and role fields instead of ignoring them', async () => {
    const sql = stubSql();
    const users = stubUsers();
    const dependencies = { sql: sql.sql, users: users.users, capability: enabled, audit: async () => undefined };
    const base = { ...details, source: 'admin' as const };
    expect(await createAccount({ ...base, password: 'ChosenByCaller123' }, dependencies))
      .toEqual({ ok: false, message: 'The account details are not valid.' });
    expect(await createAccount({ ...base, roles: 'admin' }, dependencies))
      .toEqual({ ok: false, message: 'The account details are not valid.' });
    expect(sql.calls).toHaveLength(0);
    expect(users.requests).toHaveLength(0);
  });

  it('reports the username and email pre-check conflicts as field errors', async () => {
    const username = stubSql({ usernameTaken: true });
    expect(await createAccount({ ...details, source: 'script' }, deps({ sql: username.sql })))
      .toEqual({ ok: false, field: 'username', message: 'This username is taken.' });
    const email = stubSql({ emailTaken: true });
    expect(await createAccount({ ...details, source: 'script' }, deps({ sql: email.sql })))
      .toEqual({ ok: false, field: 'email', message: 'An account with this email already exists.' });
    expect(String(email.calls[1]?.[0])).toContain('from auth.users');
    expect(email.calls[1]?.[1]).toBe('new_user@example.com');
  });

  it('maps a database failure to a fixed SQLSTATE-only error', async () => {
    const sql = stubSql({ fail: Object.assign(new Error('postgres://user:sentinel@host/postgres'), { code: '57014' }) });
    await expect(createAccount({ ...details, source: 'script' }, deps({ sql: sql.sql }))).rejects.toThrow(AdminDbError);
  });
});

describe('createAccount capability and draft refusals', () => {
  it('refuses creation while the forced-password contract is unverified and keeps the draft', async () => {
    const draft = mintPasswordDraft({ sessionId: 'session-disabled' });
    const users = stubUsers();
    const contract = getAccountCapability();
    const result = await createAccount(
      { ...details, source: 'admin', sessionId: 'session-disabled', passwordDraftId: draft.passwordDraftId },
      deps({ users: users.users, capability: contract }),
    );
    expect(result).toEqual({ ok: false, message: contract.prerequisite });
    expect(users.requests).toHaveLength(0);
    expect(consumePasswordDraft({ passwordDraftId: draft.passwordDraftId, sessionId: 'session-disabled' }))
      .toEqual({ ok: true, password: draft.password });
  });

  it('refuses unknown, expired, foreign and absent drafts before the Auth call', async () => {
    const users = stubUsers();
    const base = { ...details, source: 'admin' as const, sessionId: 'session-drafts' };
    const refused = { ok: false, message: 'The generated password is no longer available. Generate a new password and try again.' };
    expect(await createAccount({ ...base }, deps({ users: users.users }))).toEqual(refused);
    expect(await createAccount({ ...base, passwordDraftId: '00000000-0000-4000-8000-000000000000' }, deps({ users: users.users }))).toEqual(refused);

    const foreign = mintPasswordDraft({ sessionId: 'session-other' });
    expect(await createAccount({ ...base, passwordDraftId: foreign.passwordDraftId }, deps({ users: users.users }))).toEqual(refused);

    const expired = mintPasswordDraft({ sessionId: 'session-drafts', now: Date.now() - PASSWORD_DRAFT_TTL_MS - 1 });
    expect(await createAccount({ ...base, passwordDraftId: expired.passwordDraftId }, deps({ users: users.users }))).toEqual(refused);
    expect(users.requests).toHaveLength(0);
  });
});

describe('createAccount successful creation', () => {
  it('creates the account from the server draft with forced-password metadata and audits the actor', async () => {
    const draft = mintPasswordDraft({ sessionId: 'session-success' });
    const sql = stubSql();
    const users = stubUsers();
    const audits: unknown[] = [];
    const result = await createAccount(
      { ...details, source: 'admin', sessionId: 'session-success', passwordDraftId: draft.passwordDraftId },
      { sql: sql.sql, users: users.users, capability: enabled, audit: async event => { audits.push(event); } },
    );
    expect(result).toEqual({ ok: true, userId: USER_ID, password: draft.password, auditRecorded: true, operationId: draft.passwordDraftId });
    expect(users.requests).toEqual([{
      email: 'new_user@example.com',
      password: draft.password,
      email_confirm: true,
      role: 'authenticated',
      user_metadata: { username: 'new_user', display_name: 'New User' },
      app_metadata: { must_change_password: true, admin_creation: expect.objectContaining({
        id: draft.passwordDraftId, actorUserId: ACTOR, source: 'admin', username: 'new_user', sessionHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      }) },
    }]);
    expect(String(sql.calls[2]?.[0])).toContain('from public.profiles');
    expect(sql.calls[2]?.[1]).toBe(USER_ID);
    expect(audits).toEqual([{
      eventId: draft.passwordDraftId,
      actorUserId: ACTOR, targetUserId: USER_ID, action: 'account.create',
      result: 'success', detail: { username: 'new_user', source: 'admin' },
    }]);
    // Single use: the same draft cannot create a second account.
    expect(await createAccount(
      { ...details, source: 'admin', sessionId: 'session-success', passwordDraftId: draft.passwordDraftId },
      { sql: sql.sql, users: users.users, capability: enabled, audit: async () => undefined },
    )).toMatchObject({ ok: false });
  });

  it('generates the password internally for a script caller and records source "script"', async () => {
    const users = stubUsers();
    const audits: { actorUserId?: string | null; detail?: unknown }[] = [];
    const result = await createAccount({ ...details, source: 'script', actorUserId: null },
      deps({ users: users.users, audit: async event => { audits.push(event); } }));
    if (!result.ok) throw new Error('Creation should have succeeded');
    expect(isGeneratedPassword(result.password)).toBe(true);
    expect(users.requests[0]?.password).toBe(result.password);
    expect(audits[0]).toMatchObject({ actorUserId: null, detail: { username: 'new_user', source: 'script' } });
  });

  it('reports applied state with the password when the profile or the audit write is missing', async () => {
    const missing = stubSql({ profileMissing: true });
    const profile = await createAccount({ ...details, source: 'script' }, deps({ sql: missing.sql }));
    expect(profile).toMatchObject({ ok: false, userId: USER_ID });
    if (!profile.ok) expect(profile.message).toContain('reuse the existing account');

    const result = await createAccount({ ...details, source: 'script' },
      deps({ audit: async () => { throw new Error('audit offline'); } }));
    if (!result.ok) throw new Error('Creation should have succeeded');
    expect(isGeneratedPassword(result.password)).toBe(true);
    expect(result.auditRecorded).toBe(false);
  });

  it('maps Auth rate limits and duplicate identities without leaking provider text', async () => {
    const limited = stubUsers({ error: { status: 429 } });
    expect(await createAccount({ ...details, source: 'script' }, deps({ users: limited.users })))
      .toEqual({ ok: false, rateLimited: true, message: 'Rate limited; retry later.' });
    const duplicate = stubUsers({ error: { code: 'user_already_exists', status: 422 } });
    expect(await createAccount({ ...details, source: 'script' }, deps({ users: duplicate.users })))
      .toEqual({ ok: false, field: 'email', message: 'An account with this email already exists.' });
    const thrown = stubUsers({ throw: true });
    expect(await createAccount({ ...details, source: 'script' }, deps({ users: thrown.users })))
      .toMatchObject({ ok: false, message: expect.stringContaining('may already exist') });
  });

  it('returns applied identity instead of throwing after Auth succeeds and SQL becomes unavailable', async () => {
    let calls = 0;
    const tag = () => {
      calls += 1;
      if (calls > 2) return Promise.reject(new Error('synthetic SQL outage'));
      return Promise.resolve([]);
    };
    const result = await createAccount({ ...details, source: 'script' }, deps({ sql: tag as unknown as Sql }));
    expect(result).toMatchObject({ ok: false, userId: USER_ID, message: expect.stringContaining('do not create another account') });
  });

  it('refuses an unimplemented initial-password fallback even if mutations are accidentally enabled', async () => {
    const users = stubUsers();
    const result = await createAccount({ ...details, source: 'script' }, deps({
      users: users.users,
      capability: { passwordFlag: 'initialPasswords', banFallback: 'none', mutations: 'enabled', prerequisite: undefined },
    }));
    expect(result.ok).toBe(false);
    expect(users.requests).toHaveLength(0);
  });
});
