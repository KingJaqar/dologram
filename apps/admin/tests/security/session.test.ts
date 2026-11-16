// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createSessionStore, IDLE_MS } from '../../src/server/sessionStore';
const account = { userId: '10000000-0000-4000-8000-000000000001', authSessionId: '20000000-0000-4000-8000-000000000001', accessToken: 'synthetic', expiresAt: Number.MAX_SAFE_INTEGER };
describe('account sessions and scoped abuse bounds', () => {
  it('rejects forged/restarted/revoked cookies, copies identity and bounds storage', () => {
    const store = createSessionStore(); const id = store.createSession(account);
    expect(id).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(store.readSession('A'.repeat(43))).toBeUndefined();
    expect(createSessionStore().readSession(id)).toBeUndefined();
    const read = store.readSession(id); if (read) read.userId = 'forged';
    expect(store.readSession(id)?.userId).toBe(account.userId);
    for (let i = 0; i < 32; i++) store.createSession(account);
    expect(store.readSession(id)).toBeUndefined();
    const fresh = store.createSession(account); store.destroySession(fresh);
    expect(store.readSession(fresh)).toBeUndefined();
  });
  it('enforces exact idle/token expiry and activity without passive extension', () => {
    let now = 1000; const store = createSessionStore(() => now);
    const active = store.createSession(account), passive = store.createSession(account);
    now += IDLE_MS - 1;
    expect(store.readSession(active, true)).toBeDefined();
    expect(store.readSession(passive)).toBeDefined();
    now += 1;
    expect(store.readSession(passive)).toBeUndefined();
    expect(store.readSession(active)).toBeDefined();
    now += IDLE_MS - 1;
    expect(store.readSession(active)).toBeUndefined();
    const expires = store.createSession({ ...account, expiresAt: now + 100 }); now += 100;
    expect(store.readSession(expires)).toBeUndefined();
  });
  it('limits per-email attempts without global lockout or sliding windows', async () => {
    let now = 1000; const store = createSessionStore(() => now); const run = async () => true;
    for (let i = 0; i < 5; i++) expect((await store.attemptSignIn('one@fixture.invalid', run)).allowed).toBe(true);
    expect((await store.attemptSignIn('ONE@fixture.invalid', run)).allowed).toBe(false);
    expect((await store.attemptSignIn('two@fixture.invalid', run)).allowed).toBe(true);
    now += 5 * 60 * 1000;
    expect((await store.attemptSignIn('one@fixture.invalid', run)).allowed).toBe(true);
  });
  it('bounds concurrent/address state and releases failed work', async () => {
    const store = createSessionStore(); let release = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    const pending = Array.from({ length: 4 }, (_, i) => store.attemptSignIn(`${i}@fixture.invalid`, () => gate));
    expect((await store.attemptSignIn('extra@fixture.invalid', async () => true)).allowed).toBe(false);
    release(); await Promise.all(pending);
    await expect(store.attemptSignIn('throw@fixture.invalid', async () => { throw Error('synthetic'); })).rejects.toThrow('synthetic');
    expect((await store.attemptSignIn('after@fixture.invalid', async () => true)).allowed).toBe(true);
    for (let i = 4; i < 254; i++) await store.attemptSignIn(`${i}@fixture.invalid`, async () => true);
    expect((await store.attemptSignIn('overflow@fixture.invalid', async () => true)).allowed).toBe(true);
  });
});
