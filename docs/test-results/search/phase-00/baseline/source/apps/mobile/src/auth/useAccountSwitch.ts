import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { strings } from '@dologram/shared';
import { useAuth } from './AuthProvider';
import { readAuthError } from './authError';
import { ADD_ACCOUNT_PARAMS, switchToSavedAccount } from './accountSession';
import { shouldSkipAccountSwitchConfirmation, skipAccountSwitchConfirmation, type SavedAccount } from './savedAccounts';
import { actionToast } from '../notifications/toastCopy';
import { useToast } from '../components/Toast';

export function useAccountSwitch(onSwitched?: () => void) {
  const { session, profile } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [pendingAccount, setPendingAccount] = useState<SavedAccount | null>(null);
  const [switchingUserId, setSwitchingUserId] = useState<string | null>(null);
  const busy = useRef(false);
  const switching = useRef(false);

  async function performSwitch(account: SavedAccount, dontAskAgain = false) {
    if (switching.current) return;
    switching.current = true;
    setPendingAccount(null);
    setSwitchingUserId(account.userId);
    try {
      if (dontAskAgain) await skipAccountSwitchConfirmation();
      await switchToSavedAccount(account.userId, session?.user.id, profile);
      showToast(actionToast('switchAccount', 'success'));
      onSwitched?.();
      router.replace('/(main)/(tabs)');
    } catch (error) {
      const { code } = readAuthError(error);
      if (code === 'refresh_token_not_found' || code === 'refresh_token_already_used' || code === 'session_not_found' || code === 'session_expired') {
        onSwitched?.();
        showToast({ message: strings.manageAccounts.switchExpired, variant: 'error', placement: 'bottom' });
        router.push({ pathname: '/sign-in', params: { ...ADD_ACCOUNT_PARAMS, identifier: account.email ?? account.username ?? '' } });
      } else {
        showToast(actionToast('switchAccount', 'error'));
      }
    } finally {
      switching.current = false;
      busy.current = false;
      setSwitchingUserId(null);
    }
  }

  async function requestSwitch(account: SavedAccount) {
    if (busy.current) return;
    if (account.userId === session?.user.id) {
      onSwitched?.();
      router.replace('/(main)/(tabs)');
      return;
    }
    busy.current = true;
    const skip = await shouldSkipAccountSwitchConfirmation().catch(() => false);
    if (skip) {
      await performSwitch(account);
    } else {
      setPendingAccount(account);
    }
  }

  return {
    pendingAccount,
    switchingUserId,
    requestSwitch,
    confirmSwitch: (dontAskAgain: boolean) => {
      if (pendingAccount) void performSwitch(pendingAccount, dontAskAgain);
    },
    cancelSwitch: () => {
      setPendingAccount(null);
      busy.current = false;
    },
  };
}
