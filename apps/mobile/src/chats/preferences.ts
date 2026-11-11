import AsyncStorage from '@react-native-async-storage/async-storage';

export type ChatThemeName = 'default' | 'ocean' | 'mint' | 'sunset' | 'violet';

export type ChatPreferences = {
  nickname: string;
  theme: ChatThemeName;
  emoji: string;
  notifications: boolean;
  sounds: boolean;
  blocked: boolean;
};

export const CHAT_THEME_OPTIONS: readonly {
  id: ChatThemeName;
  label: string;
  color: string;
}[] = [
  { id: 'default', label: 'Default', color: '#EDE8D0' },
  { id: 'ocean', label: 'Ocean', color: '#168AAD' },
  { id: 'mint', label: 'Mint', color: '#2A9D8F' },
  { id: 'sunset', label: 'Sunset', color: '#E76F51' },
  { id: 'violet', label: 'Violet', color: '#9B5DE5' },
];

export const CHAT_EMOJI_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🔥', '✨'] as const;

export const DEFAULT_CHAT_PREFERENCES: ChatPreferences = {
  nickname: '',
  theme: 'default',
  emoji: '👍',
  notifications: true,
  sounds: true,
  blocked: false,
};

export const PINNED_MESSAGES_KEY = 'dg.pinnedMessages';

function storageKey(userId: string, chatId: string): string {
  return `dg.chatPreferences:${userId}:${chatId}`;
}

function isTheme(value: unknown): value is ChatThemeName {
  return CHAT_THEME_OPTIONS.some((option) => option.id === value);
}

function parsePreferences(value: string | null): ChatPreferences {
  if (!value) return DEFAULT_CHAT_PREFERENCES;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_CHAT_PREFERENCES;
    const row = parsed as Partial<ChatPreferences>;
    return {
      nickname: typeof row.nickname === 'string' ? row.nickname : DEFAULT_CHAT_PREFERENCES.nickname,
      theme: isTheme(row.theme) ? row.theme : DEFAULT_CHAT_PREFERENCES.theme,
      emoji: typeof row.emoji === 'string' && row.emoji.length > 0 ? row.emoji : DEFAULT_CHAT_PREFERENCES.emoji,
      notifications: typeof row.notifications === 'boolean' ? row.notifications : DEFAULT_CHAT_PREFERENCES.notifications,
      sounds: typeof row.sounds === 'boolean' ? row.sounds : DEFAULT_CHAT_PREFERENCES.sounds,
      blocked: typeof row.blocked === 'boolean' ? row.blocked : DEFAULT_CHAT_PREFERENCES.blocked,
    };
  } catch {
    return DEFAULT_CHAT_PREFERENCES;
  }
}

export async function loadChatPreferences(userId: string, chatId: string): Promise<ChatPreferences> {
  return parsePreferences(await AsyncStorage.getItem(storageKey(userId, chatId)));
}

export async function saveChatPreferences(
  userId: string,
  chatId: string,
  preferences: ChatPreferences,
): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId, chatId), JSON.stringify(preferences));
}

const preferenceWrites = new Map<string, Promise<unknown>>();
const preferenceListeners = new Map<string, Set<() => void>>();

function notifyPreferenceChange(userId: string, chatId: string): void {
  preferenceListeners.get(storageKey(userId, chatId))?.forEach((listener) => listener());
}

export function subscribeChatPreferenceChanges(userId: string, chatId: string, listener: () => void): () => void {
  const key = storageKey(userId, chatId);
  const listeners = preferenceListeners.get(key) ?? new Set<() => void>();
  listeners.add(listener);
  preferenceListeners.set(key, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) preferenceListeners.delete(key);
  };
}

export async function updateChatPreferences(
  userId: string,
  chatId: string,
  patch: Partial<ChatPreferences>,
): Promise<ChatPreferences> {
  const key = storageKey(userId, chatId);
  const operation = (preferenceWrites.get(key) ?? Promise.resolve()).catch(() => undefined).then(async () => {
    const next = { ...parsePreferences(await AsyncStorage.getItem(key)), ...patch };
    await saveChatPreferences(userId, chatId, next);
    notifyPreferenceChange(userId, chatId);
    return next;
  });
  preferenceWrites.set(key, operation);
  try { return await operation; }
  finally { if (preferenceWrites.get(key) === operation) preferenceWrites.delete(key); }
}

export async function clearChatPreferences(userId: string, chatId: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(userId, chatId));
  notifyPreferenceChange(userId, chatId);
}

export async function loadPinnedMessageIds(userId: string): Promise<Set<string>> {
  const value = await AsyncStorage.getItem(`${PINNED_MESSAGES_KEY}:${userId}`);
  if (!value) return new Set();
  try {
    const parsed: unknown = JSON.parse(value);
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

export async function savePinnedMessageIds(userId: string, ids: Iterable<string>): Promise<void> {
  await AsyncStorage.setItem(`${PINNED_MESSAGES_KEY}:${userId}`, JSON.stringify([...ids]));
}
