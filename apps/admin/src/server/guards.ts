import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { actionPolicy } from './actionRegistry';
import { localRequestStatus, SESSION_COOKIE } from './requestPolicy';
import { sessionStore } from './session';
import { accountAuth } from './accountAuth';

export type AdminActor = { sessionId: string; userId: string };
export type ActionDenial = { ok: false; code: 'forbidden' | 'unauthorized'; message: string };
const forbidden: ActionDenial = { ok: false, code: 'forbidden', message: 'Request refused.' };
const unauthorized: ActionDenial = { ok: false, code: 'unauthorized', message: 'Admin access could not be verified. Sign in again or retry when the backend is available.' };

export async function assertLocalRequest(mutation = false): Promise<boolean> {
  return localRequestStatus(await headers(), mutation) === undefined;
}
export async function validSession(activity = false): Promise<AdminActor | undefined> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = sessionStore.readSession(id);
  if (!id || !account) return;
  try {
    if (!await accountAuth().currentAdmin(account)) {
      sessionStore.destroySession(id);
      return;
    }
    // A simultaneous sign-out or expiry must win over in-flight verification.
    if (!sessionStore.readSession(id, activity)) return;
    return { sessionId: id, userId: account.userId };
  } catch { return; }
}
export async function requirePageSession() {
  const h = await headers();
  const activity = h.get('sec-fetch-user') === '?1' && h.get('sec-fetch-mode') === 'navigate'
    && h.get('sec-fetch-dest') === 'document' && !h.has('rsc')
    && !h.has('next-router-prefetch') && h.get('purpose') !== 'prefetch';
  if (!await assertLocalRequest()) redirect('/sign-in');
  const actor = await validSession(activity);
  if (!actor) redirect('/sign-in?reason=access');
  return actor;
}
/** Polling is passive and validates the live identity/role every time. */
export async function requireApiSession(): Promise<Response | undefined> {
  const status = localRequestStatus(await headers(), false);
  if (status) return Response.json(forbidden, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!await validSession()) return Response.json(unauthorized, { status: 401, headers: { 'Cache-Control': 'no-store' } });
}
export async function guardedAction<T>(name: string, run: (actor: AdminActor | undefined) => Promise<T>): Promise<T | ActionDenial> {
  if (!await assertLocalRequest(true)) return forbidden;
  const policy = actionPolicy(name);
  if (!policy) return forbidden;
  if (policy === 'local-sign-out') {
    // No business privileges: the callback may only clear the presented local state.
    return run(undefined);
  }
  const actor = policy === 'session' ? await validSession(true) : undefined;
  if (policy === 'session' && !actor) return unauthorized;
  return run(actor);
}
