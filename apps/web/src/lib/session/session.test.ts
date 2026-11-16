import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDgClient, strings, type DgClient, type DgFetch } from '@dologram/shared';
import { SessionController, type Session } from './session';
import { consumeRecoveryUrl, recoveryKey, revocationKey } from './recovery';
import { retainedWipeKey } from './signOut';
import { authMessage } from './errors';

const clients: DgClient[] = [];
const controllers: SessionController[] = [];
let fixtureId = 0;
const user = (id = 'owner-a', forced = false) => ({ id, aud: 'authenticated', role: 'authenticated', email: `${id}@example.test`, app_metadata: { must_change_password: forced }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' });
const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const token = (id = 'owner-a') => `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 })}.c2lnbmF0dXJl`;
const session = (id = 'owner-a', forced = false): Session => ({ access_token: token(id), refresh_token: `refresh-${id}`, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: user(id, forced) });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' } });

function fixture(options: { restored?: Session; forced?: boolean; override?: (url: URL, init: RequestInit | undefined) => Response | Promise<Response> | undefined } = {}) {
  const requests: string[] = [];
  const storage = new Map<string, string>();
  const host = `isolated${++fixtureId}`;
  const sessionKey = `sb-${host}-auth-token`;
  const active = options.restored ?? session('owner-a', options.forced);
  if (options.restored) storage.set(sessionKey, JSON.stringify(options.restored));
  const transport: DgFetch = vi.fn(async (input, init) => {
    const url = new URL(String(input));
    requests.push(`${init?.method ?? 'GET'} ${url.pathname}`);
    const override = options.override?.(url, init);
    if (override) return await override;
    if (url.pathname.endsWith('/user')) return json(user(active.user.id, options.forced));
    if (url.pathname.endsWith('/token') || url.pathname.endsWith('/signup')) return json(active);
    if (url.pathname.includes('/rest/v1/profiles')) {
      const profile = { user_id: active.user.id, username: 'owner_a', display_name: 'Owner A', avatar_url: null, premium_flags: null };
      return json(new Headers(init?.headers).get('Accept')?.includes('vnd.pgrst.object') ? profile : [profile]);
    }
    if (url.pathname.endsWith('/recover') || url.pathname.endsWith('/logout')) return json({});
    throw new Error(`Unexpected fixture path: ${url.pathname}`);
  });
  const client = createDgClient({ url: `https://${host}.example.test`, key: 'sb_publishable_synthetic', storage: { getItem: async (key) => storage.get(key) ?? null, setItem: async (key, value) => { storage.set(key, value); }, removeItem: async (key) => { storage.delete(key); } }, fetch: transport });
  clients.push(client);
  const controller = new SessionController(() => client);
  controllers.push(controller);
  return { controller, client, transport, requests, storage, sessionKey };
}
const ready = (controller: SessionController, status: string) => vi.waitFor(() => expect(controller.getSnapshot().status).toBe(status));
beforeEach(() => { sessionStorage.clear(); window.history.replaceState({}, '', '/sign-in'); vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true); });
afterEach(async () => {
  controllers.splice(0).forEach((controller) => controller.stop());
  for (const client of clients.splice(0)) { await client.auth.initialize(); await client.auth.dispose(); }
  vi.restoreAllMocks();
});

it('restores a verified owner, defers SDK work, and subscribes once across Strict Mode restart', async () => {
  const { controller, client } = fixture({ restored: session() });
  const subscribe = vi.spyOn(client.auth, 'onAuthStateChange');
  controller.start(); controller.stop(); controller.start();
  await ready(controller, 'signedIn');
  expect(controller.getSnapshot().profile?.user_id).toBe('owner-a');
  expect(subscribe).toHaveBeenCalledTimes(1);
});

it('signs in and lets the SDK update Realtime exactly once for a token', async () => {
  const { controller, client } = fixture();
  const realtime = vi.spyOn(client.realtime, 'setAuth');
  controller.start(); await ready(controller, 'signedOut');
  await controller.signIn('owner-a@example.test', 'correct-password');
  expect(controller.getSnapshot().status).toBe('signedIn');
  expect(realtime.mock.calls.filter(([value]) => value === token())).toHaveLength(1);
});

it('signs in with a normalized username through the backend function and persists the verified session', async () => {
  const { controller, client, requests } = fixture({ override: (url, init) => {
    if (!url.pathname.endsWith('/sign-in-username')) return;
    expect(JSON.parse(String(init?.body))).toEqual({ username: 'owner_a', password: 'correct-password' });
    return json({ session: session() });
  } });
  controller.start(); await ready(controller, 'signedOut');
  await controller.signIn(' OWNER_A ', 'correct-password');
  expect(controller.getSnapshot().status).toBe('signedIn');
  expect((await client.auth.getSession()).data.session?.user.id).toBe('owner-a');
  expect(requests).toContain('POST /functions/v1/sign-in-username');
  expect(requests.some((request) => request.endsWith('/token'))).toBe(false);
});

it.each([401, 429, 503])('handles username function failure %s without creating a session', async (status) => {
  const { controller, client } = fixture({ override: (url) => url.pathname.endsWith('/sign-in-username') ? json({ error: 'private details' }, status) : undefined });
  controller.start(); await ready(controller, 'signedOut');
  let failure: unknown;
  try { await controller.signIn('owner_a', 'incorrect-password'); } catch (error) { failure = error; }
  expect(authMessage(failure, 'Try again.', true)).toBe(status === 401 ? 'Email, username or password is incorrect.' : status === 429 ? strings.signIn.tooManyAttempts : 'Try again.');
  expect((await client.auth.getSession()).data.session).toBeNull();
});

it('rejects a malformed username session without installing tokens', async () => {
  const { controller, client } = fixture({ override: (url) => url.pathname.endsWith('/sign-in-username') ? json({ session: { access_token: 'incomplete' } }) : undefined });
  controller.start(); await ready(controller, 'signedOut');
  await expect(controller.signIn('owner_a', 'correct-password')).rejects.toThrow('Missing session');
  expect((await client.auth.getSession()).data.session).toBeNull();
});

it('wrong credentials create no session and raw details are never shown', async () => {
  const { controller, client } = fixture({ override: (url) => url.pathname.endsWith('/token') ? json({ code: 'invalid_credentials', message: 'secret backend detail' }, 400) : undefined });
  controller.start(); await ready(controller, 'signedOut');
  let failure: unknown;
  try { await controller.signIn('wrong@example.test', 'incorrect-password'); } catch (error) { failure = error; }
  expect(authMessage(failure, 'fallback')).toBe('Email, username or password is incorrect.');
  expect((await client.auth.getSession()).data.session).toBeNull();
});

it('recovers from a rejected saved session through local sign-out and a fresh sign-in', async () => {
  let rejectSavedSession = true;
  const { controller, client, storage, sessionKey } = fixture({ restored: session(), override: (url) => {
    if (rejectSavedSession && url.pathname.endsWith('/user')) return json({ code: 'bad_jwt', message: 'Expired token' }, 401);
  } });
  controller.start(); await ready(controller, 'error');
  await controller.signOut();
  expect(controller.getSnapshot().status).toBe('signedOut');
  expect(storage.has(sessionKey)).toBe(false);
  expect((await client.auth.getSession()).data.session).toBeNull();
  rejectSavedSession = false;
  await controller.signIn('owner-a@example.test', 'correct-password');
  expect(controller.getSnapshot().status).toBe('signedIn');
});

it.each([429, 500])('classifies sign-up failure %s safely without a false username collision', async (status) => {
  const { controller, client } = fixture({ override: (url) => url.pathname.endsWith('/signup') ? json({ message: 'profiles_username_unique_idx sensitive' }, status) : undefined });
  controller.start(); await ready(controller, 'signedOut');
  let failure: unknown;
  try { await controller.signUp('owner-a@example.test', 'new-password12', 'owner_a', 'Owner A'); } catch (error) { failure = error; }
  expect(authMessage(failure, 'Registration failed')).toBe(status === 429 ? 'Too many attempts. Try again in a few minutes.' : 'Registration failed');
  expect((await client.auth.getSession()).data.session).toBeNull();
});

it('passes registration metadata and reports server confirmation-required settings', async () => {
  let metadata: unknown;
  const { controller } = fixture({ override: (url, init) => {
    if (!url.pathname.endsWith('/signup')) return;
    const payload: unknown = JSON.parse(String(init?.body));
    metadata = payload;
    return json(user());
  } });
  controller.start(); await ready(controller, 'signedOut');
  expect(await controller.signUp('owner-a@example.test', 'new-password12', 'owner_a', 'Owner A')).toBe(true);
  expect(metadata).toMatchObject({ data: { username: 'owner_a', display_name: 'Owner A' } });
  expect(controller.getSnapshot().status).toBe('signedOut');
});

it('uses a same-origin reset redirect and sends only the requested email', async () => {
  let redirect = '';
  const { controller } = fixture({ override: (url) => { if (url.pathname.endsWith('/recover')) redirect = url.searchParams.get('redirect_to') ?? ''; return undefined; } });
  controller.start(); await ready(controller, 'signedOut');
  await controller.forgotPassword('owner-a@example.test');
  expect(redirect).toBe(`${location.origin}/reset-password`);
});

it('clears recovery URL before SDK construction/requests and blocks SIGNED_IN until update', async () => {
  history.replaceState({ marker: 'retained' }, '', `/reset-password#access_token=${token()}&refresh_token=refresh-owner-a&type=recovery`);
  const { controller, requests } = fixture({ override: () => { expect(location.hash).toBe(''); return undefined; } });
  const statuses: string[] = [];
  controller.subscribe(() => statuses.push(controller.getSnapshot().status));
  controller.start();
  expect(location.hash).toBe('');
  expect(history.state.marker).toBe('retained');
  controller.stop(); controller.start();
  await vi.waitFor(() => expect(controller.getSnapshot().recoveryReady).toBe(true));
  expect(statuses).not.toContain('signedIn');
  expect(requests.some((path) => path.includes('/profiles'))).toBe(false);
  expect(sessionStorage.getItem(recoveryKey)).toBe('owner-a');
  await controller.changePassword('updated-password12');
  expect(controller.getSnapshot().status).toBe('signedIn');
  expect(sessionStorage.getItem(recoveryKey)).toBeNull();
});

it.each(['#type=signup&access_token=a&refresh_token=b', '#type=recovery&access_token=a', '?code=unsupported', '#error=access_denied&error_description=sensitive'])('fails closed and scrubs malformed callback %s', async (suffix) => {
  history.replaceState({}, '', `/reset-password${suffix}`);
  const { controller, requests } = fixture();
  controller.start();
  await vi.waitFor(() => expect(controller.getSnapshot().error).toBeTruthy());
  expect(location.hash + location.search).toBe('');
  expect(controller.getSnapshot().recoveryReady).toBe(false);
  expect(requests).toEqual([]);
  expect(controller.getSnapshot().status).toBe('passwordRecovery');
});

it('does not enable Save on direct reset navigation without a recovery marker', async () => {
  history.replaceState({}, '', '/reset-password');
  const { controller } = fixture({ restored: session() });
  controller.start(); await ready(controller, 'signedIn');
  expect(controller.getSnapshot().recoveryReady).toBe(false);
});

it('resumes a pending recovery on reload but refuses a mismatched owner marker', async () => {
  sessionStorage.setItem(recoveryKey, 'owner-a');
  const first = fixture({ restored: session() });
  first.controller.start();
  await vi.waitFor(() => expect(first.controller.getSnapshot().recoveryReady).toBe(true));
  first.controller.stop();
  sessionStorage.setItem(recoveryKey, 'owner-b');
  const next = fixture({ restored: session() }); next.controller.start();
  await vi.waitFor(() => expect(next.controller.getSnapshot().error).toBeTruthy());
  expect(next.controller.getSnapshot().recoveryReady).toBe(false);
});

it('rejects an invalid/expired session token without claiming one-time mail-link verification', async () => {
  history.replaceState({}, '', `/reset-password#access_token=${token()}&refresh_token=bad&type=recovery`);
  const { controller } = fixture({ override: (url) => url.pathname.endsWith('/user') ? json({ message: 'invalid token', code: 'bad_jwt' }, 401) : undefined });
  controller.start();
  await vi.waitFor(() => expect(controller.getSnapshot().error).toBeTruthy());
  expect(controller.getSnapshot().recoveryReady).toBe(false);
  expect(controller.getSnapshot().status).toBe('passwordRecovery');
});

it('retains recovery on failed update and failed refresh; verification can retry', async () => {
  sessionStorage.setItem(recoveryKey, 'owner-a');
  let failure: 'update' | 'refresh' | null = 'update';
  const { controller, client } = fixture({ restored: session(), override: (url, init) => {
    if (failure === 'update' && url.pathname.endsWith('/user') && init?.method === 'PUT') return json({ message: 'failure' }, 500);
  } });
  controller.start(); await vi.waitFor(() => expect(controller.getSnapshot().recoveryReady).toBe(true));
  await expect(controller.changePassword('updated-password12')).rejects.toBeDefined();
  expect(controller.getSnapshot().status).toBe('passwordRecovery');
  failure = 'refresh';
  const refresh = vi.spyOn(client.auth, 'refreshSession').mockRejectedValue(new TypeError('Offline'));
  await expect(controller.changePassword('updated-password12')).rejects.toBeDefined();
  expect(sessionStorage.getItem(recoveryKey)).toBe('owner-a');
  failure = null;
  refresh.mockRestore();
  await controller.verifyPassword();
  expect(controller.getSnapshot().status).toBe('signedIn');
});

it('never reads profiles for a forced account and does not trust user metadata to clear its gate', async () => {
  let forced = true;
  const { controller, requests } = fixture({ restored: session('owner-a', true), forced: true, override: (url) => url.pathname.endsWith('/user') ? json({ ...user('owner-a', forced), user_metadata: { must_change_password: false } }) : undefined });
  controller.start(); await ready(controller, 'mustChangePassword');
  expect(requests.some((path) => path.includes('/profiles'))).toBe(false);
  await expect(controller.changePassword('updated-password12')).rejects.toThrow('access is still restricted');
  expect(controller.getSnapshot().status).toBe('mustChangePassword');
  forced = false;
  await controller.verifyPassword();
  expect(controller.getSnapshot().status).toBe('signedIn');
});

it('restores offline without making a request and disables auth commands', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  const { controller, requests } = fixture({ restored: session() });
  controller.start(); await ready(controller, 'signedIn');
  expect(requests).toEqual([]);
  expect(controller.getSnapshot().online).toBe(false);
  await expect(controller.signIn('owner-a@example.test', 'password')).rejects.toThrow('Offline');
});

