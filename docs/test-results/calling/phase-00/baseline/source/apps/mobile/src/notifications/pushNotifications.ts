import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo';
import Constants from 'expo-constants';
import type { DevicePushToken, NotificationResponse } from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { subscribeNetState } from '../net/netState';
import { getLocalDatabase } from '../queue/db';
import { subscribeCacheChange } from '../sync/cacheEvents';
import { loadNotificationPreferences, type NotificationPreferences } from './preferences';

function loadNotifications(): typeof import('expo-notifications') | null {
  if ((Platform.OS !== 'android' && Platform.OS !== 'ios') || isRunningInExpoGo()) return null;
  if (!requireOptionalNativeModule('ExpoPushTokenManager')) return null;

  // An older client can lack the synchronous APIs used to replay and clear a tap on startup.
  const emitter = requireOptionalNativeModule<{
    getLastNotificationResponse?: () => NotificationResponse | null;
    clearLastNotificationResponse?: () => void;
  }>('ExpoNotificationsEmitter');
  if (typeof emitter?.getLastNotificationResponse !== 'function' ||
      typeof emitter.clearLastNotificationResponse !== 'function') return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Evaluate only after the native checks.
    return require('expo-notifications');
  } catch (error) {
    // The package also loads other native modules when it is imported.
    if (error instanceof Error && error.message.startsWith('Cannot find native module ')) return null;
    throw error;
  }
}

const Notifications = loadNotifications();
export const isNotificationRuntimeAvailable = Notifications !== null;
const PERMISSION_PROMPT_KEY = 'dg.notificationPermissionPrompted';

type RegistrationState = 'idle' | 'syncing' | 'registered' | 'disabled' | 'permission' | 'pending' | 'failed' | 'configuration';
let registration: { userId: string | null; state: RegistrationState } = { userId: null, state: 'idle' };
const listeners = new Set<() => void>();
let activeUserId: string | null = null;
let pausedUserId: string | null = null;
let preferences: NotificationPreferences | null = null;
let permissionGranted = false;
let expoToken: string | null = null;
let connected = true;
let queue: Promise<unknown> = Promise.resolve();
let badgeUpdate: ReturnType<typeof setTimeout> | undefined;

function hasGenericPreview(content: { title: string | null; body: string | null }): boolean {
  return content.title === 'DoloGram' && content.body === 'New message';
}

