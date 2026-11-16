// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { actionPolicy, actionRegistry } from '../../src/server/actionRegistry';
import { ADMIN_HOST, ADMIN_ORIGIN, localRequestStatus, SESSION_COOKIE } from '../../src/server/requestPolicy';
import { guardedAction, requireApiSession, requirePageSession, validSession } from '../../src/server/guards';
import { sessionStore } from '../../src/server/session';
import { proxy } from '../../src/proxy';
const account = { userId: '10000000-0000-4000-8000-000000000001', authSessionId: '20000000-0000-4000-8000-000000000001', accessToken: 'synthetic', expiresAt: Number.MAX_SAFE_INTEGER };
const request = vi.hoisted(() => ({ headers: new Headers(), id: undefined as string | undefined, verify: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('../../src/server/accountAuth', () => ({ accountAuth: () => ({ currentAdmin: request.verify }) }));
vi.mock('next/headers', () => ({ headers: async () => request.headers, cookies: async () => ({ get: () => request.id ? { value: request.id } : undefined }) }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
beforeEach(() => {
  vi.clearAllMocks(); request.headers = new Headers({ host: ADMIN_HOST, origin: ADMIN_ORIGIN });
  request.id = undefined; request.verify.mockResolvedValue(true);
});
describe('origin-host and authoritative account entry points', () => {
  it.each([null, 'null', 'http://127.0.0.1:3199', 'http://localhost:3100', 'https://127.0.0.1:3100', `${ADMIN_ORIGIN}/`])('denies mutation Origin %s before effects', async origin => {
    if (origin === null) request.headers.delete('origin'); else request.headers.set('origin', origin);
    const effect = vi.fn(async () => ({ ok: true }));
    for (const name of ['signIn', 'signOut', 'createAccount']) expect(await guardedAction(name, effect)).toMatchObject({ code: 'forbidden' });
    expect(effect).not.toHaveBeenCalled(); expect(request.verify).not.toHaveBeenCalled();
  });
  it.each(['evil.test', 'localhost:3100', '127.0.0.1', `${ADMIN_HOST}.evil.test`])('denies Host %s regardless of forwarded host', async host => {
    request.headers.set('host', host); request.headers.set('x-forwarded-host', ADMIN_HOST);
    expect(localRequestStatus(request.headers, false)).toBe(421);
    const effect = vi.fn(async () => ({})); await guardedAction('signIn', effect);
    expect(effect).not.toHaveBeenCalled();
    await expect(requirePageSession()).rejects.toThrow('redirect:/sign-in');
    expect((await requireApiSession())?.status).toBe(421);
  });
  it('fails closed for every unknown/inherited action and requires identity for every business action', async () => {
    expect(Object.isFrozen(actionRegistry)).toBe(true);
    expect(Object.entries(actionRegistry).filter(([, p]) => p === 'public-sign-in')).toEqual([['signIn', 'public-sign-in']]);
    const effect = vi.fn(async () => ({ ok: true }));
    for (const name of ['toString', '__proto__', 'unknown']) {
      expect(actionPolicy(name)).toBeUndefined(); expect(await guardedAction(name, effect)).toMatchObject({ code: 'forbidden' });
    }
    for (const [name, policy] of Object.entries(actionRegistry)) if (policy === 'session') expect(await guardedAction(name, effect)).toMatchObject({ code: 'unauthorized' });
    expect(effect).not.toHaveBeenCalled();
    expect(await guardedAction('signIn', effect)).toEqual({ ok: true });
  });
  it('checks page/RSC/API/direct actions and current role on each call; exposes only actor identity', async () => {
    request.id = 'A'.repeat(43); request.headers.set('rsc', '1');
    await expect(requirePageSession()).rejects.toThrow('redirect:/sign-in?reason=access');
    expect((await requireApiSession())?.status).toBe(401);
    request.id = sessionStore.createSession(account);
    expect(await requirePageSession()).toEqual({ sessionId: request.id, userId: account.userId });
    expect(await requireApiSession()).toBeUndefined();
    expect(await guardedAction('createAccount', async actor => actor)).toEqual({ sessionId: request.id, userId: account.userId });
    expect(request.verify).toHaveBeenCalledTimes(3);
    request.verify.mockResolvedValue(false);
    const effect = vi.fn(async () => ({ ok: true }));
    expect(await guardedAction('createAccount', effect)).toMatchObject({ code: 'unauthorized' });
    expect(effect).not.toHaveBeenCalled(); expect(sessionStore.readSession(request.id)).toBeUndefined();
  });
  it('fails closed on outages; simultaneous sign-out wins over in-flight verification', async () => {
    request.id = sessionStore.createSession(account); request.verify.mockRejectedValue(Error('provider-secret'));
    expect(await validSession(true)).toBeUndefined();
    let release: (value: boolean) => void = () => {};
    request.verify.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const pending = validSession(true);
    await vi.waitFor(() => expect(request.verify).toHaveBeenCalledTimes(2));
    sessionStore.destroySession(request.id); release(true);
    expect(await pending).toBeUndefined();
  });
  it('Proxy covers assets, sign-in/out Origin, old cookies and JSON API denials', () => {
    for (const path of ['/', '/sign-in', '/_next/static/test.js', '/api/session']) expect(proxy(new NextRequest(`${ADMIN_ORIGIN}${path}`, { headers: { host: 'evil.test' } })).status).toBe(421);
    expect(proxy(new NextRequest(`${ADMIN_ORIGIN}/sign-in`, { method: 'POST', headers: { host: ADMIN_HOST } })).status).toBe(403);
    expect(proxy(new NextRequest(`${ADMIN_ORIGIN}/api/session`, { headers: { host: ADMIN_HOST } })).status).toBe(401);
    expect(proxy(new NextRequest(ADMIN_ORIGIN, { headers: { host: ADMIN_HOST, cookie: 'dg_admin_session=old' } })).headers.get('location')).toBe(`${ADMIN_ORIGIN}/sign-in`);
    expect(proxy(new NextRequest(`${ADMIN_ORIGIN}/_next/static/a.js`, { headers: { host: ADMIN_HOST } })).status).toBe(200);
    expect(proxy(new NextRequest(ADMIN_ORIGIN, { headers: { host: ADMIN_HOST, cookie: `${SESSION_COOKIE}=forged` } })).status).toBe(200);
  });
});
