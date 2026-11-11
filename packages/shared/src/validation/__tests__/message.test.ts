import { config } from '../../config'; import { validateMessageText, dgTrim, isBlank } from '../message';
import { codePointLength } from '../text';

describe('validateMessageText', () => {
  test('accepts text within maxChars limit', () => {
    const longText = 'a'.repeat(config.message.maxChars);
    expect(validateMessageText(longText, 0)).toEqual({ ok: true });
  });

  test('rejects text exceeding maxChars', () => {
    const tooLong = 'a'.repeat(config.message.maxChars + 1);
    expect(validateMessageText(tooLong, 0)).toEqual({ ok: false, reason: 'tooLong' });
  });

  test('rejects blank text without attachment', () => {
    expect(validateMessageText('', 0)).toEqual({ ok: false, reason: 'blank' });
  });

  test('accepts blank text with attachment', () => {
    expect(validateMessageText('', 1)).toEqual({ ok: true });
  });

  test('accepts text exactly at maxChars', () => {
    expect(validateMessageText('a'.repeat(config.message.maxChars), 0)).toEqual({ ok: true });
  });

  test.each([0, 1])('enforces the Unicode boundary with %i attachments', (attachments) => {
    expect(validateMessageText('👍'.repeat(4096), attachments)).toEqual({ ok: true });
    expect(validateMessageText('👍'.repeat(4097), attachments)).toEqual({ ok: false, reason: 'tooLong' });
    expect(validateMessageText('a'.repeat(4096) + ' ', attachments)).toEqual({ ok: false, reason: 'tooLong' });
  });
});

describe('codePointLength', () => {
  test('counts ASCII characters', () => {
    expect(codePointLength('hello')).toBe(5);
  });

  test('counts multi-byte Unicode correctly', () => {
    expect(codePointLength('👍')).toBe(1);
    expect(codePointLength('👍🏻')).toBe(2);
  });
});

describe('dgTrim', () => {
  test('trims leading/trailing whitespace', () => {
    expect(dgTrim('  hello  ')).toBe('hello');
  });

  test('trims newlines and tabs', () => {
    expect(dgTrim('\n\nhello\t')).toBe('hello');
  });

  test('returns empty for blank string', () => {
    expect(dgTrim('   ')).toBe('');
  });
});

describe('isBlank', () => {
  test('returns true for whitespace-only', () => {
    expect(isBlank('   ')).toBe(true);
  });

  test('returns false for content', () => {
    expect(isBlank('hello')).toBe(false);
  });
});
