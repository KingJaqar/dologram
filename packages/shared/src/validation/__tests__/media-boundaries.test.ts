import { describe, expect, it } from 'vitest';
import { config } from '../../config';
import { validateAttachment } from '../attachment';

describe('Phase 12 picker boundaries', () => {
  it.each([0, -1, NaN, Infinity, 1.5])('rejects unreadable or invalid byte size %s', (sizeBytes) => {
    expect(validateAttachment({ mediaType: 'photo', mime: 'image/jpeg', sizeBytes })).toEqual({ ok: false, reason: 'invalidSize' });
  });
  it('accepts exactly 10 MiB and refuses the next byte for a photo', () => {
    expect(validateAttachment({ mediaType: 'photo', mime: 'image/jpeg', sizeBytes: config.media.smallMaxBytes })).toEqual({ ok: true });
    expect(validateAttachment({ mediaType: 'photo', mime: 'image/jpeg', sizeBytes: config.media.smallMaxBytes + 1 })).toEqual({ ok: false, reason: 'tooLarge' });
  });
  it('accepts exactly 50 MiB and refuses the next byte for a file', () => {
    expect(validateAttachment({ mediaType: 'file', mime: 'application/pdf', sizeBytes: config.media.largeMaxBytes })).toEqual({ ok: true });
    expect(validateAttachment({ mediaType: 'file', mime: 'application/pdf', sizeBytes: config.media.largeMaxBytes + 1 })).toEqual({ ok: false, reason: 'tooLarge' });
  });
});
