import type { SessionController } from './session';

/** Set while database deletion stayed blocked after a logical wipe (D-109 (5)). */
export const retainedWipeKey = 'dg-browser-cleanup';
export const retainedWipeMessage = 'Your local records were cleared. Database deletion was blocked; close other DoloGram tabs to finish cleanup.';
const database = 'dologram';
const deadlineMs = 5000;

function retained(): boolean {
  try { return sessionStorage.getItem(retainedWipeKey) !== null; }
  catch { return false; }
}

/**
 * Startup finishes a blocked deletion before any owner is restored. Every owner row was already
 * logically cleared, so a record that stays blocked still prevents access to account data.
 */
export async function completePendingWipe(factory: IDBFactory | null = typeof indexedDB === 'undefined' ? null : indexedDB): Promise<'none' | 'cleared' | 'blocked'> {
  if (!factory || !retained()) return 'none';
  const outcome = await new Promise<'deleted' | 'blocked'>((resolve) => {
    const timer = setTimeout(() => resolve('blocked'), deadlineMs);
    const request = factory.deleteDatabase(database);
    request.onsuccess = () => { clearTimeout(timer); resolve('deleted'); };
    request.onerror = () => { clearTimeout(timer); resolve('blocked'); };
  });
  if (outcome === 'blocked') return 'blocked';
  try { sessionStorage.removeItem(retainedWipeKey); }
  catch { return 'blocked'; }
  return 'cleared';
}

/**
 * W-P09-S02 sign-out. The account store owns the wipe: its registered cleanup stops delivery and
 * sync under the signing-out epoch, clears this owner's rows, then deletes this browser's database.
 */
export function signOutAndWipe(controller: SessionController): Promise<void> {
  return controller.signOut();
}
