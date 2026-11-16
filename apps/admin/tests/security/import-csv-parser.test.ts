// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseCsv, resultsCsv, MAX_CSV_BYTES } from '../../src/app/(admin)/accounts/import/csv';
const header = 'email,username,display_name\r\n';
describe('browser CSV parsing and download', () => {
  it('accepts BOM, quoted commas/quotes and multiline names', () => {
    expect(parseCsv('\uFEFF' + header + 'one@example.test,one_user,"One, ""Name""\nHere"\r\n')).toMatchObject({ ok: true, input: { rows: [{ display_name: 'One, "Name"\nHere' }] } });
  });
  it('rejects semicolons, duplicate/extra headers, malformed rows,101 rows, empty and oversized files', () => {
    for (const text of ['email;username;display_name\na;b;c', 'email,email,display_name\na,b,c', 'email,username,display_name,extra\na,b,c,d', header + 'a,b', header + 'a,b,"unclosed', header, 'x'.repeat(MAX_CSV_BYTES + 1)]) {
      expect(parseCsv(text).ok).toBe(false);
    }
    expect(parseCsv(header + Array.from({ length: 101 }, () => 'one@example.test,one_user,One').join('\r\n'))).toEqual({ ok: false, message: 'A CSV can have at most 100 rows.' });
  });
  it('quotes values, neutralizes formula identities and excludes rows without a one-time password', () => {
    const text = resultsCsv([{ row: 1, email: '=formula@example.test', password: 'synthetic-secret' }, { row: 2, email: 'failed@example.test', problem: 'Failed' }]);
    expect(text).toBe('"email","password"\r\n"\'=formula@example.test","synthetic-secret"');
  });
});
