import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { supabase } from '../../lib/supabase';
import { subscribeNetState } from '../../net/netState';
import {
  loadNotificationPreferences,
  updateNotificationPreferences,
} from '../preferences';
import { getPushRegistration, startPushNotifications, syncPushRegistration } from '../pushNotifications';

jest.mock('expo', () => ({
  isRunningInExpoGo: () => false,
  requireOptionalNativeModule: () => ({ getLastNotificationResponse: jest.fn(), clearLastNotificationResponse: jest.fn() }),
}));
jest.mock('expo-constants', () => ({ __esModule: true, default: { easConfig: { projectId: 'project' } } }));
jest.mock('react-native', () => Object.create(jest.requireActual('react-native'), {
  AppState: { value: { currentState: 'active', addEventListener: () => ({ remove: jest.fn() }) } },
  Platform: { value: { OS: 'android', Version: 35 } },
}));
jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  AndroidNotificationVisibility: { PRIVATE: 0 },
  addPushTokenListener: () => ({ remove: jest.fn() }),
  dismissAllNotificationsAsync: jest.fn(async () => {}),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[test]' })),
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getPresentedNotificationsAsync: jest.fn(async () => []),
  setBadgeCountAsync: jest.fn(async () => true),
  setNotificationChannelAsync: jest.fn(async () => ({})),
  setNotificationHandler: jest.fn(),
}));
jest.mock('../../lib/supabase', () => {
  const owner = jest.fn(async () => ({ error: null }));
  const token = jest.fn(() => ({ eq: owner }));
  const table = { upsert: jest.fn(async () => ({ error: null })), delete: jest.fn(() => ({ eq: token })) };
  return { supabase: { from: jest.fn(() => table) } };
});
jest.mock('../../net/netState', () => ({ subscribeNetState: jest.fn(() => () => {}) }));
jest.mock('../../queue/db', () => ({ getLocalDatabase: async () => ({ getFirstAsync: async () => ({ count: 4 }) }) }));

const USER = 'notification-user';
const STORAGE_KEY = `dg.notificationPreferences:${USER}`;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

test('legacy switches keep their values but never opt into sending message text', async () => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: true, messagePreviews: true, sounds: false }));
  expect(await loadNotificationPreferences(USER)).toMatchObject({ messagePreviews: false, sounds: false });
  await updateNotificationPreferences(USER, { messagePreviews: true });
  expect(await loadNotificationPreferences(USER)).toMatchObject({ messagePreviews: true, sounds: false });
});

test('registers the exact native channel and clears the badge and token when switched off', async () => {
  jest.useFakeTimers();
  const stop = startPushNotifications(USER);
  try {
    await updateNotificationPreferences(USER, { messagePreviews: true, sounds: false, vibration: true, badges: false });
    await syncPushRegistration(USER);
    expect(Notifications.setNotificationChannelAsync).toHaveBeenLastCalledWith('messages-v2-010', expect.objectContaining({
      sound: null, enableVibrate: true, vibrationPattern: [0, 250], showBadge: false,
    }));
    const tokens = jest.mocked(supabase.from).mock.results[0]?.value;
    expect(tokens.upsert).toHaveBeenLastCalledWith(expect.objectContaining({
      android_channel_id: 'messages-v2-010', preview_text: true, sounds: false, vibration: true, badges: false,
    }), { onConflict: 'token' });
    expect(getPushRegistration(USER)).toBe('registered');
    await jest.advanceTimersByTimeAsync(150);
    expect(Notifications.setBadgeCountAsync).toHaveBeenLastCalledWith(0);

    await updateNotificationPreferences(USER, { sounds: true, vibration: false, badges: true });
    await syncPushRegistration(USER);
    expect(Notifications.setNotificationChannelAsync).toHaveBeenLastCalledWith('messages-v2-101', expect.objectContaining({
      enableVibrate: false, showBadge: true,
    }));
    await jest.advanceTimersByTimeAsync(150);
    expect(Notifications.setBadgeCountAsync).toHaveBeenLastCalledWith(4);

    await updateNotificationPreferences(USER, { enabled: false });
    await syncPushRegistration(USER);
    expect(getPushRegistration(USER)).toBe('disabled');
    expect(tokens.delete).toHaveBeenCalled();
    expect(Notifications.dismissAllNotificationsAsync).toHaveBeenCalled();
    expect(await AsyncStorage.getItem(`dg.pushToken:${USER}`)).toBeNull();
  } finally {
    stop?.();
    jest.useRealTimers();
  }
});

test('keeps the saved master switch off while revocation is offline and retries on reconnect', async () => {
  const stop = startPushNotifications(USER);
  const notifyNetwork = jest.mocked(subscribeNetState).mock.calls[0]?.[0];
  try {
    await syncPushRegistration(USER);
    notifyNetwork?.({ isConnected: false, type: 'none', cellularGeneration: null });
    await updateNotificationPreferences(USER, { enabled: false });
    await syncPushRegistration(USER);
    expect(getPushRegistration(USER)).toBe('pending');
    expect((await loadNotificationPreferences(USER)).enabled).toBe(false);
    notifyNetwork?.({ isConnected: true, type: 'wifi', cellularGeneration: null });
    await syncPushRegistration(USER);
    expect(getPushRegistration(USER)).toBe('disabled');
  } finally {
    stop?.();
  }
});
