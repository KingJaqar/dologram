import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadBlockedChatIds, saveChatPreferences, DEFAULT_CHAT_PREFERENCES } from '../preferences';

beforeEach(async () => { await AsyncStorage.clear(); jest.clearAllMocks(); });

test('loads blocked state in one batch and scopes it to the account', async () => {
  await saveChatPreferences('me', 'blocked', { ...DEFAULT_CHAT_PREFERENCES, blocked: true });
  await saveChatPreferences('other', 'visible', { ...DEFAULT_CHAT_PREFERENCES, blocked: true });
  await AsyncStorage.setItem('dg.chatPreferences:me:corrupt', '{broken');
  const blocked = await loadBlockedChatIds('me', ['blocked', 'visible', 'missing', 'corrupt']);
  expect([...blocked]).toEqual(['blocked']);
  expect(AsyncStorage.multiGet).toHaveBeenCalledTimes(1);
});

test('an empty list requires no native storage read', async () => {
  expect(await loadBlockedChatIds('me', [])).toEqual(new Set());
  expect(AsyncStorage.multiGet).not.toHaveBeenCalled();
});
