import { describe, expect, it } from 'vitest';
import type { Sql } from 'postgres';
import { AdminDbError } from '../db.ts';
import { getAccount, listAccounts } from './list.ts';

interface RawRow {
  user_id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
  created_at: Date | string;
  last_sign_in_at: Date | string | null;
  banned: boolean;
  must_change: boolean;
  is_admin: boolean;
}

const ROWS: RawRow[] = [
  {
    user_id: '40000000-0000-4000-8000-00000000000a',
    username: 'user_a',
    display_name: 'Phase 7 user_a',
    email: 'user_a@fixture.invalid',
    created_at: new Date('2026-11-15T04:05:06.000Z'),
    last_sign_in_at: null,
    banned: false,
    must_change: false,
    is_admin: false,
  },
  {
    user_id: '40000000-0000-4000-8000-00000000000b',
    username: 'user_b',
    display_name: 'Phase 7 user_b',
    email: 'user_b@fixture.invalid',
    created_at: '2026-11-14T01:02:03.000Z',
    last_sign_in_at: '2026-11-14T02:03:04.000Z',
    banned: true,
    must_change: true,
    is_admin: true,
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

describe('listAccounts', () => {
  it('returns one stable 50-row page with precedence-ordered statuses and no premium data', async () => {
    const { sql, calls } = stub();
    const result = await listAccounts({}, sql);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(50);
    expect(result.filter).toBe('all');
    expect(result.total).toBe(51);
    expect(result.rows[0]).toMatchObject({
      userId: ROWS[0]?.user_id,
      username: 'user_a',
      displayName: 'Phase 7 user_a',
      email: 'user_a@fixture.invalid',
      createdAt: '2026-11-15T04:05:06.000Z',
      lastSignInAt: null,
      status: 'active',
      admin: false,
      premiumFlags: [],
    });
    // Banned wins over the must-change flag; the database role drives the Admin pill.
    expect(result.rows[1]).toMatchObject({
      createdAt: '2026-11-14T01:02:03.000Z',
      lastSignInAt: '2026-11-14T02:03:04.000Z',
      status: 'banned',
      admin: true,
    });
    const statement = String(calls[0]?.[0]);
    expect(statement).toContain('from auth.users u');
    expect(statement).toContain('left join public.profiles p on p.user_id = u.id');
    expect(statement).toContain('order by u.created_at desc, u.id desc');
    expect(calls[0]?.slice(1)).toEqual([null, null, null, 'all', 'all', 'all', 'all', 50, 0]);
  });

  it('uses identical predicates and count for a search and status filter', async () => {
    const { sql, calls } = stub();
    await listAccounts({ q: 'USER_B', filter: 'banned', page: '2' }, sql);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.slice(1, 8)).toEqual(['%USER\\_B%', '%USER\\_B%', '%USER\\_B%', 'banned', 'banned', 'banned', 'banned']);
    expect(calls[1]?.slice(1, 8)).toEqual(calls[0]?.slice(1, 8));
    expect(calls[0]?.at(-2)).toBe(50);
    expect(calls[0]?.at(-1)).toBe(50);
  });

  it('escapes LIKE metacharacters in the search term', async () => {
    const { sql, calls } = stub();
    await listAccounts({ q: '50%_off\\' }, sql);
    expect(calls[0]?.[1]).toBe('%50\\%\\_off\\\\%');
  });

  it('bounds the page and falls back to the all filter for an unknown chip', async () => {
    const { sql, calls } = stub();
    const result = await listAccounts({ page: '0', filter: 'drop table' }, sql);
    expect(result.page).toBe(1);
    expect(result.filter).toBe('all');
    expect(calls[0]?.at(-1)).toBe(0);
    const later = stub();
    expect((await listAccounts({ page: '4', filter: 'mustChange' }, later.sql)).filter).toBe('mustChange');
    expect(later.calls[0]?.at(-1)).toBe(150);
  });

  it('keeps accounts whose profile row is missing without inventing identity', async () => {
    const { sql } = stub({
      rows: [{ ...(ROWS[0] as RawRow), username: null, display_name: null, email: null, must_change: true }],
      total: 1,
    });
    const result = await listAccounts({}, sql);
    expect(result.rows[0]).toMatchObject({
      username: null, displayName: null, email: null, status: 'mustChangePassword',
    });
  });

  it('maps a database failure to a fixed error', async () => {
    const { sql } = stub({ fail: Object.assign(new Error('postgres://user:sentinel@host/postgres'), { code: '57014' }) });
    try {
      await listAccounts({}, sql);
      throw new Error('unreachable');
    } catch (error) {
      expect(error).toBeInstanceOf(AdminDbError);
      expect((error as Error).message).toBe('Database request failed (57014).');
      expect((error as Error).message).not.toMatch(/sentinel|postgres:\/\//u);
    }
  });
});

describe('getAccount', () => {
  it('refuses a malformed id without querying', async () => {
    const { sql, calls } = stub();
    expect(await getAccount('drop table', sql)).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('returns the allowlisted identity for a known account and null otherwise', async () => {
    const found = stub({ rows: [ROWS[1] as RawRow] });
    const account = await getAccount('40000000-0000-4000-8000-00000000000b', found.sql);
    expect(account).toMatchObject({ username: 'user_b', status: 'banned', admin: true });
    expect(String(found.calls[0]?.[0])).toContain('where u.id =');
    expect(found.calls[0]?.[1]).toBe('40000000-0000-4000-8000-00000000000b');
    const missing = stub({ rows: [] });
    expect(await getAccount('40000000-0000-4000-8000-00000000000c', missing.sql)).toBeNull();
  });
});
