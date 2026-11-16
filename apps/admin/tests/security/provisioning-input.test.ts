// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseProvisioningCsv } from '../../../../scripts/provisioningCsv';

const header = 'email,username,display_name\r\n';

describe('actual provisioning wrapper CSV input', () => {
  it('supports BOM, blank lines, quoted commas/quotes and multiline fields with source line numbers', () => {
    expect(parseProvisioningCsv('\uFEFF' + header + '\r\nuser@fixture.invalid,user_one,"One, ""User"""\r\n'
      + 'two@fixture.invalid,user_two,"Two\nUser"\r\n')).toEqual([
      { line: 3, email: 'user@fixture.invalid', username: 'user_one', displayName: 'One, "User"' },
      { line: 4, email: 'two@fixture.invalid', username: 'user_two', displayName: 'Two\nUser' },
    ]);
  });

  it('requires the exact header and exactly three fields per record', () => {
    expect(() => parseProvisioningCsv('Email,username,display_name')).toThrow('The CSV needs the columns');
    expect(() => parseProvisioningCsv(header + 'user@fixture.invalid,user_one')).toThrow('Line 2 must have exactly 3 fields.');
  });

  it('refuses malformed quotes with a safe error that excludes the field contents', () => {
    expect(() => parseProvisioningCsv(header + 'user@fixture.invalid,user_one,"synthetic-secret'))
      .toThrow('Line 2 has an unclosed quoted field.');
    expect(() => parseProvisioningCsv(header + 'user@fixture.invalid,user_one,"User"oops'))
      .toThrow('Line 2 has invalid CSV quoting.');
  });

  it('accepts 100 rows and refuses the 101st before any provisioning starts', () => {
    const row = 'user@fixture.invalid,user_one,User\n';
    expect(parseProvisioningCsv(header + row.repeat(100))).toHaveLength(100);
    expect(() => parseProvisioningCsv(header + row.repeat(101))).toThrow('A CSV can have at most 100 rows.');
  });
});
