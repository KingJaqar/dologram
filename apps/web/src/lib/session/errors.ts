import { strings } from '@dologram/shared';

export class PasswordVerificationError extends Error {
  constructor(restricted = false) {
    super(restricted ? 'Your password was updated, but access is still restricted. Retry verification or contact the account administrator.' : 'Your password was updated, but access verification did not finish. Retry verification before continuing.');
  }
}

export function authMessage(error: unknown, fallback: string, credentialRequest = false): string {
  if (error instanceof PasswordVerificationError) return error.message;
  const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (status === 429 || code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') return strings.signIn.tooManyAttempts;
  if (code === 'invalid_credentials') return 'Email, username or password is incorrect.';
  if (credentialRequest && status === 400 && !code) return 'Email, username or password is incorrect.';
  if (code === 'email_not_confirmed') return strings.signUp.checkEmail;
  if (code === 'email_exists' || code === 'user_already_exists') return strings.signUp.emailTaken;
  if (error instanceof TypeError || status === 0 || (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name))) return strings.common.checkConnection;
  return fallback;
}
