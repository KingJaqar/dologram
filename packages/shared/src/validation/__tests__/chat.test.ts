import { config, validateGroupTitle, validateFolderName } from '../chat';

describe('validateGroupTitle', () => {
  test('accepts valid group title (1-64 chars)', () => {
    expect(validateGroupTitle('My Group')).toBe(true);
    expect(validateGroupTitle('A'.repeat(64))).toBe(true);
  });

  test('rejects title over 64 chars', () => {
    expect(validateGroupTitle('A'.repeat(65))).toBe(false);
  });

  test('rejects blank title', () => {
    expect(validateGroupTitle('')).toBe(false);
  });

  test('trims and validates', () => {
    expect(validateGroupTitle('  hello  ')).toBe(true);
  });
});

describe('validateFolderName', () => {
  test('accepts valid folder name (1-32 chars)', () => {
    expect(validateFolderName('My Folder')).toBe(true);
    expect(validateFolderName('A'.repeat(32))).toBe(true);
  });

  test('rejects folder name over 32 chars', () => {
    expect(validateFolderName('A'.repeat(33))).toBe(false);
  });

  test('rejects blank folder name', () => {
    expect(validateFolderName('')).toBe(false);
  });

  test('trims and validates', () => {
    expect(validateFolderName('  hello  ')).toBe(true);
  });
});