import { fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DgClient } from '@dologram/shared';

let activeClient: DgClient | undefined;
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://isolated.example.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'sb_publishable_synthetic');
  localStorage.clear();
});
afterEach(async () => {
  if (activeClient) {
    await activeClient.auth.initialize();
    await activeClient.auth.dispose();
    activeClient = undefined;
  }
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('lazy browser integration', () => {
  it('does not access session storage or fetch at import, and creates one client on demand', async () => {
    // Audit SDK evaluation separately; its guarded localStorage capability/debug probes
    // are independent of whether our browser singleton has been created.
    await import('@dologram/shared');
    const read = vi.spyOn(Storage.prototype, 'getItem');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    const transport = vi.fn<typeof fetch>();
    const { getSupabase } = await import('./supabase');
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    activeClient = getSupabase({ fetch: transport });
    expect(getSupabase()).toBe(activeClient);
    expect(getSupabase({ fetch: transport })).toBe(activeClient);
    expect(() => getSupabase({ fetch: vi.fn<typeof fetch>() })).toThrow('connection settings');
    await activeClient.auth.initialize();
    expect(transport).not.toHaveBeenCalled();
  });

  it('uses the injected fetch and the caller session token without exposing it to diagnostics', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      id: 'synthetic-user', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const { getSupabase } = await import('./supabase');
    activeClient = getSupabase({ fetch: transport });
    await activeClient.auth.getUser('synthetic-session-token');
    expect(transport).toHaveBeenCalledOnce();
    const call = transport.mock.calls[0];
    if (!call) throw new Error('Expected the injected request');
    const [url, options] = call;
    expect(String(url)).toBe('https://isolated.example.test/auth/v1/user');
    expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer synthetic-session-token');
    expect(new Headers(options?.headers).get('apikey')).toBe('sb_publishable_synthetic');
  });

  it.each(['', 'http://isolated.example.test', 'https://name:password@isolated.example.test', 'https://isolated.example.test/path', 'https://isolated.example.test?token=sensitive'])('rejects invalid configuration without disclosing it: %s', async (url) => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', url);
    const { getSupabase, getBrowserClientProblem } = await import('./supabase');
    expect(() => getSupabase()).toThrow('connection settings');
    expect(getBrowserClientProblem()?.message).not.toContain('sensitive');
    expect(getBrowserClientProblem()?.message).not.toContain('password@');
  });

  it.each(['', 'placeholder', 'sb_secret_fixture', `header.${btoa('{"role":"service_role"}')}.signature`])('refuses missing, malformed and privileged keys', async (key) => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', key);
    const { getSupabase } = await import('./supabase');
    expect(() => getSupabase()).toThrow('connection settings');
  });

  it('accepts a legacy anon key and preserves other stored data during its probe', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', `header.${btoa('{"role":"anon"}')}.signature`);
    localStorage.setItem('dg.theme', 'dark');
    const { getSupabase, browserStorage } = await import('./supabase');
    activeClient = getSupabase();
    await browserStorage.setItem('synthetic-session', 'synthetic-value');
    expect(await browserStorage.getItem('synthetic-session')).toBe('synthetic-value');
    await browserStorage.removeItem('synthetic-session');
    expect(await browserStorage.getItem('synthetic-session')).toBeNull();
    expect(localStorage.getItem('dg.theme')).toBe('dark');
    expect(Object.keys(localStorage).filter((key) => key.startsWith('dg.storage-check.'))).toEqual([]);
  });

  it.each(['getItem', 'setItem', 'removeItem'] as const)('reports %s failure and allows recovery without losing a session', async (method) => {
    const { browserStorage, getBrowserClientProblem } = await import('./supabase');
    localStorage.setItem('synthetic-session', 'retained');
    const failure = vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new DOMException('sensitive input', 'SecurityError'); });
    await expect(method === 'setItem' ? browserStorage.setItem('other', 'x') : browserStorage[method]('other')).rejects.toThrow('browser storage');
    expect(getBrowserClientProblem()?.message).not.toContain('sensitive input');
    failure.mockRestore();
    expect(await browserStorage.getItem('synthetic-session')).toBe('retained');
  });

  it('shows denied storage and quota errors in the public recovery UI, then retries successfully', async () => {
    const { getSupabase, getBrowserClientProblem } = await import('./supabase');
    const { BrowserClientStatus } = await import('../components/BrowserClientStatus');
    const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('private details', 'QuotaExceededError'); });
    render(<BrowserClientStatus />);
    act(() => { expect(() => getSupabase()).toThrow('browser storage'); });
    expect(screen.getByRole('alert')).toHaveTextContent('free some space');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('alert')).toBeVisible();
    failure.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    activeClient = getSupabase();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(getBrowserClientProblem()).toBeNull();
  });

  it('reports a denied localStorage getter before creating a client', async () => {
    const { getSupabase } = await import('./supabase');
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });
    expect(() => getSupabase()).toThrow('browser storage');
  });
});
