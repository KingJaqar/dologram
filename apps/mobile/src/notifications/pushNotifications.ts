import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo';
import Constants from 'expo-constants';
import type { DevicePushToken, NotificationResponse } from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { subscribeNetState } from '../net/netState';
import { getLocalDatabase } from '../queue/db';
import { subscribeCacheChange } from '../sync/cacheEvents';
import { loadChatPreferences, subscribeAllChatPreferenceChanges } from '../chats/preferences';
import { loadNotificationPreferences, subscribeNotificationPreferenceChanges, type NotificationPreferences } from './preferences';
import type { MemoReminderMode } from '@dologram/shared';

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
let memoReminderPreferences = { enabled: true, sounds: true, vibration: true };

function hasGenericPreview(content: { title: string | null; body: string | null }): boolean {
  return content.title === 'DoloGram' && content.body === 'New message';
}

export function isCallNotificationContent(content: { data?: unknown }): boolean {
  const data = content.data;
  return typeof data === 'object' && data !== null
    && 'notification_type' in data && (data.notification_type === 'call_invite' || data.notification_type === 'call_ended')
    && 'call_id' in data && typeof data.call_id === 'string';
}

export function isCallInviteNotificationContent(content: { data?: unknown }): boolean {
  const data = content.data;
  return typeof data === 'object' && data !== null
    && 'notification_type' in data && data.notification_type === 'call_invite'
    && 'call_id' in data && typeof data.call_id === 'string';
}

export type MemoReminderNotificationData = {
  event_kind: 'memo_reminder'; account_id: string; memo_id: string; memo_generation: number | string;
  reminder_id: string; occurrence_id: string; mode: MemoReminderMode;
};

export function isMemoReminderData(data: unknown): data is MemoReminderNotificationData {
  if (typeof data !== 'object' || data === null) return false;
  const value = data as Record<string, unknown>;
  return value.event_kind === 'memo_reminder' && typeof value.account_id === 'string' && typeof value.memo_id === 'string'
    && ((typeof value.memo_generation === 'number' && Number.isSafeInteger(value.memo_generation)) || typeof value.memo_generation === 'string')
    && typeof value.reminder_id === 'string' && typeof value.occurrence_id === 'string'
    && (value.mode === 'regular' || value.mode === 'alarm');
}

export function isMemoReminderNotificationContent(content: { data?: unknown }): content is { data: MemoReminderNotificationData } {
  return isMemoReminderData(content.data);
}

