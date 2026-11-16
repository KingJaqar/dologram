import AsyncStorage from '@react-native-async-storage/async-storage';

export type MemoReminderPreferences = { enabled: boolean; sounds: boolean; vibration: boolean };
const DEFAULTS: MemoReminderPreferences = { enabled: true, sounds: true, vibration: true };
const key = (accountId: string) => `dg.memo.reminder-preferences:${accountId}`;

function valid(value: unknown): value is MemoReminderPreferences {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.enabled === 'boolean' && typeof candidate.sounds === 'boolean' && typeof candidate.vibration === 'boolean';
}

export async function loadMemoReminderPreferences(accountId: string): Promise<MemoReminderPreferences> {
  const raw = await AsyncStorage.getItem(key(accountId));
  if (!raw) return DEFAULTS;
  try {
    const parsed: unknown = JSON.parse(raw);
    return valid(parsed) ? parsed : DEFAULTS;
  } catch { return DEFAULTS; }
}

export async function updateMemoReminderPreferences(accountId: string, next: Partial<MemoReminderPreferences>): Promise<MemoReminderPreferences> {
  const value = { ...(await loadMemoReminderPreferences(accountId)), ...next };
  if (!valid(value)) throw new Error('Memo reminder preferences are invalid.');
  await AsyncStorage.setItem(key(accountId), JSON.stringify(value));
  return value;
}
