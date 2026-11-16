import { describe, expect, it } from 'vitest';
import type { Sql } from 'postgres';
import { validateRows } from './validateRows.ts';
const headers = ['email', 'username', 'display_name'];
const row = { email: 'one@example.test', username: 'user_one', display_name: 'One' };
function database(taken: { email: string | null; username: string | null }[] = []) {
  const calls: unknown[][] = [];
  const sql = ((_parts: TemplateStringsArray, ...values: unknown[]) => { calls.push(values); return Promise.resolve(taken); }) as unknown as Sql;
  return { sql, calls };
}
describe('validateRows CSV boundary', () => {
  it('rejects wrong, duplicate, reordered, extra headers and 101 rows before SQL', async () => {
    const db = database();
    for (const bad of [['email', 'username'], ['email', 'email', 'display_name'], [...headers, 'extra'], [...headers].reverse()]) {
      expect(await validateRows({ headers: bad, rows: [row] }, db.sql)).toEqual({ ok: false, message: 'The CSV needs the columns email, username and display_name.' });
    }
    expect(await validateRows({ headers, rows: Array.from({ length: 101 }, () => row) }, db.sql)).toEqual({ ok: false, message: 'A CSV can have at most 100 rows.' });
    expect(db.calls).toHaveLength(0);
  });
  it('normalizes identities and flags every duplicate, existing identity and invalid field', async () => {
    const db = database([{ email: 'taken@example.test', username: null }, { email: null, username: 'taken_user' }]);
    const result = await validateRows({ headers, rows: [
      row, { ...row, email: ' ONE@EXAMPLE.TEST ', username: 'other_user' },
      { ...row, email: 'taken@example.test', username: 'third_user' },
      { ...row, email: 'four@example.test', username: 'TAKEN_USER' },
      { ...row, email: 'five@example.test', username: 'bad' },
      { email: 'six@example.test', username: 'six_user', display_name: '  ' },
      { email: 'seven@example.test', username: 'seven_user', display_name: '😀'.repeat(64) },
    ] }, db.sql);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows.map(value => value.problem)).toEqual([
      'Duplicate email in this CSV.', 'Duplicate email in this CSV.', 'An account with this email already exists.',
      'This username is taken.', expect.stringContaining('Username must'), 'Display name must be 1 to 64 characters.', undefined,
    ]);
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0]?.[0]).toContain('one@example.test');
  });
  it('refuses forged structures, oversized fields and empty files', async () => {
    const db = database();
    for (const input of [null, { headers, rows: [{ ...row, roles: 'admin' }] }, { headers, rows: [{ ...row, email: 'a'.repeat(255) }] }, { headers, rows: [] }]) {
      expect((await validateRows(input, db.sql)).ok).toBe(false);
    }
    expect(db.calls).toHaveLength(0);
  });
});
