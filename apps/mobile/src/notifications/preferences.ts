import AsyncStorage from '@react-native-async-storage/async-storage';

export type NotificationPreferences = {
  enabled: boolean;
  messagePreviews: boolean;
  sounds: boolean;
  vibration: boolean;
  badges: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  messagePreviews: false,
  sounds: true,
  vibration: true,
  badges: true,
};

function storageKey(userId: string): string {
  return `dg.notificationPreferences:${userId}`;
}

function parsePreferences(value: string | null): NotificationPreferences {
  if (!value) return DEFAULT_NOTIFICATION_PREFERENCES;

  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_NOTIFICATION_PREFERENCES;
    const row = parsed as Partial<NotificationPreferences> & { version?: number };
    return {
      enabled: typeof row.enabled === 'boolean' ? row.enabled : DEFAULT_NOTIFICATION_PREFERENCES.enabled,
      // The legacy switch only enabled a generic body. Real text requires a new opt-in.
      messagePreviews: row.version === 2 && row.messagePreviews === true,
      sounds: typeof row.sounds === 'boolean' ? row.sounds : DEFAULT_NOTIFICATION_PREFERENCES.sounds,
      vibration: typeof row.vibration === 'boolean' ? row.vibration : DEFAULT_NOTIFICATION_PREFERENCES.vibration,
      badges: typeof row.badges === 'boolean' ? row.badges : DEFAULT_NOTIFICATION_PREFERENCES.badges,
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

export async function loadNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  return parsePreferences(await AsyncStorage.getItem(storageKey(userId)));
}

export async function saveNotificationPreferences(
  userId: string,
  preferences: NotificationPreferences,
): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify({ ...preferences, version: 2 }));
}

export async function updateNotificationPreferences(
  userId: string,
  patch: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const next = { ...(await loadNotificationPreferences(userId)), ...patch };
  await saveNotificationPreferences(userId, next);
  return next;
}