export function subscribePushRegistration(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getPushRegistration(userId: string | undefined): RegistrationState {
  return registration.userId === userId ? registration.state : 'idle';
}
export function memoReminderPushToken(accountId: string): string | null {
  return registration.userId === accountId && registration.state === 'registered' ? expoToken : null;
}

function setRegistration(userId: string, state: RegistrationState): void {
  if (!isActive(userId)) return;
  registration = { userId, state };
  for (const listener of listeners) listener();
}

Notifications?.setNotificationHandler({
  handleNotification: async ({ request: { content, trigger } }) => {
    const memoReminderData = isMemoReminderData(content.data) ? content.data : null;
    if (memoReminderData) {
      const channel = trigger && 'type' in trigger && trigger.type !== 'push' && 'channelId' in trigger ? trigger.channelId : null;
      const canAlert = memoReminderPreferences.sounds || memoReminderPreferences.vibration;
      return {
        shouldShowBanner: memoReminderPreferences.enabled,
        shouldShowList: memoReminderPreferences.enabled,
        shouldPlaySound: memoReminderPreferences.enabled && canAlert && (channel === null || channel === memoReminderChannelId(memoReminderData.mode)),
        shouldSetBadge: false,
      };
    }
    const callNotification = isCallNotificationContent(content);
    const show = preferences?.enabled === true &&
      (callNotification || preferences.messagePreviews || hasGenericPreview(content));
    // On Android, Expo's foreground sound flag also gates vibration. Let the
    // matching channel apply them independently, and silence older pushes.
    const channel = trigger && 'type' in trigger && trigger.type === 'push'
      ? trigger.remoteMessage?.notification?.channelId
      : null;
    const canAlert = Platform.OS === 'android' && Number(Platform.Version) >= 26
      ? preferences !== null
        && channel === (callNotification ? callAndroidChannelId(preferences) : androidChannelId(preferences))
        && (!callNotification || isCallInviteNotificationContent(content))
        && (preferences.sounds || preferences.vibration)
      : preferences?.sounds === true && (!callNotification || isCallInviteNotificationContent(content));
    return {
      shouldShowBanner: show,
      shouldShowList: show,
      shouldPlaySound: show && canAlert,
      shouldSetBadge: !callNotification && show && preferences?.badges === true,
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

export function setMemoReminderPresentationPreferences(next: { enabled: boolean; sounds: boolean; vibration: boolean }): void {
  memoReminderPreferences = { ...next };
}

export function memoReminderChannelId(mode: MemoReminderMode): string {
  return mode === 'alarm' ? 'memo-reminders-alarm-v1' : 'memo-reminders-v1';
}

export async function prepareMemoReminderChannels(next = memoReminderPreferences): Promise<void> {
  if (!Notifications || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(memoReminderChannelId('regular'), {
    name: 'Memo reminders', importance: Notifications.AndroidImportance.HIGH,
    ...(next.sounds ? {} : { sound: null }), enableVibrate: next.vibration,
    ...(next.vibration ? { vibrationPattern: [0, 250, 250] } : {}), showBadge: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
  await Notifications.setNotificationChannelAsync(memoReminderChannelId('alarm'), {
    name: 'Memo alarms', importance: Notifications.AndroidImportance.MAX,
    ...(next.sounds ? {} : { sound: null }), enableVibrate: next.vibration,
    ...(next.vibration ? { vibrationPattern: [0, 500, 250, 500] } : {}), showBadge: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
}

export async function scheduleMemoReminderNotification(input: { data: MemoReminderNotificationData; at: number; mode: MemoReminderMode }): Promise<string> {
  if (!Notifications) throw new Error('Memo reminder notifications are unavailable in this app build.');
  await prepareMemoReminderChannels();
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'DoloGram reminder', body: input.mode === 'alarm' ? 'Memo alarm' : 'You have a memo reminder.',
      data: input.data, sound: memoReminderPreferences.sounds ? 'default' : false,
      ...(input.mode === 'alarm' ? { sticky: true, priority: 'max' } : {}),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: input.at, channelId: memoReminderChannelId(input.mode) },
  });
}

export async function cancelMemoReminderNotification(identifier: string | null): Promise<void> {
  if (!Notifications || !identifier) return;
  await Notifications.cancelScheduledNotificationAsync(identifier);
}

export async function getScheduledMemoReminderNotifications(): Promise<ReturnType<NonNullable<typeof Notifications>['getAllScheduledNotificationsAsync']> extends Promise<infer T> ? T : never> {
  if (!Notifications) return [] as never;
  return Notifications.getAllScheduledNotificationsAsync() as never;
}

function tokenStorageKey(userId: string): string {
  return `dg.pushToken:${userId}`;
}

function androidChannelId(next: NotificationPreferences): string {
  return `messages-v2-${Number(next.sounds)}${Number(next.vibration)}${Number(next.badges)}`;
}

export function callAndroidChannelId(next: NotificationPreferences): string {
  return `calls-v1-${Number(next.sounds)}${Number(next.vibration)}`;
}

async function prepareAndroidChannels(next: NotificationPreferences): Promise<{ message: string | null; calls: string | null }> {
  if (!Notifications || Platform.OS !== 'android') return { message: null, calls: null };
  // Android locks channel behavior at creation. Each combination has a stable ID.
  const messageChannelId = androidChannelId(next);
  const channel = await Notifications.setNotificationChannelAsync(messageChannelId, {
    name: ['Messages', next.sounds ? 'sound' : 'silent', next.vibration ? 'vibration' : null,
      next.badges ? 'badges' : null].filter(Boolean).join(' · '),
    importance: Notifications.AndroidImportance.DEFAULT,
    ...(next.sounds ? {} : { sound: null }),
    enableVibrate: next.vibration,
    ...(next.vibration ? { vibrationPattern: [0, 250] } : {}),
    showBadge: next.badges,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
  const callChannelId = callAndroidChannelId(next);
  const callChannel = await Notifications.setNotificationChannelAsync(callChannelId, {
    name: ['Calls', next.sounds ? 'sound' : 'silent', next.vibration ? 'vibration' : null,
    ].filter(Boolean).join(' · '),
    importance: Notifications.AndroidImportance.DEFAULT,
    ...(next.sounds ? {} : { sound: null }),
    enableVibrate: next.vibration,
    ...(next.vibration ? { vibrationPattern: [0, 250] } : {}),
    showBadge: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
  const silentCallChannelId = `calls-v1-0${Number(next.vibration)}`;
  if (silentCallChannelId !== callChannelId) {
    await Notifications.setNotificationChannelAsync(silentCallChannelId, {
      name: ['Calls', 'silent', next.vibration ? 'vibration' : null].filter(Boolean).join(' · '),
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
      enableVibrate: next.vibration,
      ...(next.vibration ? { vibrationPattern: [0, 250] } : {}),
      showBadge: false,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
  }
  // Android 7 has no channels to configure.
  return { message: channel ? messageChannelId : null, calls: callChannel ? callChannelId : null };
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
    LEFT JOIN pending_read_states pending ON pending.chat_id = member.chat_id AND pending.user_id = member.user_id
    JOIN cache_messages message ON message.chat_id = member.chat_id
       AND message.seq > MAX(
         COALESCE(member.confirmed_last_read_seq, 0),
         CASE WHEN pending.membership_joined_at = json_extract(member.payload, '$.joined_at')
              THEN COALESCE(pending.last_read_seq, 0) ELSE 0 END)
       AND message.sender_id <> member.user_id
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

async function syncCallDevicePreferences(
  userId: string,
  token: string,
  notificationPreferences: NotificationPreferences,
): Promise<void> {
  const db = await getLocalDatabase();
  const chats = await db.getAllAsync<{ chat_id: string }>(
    'SELECT chat_id FROM cache_chat_members WHERE user_id = ?',
    [userId],
  );
  const rows = await Promise.all(chats.map(async ({ chat_id: chatId }) => {
    const chat = await loadChatPreferences(userId, chatId);
    return {
      push_token: token,
      chat_id: chatId,
      enabled: notificationPreferences.enabled && chat.notifications,
      sounds: notificationPreferences.sounds && chat.sounds,
      blocked: chat.blocked,
      updated_at: new Date().toISOString(),
    };
  }));
  if (rows.length === 0 || !isActive(userId)) return;
  const { error } = await supabase.from('call_device_preferences').upsert(rows, { onConflict: 'push_token,chat_id' });
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
      const channels = await prepareAndroidChannels(next);
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
        android_channel_id: channels.message,
        call_notifications: next.enabled,
        call_android_channel_id: channels.calls,
      }, { onConflict: 'token' });
      if (error) throw error;
      await syncCallDevicePreferences(userId, token, next);
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
  const stopNotificationPreferences = subscribeNotificationPreferenceChanges(userId, () => {
    void syncPushRegistration(userId);
  });
  const stopChatPreferences = subscribeAllChatPreferenceChanges(userId, () => {
    void syncPushRegistration(userId);
  });
  void syncPushRegistration(userId, AppState.currentState === 'active' ? 'once' : 'never');
  return () => {
    stopNetwork();
    appState.remove();
    token.remove();
    stopCache();
    stopNotificationPreferences();
    stopChatPreferences();
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
