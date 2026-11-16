// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signIn } from '../../src/app/sign-in/actions';
import { signOut } from '../../src/app/(admin)/actions';
import { sessionStore } from '../../src/server/session';
import { ADMIN_HOST, ADMIN_ORIGIN, SESSION_COOKIE, sessionCookieOptions } from '../../src/server/requestPolicy';
const account = { userId: '10000000-0000-4000-8000-000000000001', authSessionId: '20000000-0000-4000-8000-000000000001', accessToken: 'synthetic', expiresAt: Number.MAX_SAFE_INTEGER };
const f = vi.hoisted(() => ({ headers: new Headers(), id: undefined as string | undefined, signIn: vi.fn(), set: vi.fn(), delete: vi.fn() }));
const audit = vi.hoisted(() => ({ recordAudit: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('../../src/server/auditLog', () => audit);
vi.mock('../../src/server/accountAuth', () => ({ accountAuth: () => ({ signIn: f.signIn, currentAdmin: () => { throw Error('offline'); } }) }));
vi.mock('next/headers', () => ({ headers: async () => f.headers, cookies: async () => ({ get: () => f.id ? { value: f.id } : undefined, set: f.set, delete: f.delete }) }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw Error(`redirect:${path}`); } }));
let sequence = 0;
function data() { const d = new FormData(); d.set('identifier', `admin${sequence++}@fixture.invalid`); d.set('password', 'synthetic-input'); return d; }
beforeEach(() => { vi.clearAllMocks(); f.headers = new Headers({ host: ADMIN_HOST, origin: ADMIN_ORIGIN }); f.id = undefined; f.signIn.mockResolvedValue({ ok: true, account }); f.set.mockImplementation(() => {}); });
describe('real account sign-in/sign-out actions', () => {
  it('rotates a cookie only after verified authorization and sets a browser-session cookie', async () => {
    f.id = sessionStore.createSession(account); const old = f.id;
    await expect(signIn({ ok: false }, data())).rejects.toThrow('redirect:/');
    expect(f.set).toHaveBeenCalledWith(SESSION_COOKIE, expect.stringMatching(/^[A-Za-z0-9_-]{43}$/u), sessionCookieOptions);
    expect(sessionStore.readSession(old)).toBeUndefined();
  });
  it('denies duplicate/file/oversized inputs before provider calls and never leaks errors', async () => {
    const duplicate = data(); duplicate.append('identifier', 'other@fixture.invalid');
    const file = data(); file.set('password', new Blob(['x']), 'file');
    const oversized = data(); oversized.set('password', 'x'.repeat(1025));
    for (const d of [new FormData(), duplicate, file, oversized]) expect((await signIn({ ok: false }, d)).ok).toBe(false);
    expect(f.signIn).not.toHaveBeenCalled();
    f.signIn.mockRejectedValue(Error('secret-provider-detail'));
    expect(JSON.stringify(await signIn({ ok: false }, data()))).not.toContain('secret-provider-detail');
  });
  it('audits the verified sign-in and a refused attempt without blocking either result', async () => {
    const email = `audit-${process.pid}@fixture.invalid`;
    const payload = () => { const d = new FormData(); d.set('identifier', email); d.set('password', 'synthetic-input'); return d; };
    await expect(signIn({ ok: false }, payload())).rejects.toThrow('redirect:/');
    expect(audit.recordAudit).toHaveBeenCalledWith({ action: 'session.unlock', actorUserId: account.userId, result: 'success', detail: {} });
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(signIn({ ok: false }, payload())).rejects.toThrow('redirect:/');
    }
    expect((await signIn({ ok: false }, payload())).ok).toBe(false);
    expect(audit.recordAudit).toHaveBeenLastCalledWith({ action: 'session.lockout', actorUserId: null, result: 'failed', detail: {} });
  });
  it('cleans newly minted sessions after cookie-write failure', async () => {
    f.set.mockImplementation(() => { throw Error('cookie failure'); });
    expect((await signIn({ ok: false }, data())).ok).toBe(false);
    const id: unknown = f.set.mock.calls[0]?.[1];
    expect(typeof id === 'string' && sessionStore.readSession(id)).toBeUndefined();
  });
  it('signs out locally during outage, revokes old state and refuses foreign Origin first', async () => {
    f.id = sessionStore.createSession(account); f.headers.delete('origin');
    expect(await signOut()).toMatchObject({ code: 'forbidden' }); expect(sessionStore.readSession(f.id)).toBeDefined();
    f.headers.set('origin', ADMIN_ORIGIN);
    await expect(signOut()).rejects.toThrow('redirect:/sign-in');
    expect(sessionStore.readSession(f.id)).toBeUndefined(); expect(f.delete).toHaveBeenCalledWith(SESSION_COOKIE);
    f.id = undefined; await expect(signOut()).rejects.toThrow('redirect:/sign-in');
  });
});
