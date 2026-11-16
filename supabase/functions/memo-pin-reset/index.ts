import { authenticate } from '../_shared/calling.ts';
import { CallHttpError, exactKeys, isObject, jsonResponse, readJsonBody, requireString, requireUuid } from '../_shared/http.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const boundedFetch: typeof fetch = (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) });
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false }, global: { fetch: boundedFetch } });
function json(body: unknown, status = 200): Response { return jsonResponse(body, status, { 'cache-control': 'no-store' }); }
async function challengeSecret(): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(crypto.randomUUID()));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.method !== 'POST') return json({ code: 'MEMO_INVALID_REQUEST' }, 405);
  try {
    const auth = await authenticate(request);
    const body = await readJsonBody(request, 16 * 1024);
    const action = requireString(body.action, 16);
    const nonce = requireString(body.device_nonce, 128);
    if (nonce.length < 16) return json({ code: 'MEMO_INVALID_REQUEST' }, 400);
    const user = await admin.auth.admin.getUserById(auth.actorId);
    if (user.error || !user.data.user?.email || !user.data.user.email_confirmed_at) return json({ code: 'MEMO_EMAIL_UNVERIFIED' }, 403);
    // This isolated server client must never replace the app's active session.
    const otp = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }, global: { fetch: boundedFetch } });
    if (action === 'request') {
      exactKeys(body, ['action', 'device_nonce']);
      const challengeId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const created = await admin.rpc('memo_pin_reset_create', { p_challenge_id: challengeId, p_account_id: auth.actorId, p_device_nonce: nonce, p_code_hash: await challengeSecret(), p_expires_at: expiresAt });
      if (created.error) throw created.error;
      const sent = await otp.auth.signInWithOtp({ email: user.data.user.email, options: { shouldCreateUser: false } });
      if (sent.error) return json({ code: sent.error.status === 429 ? 'MEMO_RATE_LIMITED' : 'MEMO_SERVICE_UNAVAILABLE', retryable: sent.error.status !== 429 }, sent.error.status === 429 ? 429 : 503);
      return json({ challenge_id: challengeId, expires_at: expiresAt });
    }
    if (action === 'verify') {
      exactKeys(body, ['action', 'challenge_id', 'device_nonce', 'code']);
      const code = requireString(body.code, 6);
      if (!/^\d{6}$/.test(code)) return json({ code: 'MEMO_RESET_INVALID' }, 400);
      const challengeId = requireUuid(body.challenge_id);
      const lease = crypto.randomUUID();
      const started = await admin.rpc('memo_pin_reset_begin_otp', { p_challenge_id: challengeId, p_account_id: auth.actorId, p_device_nonce: nonce, p_verification_id: lease });
      if (started.error) throw started.error;
      if (started.data?.allowed !== true) return json({ code: 'MEMO_RESET_INVALID' }, 400);
      let authorized = false;
      try {
        const verified = await otp.auth.verifyOtp({ email: user.data.user.email, token: code, type: 'email' });
        authorized = !verified.error && verified.data.user?.id === auth.actorId && verified.data.session !== null;
        if (verified.data.session) {
          const signedOut = await otp.auth.signOut({ scope: 'local' });
          if (signedOut.error) authorized = false;
        }
      } finally {
        const finished = await admin.rpc('memo_pin_reset_finish_otp', { p_challenge_id: challengeId, p_account_id: auth.actorId, p_device_nonce: nonce, p_verification_id: lease, p_authorized: authorized });
        if (finished.error) throw finished.error;
        authorized = authorized && finished.data?.authorized === true;
      }
      if (!authorized) return json({ code: 'MEMO_RESET_INVALID' }, 400);
      return json({ authorized: true, account_id: auth.actorId, device_nonce: nonce });
    }
    return json({ code: 'MEMO_INVALID_REQUEST' }, 400);
  } catch (error) {
    if (error instanceof CallHttpError) return json({ code: error.status === 401 ? 'MEMO_UNAUTHENTICATED' : error.status === 403 ? 'MEMO_NOT_ALLOWED' : error.status >= 500 ? 'MEMO_SERVICE_UNAVAILABLE' : 'MEMO_INVALID_REQUEST', retryable: error.retryable }, error.status);
    const message = error instanceof Error ? error.message : isObject(error) && typeof error.message === 'string' ? error.message : '';
    if (message.includes('MEMO_RATE_LIMITED')) return json({ code: 'MEMO_RATE_LIMITED', retryable: false, retry_after_seconds: 60 }, 429);
    return json({ code: 'MEMO_SERVICE_UNAVAILABLE', retryable: true }, 503);
  }
});
