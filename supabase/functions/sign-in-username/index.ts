import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = getServiceRoleKey();
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});

const headers = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

function getServiceRoleKey(): string {
  const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacyKey) return legacyKey;

  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as { default?: unknown };
      if (typeof parsed.default === 'string' && parsed.default.length > 0) return parsed.default;
    } catch {
      // Fall through to the explicit configuration error below.
    }
  }

  throw new Error('A Supabase service key is not configured for sign-in.');
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function invalidCredentials(): Response {
  // Keep username existence private: the client receives the same response for an unknown
  // username and a wrong password.
  return json({ error: 'invalid_credentials' }, 401);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: { username?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { username?: unknown; password?: unknown };
  } catch {
    return invalidCredentials();
  }

  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^[a-z][a-z0-9_]{4,31}$/.test(username) || password.length === 0) {
    return invalidCredentials();
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('email')
    .eq('username', username)
    .maybeSingle();

  if (profileError) {
    console.error('Username lookup failed:', profileError.message);
    return json({ error: 'service_unavailable' }, 503);
  }
  if (!profile?.email) return invalidCredentials();

  const { data, error: authError } = await admin.auth.signInWithPassword({
    email: profile.email,
    password,
  });
  if (authError || !data.session) return invalidCredentials();

  return json({
    session: {
      access_token: data.session.access_token,
      expires_at: data.session.expires_at,
      expires_in: data.session.expires_in,
      refresh_token: data.session.refresh_token,
      token_type: data.session.token_type,
      user: data.session.user,
    },
  }, 200);
});
