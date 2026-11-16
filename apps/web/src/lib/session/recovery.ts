export const recoveryKey = 'dg.auth.recovery.v1';
export const revocationKey = 'dg.auth.revocation-pending.v1';

/** Consume only the configured implicit callback; never retain URL credentials. */
export function consumeRecoveryUrl(): { access_token: string; refresh_token: string } | null | 'invalid' {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const callback = ['access_token', 'refresh_token', 'type', 'error', 'error_description'].some((key) => hash.has(key)) || url.searchParams.has('code') || url.searchParams.has('error');
  if (!callback) return null;
  // Preserve Next's state and discard callback parameters before creating the SDK.
  window.history.replaceState(window.history.state, '', url.pathname);
  const access_token = hash.get('access_token');
  const refresh_token = hash.get('refresh_token');
  if (url.pathname !== '/reset-password' || url.search || hash.get('type') !== 'recovery' || hash.getAll('type').length !== 1 ||
      hash.getAll('access_token').length !== 1 || hash.getAll('refresh_token').length !== 1 ||
      !access_token?.trim() || !refresh_token?.trim() || hash.has('error')) return 'invalid';
  return { access_token, refresh_token };
}

export function recoveryRedirect(): string {
  const redirect = new URL('/reset-password', window.location.origin);
  if (!['http:', 'https:'].includes(redirect.protocol) || redirect.origin !== window.location.origin || redirect.username || redirect.password) throw new Error('Invalid recovery origin');
  return redirect.href;
}
