import { expect, it } from 'vitest';
import { config, validateAttachment, validateAttachmentCount, validateMessageText } from '@dologram/shared';
import { ids } from './ids';

it('uses browser UUIDs for every shared entity', () => {
  const values = [ids.messageId(), ids.mediaId(), ids.chatId(), ids.folderId()];
  expect(new Set(values).size).toBe(4);
  values.forEach((value) => expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));
});

it('preserves the shared blank and Unicode rules through the browser entry', () => {
  expect(validateMessageText(' \t\n\r\f\v', 0)).toEqual({ ok: false, reason: 'blank' });
  expect(validateMessageText(' \t\n\r\f\v', 1)).toEqual({ ok: true });
  expect(validateMessageText('👍'.repeat(4096), 0)).toEqual({ ok: true });
  expect(validateMessageText('👍'.repeat(4097), 1)).toEqual({ ok: false, reason: 'tooLong' });
});

it('validates browser File metadata with existing MIME, count and exact bucket limits', () => {
  const file = new File(['x'], 'synthetic.pdf', { type: 'application/pdf' });
  expect(validateAttachment({ mediaType: 'file', mime: file.type, sizeBytes: file.size })).toEqual({ ok: true });
  expect(validateAttachment({ mediaType: 'photo', mime: 'image/gif', sizeBytes: 1 })).toEqual({ ok: false, reason: 'unsupportedType' });
  for (const [mediaType, mime, limit] of [
    ['photo', 'image/jpeg', config.media.smallMaxBytes],
    ['file', 'application/pdf', config.media.largeMaxBytes],
  ] as const) {
    expect(validateAttachment({ mediaType, mime, sizeBytes: limit })).toEqual({ ok: true });
    expect(validateAttachment({ mediaType, mime, sizeBytes: limit + 1 })).toEqual({ ok: false, reason: 'tooLarge' });
  }
  expect(validateAttachmentCount(10)).toBe(true);
  expect(validateAttachmentCount(11)).toBe(false);
});
