import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { MemoStore, memoSchemaVersion, validateMemoId } from '@dologram/shared';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { Directory, File, Paths } from 'expo-file-system';
import { isMemoScopeCurrent, memoScope, registerMemoDrain, subscribeMemoScope, type MemoScope } from './lifecycle';
import { secureStore } from './secureStore';

type Binding = { version: 1; accountId: string; key: string; enrolled: boolean; passwordChangeRequired: boolean; initialized: boolean };
const registryKey = 'dg.memo.accounts.v1';
const keyOptions = { requireAuthentication: false, keychainService: 'dg.memo.v1' };
let serial: Promise<unknown> = Promise.resolve();
let opened: { accountId: string; db: SQLiteDatabase; store: MemoStore } | null = null;
const changeListeners = new Set<() => void>();
export function subscribeMemos(listener: () => void): () => void { changeListeners.add(listener); return () => { changeListeners.delete(listener); }; }
function notifyMemos(): void { changeListeners.forEach((listener) => listener()); }
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const work = serial.then(task);
  serial = work.catch(() => {});
  return work;
}
async function closeHandle(): Promise<void> {
  const previous = opened;
  if (previous) await previous.db.closeAsync();
  opened = null;
}
registerMemoDrain(() => enqueue(closeHandle));
subscribeMemoScope(() => { void enqueue(closeHandle).catch(() => { notifyMemos(); }); });

