import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearSearchHistory,
  clearSearchHistoryStorage,
  loadSearchHistory,
  recordSearchHistory,
  removeSearchHistoryEntry,
  SEARCH_HISTORY_KEY_PREFIX,
  SearchHistoryTimeoutError,
} from '../history';

const entry = (id: string, kind: 'person' | 'chat' = 'person', selectedAt = Date.now()) => ({ kind, id, selectedAt });
const key = (userId: string) => `${SEARCH_HISTORY_KEY_PREFIX}${userId}`;
const flush = () => new Promise((resolve) => process.nextTick(resolve));

beforeEach(async () => {
  jest.restoreAllMocks();
  await clearSearchHistoryStorage();
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
});

test('isolates accounts, validates malformed entries, caps and deduplicates durable history', async () => {
  await AsyncStorage.setItem(`${SEARCH_HISTORY_KEY_PREFIX}other`, JSON.stringify({ version: 1, entries: [entry('foreign')] }));
  await AsyncStorage.setItem(`${SEARCH_HISTORY_KEY_PREFIX}me`, '{broken');
  expect(await loadSearchHistory('me')).toEqual({ entries: [], available: true });
  expect(await loadSearchHistory('other')).toMatchObject({ available: true, entries: [expect.objectContaining({ id: 'foreign' })] });

  for (let index = 0; index < 21; index++) await recordSearchHistory('me', entry(`person-${index}`, 'person', index + 1));
  await recordSearchHistory('me', entry('person-10', 'person', 100));
  const result = await loadSearchHistory('me');
  expect(result.entries).toHaveLength(20);
  expect(result.entries[0]).toMatchObject({ id: 'person-10', selectedAt: 100 });
  expect(result.entries.filter((item) => item.id === 'person-10')).toHaveLength(1);
  expect(await loadSearchHistory('other')).toMatchObject({ entries: [expect.objectContaining({ id: 'foreign' })] });
});

test('preserves an unsupported payload until explicit clear, then restores version one', async () => {
  await AsyncStorage.setItem(`${SEARCH_HISTORY_KEY_PREFIX}me`, JSON.stringify({ version: 9, entries: [entry('future')] }));
  expect(await loadSearchHistory('me')).toEqual({ entries: [], available: false });
  await expect(recordSearchHistory('me', entry('new'))).rejects.toThrow('unavailable');
  expect(await AsyncStorage.getItem(`${SEARCH_HISTORY_KEY_PREFIX}me`)).toContain('future');
  await clearSearchHistory('me');
  expect(await loadSearchHistory('me')).toEqual({ entries: [], available: true });
});

test('keeps the durable list after a failed write and succeeds on an explicit retry', async () => {
  const setItem = jest.spyOn(AsyncStorage, 'setItem');
  setItem.mockRejectedValueOnce(new Error('storage failed'));
  await expect(recordSearchHistory('me', entry('one'))).rejects.toThrow('storage failed');
  expect(await loadSearchHistory('me')).toEqual({ entries: [], available: true });
  await recordSearchHistory('me', entry('one'));
  expect(await loadSearchHistory('me')).toMatchObject({ entries: [expect.objectContaining({ id: 'one' })] });
  await removeSearchHistoryEntry('me', entry('one'));
  expect((await loadSearchHistory('me')).entries).toEqual([]);
});

test('sign-out cleanup removes only search history keys', async () => {
  await AsyncStorage.setItem(`${SEARCH_HISTORY_KEY_PREFIX}me`, JSON.stringify({ version: 1, entries: [entry('one')] }));
  await AsyncStorage.setItem('dg.theme', 'dark');
  await clearSearchHistoryStorage();
  expect(await AsyncStorage.getItem(`${SEARCH_HISTORY_KEY_PREFIX}me`)).toBeNull();
  expect(await AsyncStorage.getItem('dg.theme')).toBe('dark');
});

test('serializes concurrent record/remove/clear and keeps an explicit clear last', async () => {
  const first = recordSearchHistory('me', entry('one'));
  const second = recordSearchHistory('me', entry('two', 'chat'));
  const removed = removeSearchHistoryEntry('me', entry('one'));
  const cleared = clearSearchHistory('me');
  await Promise.all([first, second, removed, cleared]);
  expect((await loadSearchHistory('me')).entries).toEqual([]);

  await recordSearchHistory('me', entry('three'));
  expect((await loadSearchHistory('me')).entries).toMatchObject([{ id: 'three' }]);
});

test('a sign-out cleanup cannot be undone by an in-flight writer', async () => {
  let release!: () => void;
  jest.spyOn(AsyncStorage, 'setItem').mockImplementationOnce(
    () => new Promise<void>((resolve) => { release = resolve; }),
  );
  const write = recordSearchHistory('me', entry('one'));
  await flush();
  const cleanup = clearSearchHistoryStorage();
  release();
  await cleanup;
  await write.catch(() => undefined);
  expect(await AsyncStorage.getItem(key('me'))).toBeNull();
  expect(await loadSearchHistory('me')).toEqual({ entries: [], available: true });
});

test('a failed sign-out cleanup keeps history recoverable and can be retried', async () => {
  await recordSearchHistory('me', entry('one'));
  jest.spyOn(AsyncStorage, 'getAllKeys').mockRejectedValueOnce(new Error('storage unavailable'));
  await expect(clearSearchHistoryStorage()).rejects.toThrow('storage unavailable');
  expect((await loadSearchHistory('me')).entries).toMatchObject([{ id: 'one' }]);
  await clearSearchHistoryStorage();
  expect(await AsyncStorage.getItem(key('me'))).toBeNull();
});

test('reports a logical deadline while a late storage write still settles durably', async () => {
  jest.useFakeTimers();
  const store = AsyncStorage.setItem;
  let release!: () => void;
  jest.spyOn(AsyncStorage, 'setItem').mockImplementationOnce(async (storageKey, value) => {
    await new Promise<void>((resolve) => { release = resolve; });
    await store(storageKey, value);
  });
  const outcome = recordSearchHistory('me', entry('late')).then(
    () => 'resolved' as const,
    (error: unknown) => error,
  );
  await jest.advanceTimersByTimeAsync(0);
  await jest.advanceTimersByTimeAsync(15_001);
  expect(await outcome).toBeInstanceOf(SearchHistoryTimeoutError);
  release();
  await jest.advanceTimersByTimeAsync(0);
  expect(JSON.parse((await AsyncStorage.getItem(key('me'))) ?? '{}')).toMatchObject({
    version: 1,
    entries: [expect.objectContaining({ id: 'late' })],
  });
});
