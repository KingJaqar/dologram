/**
 * Attachment reads for the sync resync (M2-05, 6.4, D-40). message_media is read-only for the MVP
 * sync; Phase 11 inserts rows.
 */
import { config, type MediaType } from '../../config';
import { classifyError, type ClassifiedError } from '../../errors';
import type { DgClient } from '../client';
import type { Tables } from '../database.types';
import type { DgResult } from '../result';

export type MessageMediaRow = Tables<'message_media'>;

export type MediaUploadOptions = {
  bucket: string;
  path: string;
  mime: string;
  cacheControl: number;
};

export type ResumableMediaUpload = (options: MediaUploadOptions) => Promise<DgResult<null>>;

export type UploadAttachmentInput = {
  chatId: string;
  mediaId: string;
  mediaType: MediaType;
  mime: string;
  sizeBytes: number;
  body?: ArrayBuffer;
  resumableUpload?: ResumableMediaUpload;
};

export type InsertMessageMediaInput = {
  mediaId: string;
  messageId: string;
  mediaType: MediaType;
  compressed: boolean;
};

export function mediaBucket(mediaType: MediaType): string {
  return mediaType === 'photo' || mediaType === 'voice' ? config.media.smallBucket : config.media.largeBucket;
}

export function mediaStoragePath(chatId: string, mediaId: string): string {
  return `${chatId}/${mediaId}`;
}

/** Storage uses a different error shape from PostgREST; duplicate objects are successful retries. */
export function isAlreadyExistsError(error: unknown): boolean {
  const record = typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : null;
  const originalResponse = record?.originalResponse;
  const responseStatus =
    typeof originalResponse === 'object' && originalResponse !== null &&
    'getStatus' in originalResponse && typeof originalResponse.getStatus === 'function'
      ? (originalResponse.getStatus as () => unknown)()
      : null;
  const status = record?.status ?? record?.statusCode ?? responseStatus;
  const code = String(record?.code ?? record?.error ?? '').toLowerCase();
  const message = String(record?.message ?? '').toLowerCase();
  return status === 409 || code.includes('already') || message.includes('already exists') || message.includes('asset already exists');
}

function storageError(error: unknown): ClassifiedError {
  const record = typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : null;
  const status = typeof record?.status === 'number'
    ? record.status
    : typeof record?.statusCode === 'number'
      ? record.statusCode
      : null;
  return classifyError(error, status);
}

/** Uploads one object with ArrayBuffer or an injected TUS implementation (M3-01, D-29, D-39). */
export async function uploadAttachment(
  client: DgClient,
  input: UploadAttachmentInput,
): Promise<DgResult<null>> {
  const bucket = mediaBucket(input.mediaType);
  const path = mediaStoragePath(input.chatId, input.mediaId);
  if (input.sizeBytes > config.media.tusThresholdBytes) {
    if (!input.resumableUpload) {
      return { data: null, error: { kind: 'server', code: 'RESUMABLE_UPLOAD_UNAVAILABLE', status: null } };
    }
    return input.resumableUpload({ bucket, path, mime: input.mime, cacheControl: config.media.cacheControlSeconds });
  }
  if (!input.body) {
    return { data: null, error: { kind: 'server', code: 'UPLOAD_BODY_UNAVAILABLE', status: null } };
  }
  const { error } = await client.storage.from(bucket).upload(path, input.body, {
    cacheControl: String(config.media.cacheControlSeconds),
    contentType: input.mime,
    upsert: false,
  });
  if (!error || isAlreadyExistsError(error)) return { data: null, error: null };
  return { data: null, error: storageError(error) };
}

/** Inserts the trigger-bound media row; a repeated media_id is an idempotent success (M3-01). */
export async function insertMessageMedia(
  client: DgClient,
  input: InsertMessageMediaInput,
): Promise<DgResult<MessageMediaRow | null>> {
  const { data, error, status } = await client
    .from('message_media')
    .insert({
      media_id: input.mediaId,
      message_id: input.messageId,
      media_type: input.mediaType,
      compressed: input.compressed,
    })
    .select()
    .single();
  if (!error) return { data, error: null };
  if (error.code === '23505') return { data: null, error: null };
  return { data: null, error: classifyError(error, status) };
}

/** Creates the 10-minute signed URL used by the later media viewer (D-113). */
export async function createMediaSignedUrl(
  client: DgClient,
  mediaType: MediaType,
  storagePath: string,
  expiresIn = config.media.signedUrlSeconds,
): Promise<DgResult<string>> {
  const { data, error } = await client.storage.from(mediaBucket(mediaType)).createSignedUrl(storagePath, expiresIn);
  if (error) return { data: null, error: storageError(error) };
  return { data: data.signedUrl, error: null };
}

/** Rows of one chat with sync_seq > afterSyncSeq, ascending, at most `limit` (D-40). */
export async function listMessageMediaAfter(
  client: DgClient,
  chatId: string,
  afterSyncSeq: number,
  limit: number,
): Promise<DgResult<MessageMediaRow[]>> {
  const { data, error, status } = await client
    .from('message_media')
    .select('*')
    .eq('chat_id', chatId)
    .gt('sync_seq', afterSyncSeq)
    .order('sync_seq', { ascending: true })
    .limit(limit);
  if (error) {
    return { data: null, error: classifyError(error, status) };
  }
  return { data, error: null };
}

/** Sender-only, idempotent deletion with a sequenced tombstone. Requires migration 024. */
export async function deleteChatAttachment(client: DgClient, mediaId: string): Promise<DgResult<MessageMediaRow>> {
  try {
    const { data, error, status } = await client.rpc('delete_chat_attachment', { p_media_id: mediaId });
    if (error || !data) return { data: null, error: classifyError(error, status) };
    return { data, error: null };
  } catch (error) { return { data: null, error: classifyError(error) }; }
}
