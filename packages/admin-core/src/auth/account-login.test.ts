import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAccountAuth } from './account.ts';

const mocks = vi.hoisted(() => ({ sql: vi.fn(), signIn: vi.fn(), getUser: vi.fn(), signOut: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('postgres', () => ({ default: () => mocks.sql }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: {
  signInWithPassword: mocks.signIn, getUser: mocks.getUser, admin: { signOut: mocks.signOut },
} }) }));

const userId = '10000000-0000-4000-8000-000000000001';
const sessionId = '20000000-0000-4000-8000-000000000001';
const token = `header.${Buffer.from(JSON.stringify({ sub: userId, session_id: sessionId, exp: 4000000000 })).toString('base64url')}.signature`;
const source = {
  SUPABASE_URL: 'http://127.0.0.1:3120', SUPABASE_PROJECT_REF: 'test-admin',
  SUPABASE_SECRET_KEY: 'synthetic', SUPABASE_DB_URL: 'postgres://postgres:synthetic@127.0.0.1:3122/postgres',
  SUPABASE_ACCESS_TOKEN: 'synthetic', BACKUP_DIR: 'G:/test-backups',
};
const options = { isolatedTarget: { projectRef: 'test-admin', apiOrigin: source.SUPABASE_URL,
  databaseHost: '127.0.0.1', databasePort: '3122' } };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.signIn.mockResolvedValue({ data: { user: { id: userId }, session: { access_token: token } }, error: null });
  mocks.getUser.mockResolvedValue({ data: { user: { id: userId, app_metadata: {} } }, error: null });
});

describe('admin login identity and authorization', () => {
  it('authenticates email and checks the current database role and session', async () => {
    mocks.sql.mockResolvedValueOnce([{ roles: 'admin' }]);
    expect((await createAccountAuth(source, options).signIn('Admin@Fixture.invalid', 'password')).ok).toBe(true);
    expect(mocks.signIn).toHaveBeenCalledWith({ email: 'admin@fixture.invalid', password: 'password' });
    expect(mocks.sql.mock.calls[0]?.slice(1)).toEqual([userId, sessionId]);
  });
  it('resolves a username privately to its Auth email before authentication', async () => {
    mocks.sql.mockResolvedValueOnce([{ email: 'admin@fixture.invalid' }]).mockResolvedValueOnce([{ roles: 'admin' }]);
    expect((await createAccountAuth(source, options).signIn(' Admin_User ', 'password')).ok).toBe(true);
    expect(mocks.sql.mock.calls[0]?.slice(1)).toEqual(['admin_user']);
    expect(mocks.signIn).toHaveBeenCalledWith({ email: 'admin@fixture.invalid', password: 'password' });
  });
  it('returns the same credential error for unknown usernames and incorrect passwords', async () => {
    mocks.sql.mockResolvedValueOnce([]);
    const auth = createAccountAuth(source, options);
    const unknown = await auth.signIn('unknown_user', 'password');
    expect(mocks.signIn).not.toHaveBeenCalled();
    mocks.signIn.mockResolvedValueOnce({ data: { session: null }, error: { status: 400 } });
    expect(await auth.signIn('admin@fixture.invalid', 'wrong')).toEqual(unknown);
  });
  it('denies a username login without the current admin role and revokes its new session', async () => {
    mocks.sql.mockResolvedValueOnce([{ email: 'user@fixture.invalid' }]).mockResolvedValueOnce([{ roles: 'user' }]);
    expect(await createAccountAuth(source, options).signIn('normal_user', 'password')).toMatchObject({ ok: false, code: 'denied' });
    expect(mocks.signOut).toHaveBeenCalledWith(token, 'local');
  });
  it('refuses even an administrator while its current Auth account still requires a password change', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: userId, app_metadata: { must_change_password: true } } }, error: null });
    expect(await createAccountAuth(source, options).signIn('admin@fixture.invalid', 'password')).toMatchObject({ ok: false, code: 'denied' });
    expect(mocks.sql).not.toHaveBeenCalled();
    expect(mocks.signOut).toHaveBeenCalledWith(token, 'local');
  });
});
