import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { strings } from '@dologram/shared';
import NotificationsScreen from '../../../app/notifications';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { loadNotificationPreferences } from '../preferences';
import { syncPushRegistration } from '../pushNotifications';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return Object.create(native, {
    Platform: { value: Object.create(native.Platform, { OS: { value: 'android' }, Version: { value: 35 } }) },
  });
});
jest.mock('expo-router', () => ({ useRouter: () => ({}) }));
jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ status: 'signedIn', session: { user: { id: 'settings-user' } } }) }));
jest.mock('../../components/Toast', () => {
  const showToast = jest.fn();
  return { useToast: () => ({ showToast }) };
});
jest.mock('../pushNotifications', () => ({
  getPushRegistration: () => 'failed',
  isNotificationRuntimeAvailable: true,
  subscribePushRegistration: () => () => {},
  syncPushRegistration: jest.fn(async () => {}),
}));

test('all five switches persist and the master switch disables the four options without clearing them', async () => {
  await AsyncStorage.clear();
  const screen = render(
    <SafeAreaProvider initialMetrics={{
      frame: { x: 0, y: 0, width: 400, height: 800 },
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    }}>
      <ThemeProvider><NotificationsScreen /></ThemeProvider>
    </SafeAreaProvider>,
  );
  const labels = strings.notifications;
  const master = () => screen.getByRole('switch', { name: labels.enabled });
  await waitFor(() => expect(master()).toBeChecked());
  for (const label of [labels.messagePreviews, labels.sounds, labels.vibration, labels.badges]) {
    const control = () => screen.getByRole('switch', { name: label });
    await waitFor(() => expect(control()).toBeEnabled());
    fireEvent.press(control());
    await waitFor(() => {
      if (label === labels.messagePreviews) expect(control()).toBeChecked();
      else expect(control()).not.toBeChecked();
    });
  }
  await waitFor(() => expect(master()).toBeEnabled());
  fireEvent.press(master());
  await waitFor(() => expect(master()).not.toBeChecked());
  expect(screen.getByRole('switch', { name: labels.messagePreviews })).toBeDisabled();
  expect(await loadNotificationPreferences('settings-user')).toEqual({
    enabled: false, messagePreviews: true, sounds: false, vibration: false, badges: false,
  });
  expect(screen.getByText(labels.syncFailed)).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: labels.retry }));
  expect(syncPushRegistration).toHaveBeenLastCalledWith('settings-user');
});
