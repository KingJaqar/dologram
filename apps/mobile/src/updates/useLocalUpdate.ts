import { useCallback, useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect, useIsFocused } from 'expo-router';
import { hasLocalApkUpdateCapability } from '../../modules/local-apk-update';
import { useCall } from '../calls/useCall';
import { isTerminalCallStatus } from '../calls/state';
import { localUpdateController } from './localUpdate';

export function useLocalUpdate(accountId: string | null) {
  const [owner] = useState(() => Symbol('local-update-settings'));
  const { view, currentCall } = useCall();
  const focused = useIsFocused();
  const supported = Platform.OS === 'android' && hasLocalApkUpdateCapability();
  const callBlocked = (currentCall !== null && !isTerminalCallStatus(currentCall.status))
    || (view.phase !== 'idle' && view.phase !== 'ended' && view.phase !== 'unavailable');
  const state = useSyncExternalStore(localUpdateController.subscribe,
    localUpdateController.getSnapshot, localUpdateController.getSnapshot);

  useLayoutEffect(() => {
    if (supported) localUpdateController.observe(owner, { accountId, focused, callBlocked });
  }, [accountId, focused, callBlocked, owner, supported]);

  useFocusEffect(useCallback(() => {
    if (supported) void localUpdateController.enter();
  }, [supported]));

  useEffect(() => {
    if (!supported) return;
    const subscription = AppState.addEventListener('change', (next) => {
      localUpdateController.appState(owner, next === 'active');
    });
    return () => {
      subscription.remove();
      localUpdateController.detach(owner);
    };
  }, [owner, supported]);

  return {
    ...state, supported, callBlocked,
    select: (allFiles = false) => { void localUpdateController.select(owner, allFiles); },
    continue: () => { void localUpdateController.continue(owner); },
    openSettings: () => { void localUpdateController.openSettings(owner); },
    cancel: () => localUpdateController.cancel(owner),
  };
}
