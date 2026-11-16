import { describe, expect, it, vi } from 'vitest';
import type { Sql } from 'postgres';
import { creationSessionHash, recoverAccountCreation, type CreationOperation } from './recoverCreation.ts';
import { getAccountCapability } from './modes.ts';

const userId = '50000000-0000-4000-8000-00000000000a';
const actorUserId = '40000000-0000-4000-8000-00000000000a';
const operationId = '60000000-0000-4000-8000-00000000000a';
const enabled = { passwordFlag: 'trigger', banFallback: 'none', mutations: 'enabled', prerequisite: undefined } as const;
const input = { operationId, actorUserId, sessionId: 'original-session', source: 'admin' } as const;
const operation: CreationOperation = { id: operationId, actorUserId, sessionHash: creationSessionHash(input.sessionId), source: 'admin', username: 'new_user' };

function fixture(options: { marker?: unknown; missing?: boolean; missingAfterRepair?: boolean; absent?: boolean; fail?: boolean } = {}) {
  const calls: { statement: string; values: unknown[] }[] = [];
  let repaired = false;
  const tag = (parts: TemplateStringsArray, ...values: unknown[]) => {
    const statement = parts.join('?');
    calls.push({ statement, values });
    if (options.fail) return Promise.reject(new Error('provider-secret'));
    if (statement.includes('as operation')) return Promise.resolve(options.absent ? [] : [{ id: userId, operation: options.marker ?? operation }]);
    if (statement.includes('update auth.users')) { repaired = true; return Promise.resolve([]); }
    return Promise.resolve((options.missing && !repaired) || options.missingAfterRepair ? [] : [{ user_id: userId }]);
  };
  return { sql: tag as unknown as Sql, calls };
}

describe('recoverAccountCreation', () => {
  it('keeps the backend gate closed and validates identities before querying', async () => {
    const f = fixture();
    expect((await recoverAccountCreation(input, { sql: f.sql, capability: getAccountCapability() })).ok).toBe(false);
    expect((await recoverAccountCreation({ ...input, operationId: 'invalid' }, { sql: f.sql, capability: enabled })).ok).toBe(false);
    expect((await recoverAccountCreation({ ...input, actorUserId: null }, { sql: f.sql, capability: enabled })).ok).toBe(false);
    expect(f.calls).toHaveLength(0);
  });

  it('refuses foreign sessions, actors, source changes and malformed markers without repairing or auditing', async () => {
    const audit = vi.fn();
    for (const marker of [
      { ...operation, sessionHash: creationSessionHash('foreign') },
      { ...operation, actorUserId: userId },
      { ...operation, source: 'script', sessionHash: null },
      { ...operation, password: 'synthetic-do-not-accept' },
    ]) {
      const f = fixture({ marker });
      expect(await recoverAccountCreation(input, { sql: f.sql, capability: enabled, audit })).toMatchObject({ ok: false, message: expect.stringContaining('unavailable for this session') });
      expect(f.calls).toHaveLength(1);
    }
    expect(audit).not.toHaveBeenCalled();
  });

  it('reconciles the committed operation without creating a user or rewriting an initialized profile', async () => {
    const f = fixture();
    const audit = vi.fn().mockResolvedValue(undefined);
    const deps = { sql: f.sql, capability: enabled, audit };
    expect(await recoverAccountCreation(input, deps)).toEqual({ ok: true, userId, auditRecorded: true });
    expect(await recoverAccountCreation(input, deps)).toEqual({ ok: true, userId, auditRecorded: true });
    expect(audit).toHaveBeenCalledWith({ eventId: operationId, actorUserId, targetUserId: userId,
      action: 'account.create', result: 'success', detail: { username: 'new_user', source: 'admin' } });
    expect(f.calls.some(call => call.statement.includes('update'))).toBe(false);
    expect(f.calls[0]?.values).toEqual([operationId]);
    expect(f.calls[1]?.statement).toContain("p.roles = 'user'");
    expect(f.calls[1]?.statement).toContain('public.chat_members');
  });

  it('resumes missing initialization through the existing trigger while retaining denied access and roles', async () => {
    const f = fixture({ missing: true });
    expect(await recoverAccountCreation(input, { sql: f.sql, capability: enabled, audit: async () => {} })).toMatchObject({ ok: true });
    expect(f.calls).toHaveLength(4);
    const repair = f.calls[2]?.statement;
    expect(repair).toContain('set raw_user_meta_data = u.raw_user_meta_data');
    expect(repair).toContain('not private.account_access_allowed(u.id)');
    expect(repair).toContain("p.roles <> 'user'");
    expect(repair).not.toContain('encrypted_password');
    const incomplete = fixture({ missing: true, missingAfterRepair: true });
    expect(await recoverAccountCreation(input, { sql: incomplete.sql, capability: enabled })).toMatchObject({ ok: false, userId });
  });

  it('returns an unknown outcome without a second creation or a password, and redacts provider errors', async () => {
    for (const f of [fixture({ absent: true }), fixture({ fail: true })]) {
      const result = await recoverAccountCreation(input, { sql: f.sql, capability: enabled });
      expect(result).toMatchObject({ ok: false, message: expect.stringContaining('do not create another account') });
      expect(JSON.stringify(result)).not.toContain('provider-secret');
      expect(f.calls).toHaveLength(1);
    }
  });

  it('keeps a stable event identity after an audit outage and recovers script operations without password delivery', async () => {
    const f = fixture();
    const audit = vi.fn().mockRejectedValueOnce(new Error('audit down')).mockResolvedValue(undefined);
    expect(await recoverAccountCreation(input, { sql: f.sql, capability: enabled, audit })).toEqual({ ok: true, userId, auditRecorded: false });
    expect(await recoverAccountCreation(input, { sql: f.sql, capability: enabled, audit })).toEqual({ ok: true, userId, auditRecorded: true });
    expect(audit.mock.calls[0]?.[0]).toEqual(audit.mock.calls[1]?.[0]);
    const script = fixture({ marker: { ...operation, source: 'script', actorUserId: null, sessionHash: null } });
    expect(await recoverAccountCreation({ operationId, source: 'script', actorUserId: null }, { sql: script.sql, capability: enabled, audit })).toEqual({ ok: true, userId, auditRecorded: true });
  });
});
