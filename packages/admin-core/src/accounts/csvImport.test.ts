import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sql } from 'postgres';
import { randomUUID } from 'node:crypto';
import { beginCsvImport, createCsvImportRow, finishCsvImport, CSV_IMPORT_TTL_MS } from './csvImport.ts';
const f = vi.hoisted(() => ({ create: vi.fn(), recover: vi.fn() }));
vi.mock('./createAccount.ts', () => ({ createAccount: f.create }));
vi.mock('./recoverCreation.ts', async original => ({ ...await original<object>(), recoverAccountCreation: f.recover }));
const actor = { userId: '40000000-0000-4000-8000-00000000000a', sessionId: 'original-session' };
const target = '50000000-0000-4000-8000-00000000000a';
const input = { headers: ['email', 'username', 'display_name'], rows: [
  { email: 'one@example.test', username: 'one_user', display_name: 'One' },
  { email: 'bad@example.test', username: 'bad', display_name: 'Bad' },
] };
const sql = (() => Promise.resolve([])) as unknown as Sql;
const audit = vi.fn(async () => undefined);
const deps = { sql, audit };
async function begin() {
  const result = await beginCsvImport({ requestId: randomUUID(), input }, actor, deps);
  if (!result.ok) throw Error('Begin failed');
  return result.importId;
}
beforeEach(() => { globalThis.__dgCsvImports = undefined; vi.clearAllMocks(); vi.useRealTimers(); });
describe('session-bound CSV import operations', () => {
  it('reuses begin acknowledgements, refuses changed snapshots and forged/invalid/foreign rows', async () => {
    const requestId = randomUUID();
    const first = await beginCsvImport({ requestId, input }, actor, deps);
    expect(await beginCsvImport({ requestId, input }, actor, deps)).toEqual(first);
    expect((await beginCsvImport({ requestId, input: { ...input, rows: input.rows.slice(0, 1) } }, actor, deps)).ok).toBe(false);
    if (!first.ok) return;
    expect(first.importId === requestId).toBe(false);
    for (const payload of [{ importId: first.importId, row: 2 }, { importId: first.importId, row: 0 }, { importId: first.importId, row: 1, email: 'forged@example.test' }]) {
      expect((await createCsvImportRow(payload, actor, deps)).ok).toBe(false);
    }
    expect((await createCsvImportRow({ importId: first.importId, row: 1 }, { ...actor, sessionId: 'foreign' }, deps)).ok).toBe(false);
    expect(f.create).not.toHaveBeenCalled();
  });
  it('serializes rows, delivers plaintext once and derives one idempotent summary from server outcomes', async () => {
    const id = await begin();
    let resolve: ((value: object) => void) | undefined;
    f.create.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const request = createCsvImportRow({ importId: id, row: 1 }, actor, deps);
    expect((await createCsvImportRow({ importId: id, row: 1 }, actor, deps)).ok).toBe(false);
    resolve?.({ ok: true, userId: target, password: 'synthetic-secret', auditRecorded: true, operationId: randomUUID() });
    const result = await request;
    expect(result).toMatchObject({ ok: true, result: { password: 'synthetic-secret' } });
    expect(JSON.stringify([...globalThis.__dgCsvImports?.values() ?? []])).not.toContain('synthetic-secret');
    expect(await createCsvImportRow({ importId: id, row: 1 }, actor, deps)).toMatchObject({ ok: true, result: { problem: expect.stringContaining('one-time password') } });
    expect(f.create).toHaveBeenCalledTimes(1);
    expect(await finishCsvImport(id, actor, deps)).toEqual({ ok: true, created: 1, invalid: 1, total: 2 });
    await finishCsvImport(id, actor, deps);
    expect(audit.mock.calls[0]).toEqual(audit.mock.calls[1]);
    expect(audit).toHaveBeenCalledWith({ eventId: id, actorUserId: actor.userId, action: 'account.import_csv', result: 'success', detail: { created: 1, invalid: 1, total: 2 } });
  });
  it('recovers lost/unknown effects without a second create and blocks premature finish', async () => {
    const id = await begin();
    expect((await finishCsvImport(id, actor, deps)).ok).toBe(false);
    f.create.mockImplementationOnce(async (details: { passwordDraftId: string }) => ({ ok: false, password: 'synthetic-secret', operationId: details.passwordDraftId, message: 'Unknown' }));
    expect(await createCsvImportRow({ importId: id, row: 1 }, actor, deps)).toMatchObject({ ok: true, result: { pending: true } });
    expect((await finishCsvImport(id, actor, deps)).ok).toBe(false);
    f.recover.mockResolvedValueOnce({ ok: true, userId: target, auditRecorded: true });
    expect(await createCsvImportRow({ importId: id, row: 1 }, actor, deps)).toMatchObject({ ok: true, result: { userId: target, pending: false } });
    expect(f.create).toHaveBeenCalledTimes(1);
    expect((await finishCsvImport(id, actor, deps)).ok).toBe(true);
  });
  it('continues after definitive row failure, reports audit failure and safely retries only the summary', async () => {
    const id = await begin();
    f.create.mockResolvedValueOnce({ ok: false, field: 'email', message: 'Taken' });
    await createCsvImportRow({ importId: id, row: 1 }, actor, deps);
    audit.mockRejectedValueOnce(Error('secret provider detail'));
    expect(await finishCsvImport(id, actor, deps)).toMatchObject({ ok: false, message: expect.stringContaining('import audit') });
    expect(await finishCsvImport(id, actor, deps)).toEqual({ ok: true, created: 0, invalid: 1, total: 2 });
    expect(f.create).toHaveBeenCalledTimes(1);
  });
  it('expires transient imports and refuses replay after expiry', async () => {
    vi.useFakeTimers();
    const id = await begin();
    vi.advanceTimersByTime(CSV_IMPORT_TTL_MS + 1);
    expect((await createCsvImportRow({ importId: id, row: 1 }, actor, deps)).ok).toBe(false);
    expect((await finishCsvImport(id, actor, deps)).ok).toBe(false);
    vi.useRealTimers();
  });
  it('retries a definitive 429 once after 2s and reports the second failure', async () => {
    vi.useFakeTimers();
    const id = await begin();
    f.create.mockResolvedValue({ ok: false, rateLimited: true, message: 'Rate limited; retry later.' });
    const pending = createCsvImportRow({ importId: id, row: 1 }, actor, deps);
    await vi.advanceTimersByTimeAsync(2000);
    expect(await pending).toMatchObject({ ok: true, result: { problem: 'Rate limited; retry later.', pending: false } });
    expect(f.create).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
