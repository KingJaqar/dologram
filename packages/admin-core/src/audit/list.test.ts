import { describe, expect, it } from 'vitest';
import type { Sql } from 'postgres';
import { AdminDbError } from '../db.ts';
import { listAudit } from './list.ts';

interface RawRow {
  id: string;
  at: Date | string;
  action: string;
  result: string;
  detail: unknown;
  target_username: string | null;
}

const ROWS: RawRow[] = [
  {
    id: '9',
    at: new Date('2026-11-15T04:05:06.000Z'),
    action: 'session.unlock',
    result: 'success',
    detail: { username: 'jane', source: 'admin' },
    target_username: 'jane',
  },
  {
    id: '8',
    at: '2026-11-14T01:02:03.000Z',
    action: 'account.delete',
    result: 'failed',
    detail: {},
    target_username: null,
  },
];

function stub(options: { rows?: RawRow[]; total?: number; fail?: unknown } = {}) {
  const calls: unknown[][] = [];
  const tag = (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push([strings.join(' ? '), ...values]);
    if (options.fail !== undefined) return Promise.reject(options.fail);
    return Promise.resolve(calls.length === 1 ? (options.rows ?? ROWS) : [{ total: options.total ?? 51 }]);
  };
  const sql = Object.assign(tag, { json: (value: unknown) => JSON.stringify(value) }) as unknown as Sql;
  return { sql, calls };
}

describe('listAudit', () => {
  it('returns one stable 50-row page with safe display text and newest-first ordering', async () => {
    const { sql, calls } = stub();
    const result = await listAudit({}, sql);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(50);
    expect(result.total).toBe(51);
    expect(result.rows.map(row => row.id)).toEqual(['9', '8']);
    expect(result.rows[0]).toMatchObject({
      at: '2026-11-15T04:05:06.000Z',
      action: 'session.unlock',
      result: 'success',
      targetUsername: 'jane',
      detail: 'source=admin, username=jane',
    });
    // An empty allowlisted detail is shown as a dash, never as raw JSON.
    expect(result.rows[1]?.detail).toBe('—');
    const statement = String(calls[0]?.[0]);
    expect(statement).toContain('order by a.at desc, a.id desc');
    expect(statement).toContain('left join public.profiles p on p.user_id = a.target_user_id');
    expect(calls[0]?.slice(1)).toEqual([null, null, null, null, null, 50, 0]);
  });

  it('uses identical predicates and count for a filtered target', async () => {
    const { sql, calls } = stub();
    await listAudit({ page: '2', action: 'session.unlock', target: 'Jane' }, sql);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.slice(1, 5)).toEqual(['session.unlock', 'session.unlock', '%Jane%', '%Jane%']);
    expect(calls[1]?.slice(1, 5)).toEqual(calls[0]?.slice(1, 5));
    expect(calls[0]?.at(-1)).toBe(50);
  });

  it('escapes LIKE metacharacters and accepts an exact target UUID', async () => {
    const escaped = stub();
    await listAudit({ target: '50%_off\\' }, escaped.sql);
    expect(escaped.calls[0]?.[3]).toBe('%50\\%\\_off\\\\%');
    expect(escaped.calls[0]?.[5]).toBeNull();
    const id = '40000000-0000-4000-8000-000000000004';
    const exact = stub();
    await listAudit({ target: id }, exact.sql);
    expect(exact.calls[0]?.[5]).toBe(id);
  });

  it('bounds the page and ignores an unregistered action filter', async () => {
    const { sql, calls } = stub();
    const result = await listAudit({ page: '0', action: 'drop table' }, sql);
    expect(result.page).toBe(1);
    expect(calls[0]?.slice(1, 3)).toEqual([null, null]);
    const invalid = stub();
    expect((await listAudit({ page: 'last' }, invalid.sql)).page).toBe(1);
    const later = stub();
    expect((await listAudit({ page: '4' }, later.sql)).page).toBe(4);
    expect(later.calls[0]?.at(-1)).toBe(150);
  });

  it('never renders an unexpected detail shape', async () => {
    const { sql } = stub({ rows: [{ ...(ROWS[0] as RawRow), detail: ['password=sentinel'] }], total: 1 });
    const result = await listAudit({}, sql);
    expect(result.rows[0]?.detail).toBe('—');
  });

  it('maps a database failure to a fixed error', async () => {
    const { sql } = stub({ fail: Object.assign(new Error('postgres://user:sentinel@host/postgres'), { code: '57014' }) });
    try {
      await listAudit({}, sql);
      throw new Error('unreachable');
    } catch (error) {
      expect(error).toBeInstanceOf(AdminDbError);
      expect((error as Error).message).toBe('Database request failed (57014).');
      expect((error as Error).message).not.toMatch(/sentinel|postgres:\/\//u);
    }
  });
});
