export const MAX_JSON_BODY_BYTES = 8_192;

export type JsonObject = Record<string, unknown>;

export class CallHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;
  readonly retryAfterSeconds?: number;
  readonly call?: unknown;

  constructor(
    status: number,
    code: string,
    retryable: boolean,
    retryAfterSeconds?: number,
    call?: unknown,
  ) {
    super(code);
    this.name = 'CallHttpError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
    this.retryAfterSeconds = retryAfterSeconds;
    this.call = call;
  }
}

const messages: Record<string, string> = {
  CALL_ALREADY_HANDLED: 'This call has already been handled.',
  CALL_BUSY: 'The other person is busy.',
  CALL_EXPIRED: 'This call has expired.',
  CALL_FEATURE_DISABLED: 'Calling is temporarily unavailable.',
  CALL_INVALID_REQUEST: 'The call request is invalid.',
  CALL_NOT_ALLOWED: 'You cannot use calling in this chat.',
  CALL_NOT_FOUND: 'The call was not found.',
  CALL_PERMISSION_REQUIRED: 'Microphone permission is required to call.',
  CALL_PROVIDER_UNAVAILABLE: 'The calling service is temporarily unavailable.',
  CALL_RATE_LIMITED: 'Too many call attempts. Please try again shortly.',
  CALL_REQUEST_CONFLICT: 'This request ID was already used for another call request.',
  CALL_UNAUTHENTICATED: 'Sign in again to use calling.',
};

export function jsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('content-type', 'application/json; charset=utf-8');
  responseHeaders.set('cache-control', 'no-store');
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

export function errorResponse(error: unknown): Response {
  const callError = error instanceof CallHttpError
    ? error
    : new CallHttpError(503, 'CALL_PROVIDER_UNAVAILABLE', true);
  const body: JsonObject = {
    code: callError.code,
    message: messages[callError.code] ?? messages.CALL_PROVIDER_UNAVAILABLE,
    retryable: callError.retryable,
  };
  if (callError.retryAfterSeconds !== undefined) {
    body.retryAfterSeconds = callError.retryAfterSeconds;
  }
  if (callError.call !== undefined) {
    body.call = callError.call;
  }
  const headers = new Headers();
  if (callError.retryAfterSeconds !== undefined) {
    headers.set('retry-after', String(callError.retryAfterSeconds));
  }
  return jsonResponse(body, callError.status, headers);
}

export function methodResponse(request: Request): Response | null {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.method !== 'POST') {
    return errorResponse(new CallHttpError(405, 'CALL_INVALID_REQUEST', false));
  }
  return null;
}

export async function readJsonBody(request: Request, maxBytes = MAX_JSON_BODY_BYTES): Promise<JsonObject> {
  const reader = request.body?.getReader();
  if (!reader) throw new CallHttpError(400, 'CALL_INVALID_REQUEST', false);
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maxBytes) throw new CallHttpError(400, 'CALL_INVALID_REQUEST', false);
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new CallHttpError(400, 'CALL_INVALID_REQUEST', false);
  }
  if (!isObject(parsed)) throw new CallHttpError(400, 'CALL_INVALID_REQUEST', false);
  return parsed;
}

export function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function exactKeys(value: JsonObject, required: readonly string[], optional: readonly string[] = []): void {
  const allowed = new Set([...required, ...optional]);
  const actual = Object.keys(value);
  if (required.some((key) => !(key in value)) || actual.some((key) => !allowed.has(key))) {
    throw new CallHttpError(400, 'CALL_INVALID_REQUEST', false);
  }
}

export function requireString(value: unknown, maxLength: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new CallHttpError(400, 'CALL_INVALID_REQUEST', false);
  }
  return value;
}

export function requireUuid(value: unknown): string {
  const candidate = requireString(value, 36).toLowerCase();
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(candidate) || /^0+$/.test(candidate.replaceAll('-', ''))) {
    throw new CallHttpError(400, 'CALL_INVALID_REQUEST', false);
  }
  return candidate;
}

export function providerError(code = 'CALL_PROVIDER_UNAVAILABLE', retryable = true): CallHttpError {
  const status = code === 'CALL_INVALID_REQUEST'
    ? 400
    : code === 'CALL_UNAUTHENTICATED'
    ? 401
    : code === 'CALL_NOT_ALLOWED'
    ? 403
    : code === 'CALL_NOT_FOUND'
    ? 404
    : 503;
  return new CallHttpError(status, code, retryable);
}

export function safeDiagnostic(code: string, fields: Record<string, string | number | boolean | null>): void {
  console.error(JSON.stringify({ scope: 'calling', code, ...fields }));
}
