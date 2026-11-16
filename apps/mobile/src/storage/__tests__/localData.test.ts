import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearLocalData } from '../localData';
import { recordSearchHistory, SEARCH_HISTORY_KEY_PREFIX } from '../../search/history';
import { CHAT_LIST_SNAPSHOT_PREFIX, recentRowsByUser } from '../../chatList/startupSnapshot';

const mockExecAsync = jest.fn(async () => undefined);
const mockListUnsent = jest.fn(async () => []);
const mockListSent = jest.fn(async () => []);
const mockDeleteAttachments = jest.fn(async () => undefined);
const mockStopQueueWorker = jest.fn();
const mockStopSync = jest.fn();

jest.mock('../../queue/db', () => ({ getLocalDatabase: jest.fn(async () => ({ execAsync: mockExecAsync })) }));
jest.mock('../../queue/store', () => ({
  createSqliteQueueStore: () => ({ listUnsent: mockListUnsent, listSent: mockListSent }),
}));
jest.mock('../../queue/attachmentFiles', () => ({
  deleteQueuedAttachmentFiles: () => mockDeleteAttachments(),
}));
jest.mock('../../queue/worker', () => ({ stopQueueWorker: () => mockStopQueueWorker() }));
jest.mock('../../queue/events', () => ({ notifyQueueChange: jest.fn() }));
jest.mock('../../sync/cacheEvents', () => ({ notifyCacheChange: jest.fn() }));
jest.mock('../../sync/lifecycle', () => ({ stopSync: () => mockStopSync() }));

const key = (userId: string) => `${SEARCH_HISTORY_KEY_PREFIX}${userId}`;
const payload = (id: string) => JSON.stringify({ version: 1, entries: [{ kind: 'person', id, selectedAt: 1 }] });
const flush = () => new Promise((resolve) => process.nextTick(resolve));

beforeEach(async () => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  await AsyncStorage.clear();
});

test('sign-out cleanup clears account search history and keeps device preferences', async () => {
  await AsyncStorage.setItem(key('me'), payload('one'));
  await AsyncStorage.setItem(key('other'), payload('two'));
  await AsyncStorage.setItem('dg.theme', 'dark');
  await AsyncStorage.setItem(CHAT_LIST_SNAPSHOT_PREFIX + 'me', '{}');

  await clearLocalData();

  expect(mockStopQueueWorker).toHaveBeenCalledTimes(1);
  expect(mockStopSync).toHaveBeenCalledTimes(1);
  expect(mockExecAsync).toHaveBeenCalledTimes(1);
  expect(await AsyncStorage.getItem(key('me'))).toBeNull();
  expect(await AsyncStorage.getItem(key('other'))).toBeNull();
  expect(await AsyncStorage.getItem('dg.theme')).toBe('dark');
  expect(await AsyncStorage.getItem(CHAT_LIST_SNAPSHOT_PREFIX + 'me')).toBeNull();
  expect(recentRowsByUser.size).toBe(0);
});

test('an in-flight history writer cannot restore entries after sign-out cleanup', async () => {
  let release!: () => void;
  jest.spyOn(AsyncStorage, 'setItem').mockImplementationOnce(
    () => new Promise<void>((resolve) => { release = resolve; }),
  );
  const write = recordSearchHistory('me', { kind: 'chat', id: 'chat', selectedAt: 2 });
  await flush();

  const cleanup = clearLocalData();
  release();
  await cleanup;
  await write.catch(() => undefined);

  expect(await AsyncStorage.getItem(key('me'))).toBeNull();
});

test('a failed cleanup keeps history recoverable and succeeds on retry', async () => {
  await AsyncStorage.setItem(key('me'), payload('one'));
  jest.spyOn(AsyncStorage, 'getAllKeys').mockRejectedValueOnce(new Error('storage unavailable'));

  await expect(clearLocalData()).rejects.toThrow('storage unavailable');
  expect(await AsyncStorage.getItem(key('me'))).not.toBeNull();

  await clearLocalData();
  expect(await AsyncStorage.getItem(key('me'))).toBeNull();
});