it.each(['offline', 'server failure'])('local sign-out denies access/removes only its session during %s', async (failure) => {
  localStorage.setItem('dg.theme', 'dark');
  if (failure === 'offline') vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  const { controller, client, storage, sessionKey } = fixture({ restored: session(), override: (url) => {
    if (!url.pathname.endsWith('/logout')) return;
    return failure === 'offline' ? Promise.reject(new TypeError('Synthetic offline transport')) : json({ message: 'network failure' }, 500);
  } });
  controller.start(); await ready(controller, 'signedIn');
  await controller.signOut();
  await ready(controller, 'signedOut');
  expect((await client.auth.getSession()).data.session).toBeNull();
  expect(storage.has(sessionKey)).toBe(false);
  expect(localStorage.getItem('dg.theme')).toBe('dark');
  expect(sessionStorage.getItem(revocationKey)).toBe('remote');
  expect(controller.getSnapshot().pendingRevocation).toBe(true);
});

it('blocks reload after an interrupted local removal', async () => {
  sessionStorage.setItem(revocationKey, 'blocked');
  const { controller } = fixture({ restored: session() });
  controller.start(); await ready(controller, 'error');
  expect(controller.getSnapshot().session).toBeNull();
});

it('ignores late profile reads after sign-out and unsubscribes/cleans deferred work on stop', async () => {
  let release: ((value: Response) => void) | undefined;
  const { controller, client } = fixture({ restored: session(), override: (url) => url.pathname.includes('/profiles') ? new Promise<Response>((resolve) => { release = resolve; }) : undefined });
  controller.start();
  await vi.waitFor(() => expect(release).toBeTypeOf('function'));
  await controller.signOut();
  release?.(json([{ user_id: 'owner-a' }]));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(controller.getSnapshot().session).toBeNull();
  const snapshot = controller.getSnapshot();
  controller.stop();
  await client.auth.refreshSession();
  expect(controller.getSnapshot()).toBe(snapshot);
});