async function readBinding(accountId: string): Promise<Binding | null> {
  validateMemoId(accountId);
  const raw = await (await secureStore()).getItemAsync(`memo.${accountId}`, keyOptions);
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('Memo key needs recovery. Sign in again or restore a backup.');
  const binding = value as Partial<Binding>;
  if (binding.version !== 1 || binding.accountId !== accountId || typeof binding.key !== 'string' || !/^[a-f0-9]{64}$/.test(binding.key) || typeof binding.enrolled !== 'boolean' || typeof binding.passwordChangeRequired !== 'boolean' || typeof binding.initialized !== 'boolean') throw new Error('Memo key needs recovery. Existing data has been kept.');
  return binding as Binding;
}
async function writeBinding(binding: Binding): Promise<void> {
  await (await secureStore()).setItemAsync(`memo.${binding.accountId}`, JSON.stringify(binding), keyOptions);
}
async function accountIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(registryKey);
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || !value.every((id: unknown) => typeof id === 'string')) throw new Error('Memo account list needs recovery.');
  return value.map((id: string) => validateMemoId(id));
}
async function location(accountId: string) {
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, validateMemoId(accountId));
  const directory = new Directory(Paths.document, 'memos', hash);
  const file = new File(directory, 'vault.db');
  return { directory, file };
}
async function cipherSupport(): Promise<void> {
  const probe = await openDatabaseAsync(':memory:', { useNewConnection: true });
  try {
    const result = await probe.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version');
    if (!result?.cipher_version) throw new Error('Update DoloGram to use encrypted memos. No plaintext memo vault was created.');
  } finally { await probe.closeAsync(); }
}
/** Enrollment is called only from authenticated, password-compliant application state. */
export function enrollMemoAccount(accountId: string, passwordChangeRequired = false): Promise<void> {
  return enqueue(async () => {
    const existing = await readBinding(accountId);
    if (existing) {
      await writeBinding({ ...existing, enrolled: true, passwordChangeRequired });
    } else {
      if (passwordChangeRequired) return;
      await cipherSupport();
      const { directory } = await location(accountId);
      if (directory.exists) throw new Error('Memo key is missing. Existing vault has been kept for recovery.');
      const key = Array.from(await Crypto.getRandomBytesAsync(32), (byte) => byte.toString(16).padStart(2, '0')).join('');
      await writeBinding({ version: 1, accountId, key, enrolled: true, passwordChangeRequired: false, initialized: false });
    }
    const ids = await accountIds();
    if (!ids.includes(accountId)) await AsyncStorage.setItem(registryKey, JSON.stringify([...ids, accountId]));
  });
}
export function enrolledMemoAccounts(): Promise<string[]> {
  return enqueue(async () => {
    const result: string[] = [];
    for (const id of await accountIds()) {
      const binding = await readBinding(id);
      if (binding?.enrolled && !binding.passwordChangeRequired) result.push(id);
    }
    return result;
  });
}
export function authorizeOfflineMemo(accountId: string): Promise<void> {
  return enqueue(async () => {
    const binding = await readBinding(accountId);
    if (!binding?.enrolled || binding.passwordChangeRequired) throw new Error('Sign in to this account again before opening its memos.');
    await cipherSupport();
  });
}
/** Internal Phase 2 adapter: the keyed vault uses the same root key for memo asset envelopes. */
export function memoEncryptionKey(scope: MemoScope): Promise<string> {
  return enqueue(async () => {
    if (!isMemoScopeCurrent(scope)) throw new Error('Memo account changed.');
    const binding = await readBinding(scope.accountId);
    if (!binding?.enrolled || binding.passwordChangeRequired) throw new Error('Sign in again to use encrypted memo assets.');
    return binding.key;
  });
}
export function removeMemoAccount(accountId: string, erase: boolean): Promise<void> {
  return enqueue(async () => {
    await closeHandle();
    if (!(await accountIds()).includes(accountId)) return;
    const binding = await readBinding(accountId);
    // Disable local entry before removing files. Failure leaves a recoverable locked vault.
    if (binding) await writeBinding({ ...binding, enrolled: false });
    if (erase) {
      const { directory } = await location(accountId);
      if (directory.exists) directory.delete();
      await (await secureStore()).deleteItemAsync(`memo.${accountId}`, keyOptions);
    }
    await AsyncStorage.setItem(registryKey, JSON.stringify((await accountIds()).filter((id) => id !== accountId)));
    notifyMemos();
  });
}
async function open(scope: MemoScope): Promise<MemoStore> {
  if (opened?.accountId === scope.accountId) return opened.store;
  await closeHandle();
  const binding = await readBinding(scope.accountId);
  if (!binding?.enrolled || binding.passwordChangeRequired) throw new Error('Sign in again to enroll this memo vault. Existing data has been kept.');
  await cipherSupport();
  const { directory, file } = await location(scope.accountId);
  const existed = file.exists;
  directory.create({ intermediates: true, idempotent: true });
  const db = await openDatabaseAsync('vault.db', { useNewConnection: true }, directory.uri);
  try {
    // Only the validated random hex key enters this pragma; never log it.
    await db.execAsync(`PRAGMA key="x'${binding.key}'"`);
    const integrity = await db.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check');
    if (integrity?.integrity_check !== 'ok') throw new Error('Memo vault needs recovery. Existing data has been kept.');
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if (!version || version.user_version > memoSchemaVersion) throw new Error('Update DoloGram to open this memo vault. Existing data has been kept.');
    await db.execAsync('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA temp_store=MEMORY;');
    const store = new MemoStore(db, scope.accountId, () => Crypto.randomUUID());
    // A persisted enrollment records unfinished first initialization. Only a proven empty,
    // readable database may retry it; existing schema/data never receives an empty replacement.
    const empty = !binding.initialized && (await db.getAllAsync("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")).length === 0;
    await store.initialize(existed && !empty);
    if (!binding.initialized) await writeBinding({ ...binding, initialized: true });
    if (!isMemoScopeCurrent(scope)) throw new Error('Memo account changed.');
    opened = { accountId: scope.accountId, db, store };
    return store;
  } catch (error) { await db.closeAsync(); throw error; }
}
export function withMemoStore<T>(scope: MemoScope, work: (store: MemoStore) => Promise<T>, changed = false): Promise<T> {
  return enqueue(async () => {
    if (!isMemoScopeCurrent(scope)) throw new Error('Memo account changed.');
    const store = await open(scope);
    const result = await work(store);
    if (!isMemoScopeCurrent(scope)) throw new Error('Memo account changed.');
    if (changed) notifyMemos();
    return result;
  });
}
export function activeMemoScope(): MemoScope {
  const scope = memoScope();
  if (!scope) throw new Error('Choose an enrolled memo account first.');
  return scope;
}
