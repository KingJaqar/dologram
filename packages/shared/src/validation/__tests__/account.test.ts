import { config, validateEmail, validateNewPassword, validateUsername, validateDisplayName } from '../account';

describe('validateEmail', () => {
  test('accepts valid email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });

  test('rejects invalid email', () => {
    expect(validateEmail('not-an-email')).toBe(false);
    expect(validateEmail('')).toBe(false);
  });
});

describe('validateNewPassword', () => {
  test('accepts 12 characters', () => {
    expect(validateNewPassword('a'.repeat(12))).toBe(true);
  });

  test('rejects 11 characters', () => {
    expect(validateNewPassword('a'.repeat(11))).toBe(false);
  });

  test('rejects empty password', () => {
    expect(validateNewPassword('')).toBe(false);
  });
});

describe('validateUsername', () => {
  test('accepts valid username (starts with lowercase, 5-32 chars)', () => {
    expect(validateUsername('user123')).toBe(true);
    expect(validateUsername('a1b2c3d4e5')).toBe(true);
  });

  test('rejects uppercase start', () => {
    expect(validateUsername('User123')).toBe(false);
  });

  test('rejects too short', () => {
    expect(validateUsername('usr')).toBe(false);
  });

  test('rejects too long', () => {
    expect(validateUsername('a'.repeat(33))).toBe(false);
  });
});

describe('validateDisplayName', () => {
  test('accepts display name within 64 chars', () => {
    expect(validateDisplayName('A'.repeat(64))).toBe(true);
  });

  test('rejects display name over 64 chars', () => {
    expect(validateDisplayName('A'.repeat(65))).toBe(false);
  });

  test('trims and validates', () => {
    expect(validateDisplayName('  hello  ')).toBe(true);
  });
});