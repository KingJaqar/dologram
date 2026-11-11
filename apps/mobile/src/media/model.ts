import { config, strings, validateAttachment, type MediaType } from '@dologram/shared';
import type { AttachmentSource } from '../queue/attachments';

export type DraftAttachment = AttachmentSource & { id: string; name: string };
export type ChatAttachment = {
  mediaId: string;
  mediaType: MediaType;
  storagePath?: string;
  localUri?: string;
  mime?: string;
  sizeBytes?: number;
};

function isMediaType(value: unknown): value is MediaType {
  return value === 'photo' || value === 'video' || value === 'voice' || value === 'file';
}

export function attachmentLabel(type: MediaType): string {
  return strings.media[type];
}

export function attachmentRefusal(source: AttachmentSource, name: string): string | null {
  const result = validateAttachment(source);
  if (result.ok) return null;
  return result.reason === 'tooLarge' ? strings.media.tooLarge(name)
    : result.reason === 'invalidSize' ? strings.media.unreadable(name) : strings.media.unsupported(name);
}

/** The server has no filename column; never manufacture one from message content. */
export function parseCachedAttachment(payload: string): ChatAttachment | null {
  try {
    const row: unknown = JSON.parse(payload);
    if (typeof row !== 'object' || row === null) return null;
    const value = row as Record<string, unknown>;
    if (value.deleted_at != null) return null;
    if (typeof value.media_id !== 'string' || !isMediaType(value.media_type) || typeof value.storage_path !== 'string') return null;
    return { mediaId: value.media_id, mediaType: value.media_type, storagePath: value.storage_path };
  } catch { return null; }
}

export function formatMediaSize(bytes: number | undefined): string {
  if (bytes === undefined) return '';
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function remainingAttachments(count: number): number {
  return Math.max(0, config.media.maxAttachments - count);
}
