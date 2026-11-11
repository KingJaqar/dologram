/**
 * Error classification shared by the queue (LS-8, D-77) and the UI.
 */

export type ClassifiedError =
  | { kind: 'delivered' }
  | { kind: 'rateLimited'; retryAfterSec: number }
  | { kind: 'deferred' }
  | { kind: 'network' }
  | { kind: 'server'; code: string | null; status: number | null };export type DgResult<T> = { data: T; error: null } | { data: null; error: ClassifiedError };
export type ErrorMessageKey
 =
  | 'chat.statusSent'
  | 'chat.labelWaitingWifi'
  | 'queue.rateLimited'
  | 'common.noConnection'
  | 'common.couldNotLoad';

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function readStatus(error: Record<string, unknown>): number | null {
  if (typeof error.status === 'number') {
    return error.status;
  }
  if (typeof error.statusCode === 'number') {
    return error.statusCode;
  }
  if (typeof error.statusCode === 'string' && error.statusCode.trim() !== '') {
    const parsed = Number(error.statusCode);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readCode(error: Record<string, unknown>): string | null {
  return typeof error.code === 'string' && error.code !== '' ? error.code : null;
}

/**
 * 23505 means the row already exists, which for a client-generated message id counts as delivered
 * (LS-8). DG429 carries the wait in `details` (D-77, D-122). A fetch failure is a network error, and
 * everything else is a server error.
 *
 * `status` is the HTTP status of the response that produced the error. supabase-js keeps it outside
 * the PostgrestError object and reports 0 when the fetch itself threw, so callers pass it in.
 */
export function classifyError(error: unknown, responseStatus?: number | null): ClassifiedError {
  const record = asRecord(error);
  const status = (record ? readStatus(record) : null) ?? responseStatus ?? null;

  if (error instanceof TypeError || status === 0) {
    return { kind: 'network' };
  }

  const code = record ? readCode(record) : null;

  if (code === '23505') {
    return { kind: 'delivered' };
  }

  if (code === 'DG429') {
    const details = record?.details;
    const parsed = Number.parseInt(typeof details === 'string' ? details : String(details ?? ''), 10);
    return { kind: 'rateLimited', retryAfterSec: Number.isFinite(parsed) ? Math.max(1, parsed) : 1 };
  }

  return { kind: 'server', code, status };
}

/** Keys of the strings module that a classified error maps to. */
export function messageKeyFor(error: ClassifiedError): ErrorMessageKey {
  switch (error.kind) {
    case 'delivered':
      return 'chat.statusSent';
    case 'rateLimited':
      return 'queue.rateLimited';
    case 'deferred':
      return 'chat.labelWaitingWifi';
    case 'network':
      return 'common.noConnection';
    case 'server':
      return 'common.couldNotLoad';
  }
}
