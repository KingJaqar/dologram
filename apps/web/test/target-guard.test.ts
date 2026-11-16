import { afterEach, expect, test, vi } from 'vitest';
import { assertIsolatedTarget, withApiFixture } from '../e2e/helpers/api';
import type { Page } from '@playwright/test';

const target = { url: 'http://127.0.0.1:54321', approvedUrl: 'http://127.0.0.1:54321', publishableKey: 'sb_publishable_fixture', allowMutations: 'isolated' };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

test('only an explicitly approved target matching the actual page can mutate', () => {
  expect(assertIsolatedTarget(target, target.url)).toBe(target.url);
  for (const change of [{ allowMutations: '' }, { approvedUrl: 'https://other.example' }, { publishableKey: 'sb_secret_rejected' }, { url: 'https://user:pass@example.com' }, { url: 'http://external.example' }]) {
    expect(() => assertIsolatedTarget({ ...target, ...change }, target.url)).toThrow();
  }
  expect(() => assertIsolatedTarget(target, 'https://other.example')).toThrow();
  const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;
  expect(assertIsolatedTarget({ ...target, publishableKey: jwt('anon') }, target.url)).toBe(target.url);
  expect(() => assertIsolatedTarget({ ...target, publishableKey: jwt('service_role') }, target.url)).toThrow();
});

test('fixture guard refuses before network access when approval is absent', async () => {
  const network = vi.fn();
  vi.stubGlobal('fetch', network);
  vi.stubEnv('E2E_ALLOW_MUTATIONS', '');
  const page = { locator: () => ({ getAttribute: async () => target.url }) } as unknown as Page;
  await expect(withApiFixture(page, { userId: 'disposable', accessToken: 'fixture-session' }, async () => undefined)).rejects.toThrow('authorization');
  expect(network).not.toHaveBeenCalled();
});

test('verified sessions use bounded own-user requests and cleanup runs after failure', async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', target.url);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', target.publishableKey);
  vi.stubEnv('E2E_ISOLATED_SUPABASE_URL', target.approvedUrl);
  vi.stubEnv('E2E_ALLOW_MUTATIONS', 'isolated');
  const network = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: 'disposable' }))).mockResolvedValueOnce(new Response('{}'));
  vi.stubGlobal('fetch', network);
  const cleanup = vi.fn().mockResolvedValue(undefined);
  const page = { locator: () => ({ getAttribute: async () => target.url }) } as unknown as Page;
  await expect(withApiFixture(page, { userId: 'disposable', accessToken: 'fixture-session' }, async (fixture) => {
    expect(fixture.runId).toMatch(/^dg-e2e-/);
    fixture.deferCleanup('chat:fixture-id', cleanup);
    await expect(fixture.request('https://other.example/rest/v1/chats')).rejects.toThrow('same-target');
    await expect(fixture.request('/rest/v1/chats', { method: 'DELETE' })).rejects.toThrow('owned by this run');
    await expect(fixture.request('/rest/v1/chats', { method: 'POST', body: '{}' })).rejects.toThrow('allocated ID');
    await fixture.request('/rest/v1/chats');
    throw new Error('scenario failed');
  })).rejects.toThrow('scenario failed');
  expect(cleanup).toHaveBeenCalledOnce();
  expect(network).toHaveBeenCalledTimes(2);
  expect(network.mock.calls[1]?.[1].headers.get('Authorization')).toBe('Bearer fixture-session');
});

test('tagged resources are cleaned automatically, including when creation loses its response', async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', target.url);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', target.publishableKey);
  vi.stubEnv('E2E_ISOLATED_SUPABASE_URL', target.approvedUrl);
  vi.stubEnv('E2E_ALLOW_MUTATIONS', 'isolated');
  const network = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: 'disposable' })))
    .mockRejectedValueOnce(new Error('connection lost')).mockResolvedValueOnce(new Response('{}'));
  vi.stubGlobal('fetch', network);
  const page = { locator: () => ({ getAttribute: async () => target.url }) } as unknown as Page;
  let id = '';
  await expect(withApiFixture(page, { userId: 'disposable', accessToken: 'fixture-session' }, async (fixture) => {
    id = fixture.allocateId();
    await fixture.request('/rest/v1/chats', { method: 'POST', body: JSON.stringify({ chat_id: id, title: fixture.runId, created_by: 'disposable', type: 'group' }) });
  })).rejects.toThrow('connection lost');
  expect(network.mock.calls[2]?.[0].href).toBe(`${target.url}/rest/v1/chats?chat_id=eq.${id}`);
  expect(network.mock.calls[2]?.[1].method).toBe('DELETE');
});
