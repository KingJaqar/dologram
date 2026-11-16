import { describe, expect, it } from 'vitest';
import type { Sql } from 'postgres';
import { AdminDbError } from '../db.ts';
import { AuditDetailError, type AuditDetailMap } from './actions.ts';
import { AuditEventError, writeAudit, type AuditEvent } from './write.ts';

const ACTOR = '10000000-0000-4000-8000-000000000001';
const TARGET = '20000000-0000-4000-8000-000000000002';

function stub(options: { fail?: unknown } = {}) {
  const calls: unknown[][] = [];
  const tag = (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push([strings.join(' ? '), ...values]);
    if (options.fail !== undefined) return Promise.reject(options.fail);
    return Promise.resolve([]);
  };
  const sql = Object.assign(tag, { json: (value: unknown) => JSON.stringify(value) }) as unknown as Sql;
  return { sql, calls };
}

function event(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    action: 'account.create',
    actorUserId: ACTOR,
    targetUserId: TARGET,
    result: 'success',
    detail: { username: 'newuser', source: 'admin' },
    ...overrides,
  } as AuditEvent;
}

describe('writeAudit', () => {
  it('inserts one row with a stable event identity and the allowlisted detail', async () => {
    const { sql, calls } = stub();
    await writeAudit(event(), sql);
    expect(calls).toHaveLength(1);
    const [statement, eventId, actor, action, target, result, detail] = calls[0] ?? [];
    expect(String(statement)).toContain('insert into private.admin_audit');
    expect(String(statement)).toContain('on conflict (event_id) do nothing');
    expect(eventId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
    expect([actor, action, target, result]).toEqual([ACTOR, 'account.create', TARGET, 'success']);
    expect(detail).toBe('{"username":"newuser","source":"admin"}');
  });

  it('keeps a caller-supplied event identity for reconciliation', async () => {
    const { sql, calls } = stub();
    const eventId = '30000000-0000-4000-8000-000000000003';
    await writeAudit(event({ eventId }), sql);
    expect(calls[0]?.[1]).toBe(eventId);
  });

  it('refuses a password key before running any statement', async () => {
    const { sql, calls } = stub();
    const detail = { username: 'newuser', source: 'admin', password: 'sentinel-password' } as unknown as AuditDetailMap['account.create'];
    await expect(writeAudit(event({ detail }), sql)).rejects.toBeInstanceOf(AuditDetailError);
    expect(calls).toHaveLength(0);
  });

  it('refuses malformed identities and results before running any statement', async () => {
    const { sql, calls } = stub();
    await expect(writeAudit(event({ actorUserId: 'not-a-uuid' }), sql)).rejects.toBeInstanceOf(AuditEventError);
    await expect(writeAudit(event({ targetUserId: 'not-a-uuid' }), sql)).rejects.toBeInstanceOf(AuditEventError);
    await expect(writeAudit(event({ result: 'unknown' as never }), sql)).rejects.toBeInstanceOf(AuditEventError);
    expect(calls).toHaveLength(0);
  });

  it('maps a database failure to a fixed error without the connection string or detail', async () => {
    const failure = Object.assign(new Error('connect postgres://user:sentinel@host/postgres failed'), { code: '08006' });
    const { sql } = stub({ fail: failure });
    try {
      await writeAudit(event(), sql);
      throw new Error('unreachable');
    } catch (error) {
      expect(error).toBeInstanceOf(AdminDbError);
      expect((error as AdminDbError).code).toBe('08006');
      expect((error as Error).message).toBe('Database request failed (08006).');
      expect((error as Error).message).not.toMatch(/sentinel|postgres:\/\//u);
    }
  });

  it('drops an unrecognized provider code instead of echoing it', async () => {
    const { sql } = stub({ fail: { code: 'not-a-code' } });
    try {
      await writeAudit(event(), sql);
      throw new Error('unreachable');
    } catch (error) {
      expect((error as AdminDbError).code).toBeUndefined();
      expect((error as Error).message).toBe('Database request failed.');
    }
  });
});
