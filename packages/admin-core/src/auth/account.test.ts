import { describe, expect, it, vi } from 'vitest';
import { parseSignIn } from './account.ts';
vi.mock('server-only', () => ({}));
describe('untrusted account credentials', () => {
  it('accepts and normalizes usernames without altering passwords', () => {
    const data = new FormData();
    data.set('identifier', '  Admin_User  '); data.set('password', ' exact password ');
    expect(parseSignIn(data)).toMatchObject({ success: true, data: { identifier: 'admin_user', password: ' exact password ' } });
    for (const identifier of ['abc', 'invalid user', 'admin%user', 'bad\0input', 'x'.repeat(255)]) {
      data.set('identifier', identifier);
      expect(parseSignIn(data).success).toBe(false);
    }
  });
  it('normalizes email only, preserves the exact password and ignores caller role claims', () => {
    const data = new FormData();
    data.set('identifier', '  Admin@Fixture.invalid '); data.set('password', ' keep spaces '); data.set('roles', 'admin');
    expect(parseSignIn(data)).toMatchObject({ success: true, data: { identifier: 'admin@fixture.invalid', password: ' keep spaces ' } });
  });
  it('rejects missing/duplicate/file/control/oversized inputs', () => {
    for (const password of ['', 'x'.repeat(1025), 'bad\0input']) {
      const data = new FormData(); data.set('identifier', 'admin@fixture.invalid'); data.set('password', password);
      expect(parseSignIn(data).success).toBe(false);
    }
    const data = new FormData(); data.set('identifier', 'admin@fixture.invalid'); data.set('password', 'synthetic');
    data.append('identifier', 'other@fixture.invalid'); expect(parseSignIn(data).success).toBe(false);
    data.delete('identifier'); data.set('identifier', new Blob(['synthetic']), 'file'); expect(parseSignIn(data).success).toBe(false);
    expect(parseSignIn(new FormData()).success).toBe(false);
  });
});
