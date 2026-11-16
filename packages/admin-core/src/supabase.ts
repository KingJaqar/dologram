import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getAdminEnv, type ConfigOptions, type EnvSource } from './env.ts';

declare global {
  var __dgAdminSupabase: SupabaseClient | undefined;
}

/**
 * Auth Admin and Storage client (D-102) with the secret key. The SDK state is
 * nonpersistent, every request is bounded, and the instance is cached per process:
 * a configuration change needs a restart.
 */
export function getAdminClient(source: EnvSource = process.env, options: ConfigOptions = {}): SupabaseClient {
  const cached = globalThis.__dgAdminSupabase;
  if (cached) return cached;
  const env = getAdminEnv(source, options);
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => fetch(input, {
        ...init, cache: 'no-store', signal: AbortSignal.timeout(10000),
      }),
    },
  });
  globalThis.__dgAdminSupabase = client;
  return client;
}