it('recovery parser keeps ordinary history intact and maps transient errors safely', () => {
  history.replaceState({}, '', '/sign-in?intent=normal');
  expect(consumeRecoveryUrl()).toBeNull();
  expect(location.search).toBe('?intent=normal');
  expect(authMessage(new TypeError('sensitive transport details'), 'fallback')).toBe('Check your connection and try again.');
  // Older Auth responses, or proxies omitting the exposed API-version header,
  // can omit structured codes. Credential failures still share one safe message.
  expect(authMessage({ status: 400, message: 'sensitive' }, 'fallback', true)).toBe('Email, username or password is incorrect.');
  expect(authMessage({ status: 400, message: 'sensitive' }, 'Registration failed')).toBe('Registration failed');
});

it('cancelling while setSession is pending cannot resurrect its persisted session', async () => {
  history.replaceState({}, '', `/reset-password#access_token=${token()}&refresh_token=refresh-owner-a&type=recovery`);
  let release: ((response: Response) => void) | undefined;
  let hold = true;
  const { controller, client } = fixture({ override: (url) => url.pathname.endsWith('/user') && hold ? new Promise<Response>((resolve) => { release = resolve; }) : undefined });
  controller.start();
  await vi.waitFor(() => expect(release).toBeTypeOf('function'));
  const cancelled = controller.signOut();
  expect(controller.getSnapshot().session).toBeNull();
  expect(sessionStorage.getItem(revocationKey)).toBe('blocked');
  hold = false;
  release?.(json(user()));
  await cancelled;
  await ready(controller, 'signedOut');
  expect((await client.auth.getSession()).data.session).toBeNull();
  expect(sessionStorage.getItem(recoveryKey)).toBeNull();
});

