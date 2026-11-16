import { randomBytes, createHash } from 'node:crypto';
import type { AccountSession } from '@dologram/admin-core';

export const IDLE_MS = 8 * 3600 * 1000;
const WINDOW_MS = 5 * 60 * 1000;

/** Only the server holds tokens. A new process/version always starts empty. */
export function createSessionStore(now: () => number = () => Date.now()) {
  const sessions = new Map<string, { account: AccountSession; lastSeenMs: number }>();
  const attempts = new Map<string, { count: number; until: number }>();
  let pending = 0;
  function prune() {
    const time = now();
    for (const [id, session] of sessions) {
      if (time - session.lastSeenMs >= IDLE_MS || time < session.lastSeenMs || session.account.expiresAt <= time) sessions.delete(id);
    }
    for (const [key, attempt] of attempts) if (attempt.until <= time) attempts.delete(key);
  }
  function createSession(account: AccountSession) {
    prune();
    if (sessions.size >= 32) {
      const oldest = sessions.keys().next().value;
      if (oldest) sessions.delete(oldest);
    }
    const id = randomBytes(32).toString('base64url');
    sessions.set(id, { account: { ...account }, lastSeenMs: now() });
    return id;
  }
  function readSession(id: string | undefined, activity = false): AccountSession | undefined {
    prune();
    if (!id || !/^[A-Za-z0-9_-]{43}$/u.test(id)) return;
    const session = sessions.get(id);
    if (!session) return;
    if (activity) session.lastSeenMs = now();
    return { ...session.account };
  }
  async function attemptSignIn<T>(email: string, run: () => Promise<T>): Promise<{ allowed: true; result: T } | { allowed: false }> {
    prune();
    const key = createHash('sha256').update(email.toLowerCase()).digest('hex');
    const previous = attempts.get(key);
    if (pending >= 4 || (previous && previous.count >= 5)) return { allowed: false };
    // Saturating unknown addresses must not create a global account lockout.
    if (!previous && attempts.size >= 256) {
      const oldest = attempts.keys().next().value;
      if (oldest) attempts.delete(oldest);
    }
    attempts.set(key, { count: (previous?.count ?? 0) + 1, until: previous?.until ?? now() + WINDOW_MS });
    pending += 1;
    try { return { allowed: true, result: await run() }; }
    finally { pending -= 1; }
  }
  return { createSession, readSession, attemptSignIn,
    destroySession: (id: string) => { sessions.delete(id); } };
}
