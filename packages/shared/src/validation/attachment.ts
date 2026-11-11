import { config, type MediaType } from '../config';

export type AttachmentInput = {
  mediaType: MediaType;
  mime: string;
  sizeBytes: number;
};

export type AttachmentResult =
  | { ok: true }
  | { ok: false; reason: 'unsupportedType' | 'tooLarge' | 'invalidSize' };

/**
 * Photos and voice notes go to the 10 MiB bucket, videos and files to the 50 MiB bucket (D-29, D-75),
 * and only the types of 5.5 are accepted (D-90, D-116).
 */
export function validateAttachment(input: AttachmentInput): AttachmentResult {
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, reason: 'invalidSize' };
  }
  const mime = input.mime.trim().toLowerCase();
  const allowed: readonly string[] = config.media.allowedTypes[
    input.mediaType as 'photo' | 'video' | 'voice' | 'file'
  ];
  if (!allowed.includes(mime)) {
    return { ok: false, reason: 'unsupportedType' };
  }
  const limit =
    input.mediaType === 'photo' || input.mediaType === 'voice'
      ? config.media.smallMaxBytes
      : config.media.largeMaxBytes;
  if (input.sizeBytes > limit) {
    return { ok: false, reason: 'tooLarge' };
  }
  return { ok: true };
}

/** A message carries at most 10 attachments (D-90). */
export function validateAttachmentCount(count: number): boolean {
  return Number.isInteger(count) && count >= 0 && count <= config.media.maxAttachments;
}
