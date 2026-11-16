import * as Crypto from 'expo-crypto';
import { secureStore } from './secureStore';
import { supabase } from '../lib/supabase';
import { isMemoScopeCurrent, memoScope, type MemoScope } from './lifecycle';
import { withMemoStore } from './vault';

type PinRecord = { version: 1; salt: string; verifier: string; failures: number; retryAt: number };
const service = 'dg.memo.pin.v1';
let authorizedGeneration: number | null = null;
const authorizedMemos = new Set<string>();
export function isMemoUnlocked(accountId: string, memoId: string): boolean {
  const scope = memoScope();
  if (!scope || scope.accountId !== accountId) return false;
  if (authorizedGeneration !== scope.generation) { authorizedMemos.clear(); authorizedGeneration = scope.generation; }
  return authorizedMemos.has(key(accountId, memoId));
}
export function lockMemo(accountId: string, memoId: string): void { authorizedMemos.delete(key(accountId, memoId)); }
function authorizeMemo(accountId: string, memoId: string): void {
  const scope = memoScope();
  if (!scope || scope.accountId !== accountId) return;
  isMemoUnlocked(accountId, memoId);
  authorizedMemos.add(key(accountId, memoId));
}

function key(accountId: string, memoId: string): string { return `memo-pin.${accountId}.${memoId}`; }
function hex(bytes: Uint8Array): string { return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join(''); }
async function digest(value: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}
function validatePin(pin: string): void {
  if (!/^\d{6}$/.test(pin)) throw new Error('PIN must contain exactly six digits.');
}
async function read(accountId: string, memoId: string): Promise<PinRecord | null> {
  const raw = await (await secureStore()).getItemAsync(key(accountId, memoId), { keychainService: service });
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('Memo protection needs recovery.');
  const record = value as Partial<PinRecord>;
  if (record.version !== 1 || typeof record.salt !== 'string' || typeof record.verifier !== 'string' || typeof record.failures !== 'number' || typeof record.retryAt !== 'number') throw new Error('Memo protection needs recovery.');
  return record as PinRecord;
}
export async function isMemoProtected(accountId: string, memoId: string): Promise<boolean> { return (await read(accountId, memoId)) !== null; }
export async function enrollMemoPin(accountId: string, memoId: string, pin: string, confirmation: string): Promise<void> {
  validatePin(pin); if (pin !== confirmation) throw new Error('PIN confirmation does not match.');
  const SecureStore = await secureStore();
  const salt = hex(await Crypto.getRandomBytesAsync(16));
  const verifier = await digest(`${salt}:${pin}`);
  await SecureStore.setItemAsync(key(accountId, memoId), JSON.stringify({ version: 1, salt, verifier, failures: 0, retryAt: 0 } satisfies PinRecord), { keychainService: service });
  const scope = memoScope();
  if (scope?.accountId === accountId) {
    await withMemoStore(scope, (store) => store.setProtectionRequired(memoId, true), true);
    authorizeMemo(accountId, memoId);
  }
}
export async function removeMemoPin(accountId: string, memoId: string, pin: string): Promise<void> {
  await verifyMemoPin(accountId, memoId, pin);
  const scope = memoScope();
  if (scope?.accountId === accountId) await withMemoStore(scope, (store) => store.setProtectionRequired(memoId, false), true);
  await (await secureStore()).deleteItemAsync(key(accountId, memoId), { keychainService: service });
}
export async function verifyMemoPin(accountId: string, memoId: string, pin: string): Promise<void> {
  const requestedScope = memoScope();
  validatePin(pin);
  const record = await read(accountId, memoId);
  if (!record) return;
  const SecureStore = await secureStore();
  if (record.retryAt > Date.now()) throw new Error(`Try again in ${Math.ceil((record.retryAt - Date.now()) / 1000)} seconds.`);
  if ((await digest(`${record.salt}:${pin}`)) === record.verifier) {
    if (record.failures !== 0 || record.retryAt !== 0) await SecureStore.setItemAsync(key(accountId, memoId), JSON.stringify({ ...record, failures: 0, retryAt: 0 }), { keychainService: service });
    if (requestedScope && !isMemoScopeCurrent(requestedScope)) throw new Error('Memo account changed.');
    authorizeMemo(accountId, memoId);
    return;
  }
  const failures = record.failures + 1;
  const delay = failures >= 5 ? Math.min(60_000, 1000 * 2 ** Math.min(failures - 5, 6)) : 0;
  await SecureStore.setItemAsync(key(accountId, memoId), JSON.stringify({ ...record, failures, retryAt: Date.now() + delay }), { keychainService: service });
  throw new Error('Incorrect PIN.');
}

async function resetDeviceNonce(accountId: string): Promise<string> {
  const Store = await secureStore();
  const storageKey = `memo-pin-reset-device.${accountId}`;
  const existing = await Store.getItemAsync(storageKey, { keychainService: service });
  if (existing && existing.length >= 16) return existing;
  const nonce = await Crypto.randomUUID();
  await Store.setItemAsync(storageKey, nonce, { keychainService: service });
  return nonce;
}

async function resetScope(accountId: string): Promise<MemoScope> {
  const scope = memoScope();
  if (!scope || scope.offline || scope.accountId !== accountId) throw new Error('Sign in to this memo account before requesting PIN recovery.');
  const session = await supabase.auth.getSession();
  if (session.error || session.data.session?.user.id !== accountId || !isMemoScopeCurrent(scope)) throw new Error('Memo recovery account changed. Sign in again.');
  return scope;
}

export async function requestMemoPinReset(accountId: string): Promise<{ challengeId: string; expiresAt: string }> {
  const scope = await resetScope(accountId);
  const deviceNonce = await resetDeviceNonce(accountId);
  const result = await supabase.functions.invoke('memo-pin-reset', { body: { action: 'request', device_nonce: deviceNonce }, timeout: 15_000 });
  if (!isMemoScopeCurrent(scope)) throw new Error('Memo recovery account changed.');
  if (result.error) throw result.error;
  const value: unknown = result.data;
  if (!value || typeof value !== 'object' || typeof (value as { challenge_id?: unknown }).challenge_id !== 'string' || typeof (value as { expires_at?: unknown }).expires_at !== 'string') throw new Error('Email PIN reset is unavailable.');
  return { challengeId: (value as { challenge_id: string }).challenge_id, expiresAt: (value as { expires_at: string }).expires_at };
}

export async function verifyMemoPinReset(accountId: string, memoId: string, challengeId: string, code: string): Promise<void> {
  const scope = await resetScope(accountId);
  if (!/^\d{6}$/.test(code)) throw new Error('Enter the six-digit reset code.');
  const deviceNonce = await resetDeviceNonce(accountId);
  const result = await supabase.functions.invoke('memo-pin-reset', { body: { action: 'verify', challenge_id: challengeId, device_nonce: deviceNonce, code }, timeout: 15_000 });
  if (result.error) throw result.error;
  const value: unknown = result.data;
  if (!value || typeof value !== 'object' || (value as { authorized?: unknown }).authorized !== true || !('account_id' in value) || value.account_id !== accountId || !('device_nonce' in value) || value.device_nonce !== deviceNonce || !isMemoScopeCurrent(scope)) throw new Error('PIN reset code is invalid, expired, or belongs to another account.');
  await (await secureStore()).deleteItemAsync(key(accountId, memoId), { keychainService: service });
}
