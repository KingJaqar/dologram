// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAccount, generatePassword, recoverAccountCreation } from '../../src/app/(admin)/accounts/new/actions';
import { sessionStore } from '../../src/server/session';
import { ADMIN_HOST, ADMIN_ORIGIN } from '../../src/server/requestPolicy';

const f = vi.hoisted(() => ({ headers: new Headers(), id: undefined as string | undefined,
  currentAdmin: vi.fn(), create: vi.fn(), recover: vi.fn(), mint: vi.fn(), revalidate: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: f.revalidate }));
vi.mock('next/headers', () => ({ headers: async () => f.headers,
  cookies: async () => ({ get: () => f.id ? { value: f.id } : undefined }) }));
vi.mock('../../src/server/accountAuth', () => ({ accountAuth: () => ({ currentAdmin: f.currentAdmin }) }));
vi.mock('@dologram/admin-core', async importOriginal => ({
  ...await importOriginal<object>(), createAccount: f.create, recoverAccountCreation: f.recover, mintPasswordDraft: f.mint,
}));

const userId = '10000000-0000-4000-8000-000000000001';
const targetId = '10000000-0000-4000-8000-000000000002';
const input = { email: 'new@fixture.invalid', username: 'new_user', displayName: 'New User', passwordDraftId: 'draft' };

beforeEach(() => {
  vi.clearAllMocks();
  f.headers = new Headers({ host: ADMIN_HOST, origin: ADMIN_ORIGIN });
  f.id = sessionStore.createSession({ userId, authSessionId: 'synthetic-session', accessToken: 'synthetic-token', expiresAt: Number.MAX_SAFE_INTEGER });
  f.currentAdmin.mockResolvedValue(true);
  f.mint.mockReturnValue({ passwordDraftId: 'minted', password: 'synthetic-preview' });
  f.create.mockResolvedValue({ ok: true, userId: targetId, password: 'synthetic-preview', auditRecorded: false });
  f.recover.mockResolvedValue({ ok: true, userId: targetId, auditRecorded: true });
});

describe('Phase 8 guarded server actions', () => {
  it('refuses foreign Origin, absent sessions, demotion and identity outages before touching drafts or core', async () => {
    f.headers.set('origin', 'https://foreign.invalid');
    expect(await generatePassword()).toMatchObject({ code: 'forbidden' });
    expect(await createAccount(input)).toMatchObject({ code: 'forbidden' });
    expect(await recoverAccountCreation('operation')).toMatchObject({ code: 'forbidden' });
    f.headers.set('origin', ADMIN_ORIGIN);
    f.currentAdmin.mockRejectedValueOnce(new Error('backend unavailable'));
    expect(await generatePassword()).toMatchObject({ code: 'unauthorized' });
    f.currentAdmin.mockResolvedValue(false);
    expect(await createAccount(input)).toMatchObject({ code: 'unauthorized' });
    expect(await recoverAccountCreation('operation')).toMatchObject({ code: 'unauthorized' });
    f.id = undefined;
    expect(await generatePassword()).toMatchObject({ code: 'unauthorized' });
    expect(f.mint).not.toHaveBeenCalled();
    expect(f.create).not.toHaveBeenCalled();
    expect(f.recover).not.toHaveBeenCalled();
  });

  it('binds drafts and creation to the authenticated actor and refreshes the list on success', async () => {
    await generatePassword();
    expect(f.mint).toHaveBeenCalledWith({ sessionId: f.id });
    const result = await createAccount({ ...input, actorUserId: targetId, sessionId: 'forged', source: 'script' });
    expect(f.create).toHaveBeenCalledWith({ ...input, actorUserId: userId, sessionId: f.id, source: 'admin' });
    expect(result).toMatchObject({ ok: true, auditRecorded: false });
    expect(f.revalidate).toHaveBeenCalledWith('/accounts');
  });

  it('preserves applied identity and fixed errors without refreshing on failure', async () => {
    f.create.mockResolvedValueOnce({ ok: false, userId: targetId, message: 'Profile unavailable.' });
    expect(await createAccount(input)).toEqual({ ok: false, userId: targetId, message: 'Profile unavailable.' });
    f.create.mockRejectedValueOnce(new Error('synthetic-secret-do-not-return'));
    expect(await createAccount(input)).toEqual({ ok: false, message: 'The request could not be completed. Try again.' });
    expect(f.revalidate).not.toHaveBeenCalled();
  });

  it('does not discard a created account or password after cache invalidation fails', async () => {
    f.revalidate.mockImplementationOnce(() => { throw new Error('synthetic-cache-outage'); });
    expect(await createAccount(input)).toEqual({ ok: true, userId: targetId, password: 'synthetic-preview', auditRecorded: false, refreshFailed: true });
    expect(f.create).toHaveBeenCalledTimes(1);
  });

  it('binds recovery to the original actor/session and never calls creation', async () => {
    expect(await recoverAccountCreation('operation')).toEqual({ ok: true, userId: targetId, auditRecorded: true });
    expect(f.recover).toHaveBeenCalledWith({ operationId: 'operation', actorUserId: userId, sessionId: f.id, source: 'admin' });
    expect(f.create).not.toHaveBeenCalled();
    f.recover.mockRejectedValueOnce(new Error('synthetic-secret-do-not-return'));
    expect(await recoverAccountCreation('operation')).toEqual({ ok: false, message: 'The request could not be completed. Try again.' });
  });
});
