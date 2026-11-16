import AsyncStorage from '@react-native-async-storage/async-storage';
import { memoSchemaVersion } from '@dologram/shared';
import { requireOptionalNativeModule } from 'expo';
import * as SecureStore from 'expo-secure-store';
import { openDatabaseAsync } from 'expo-sqlite';
import { closeMemoSession, isMemoScopeCurrent, memoScope, registerMemoFlush, setMemoScope, withMemoSessionChange } from '../lifecycle';
import { activeMemoScope, authorizeOfflineMemo, enrollMemoAccount, enrolledMemoAccounts, removeMemoAccount, withMemoStore } from '../vault';

const account = '00000000-0000-4000-8000-000000000001';
const second = '00000000-0000-4000-8000-000000000002';
const mockFiles = { directory: false, file: false, deleted: false };
jest.mock('expo', () => ({ requireOptionalNativeModule: jest.fn(() => ({})) }));
jest.mock('expo-crypto', () => ({ CryptoDigestAlgorithm: { SHA256: 'SHA256' }, digestStringAsync: jest.fn(async (algorithm: string, id: string) => id.replaceAll('-', '')), getRandomBytesAsync: jest.fn(async () => new Uint8Array(32).fill(17)) }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({
  Paths: { document: 'file:///private/files' },
  Directory: class {
    uri = 'file:///private/files/memos/opaque';
    get exists() { return mockFiles.directory; }
    create() { mockFiles.directory = true; }
    delete() { mockFiles.deleted = true; mockFiles.directory = false; mockFiles.file = false; }
  },
  File: class { get exists() { return mockFiles.file; } },
}));
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
const keys = new Map<string, string>();
const calls: string[] = [];
let cipher = true;
let wrongKey = false;
let schemaVersion = 1;
let hold: Promise<void> | null = null;
const database = {
  closeAsync: jest.fn(async () => { calls.push('close'); }),
  execAsync: jest.fn(async (sql: string) => { calls.push(sql.startsWith('PRAGMA key=') ? 'key' : sql); }),
  getFirstAsync: jest.fn(async (sql: string) => {
    calls.push(sql);
    if (sql === 'PRAGMA cipher_version') return cipher ? { cipher_version: '4.7.0' } : null;
    if (sql === 'PRAGMA integrity_check') { if (wrongKey) throw new Error('file is not a database'); return { integrity_check: 'ok' }; }
    if (sql === 'PRAGMA user_version') return { user_version: schemaVersion };
    if (sql === 'SELECT account_id FROM vault_identity') return { account_id: account };
    return null;
  }),
  getAllAsync: jest.fn(async () => { if (hold) await hold; return []; }),
  runAsync: jest.fn(async () => ({})),
  withTransactionAsync: jest.fn(async (task: () => Promise<void>) => task()),
};
beforeEach(async () => {
  setMemoScope(null); await closeMemoSession();
  keys.clear(); await AsyncStorage.clear();
  cipher = true; wrongKey = false; schemaVersion = 1; hold = null;
  mockFiles.directory = false; mockFiles.file = false; mockFiles.deleted = false;
  jest.clearAllMocks(); calls.length = 0;
  jest.mocked(requireOptionalNativeModule).mockReturnValue({});
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key) => keys.get(key) ?? null);
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => { keys.set(key, value); });
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key) => { keys.delete(key); });
  jest.mocked(openDatabaseAsync).mockImplementation(async (name) => { calls.push(`open:${name}`); if (name !== ':memory:') mockFiles.file = true; return database as unknown as Awaited<ReturnType<typeof openDatabaseAsync>>; });
});
afterEach(async () => { hold = null; setMemoScope(null); await closeMemoSession(); });

