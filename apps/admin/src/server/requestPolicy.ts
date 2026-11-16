export const ADMIN_HOST = '127.0.0.1:3100';
export const ADMIN_ORIGIN = `http://${ADMIN_HOST}`;
export const SESSION_COOKIE = 'dg_admin_account_v1';
export const sessionCookieOptions = { httpOnly: true, sameSite: 'strict', path: '/', secure: false } as const;

export function localRequestStatus(headers: Pick<Headers, 'get'>, mutation: boolean): 403 | 421 | undefined {
  // Forwarded headers never override the actual Host/Origin security boundary.
  if (headers.get('host') !== ADMIN_HOST) return 421;
  if (mutation && headers.get('origin') !== ADMIN_ORIGIN) return 403;
}

export function isMutation(method: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

