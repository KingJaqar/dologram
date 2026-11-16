'use server';
import { parseSignIn } from '@dologram/admin-core';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { guardedAction } from '../../server/guards';
import { accountAuth } from '../../server/accountAuth';
import { recordAudit } from '../../server/auditLog';
import { sessionStore } from '../../server/session';
import { SESSION_COOKIE, sessionCookieOptions } from '../../server/requestPolicy';
import type { SignInState } from './state';

export async function signIn(_previous: SignInState, data: FormData): Promise<SignInState> {
  const result = await guardedAction('signIn', async () => {
    if (!(data instanceof FormData)) return { ok: false, message: 'Enter a valid username or email and password.' } as const;
    const parsed = parseSignIn(data);
    if (!parsed.success) return { ok: false, message: 'Enter a valid username or email and password (at most 1024 characters).' } as const;
    try {
      const attempt = await sessionStore.attemptSignIn(parsed.data.identifier,
        () => accountAuth().signIn(parsed.data.identifier, parsed.data.password));
      if (!attempt.allowed) {
        // The bounded sign-in limiter refused credentials that were never verified.
        await recordAudit({ action: 'session.lockout', actorUserId: null, result: 'failed', detail: {} });
        return { ok: false, message: 'Too many sign-in attempts. Try again in five minutes.' } as const;
      }
      if (!attempt.result.ok) return { ok: false, message: attempt.result.message } as const;
      const jar = await cookies();
      const old = jar.get(SESSION_COOKIE)?.value;
      if (old) sessionStore.destroySession(old);
      const id = sessionStore.createSession(attempt.result.account);
      try { jar.set(SESSION_COOKIE, id, sessionCookieOptions); }
      catch (error) { sessionStore.destroySession(id); throw error; }
      await recordAudit({ action: 'session.unlock', actorUserId: attempt.result.account.userId, result: 'success', detail: {} });
      return { ok: true } as const;
    } catch {
      return { ok: false, message: 'Sign in is unavailable. Check the backend connection and try again.' } as const;
    }
  });
  if (result.ok) redirect('/');
  return result;
}
