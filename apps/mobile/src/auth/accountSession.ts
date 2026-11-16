import type { Session } from '@supabase/supabase-js';
import { createAccountAuthClient, supabase } from '../lib/supabase';
import { withPushRegistrationPaused } from '../notifications/pushNotifications';
import type { AuthProfile } from './AuthProvider';
import { loadSavedAccounts, saveSessionAccount } from './savedAccounts';
import { stopCurrentCallForSessionChange } from '../calls/lifecycle';
import { pauseQueueForAccountSwitch } from '../queue/worker';
import { pauseSyncForAccountSwitch } from '../sync/lifecycle';
import { withMemoSessionChange } from '../memos/lifecycle';

export const ADD_ACCOUNT_PARAMS = { addAccount: '1' } as const;

export async function activateAccountSession(
  next: Session,
  currentUserId: string | undefined,
  profile: AuthProfile | null,
): Promise<void> {
  await saveSessionAccount(next, null);
  await withPushRegistrationPaused(currentUserId, async () => {
    await stopCurrentCallForSessionChange(currentUserId);
    const switching = next.user.id !== currentUserId;
    const resumeSync = switching ? pauseSyncForAccountSwitch() : undefined;
    const resumeQueue = switching ? await pauseQueueForAccountSwitch() : undefined;
    try {
      // Capture the outgoing session after delivery has finished, since it may have refreshed.
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (session?.user.id !== currentUserId) throw new Error('Current account changed');
      if (session) await saveSessionAccount(session, profile);

      const activate = async () => {
        const result = await supabase.auth.setSession(next);
        if (result.error || !result.data.session) throw result.error ?? new Error('Missing account session');
      };
      if (switching) await withMemoSessionChange(activate);
      else await activate();
    } catch (error) {
      resumeQueue?.();
      resumeSync?.();
      throw error;
    }
  });
}

export async function switchToSavedAccount(
  userId: string,
  currentUserId: string | undefined,
  profile: AuthProfile | null,
): Promise<void> {
  const account = (await loadSavedAccounts()).find((saved) => saved.userId === userId);
  if (!account) throw new Error('Saved account missing');

  const { data, error } = await createAccountAuthClient().auth.refreshSession({ refresh_token: account.refreshToken });
  if (error) throw error;
  if (data.session?.user.id !== userId) throw new Error('Saved account session does not match');

  // A refresh rotates the token. Keep the replacement even if activation fails.
  await activateAccountSession(data.session, currentUserId, profile);
}
