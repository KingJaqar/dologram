import 'server-only';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { z } from 'zod';
import { getAdminEnv, type ConfigOptions, type EnvSource } from '../env.ts';
import { databaseTls } from '../databaseTls.ts';

const credentials = z.object({
  identifier: z.union([z.email().max(254), z.string().regex(/^[a-z][a-z0-9_]{4,31}$/u)]),
  password: z.string().min(1).max(1024).refine(value => !value.includes('\0')),
});
const claims = z.object({ sub: z.uuid(), session_id: z.uuid(), exp: z.number().int().positive() });
export interface AccountSession {
  userId: string;
  authSessionId: string;
  accessToken: string;
  expiresAt: number;
}
export type SignInResult = { ok: true; account: AccountSession }
  | { ok: false; code: 'invalid' | 'denied' | 'unavailable'; message: string };

export function parseSignIn(data: FormData) {
  const identifier = data.getAll('identifier');
  const password = data.getAll('password');
  return credentials.safeParse({
    identifier: identifier.length === 1 && typeof identifier[0] === 'string' ? identifier[0].trim().toLowerCase() : undefined,
    password: password.length === 1 ? password[0] : undefined,
  });
}

/** Separate, nonpersistent Auth clients never become service clients or browser state. */
export function createAccountAuth(source: EnvSource = process.env, options: ConfigOptions = {}) {
  const env = getAdminEnv(source, options);
  const sql = postgres(env.SUPABASE_DB_URL, {
    ssl: databaseTls(Boolean(options.isolatedTarget)), prepare: false, max: 2,
    idle_timeout: 5, connect_timeout: 5, queue_timeout: 5, query_timeout: 10,
    cancel_timeout: 1, connection: { statement_timeout: 5000 }, onnotice: () => {},
  });
  function client() {
    return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, {
        ...init, cache: 'no-store', signal: AbortSignal.timeout(10000),
      }) },
    });
  }
  async function currentAdmin(account: AccountSession): Promise<boolean> {
    if (account.expiresAt <= Date.now()) return false;
    const { data, error } = await client().auth.getUser(account.accessToken);
    if (error || data.user?.id !== account.userId) return false;
    const forced = data.user.app_metadata.must_change_password;
    if (forced !== undefined && forced !== false) return false;
    // Checking auth.sessions closes the signed-but-revoked JWT window. Never trust
    // metadata/claims for application roles, or cache a prior successful role read.
    const rows = await sql<{ roles: string }[]>`
      select p.roles from public.profiles p
      join auth.users u on u.id = p.user_id
      join auth.sessions s on s.user_id = u.id
      where p.user_id = ${account.userId}::uuid and s.id = ${account.authSessionId}::uuid
        and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now())
        and (s.not_after is null or s.not_after > now())`;
    return rows.length === 1 && rows[0]?.roles === 'admin';
  }
  async function signIn(identifier: string, password: string): Promise<SignInResult> {
    const parsedCredentials = credentials.safeParse({ identifier: identifier.trim().toLowerCase(), password });
    if (!parsedCredentials.success) {
      return { ok: false, code: 'invalid', message: 'Enter a valid username or email and password (at most 1024 characters).' };
    }
    try {
      let email = parsedCredentials.data.identifier;
      if (!email.includes('@')) {
        // Resolve privately; authorize the authenticated identity against the database below.
        const rows = await sql<{ email: string }[]>`
          select u.email from public.profiles p join auth.users u on u.id = p.user_id
          where lower(p.username) = ${email} and u.deleted_at is null limit 2`;
        if (rows.length !== 1 || !rows[0]?.email) {
          return { ok: false, code: 'invalid', message: 'Username, email or password is incorrect, or the account is disabled.' };
        }
        email = rows[0].email;
      }
      const { data, error } = await client().auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        const unavailable = error && (!error.status || error.status >= 500 || error.status === 429);
        return { ok: false, code: unavailable ? 'unavailable' : 'invalid', message: unavailable
          ? 'Sign in is unavailable. Try again shortly.' : 'Username, email or password is incorrect, or the account is disabled.' };
      }
      let payload: unknown;
      try { payload = JSON.parse(Buffer.from(data.session.access_token.split('.')[1] ?? '', 'base64url').toString('utf8')); }
      catch { return { ok: false, code: 'unavailable', message: 'Sign in is unavailable. Try again shortly.' }; }
      const parsed = claims.safeParse(payload);
      if (!parsed.success || parsed.data.sub !== data.user.id) {
        return { ok: false, code: 'unavailable', message: 'Sign in is unavailable. Try again shortly.' };
      }
      const account: AccountSession = { userId: parsed.data.sub, authSessionId: parsed.data.session_id,
        accessToken: data.session.access_token, expiresAt: parsed.data.exp * 1000 };
      if (!await currentAdmin(account)) {
        // This is a new admin-web Auth session, so revoking it cannot sign out
        // the same account on its normal mobile/web sessions.
        await client().auth.admin.signOut(account.accessToken, 'local');
        return { ok: false, code: 'denied', message: 'This account does not have admin access.' };
      }
      return { ok: true, account };
    } catch {
      return { ok: false, code: 'unavailable', message: 'Sign in is unavailable. Check the backend connection and try again.' };
    }
  }
  return { signIn, currentAdmin, close: () => sql.end({ timeout: 1 }) };
}
