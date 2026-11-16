'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { guardedAction } from '../../server/guards';
import { SESSION_COOKIE } from '../../server/requestPolicy';
import { sessionStore } from '../../server/session';

export async function signOut() {
  const result = await guardedAction('signOut', async () => {
    const jar = await cookies();
    const id = jar.get(SESSION_COOKIE)?.value;
    if (id) sessionStore.destroySession(id);
    jar.delete(SESSION_COOKIE);
    return { ok: true } as const;
  });
  if (result.ok) redirect('/sign-in');
  return result;
}
