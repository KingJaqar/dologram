import { config, validateAttachment, validateAttachmentCount } from '../attachment';

describe('validateAttachment', () => {
  test('accepts valid photo JPEG', () => {
    expect(
      validateAttachment({ mediaType: 'photo', mime: 'image/jpeg', sizeBytes: 1000000 })
    ).toEqual({ ok: true });
  });

  test('rejects unsupported type', () => {
    expect(
      validateAttachment({ mediaType: 'photo', mime: 'image/gif', sizeBytes: 1000 })
    ).toEqual({ ok: false, reason: 'unsupportedType' });
  });

  test('accepts valid photo PNG', () => {
    expect(
      validateAttachment({ mediaType: 'photo', mime: 'image/png', sizeBytes: 1000000 })
    ).toEqual({ ok: true });
  });

  test('accepts valid video MP4', () => {
    expect(
      validateAttachment({ mediaType: 'video', mime: 'video/mp4', sizeBytes: 10000000 })
    ).toEqual({ ok: true });
  });

  test('accepts valid voice MP4', () => {
    expect(
      validateAttachment({ mediaType: 'voice', mime: 'audio/mp4', sizeBytes: 5000000 })
    ).toEqual({ ok: true });
  });

  test('rejects file too large (photo bucket 10MiB)', () => {
    expect(
      validateAttachment({ mediaType: 'photo', mime: 'image/jpeg', sizeBytes: 20 * 1024 * 1024 })
    ).toEqual({ ok: false, reason: 'tooLarge' });
  });

  test('rejects file too large (video bucket 50MiB)', () => {
    expect(
      validateAttachment({ mediaType: 'video', mime: 'video/mp4', sizeBytes: 100 * 1024 * 1024 })
    ).toEqual({ ok: false, reason: 'tooLarge' });
  });
});

describe('validateAttachmentCount', () => {
  test('accepts 0 attachments', () => {
    expect(validateAttachmentCount(0)).toBe(true);
  });

  test('accepts max 10 attachments', () => {
    expect(validateAttachmentCount(10)).toBe(true);
  });

  test('rejects 11 attachments', () => {
    expect(validateAttachmentCount(11)).toBe(false);
  });

  test('rejects negative count', () => {
    expect(validateAttachmentCount(-1)).toBe(false);
  });

  test('rejects non-integer', () => {
    expect(validateAttachmentCount(3.5)).toBe(false);
  });
});