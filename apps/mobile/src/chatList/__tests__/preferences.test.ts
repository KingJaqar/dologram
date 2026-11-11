import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadChatListPreferences, setChatListPreference, updateChatListPreferences } from '../preferences';
import { subscribeCacheChange } from '../../sync/cacheEvents';

beforeEach(async () => { await AsyncStorage.clear(); });

test('upgrades existing pin/ignore preferences and isolates accounts', async () => {
  await AsyncStorage.setItem('dg.chatListPreferences', JSON.stringify({ alice: { pinned: ['a', 3], ignored: ['b'] } }));
  expect(await loadChatListPreferences('alice')).toEqual({ pinned: ['a'], ignored: ['b'], unread: [], deleted: [] });
  expect(await loadChatListPreferences('bob')).toEqual({ pinned: [], ignored: [], unread: [], deleted: [] });
});

test('concurrent changes preserve all accounts and notify mounted lists', async () => {
  const listener = jest.fn();
  const stop = subscribeCacheChange(listener);
  await Promise.all([
    setChatListPreference('alice', 'a', 'pinned', true),
    setChatListPreference('alice', 'b', 'ignored', true),
    setChatListPreference('bob', 'c', 'unread', true),
  ]);
  expect(await loadChatListPreferences('alice')).toEqual({ pinned: ['a'], ignored: ['b'], unread: [], deleted: [] });
  expect((await loadChatListPreferences('bob')).unread).toEqual(['c']);
  expect(listener).toHaveBeenCalledTimes(3);
  stop();
});

test('delete is distinct from ignore, and reopening clears only deletion and unread', async () => {
  await updateChatListPreferences('alice', 'a', { pinned: true, ignored: true, unread: true });
  await updateChatListPreferences('alice', 'a', { deleted: true, pinned: false, ignored: false, unread: false });
  expect(await loadChatListPreferences('alice')).toEqual({ pinned: [], ignored: [], unread: [], deleted: ['a'] });
  await updateChatListPreferences('alice', 'a', { deleted: false, unread: false });
  expect((await loadChatListPreferences('alice')).deleted).toEqual([]);
});

test('failed storage writes reject, preserve state, and allow the next action to retry', async () => {
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('storage failed'));
  await expect(setChatListPreference('alice', 'a', 'ignored', true)).rejects.toThrow('storage failed');
  expect((await loadChatListPreferences('alice')).ignored).toEqual([]);
  await setChatListPreference('alice', 'a', 'ignored', true);
  expect((await loadChatListPreferences('alice')).ignored).toEqual(['a']);
});

test('no-op read clearing does not notify and corrupt storage is recoverable', async () => {
  await AsyncStorage.setItem('dg.chatListPreferences', 'broken');
  const listener = jest.fn();
  const stop = subscribeCacheChange(listener);
  await setChatListPreference('alice', 'a', 'unread', false);
  expect(listener).not.toHaveBeenCalled();
  await setChatListPreference('alice', 'a', 'unread', true);
  expect((await loadChatListPreferences('alice')).unread).toEqual(['a']);
  stop();
});
