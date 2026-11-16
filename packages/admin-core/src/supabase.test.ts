import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { getAdminClient } from './supabase.ts';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ auth: {} })) }));

const ref = 'abcdefghijklmnopqrst';
const source = {
  SUPABASE_URL: `https://${ref}.supabase.co`, SUPABASE_PROJECT_REF: ref,
  SUPABASE_SECRET_KEY: 'synthetic-secret', SUPABASE_ACCESS_TOKEN: 'synthetic-access',
  SUPABASE_DB_URL: `postgres://postgres:synthetic@db.${ref}.supabase.co/postgres`,
  BACKUP_DIR: 'G:/protected-backups',
};

afterEach(() => {
  globalThis.__dgAdminSupabase = undefined;
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('getAdminClient', () => {
  it('validates configuration before constructing a client', () => {
    expect(() => getAdminClient({})).toThrow();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('caches the server-only client without persisting or refreshing sessions', async () => {
    const client = getAdminClient(source);
    expect(getAdminClient(source)).toBe(client);
    expect(createClient).toHaveBeenCalledTimes(1);
    const call = vi.mocked(createClient).mock.calls[0];
    expect(call?.slice(0, 2)).toEqual([source.SUPABASE_URL, source.SUPABASE_SECRET_KEY]);
    expect(call?.[2]?.auth).toEqual({ persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
    const request = call?.[2]?.global?.fetch;
    if (!request) throw new Error('Expected bounded SDK fetch');
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    await request('https://fixture.invalid', { method: 'POST' });
    expect(fetch).toHaveBeenCalledWith('https://fixture.invalid', expect.objectContaining({
      method: 'POST', cache: 'no-store', signal: expect.any(AbortSignal),
    }));
  });
});
