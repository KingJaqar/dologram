// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateCsv, beginCsvImport, finishCsvImport } from '../../src/app/(admin)/accounts/import/actions';
import { createAccount } from '../../src/app/(admin)/accounts/new/actions';
import { sessionStore } from '../../src/server/session';
import { ADMIN_HOST, ADMIN_ORIGIN } from '../../src/server/requestPolicy';
const f = vi.hoisted(() => ({ headers: new Headers(), id: undefined as string | undefined,
  currentAdmin: vi.fn(), validate: vi.fn(), begin: vi.fn(), finish: vi.fn(), row: vi.fn(), refresh: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: f.refresh }));
vi.mock('next/headers', () => ({ headers: async () => f.headers, cookies: async () => ({ get: () => f.id ? { value: f.id } : undefined }) }));
vi.mock('../../src/server/accountAuth', () => ({ accountAuth: () => ({ currentAdmin: f.currentAdmin }) }));
vi.mock('@dologram/admin-core', async original => ({ ...await original<object>(), validateRows: f.validate, beginCsvImport: f.begin, finishCsvImport: f.finish, createCsvImportRow: f.row }));
const userId = '40000000-0000-4000-8000-00000000000a';
beforeEach(() => {
  vi.clearAllMocks();
  f.headers = new Headers({ host: ADMIN_HOST, origin: ADMIN_ORIGIN });
  f.id = sessionStore.createSession({ userId, authSessionId: 'fixture', accessToken: 'fixture', expiresAt: Number.MAX_SAFE_INTEGER });
  f.currentAdmin.mockResolvedValue(true);
});
describe('CSV action authorization', () => {
  it('refuses foreign Origin, demotion, missing sessions and unavailable role verification before core', async () => {
    const calls = [() => validateCsv({}), () => beginCsvImport({}), () => finishCsvImport('id'), () => createAccount({ importId: 'id', row: 1 })];
    for (const state of ['origin', 'demoted', 'outage', 'absent']) {
      f.headers.set('origin', state === 'origin' ? 'https://foreign.invalid' : ADMIN_ORIGIN);
      f.currentAdmin.mockImplementation(async () => { if (state === 'outage') throw Error('unavailable'); return state !== 'demoted'; });
      if (state === 'absent') f.id = undefined;
      for (const call of calls) expect(await call()).toMatchObject({ ok: false });
    }
    for (const mock of [f.validate, f.begin, f.finish, f.row]) expect(mock).not.toHaveBeenCalled();
  });
  it('injects the verified actor/session, forwards immutable references and reports safe failures', async () => {
    f.begin.mockResolvedValueOnce({ ok: true, importId: 'server-id' });
    f.finish.mockResolvedValueOnce({ ok: true, created: 1, invalid: 0, total: 1 });
    f.row.mockResolvedValueOnce({ ok: true, result: { row: 1, email: 'one@example.test', userId } });
    const payload = { requestId: 'request', input: {} };
    await beginCsvImport(payload);
    expect(f.begin).toHaveBeenCalledWith(payload, { sessionId: f.id, userId });
    await createAccount({ importId: 'server-id', row: 1 });
    expect(f.row).toHaveBeenCalledWith({ importId: 'server-id', row: 1 }, { sessionId: f.id, userId });
    expect(f.refresh).toHaveBeenCalledWith('/accounts');
    await finishCsvImport('server-id');
    expect(f.finish).toHaveBeenCalledWith('server-id', { sessionId: f.id, userId });
    f.validate.mockRejectedValueOnce(Error('sensitive provider diagnostic'));
    expect(await validateCsv({})).toEqual({ ok: false, message: 'The request could not be completed. Try again.' });
  });
});