test('older clients without SecureStore or SQLCipher fail closed before file creation', async () => {
  jest.mocked(requireOptionalNativeModule).mockReturnValue(null);
  await expect(enrollMemoAccount(account)).rejects.toThrow('Update');
  expect(openDatabaseAsync).not.toHaveBeenCalled();
  jest.mocked(requireOptionalNativeModule).mockReturnValue({}); cipher = false;
  await expect(enrollMemoAccount(account)).rejects.toThrow('plaintext');
  expect(mockFiles.file).toBe(false); expect(keys.size).toBe(0);
});
test('enrollment persists a protected binding; offline auth does not create a cloud session', async () => {
  await enrollMemoAccount(account);
  expect(await enrolledMemoAccounts()).toEqual([account]);
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(`memo.${account}`, expect.any(String), expect.objectContaining({ requireAuthentication: false }));
  await authorizeOfflineMemo(account); setMemoScope(account, true);
  expect(memoScope()).toMatchObject({ accountId: account, offline: true });
  expect(mockFiles.file).toBe(false);
});
test('missing key with existing files never creates a replacement key or deletes originals', async () => {
  mockFiles.directory = true; mockFiles.file = true;
  await expect(enrollMemoAccount(account)).rejects.toThrow('key is missing');
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled(); expect(mockFiles.deleted).toBe(false);
});
test('key is applied before integrity/schema reads; wrong key and newer schemas are preserved', async () => {
  await enrollMemoAccount(account); setMemoScope(account);
  const scope = activeMemoScope(); wrongKey = true;
  await expect(withMemoStore(scope, (store) => store.list())).rejects.toThrow('not a database');
  expect(calls.indexOf('key')).toBeLessThan(calls.indexOf('PRAGMA integrity_check'));
  expect(calls.some((sql) => sql.startsWith('CREATE TABLE'))).toBe(false); expect(mockFiles.deleted).toBe(false);
  wrongKey = false; schemaVersion = memoSchemaVersion + 1; calls.length = 0;
  await expect(withMemoStore(scope, (store) => store.list())).rejects.toThrow('Update');
  expect(calls.some((sql) => sql.includes('journal_mode'))).toBe(false);
});
test('serializes reads, rejects queued stale generations, and drains before account teardown', async () => {
  await enrollMemoAccount(account); setMemoScope(account);
  const scope = activeMemoScope();
  await withMemoStore(scope, async () => undefined);
  let release: () => void = () => {};
  const barrier = new Promise<void>((resolve) => { release = resolve; });
  let entered = false;
  const first = withMemoStore(scope, async () => { entered = true; await barrier; return 1; });
  await Promise.resolve(); await Promise.resolve();
  expect(entered).toBe(true);
  const queuedWork = jest.fn(async () => 2);
  const next = withMemoStore(scope, queuedWork);
  const firstCheck = expect(first).rejects.toThrow('changed');
  const nextCheck = expect(next).rejects.toThrow('changed');
  setMemoScope(second); release();
  await Promise.all([firstCheck, nextCheck]);
  expect(queuedWork).not.toHaveBeenCalled(); expect(isMemoScopeCurrent(scope)).toBe(false);
});
test('a failed draft flush blocks user-driven session changes', async () => {
  setMemoScope(account);
  const unregister = registerMemoFlush(async () => { throw new Error('disk full'); });
  try { await expect(closeMemoSession()).rejects.toThrow('disk full'); expect(memoScope()?.accountId).toBe(account); }
  finally { unregister(); }
  await closeMemoSession(); expect(memoScope()).toBeNull();
});
test('failed auth changes resume only the outgoing local identity and cannot overwrite a newer account', async () => {
  setMemoScope(account);
  await expect(withMemoSessionChange(async () => { throw new Error('cloud failed'); })).rejects.toThrow('cloud failed');
  expect(memoScope()?.accountId).toBe(account);
  await expect(withMemoSessionChange(async () => { setMemoScope(second); throw new Error('late cloud failure'); })).rejects.toThrow();
  expect(memoScope()?.accountId).toBe(second);
});
test('password-change requirements and removal disable offline entry; retain and erase are distinct', async () => {
  await enrollMemoAccount(account);
  await enrollMemoAccount(account, true);
  expect(await enrolledMemoAccounts()).toEqual([]);
  await expect(authorizeOfflineMemo(account)).rejects.toThrow('Sign in');
  await enrollMemoAccount(account, false);
  const before = keys.get(`memo.${account}`);
  await removeMemoAccount(account, false);
  expect(mockFiles.deleted).toBe(false); expect(keys.has(`memo.${account}`)).toBe(true);
  await expect(authorizeOfflineMemo(account)).rejects.toThrow('Sign in');
  await enrollMemoAccount(account);
  expect(JSON.parse(keys.get(`memo.${account}`) ?? '{}').key).toBe(JSON.parse(before ?? '{}').key);
  await removeMemoAccount(account, true);
  expect(keys.has(`memo.${account}`)).toBe(false); expect(await enrolledMemoAccounts()).toEqual([]);
});