export function subscribePushRegistration(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getPushRegistration(userId: string | undefined): RegistrationState {
  return registration.userId === userId ? registration.state : 'idle';
}

function setRegistration(userId: string, state: RegistrationState): void {
  if (!isActive(userId)) return;
  registration = { userId, state };
  for (const listener of listeners) listener();
}

Notifications?.setNotificationHandler({
  handleNotification: async ({ request: { content, trigger } }) => {
    const show = preferences?.enabled === true &&
      (preferences.messagePreviews || hasGenericPreview(content));
    // On Android, Expo's foreground sound flag also gates vibration. Let the
    // matching channel apply them independently, and silence older pushes.
    const channel = trigger && 'type' in trigger && trigger.type === 'push'
      ? trigger.remoteMessage?.notification?.channelId
      : null;
    const canAlert = Platform.OS === 'android' && Number(Platform.Version) >= 26
      ? preferences !== null && channel === androidChannelId(preferences) && (preferences.sounds || preferences.vibration)
      : preferences?.sounds === true;
    return {
      shouldShowBanner: show,
      shouldShowList: show,
      shouldPlaySound: show && canAlert,
      shouldSetBadge: show && preferences?.badges === true,
    };
  },
});

export function subscribeNotificationResponses(listener: (response: NotificationResponse) => void) {
  const subscription = Notifications?.addNotificationResponseReceivedListener(listener);
  const lastResponse = Notifications?.getLastNotificationResponse();
  if (lastResponse) listener(lastResponse);
  return () => subscription?.remove();
}

export function clearNotificationResponse(): void {
  Notifications?.clearLastNotificationResponse();
}

function tokenStorageKey(userId: string): string {
  return `dg.pushToken:${userId}`;
}

function androidChannelId(next: NotificationPreferences): string {
  return `messages-v2-${Number(next.sounds)}${Number(next.vibration)}${Number(next.badges)}`;
}

async function prepareAndroidChannel(next: NotificationPreferences): Promise<string | null> {
  if (!Notifications || Platform.OS !== 'android') return null;
  // Android locks channel behavior at creation. Each combination has a stable ID.
  const channelId = androidChannelId(next);
  const channel = await Notifications.setNotificationChannelAsync(channelId, {
    name: ['Messages', next.sounds ? 'sound' : 'silent', next.vibration ? 'vibration' : null,
      next.badges ? 'badges' : null].filter(Boolean).join(' · '),
    importance: Notifications.AndroidImportance.DEFAULT,
    ...(next.sounds ? {} : { sound: null }),
    enableVibrate: next.vibration,
    ...(next.vibration ? { vibrationPattern: [0, 250] } : {}),
    showBadge: next.badges,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
  // Android 7 has no channels to configure.
  return channel ? channelId : null;
}

async function refreshBadge(userId: string): Promise<void> {
  if (!Notifications || !isActive(userId)) return;
  const snapshot = preferences;
  if (!snapshot?.enabled || !snapshot.badges || !permissionGranted) {
    await Notifications.setBadgeCountAsync(0);
    return;
  }
  const db = await getLocalDatabase();
  const row = await db.getFirstAsync<{ count: number }>(`
    SELECT COUNT(*) AS count
    FROM cache_chat_members member
    JOIN cache_messages message ON message.chat_id = member.chat_id
      AND message.seq > member.last_read_seq AND message.sender_id <> member.user_id
      AND message.deleted_at IS NULL
    WHERE member.user_id = ?`, [userId]);
  if (isActive(userId) && preferences === snapshot && permissionGranted) {
    await Notifications.setBadgeCountAsync(row?.count ?? 0);
  }
}

function scheduleBadgeUpdate(userId: string): void {
  clearTimeout(badgeUpdate);
  badgeUpdate = setTimeout(() => { void refreshBadge(userId).catch(() => {}); }, 150);
}

async function removeToken(userId: string, token: string): Promise<void> {
  const { error } = await supabase.from('push_tokens').delete().eq('token', token).eq('user_id', userId);
  if (error) throw error;
}

function enqueue(task: () => Promise<void>): Promise<void> {
  const operation = queue.then(task);
  queue = operation.catch(() => {});
  return operation;
}

async function unregister(userId: string): Promise<void> {
  const token = await AsyncStorage.getItem(tokenStorageKey(userId));
  if (!token) return;
  if (!connected) throw new Error('Push registration is offline');
  await removeToken(userId, token);
  await AsyncStorage.removeItem(tokenStorageKey(userId));
}

function isActive(userId: string): boolean {
  return activeUserId === userId && pausedUserId !== userId;
}

export function syncPushRegistration(
  userId: string,
  prompt: 'never' | 'once' | 'explicit' = 'never',
  devicePushToken?: DevicePushToken,
): Promise<void> {
  if (!Notifications || !isActive(userId)) return Promise.resolve();
  const notifications = Notifications;
  setRegistration(userId, 'syncing');
  return enqueue(async () => {
    if (!isActive(userId)) return;
    try {
      const next = await loadNotificationPreferences(userId);
      if (!isActive(userId)) return;
      const previous = preferences;
      preferences = next;
      if (!next.enabled || (Platform.OS === 'android' && !next.badges && previous?.badges !== false)) {
        await notifications.dismissAllNotificationsAsync().catch(() => {});
      } else if (!next.messagePreviews && previous?.messagePreviews !== false) {
        const shown = await notifications.getPresentedNotificationsAsync().catch(() => []);
        await Promise.allSettled(shown.filter(({ request: { content } }) =>
          typeof content.data?.chat_id === 'string' && !hasGenericPreview(content),
        ).map(({ request }) => notifications.dismissNotificationAsync(request.identifier)));
      }
      if (!next.enabled) {
        permissionGranted = false;
        scheduleBadgeUpdate(userId);
        await unregister(userId);
        setRegistration(userId, 'disabled');
        return;
      }

      // Android needs a channel before it can present the OS permission prompt.
      const channelId = await prepareAndroidChannel(next);
      let permission = await notifications.getPermissionsAsync();
      const shouldPrompt = prompt === 'explicit' ||
        (prompt === 'once' && !(await AsyncStorage.getItem(PERMISSION_PROMPT_KEY)));
      if (!permission.granted && permission.canAskAgain && shouldPrompt && isActive(userId)) {
        await AsyncStorage.setItem(PERMISSION_PROMPT_KEY, '1');
        permission = await notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
      }
      if (!isActive(userId)) return;
      permissionGranted = permission.granted ||
        permission.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL;
      scheduleBadgeUpdate(userId);
      if (!permissionGranted) {
        setRegistration(userId, 'permission');
        await unregister(userId).catch(() => {});
        return;
      }
      if (!connected) {
        setRegistration(userId, 'pending');
        return;
      }

      const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) throw new Error('Missing EAS project ID');
      const token = !devicePushToken && expoToken ? expoToken :
        (await notifications.getExpoPushTokenAsync({ projectId, devicePushToken })).data;
      if (!isActive(userId)) return;
      const key = tokenStorageKey(userId);
      const previousToken = await AsyncStorage.getItem(key);
      if (previousToken && previousToken !== token) await removeToken(userId, previousToken);
      // Keep the token available for revocation even if the request succeeds after a network error.
      await AsyncStorage.setItem(key, token);
      if (!isActive(userId)) return;
      const { error } = await supabase.from('push_tokens').upsert({
        token,
        user_id: userId,
        last_seen_at: new Date().toISOString(),
        message_previews: next.messagePreviews,
        preview_text: next.messagePreviews,
        sounds: next.sounds,
        vibration: next.vibration,
        badges: next.badges,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        android_channel_id: channelId,
      }, { onConflict: 'token' });
      if (error) throw error;
      if (isActive(userId)) expoToken = token;
      setRegistration(userId, 'registered');
    } catch (error) {
      const firebaseMissing = error instanceof Error && error.message.includes('Unable to get Firebase Messaging instance');
      setRegistration(userId, firebaseMissing ? 'configuration' : connected ? 'failed' : 'pending');
    }
  });
}

export function startPushNotifications(userId: string): (() => void) | undefined {
  if (!Notifications) return;
  activeUserId = userId;
  pausedUserId = null;
  let firstConnection = true;
  const stopNetwork = subscribeNetState((state) => {
    const reconnected = state.isConnected && !connected;
    connected = state.isConnected;
    if (!firstConnection && reconnected && AppState.currentState === 'active') {
      void syncPushRegistration(userId);
    }
    firstConnection = false;
  });
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') void syncPushRegistration(userId, 'once');
  });
  const token = Notifications.addPushTokenListener((deviceToken) => {
    void syncPushRegistration(userId, 'never', deviceToken);
  });
  const stopCache = subscribeCacheChange(() => scheduleBadgeUpdate(userId));
  void syncPushRegistration(userId, AppState.currentState === 'active' ? 'once' : 'never');
  return () => {
    stopNetwork();
    appState.remove();
    token.remove();
    stopCache();
    clearTimeout(badgeUpdate);
    activeUserId = null;
    preferences = null;
    permissionGranted = false;
    expoToken = null;
  };
}

/** Stop registering the old account and revoke its token while its session still owns the row. */
export async function withPushRegistrationPaused<T>(userId: string | undefined, changeAccount: () => Promise<T>): Promise<T> {
  if (!Notifications || !userId || !isActive(userId)) return changeAccount();
  const notifications = Notifications;
  pausedUserId = userId;
  preferences = null;
  clearTimeout(badgeUpdate);
  try {
    await enqueue(async () => {
      notifications.clearLastNotificationResponse();
      await Promise.allSettled([
        notifications.dismissAllNotificationsAsync(),
        notifications.setBadgeCountAsync(0),
        unregister(userId),
      ]);
    });
    return await changeAccount();
  } catch (error) {
    if (pausedUserId === userId) pausedUserId = null;
    void syncPushRegistration(userId);
    throw error;
  }
}
