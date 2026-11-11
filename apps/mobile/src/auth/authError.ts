/**
 * Shape of the errors supabase-js reports from Auth (D-163, D-181).
 * supabase-js surfaces `AuthApiError` objects with `status`, `code` and `message`;
 * a failed fetch throws a `TypeError` instead. Screens map these to UI strings.
 */
export interface AuthErrorInfo {
  status?: number;
  code?: string;
  message: string;
}

export function readAuthError(error: unknown): AuthErrorInfo {
  if (typeof error !== 'object' || error === null) return { message: '' };

  const record = error as Record<string, unknown>;
  const status = typeof record.status === 'number' ? record.status : undefined;
  const code = typeof record.code === 'string' ? record.code : undefined;
  const message = typeof record.message === 'string' ? record.message : '';

  return { status, code, message };
}

/** A request that never reached the server: fetch threw or reported status 0. */
export function isNetworkError(error: unknown, info: AuthErrorInfo): boolean {
  return error instanceof TypeError || info.status === 0 || info.status === undefined;
}
