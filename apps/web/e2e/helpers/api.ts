import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';

type Target = { url: string; publishableKey: string; approvedUrl: string; allowMutations: string };
// Confirmed against Database.public.Tables; no invented generic `id` column.
const fixtureKeys = { chats: 'chat_id', messages: 'message_id' } as const;

function origin(value: string): string {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error();
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error();
    return url.origin;
  } catch {
    throw new Error('Fixture target must be an explicit HTTPS origin or loopback HTTP origin.');
  }
}

export function assertIsolatedTarget(target: Target, embeddedUrl: string): string {
  if (target.allowMutations !== 'isolated') throw new Error('Fixture mutations need explicit isolated-target authorization.');
  const url = origin(target.url);
  if (url !== origin(target.approvedUrl) || url !== origin(embeddedUrl)) throw new Error('Fixture target differs from the approved or embedded target.');
  if (!target.publishableKey.startsWith('sb_publishable_')) {
    // Legacy anon JWTs are supported; privileged roles fail closed.
    try {
      const payload = target.publishableKey.split('.')[1];
      if (!payload) throw new Error();
      const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString());
      if (!claims || typeof claims !== 'object' || !('role' in claims) || claims.role !== 'anon') throw new Error();
    } catch {
      throw new Error('Fixtures require a publishable or legacy anon key.');
    }
  }
  return url;
}

type Fixture = {
  runId: string;
  allocateId: () => string;
  request: (path: string, init?: RequestInit) => Promise<Response>;
  deferCleanup: (resourceId: string, cleanup: () => Promise<void>) => void;
};

/** Runner-only. Approval/configuration must come from an owner-verified isolated harness.
 * Tagged UUID-keyed REST rows are owned by this run and cleaned automatically.
 * Other fixture types require a separately approved, schema-specific harness.
 */
export async function withApiFixture<T>(
  page: Page,
  session: { userId: string; accessToken: string },
  work: (fixture: Fixture) => Promise<T>,
): Promise<T> {
  const target: Target = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    approvedUrl: process.env.E2E_ISOLATED_SUPABASE_URL || '',
    allowMutations: process.env.E2E_ALLOW_MUTATIONS || '',
  };
  const check = async () => assertIsolatedTarget(target, await page.locator('meta[name="dg-supabase-url"]').getAttribute('content') || '');
  const url = await check();
  if (!session.userId || !session.accessToken) throw new Error('A disposable user session is required.');
  const headers = { apikey: target.publishableKey, Authorization: `Bearer ${session.accessToken}` };
  const auth = await fetch(`${url}/auth/v1/user`, { headers, signal: AbortSignal.timeout(10_000), redirect: 'error' });
  if (!auth.ok) throw new Error(`Fixture session verification failed (${auth.status}).`);
  const user: unknown = await auth.json();
  if (!user || typeof user !== 'object' || !('id' in user) || user.id !== session.userId) throw new Error('Fixture user identity mismatch.');
  const cleanups: { id: string; run: () => Promise<void> }[] = [];
  const runId = `dg-e2e-${randomUUID()}`;
  const allocated = new Set<string>();
  const owned = new Set<string>();
  const request: Fixture['request'] = async (path, init = {}) => {
    await check();
    const endpoint = new URL(path, url);
    if (endpoint.origin !== url || !/^\/rest\/v1\/[a-z_]+$/.test(endpoint.pathname) || endpoint.username || endpoint.password) throw new Error('Fixture API only accepts same-target REST paths.');
    const table = endpoint.pathname.slice('/rest/v1/'.length);
    if (table !== 'chats' && table !== 'messages') throw new Error('No verified fixture contract for this table.');
    const key = fixtureKeys[table];
    const method = (init.method || 'GET').toUpperCase();
    if (method === 'POST') {
      let row: unknown;
      try { row = typeof init.body === 'string' ? JSON.parse(init.body) : undefined; } catch { throw new Error('Fixture creation requires a JSON row.'); }
      const values = row && typeof row === 'object' && !Array.isArray(row) ? row as Record<string, unknown> : {};
      const id = values[key];
      if (typeof id !== 'string' || !allocated.delete(id) || !Object.values(values).some((value) => typeof value === 'string' && value.includes(runId))) throw new Error('Fixture creation requires an allocated ID and run tag.');
      const resource = `${endpoint.pathname}?${key}=eq.${id}`;
      owned.add(resource);
      // Register before the request: even a lost creation response needs cleanup.
      cleanups.push({ id, run: async () => { await request(resource, { method: 'DELETE' }); } });
    } else if (method !== 'GET' && (!['PATCH', 'DELETE'].includes(method) || !owned.has(`${endpoint.pathname}${endpoint.search}`))) {
      throw new Error('Fixture mutations require an exact resource owned by this run.');
    }
    const requestHeaders = new Headers(init.headers);
    if (typeof init.body === 'string' && !requestHeaders.has('Content-Type')) requestHeaders.set('Content-Type', 'application/json');
    for (const [name, value] of Object.entries(headers)) requestHeaders.set(name, value);
    const response = await fetch(endpoint, { ...init, headers: requestHeaders, signal: AbortSignal.timeout(10_000), redirect: 'error' });
    if (!response.ok) throw new Error(`Fixture request failed (${response.status}).`);
    return response;
  };
  try {
    return await work({
      runId,
      allocateId() { const id = randomUUID(); allocated.add(id); return id; },
      request,
      deferCleanup(id, run) {
        if (!/^[A-Za-z0-9:_-]{1,180}$/.test(id)) throw new Error('Cleanup requires a resource identifier, never credentials.');
        cleanups.push({ id, run });
      },
    });
  } finally {
    const failed: string[] = [];
    for (const cleanup of cleanups.reverse()) {
      try { await cleanup.run(); } catch { failed.push(cleanup.id); }
    }
    if (failed.length) throw new Error(`Fixture cleanup incomplete; recover resource IDs: ${failed.join(', ')}.`);
  }
}
