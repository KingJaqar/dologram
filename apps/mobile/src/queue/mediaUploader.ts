/** Android Storage upload adapters for Phase 11 (M3-01, D-29, D-39, D-113). */
import { File } from 'expo-file-system';
import { Upload } from 'tus-js-client';
import {
  classifyError,
  config,
  isAlreadyExistsError,
  type DgResult,
  type MediaUploadOptions,
} from '@dologram/shared';
import { supabase } from '../lib/supabase';

function resumableEndpoint(): string {
  const configured = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const url = new URL(configured);
  const hostname = url.hostname;
  const directHostname = hostname.endsWith('.supabase.co')
    ? `${hostname.slice(0, -'.supabase.co'.length)}.storage.supabase.co`
    : hostname;
  return `${url.protocol}//${directHostname}/storage/v1/upload/resumable`;
}

function responseStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null;
  const record = error as Record<string, unknown>;
  const response = record.originalResponse;
  if (typeof response === 'object' && response !== null && 'getStatus' in response && typeof response.getStatus === 'function') {
    const status = (response.getStatus as () => unknown)();
    return typeof status === 'number' ? status : null;
  }
  return null;
}

async function resumableUpload(file: File, options: MediaUploadOptions): Promise<DgResult<null>> {
  const { data, error } = await supabase.auth.getSession();
  if (error) return { data: null, error: classifyError(error) };
  const accessToken = data.session?.access_token;
  if (!accessToken) return { data: null, error: { kind: 'server', code: 'AUTH_SESSION_MISSING', status: null } };

  return new Promise((resolve) => {
    const upload = new Upload(file, {
      endpoint: resumableEndpoint(),
      uploadSize: file.size,
      chunkSize: config.media.tusThresholdBytes,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${accessToken}`,
        'x-upsert': 'false',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: options.bucket,
        objectName: options.path,
        contentType: options.mime,
        cacheControl: String(options.cacheControl),
      },
      onError: (uploadError) => {
        if (isAlreadyExistsError(uploadError)) {
          resolve({ data: null, error: null });
          return;
        }
        resolve({ data: null, error: classifyError(uploadError, responseStatus(uploadError)) });
      },
      onSuccess: () => resolve({ data: null, error: null }),
    });
    upload.start();
  });
}

export async function uploadMobileAttachment(input: {
  uri: string;
  mime: string;
  sizeBytes: number;
  bucket: string;
  path: string;
}): Promise<DgResult<null>> {
  try {
    const file = new File(input.uri);
    if (input.sizeBytes > config.media.tusThresholdBytes) {
      return await resumableUpload(file, {
        bucket: input.bucket,
        path: input.path,
        mime: input.mime,
        cacheControl: config.media.cacheControlSeconds,
      });
    }
    const body = await file.arrayBuffer();
    const { error } = await supabase.storage.from(input.bucket).upload(input.path, body, {
      cacheControl: String(config.media.cacheControlSeconds),
      contentType: input.mime,
      upsert: false,
    });
    if (!error || isAlreadyExistsError(error)) return { data: null, error: null };
    return { data: null, error: classifyError(error) };
  } catch (error) {
    return { data: null, error: classifyError(error) };
  }
}
