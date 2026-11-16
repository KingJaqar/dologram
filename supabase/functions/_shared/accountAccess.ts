import { CallHttpError } from './http.ts';

/** Only verified, current getUser metadata belongs here; never decoded JWT data. */
export function assertAccountAccess(appMetadata: Record<string, unknown>): void {
  const flag = appMetadata.must_change_password;
  if (flag !== undefined && flag !== false) throw new CallHttpError(403, 'CALL_NOT_ALLOWED', false);
}