it('verification cannot bypass a recovery without a successful password update', async () => {
  sessionStorage.setItem(recoveryKey, 'owner-a');
  const { controller } = fixture({ restored: session() });
  controller.start(); await vi.waitFor(() => expect(controller.getSnapshot().recoveryReady).toBe(true));
  await expect(controller.verifyPassword()).rejects.toThrow('Update your password');
  expect(controller.getSnapshot().status).toBe('passwordRecovery');
});

it('a refresh event retains the owner and updates the Realtime token once', async () => {
  const refreshed = { ...session(), access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: 'owner-a', exp: Math.floor(Date.now() / 1000) + 3700 })}.c2lnbmF0dXJl` };
  const { controller, client } = fixture({ restored: session(), override: (url) => url.pathname.endsWith('/token') ? json(refreshed) : undefined });
  controller.start(); await ready(controller, 'signedIn');
  const refresh = vi.spyOn(client.realtime, 'setAuth');
  await client.auth.refreshSession();
  await ready(controller, 'signedIn');
  expect(controller.getSnapshot().session?.access_token).toBe(refreshed.access_token);
  expect(refresh.mock.calls.filter(([value]) => value === refreshed.access_token)).toHaveLength(1);
});

it('an account transition fences an old profile and cleans old channels before the new owner appears', async () => {
  let activeOwner = 'owner-a';
  let release: ((response: Response) => void) | undefined;
  const { controller, client } = fixture({ restored: session(), override: (url, init) => {
    if (url.pathname.endsWith('/user')) return json(user(activeOwner));
    if (url.pathname.includes('/profiles')) {
      if (activeOwner === 'owner-a') return new Promise<Response>((resolve) => { release = resolve; });
      const row = { user_id: activeOwner, username: 'owner_b', display_name: 'Owner B', avatar_url: null, premium_flags: null };
      return json(new Headers(init?.headers).get('Accept')?.includes('vnd.pgrst.object') ? row : [row]);
    }
  } });
  const cleanup = vi.spyOn(client, 'removeAllChannels');
  controller.start(); await vi.waitFor(() => expect(release).toBeTypeOf('function'));
  activeOwner = 'owner-b';
  await client.auth.setSession(session('owner-b'));
  await ready(controller, 'signedIn');
  expect(cleanup.mock.calls.length).toBeGreaterThanOrEqual(2);
  expect(controller.getSnapshot().profile?.user_id).toBe('owner-b');
  release?.(json([{ user_id: 'owner-a' }]));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(controller.getSnapshot().profile?.user_id).toBe('owner-b');
});

it('waits for store quiescence before SDK removal and retains failed cleanup across provider unmount', async () => {
  const { controller, client } = fixture({ restored: session() });
  controller.start(); await ready(controller, 'signedIn');
  const revoke = vi.spyOn(client.auth, 'signOut');
  let release: (() => void) | undefined;
  let calls = 0;
  const unregister = controller.registerLocalCleanup(async () => {
    calls++;
    if (calls === 1) throw new Error('Injected storage failure');
    await new Promise<void>((resolve) => { release = resolve; });
  });
  const first = controller.signOut(); unregister(); await first;
  expect(controller.getSnapshot().status).toBe('error'); expect(revoke).not.toHaveBeenCalled();
  const retry = controller.signOut();
  await vi.waitFor(() => expect(release).toBeTypeOf('function'));
  expect(revoke).not.toHaveBeenCalled(); release?.(); await retry;
  expect(calls).toBe(2); expect(controller.getSnapshot().status).toBe('signedOut');
});

it('reports retained physical cleanup after logical wiping and finishes it before the next owner', async () => {
  const { controller } = fixture({ restored: session() });
  controller.start(); await ready(controller, 'signedIn');
  controller.registerLocalCleanup(async () => 'Your local records were cleared. Database deletion was blocked.');
  await controller.signOut(); expect(controller.getSnapshot().error).toContain('local records were cleared');
  expect(sessionStorage.getItem(retainedWipeKey)).toBe('retained');
  controller.stop();
  const next = fixture().controller; next.start(); await ready(next, 'signedOut');
  // D-109 (5): startup completes a blocked deletion before any owner is restored.
  expect(sessionStorage.getItem(retainedWipeKey)).toBeNull();
  expect(next.getSnapshot().error).toBeNull();
});
