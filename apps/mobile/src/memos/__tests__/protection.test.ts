import { requireOptionalNativeModule } from 'expo';
import { enrollMemoPin, isMemoProtected, removeMemoPin, requestMemoPinReset, verifyMemoPin, verifyMemoPinReset } from '../protection';
import { setMemoScope } from '../lifecycle';
import { supabase } from '../../lib/supabase';

jest.mock('../../lib/supabase', () => ({ supabase: { auth: { getSession: jest.fn() }, functions: { invoke: jest.fn() } } }));
jest.mock('../vault', () => ({ withMemoStore: jest.fn() }));

jest.mock('expo', () => ({ requireOptionalNativeModule: jest.fn(() => null) }));
jest.mock('expo-secure-store', () => {
  // Match the real package's import-time failure on an older installed binary.
  if (!jest.requireMock('expo').requireOptionalNativeModule('ExpoSecureStore')) {
    throw new Error("Cannot find native module 'ExpoSecureStore'");
  }
  return { getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() };
});
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  digestStringAsync: jest.fn(async (_algorithm: string, value: string) => `hash:${value}`),
  getRandomBytesAsync: jest.fn(async () => new Uint8Array(16).fill(17)),
  randomUUID: jest.fn(() => 'device-nonce-fixture-123'),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(requireOptionalNativeModule).mockReturnValue(null);
  setMemoScope(null);
});

test('email recovery rejects offline and wrong cloud accounts before invoking the service', async () => {
  setMemoScope('account', true);
  await expect(requestMemoPinReset('account')).rejects.toThrow('Sign in');
  setMemoScope('account');
  jest.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null });
  await expect(requestMemoPinReset('account')).rejects.toThrow('account changed');
  expect(supabase.functions.invoke).not.toHaveBeenCalled();
});

test('email recovery cannot remove a PIN after account teardown while verification is in flight', async () => {
  jest.mocked(requireOptionalNativeModule).mockReturnValue({});
  const storage: typeof import('expo-secure-store') = jest.requireMock('expo-secure-store');
  jest.mocked(storage.getItemAsync).mockResolvedValue('device-nonce-fixture-123');
  setMemoScope('account');
  // Only the identity is consumed; the auth adapter itself is outside this unit test.
  jest.mocked(supabase.auth.getSession).mockImplementation(async () => ({ data: { session: { user: { id: 'account' } } }, error: null }) as Awaited<ReturnType<typeof supabase.auth.getSession>>);
  jest.mocked(supabase.functions.invoke).mockImplementation(async () => {
    setMemoScope('another-account');
    return { data: { authorized: true, account_id: 'account', device_nonce: 'device-nonce-fixture-123' }, error: null };
  });
  await expect(verifyMemoPinReset('account', 'memo', 'challenge', '123456')).rejects.toThrow('another account');
  expect(storage.deleteItemAsync).not.toHaveBeenCalled();
});

test('PIN routes can import without SecureStore; all operations reject safely when unavailable', async () => {
  await expect(isMemoProtected('account', 'memo')).rejects.toThrow('Update DoloGram');
  await expect(enrollMemoPin('account', 'memo', '123456', '123456')).rejects.toThrow('Update DoloGram');
  await expect(verifyMemoPin('account', 'memo', '123456')).rejects.toThrow('Update DoloGram');
  await expect(removeMemoPin('account', 'memo', '123456')).rejects.toThrow('Update DoloGram');
});

test('available native storage preserves PIN enrollment, verification and removal', async () => {
  jest.mocked(requireOptionalNativeModule).mockReturnValue({});
  const storage: typeof import('expo-secure-store') = jest.requireMock('expo-secure-store');
  const records = new Map<string, string>();
  jest.mocked(storage.getItemAsync).mockImplementation(async (key) => records.get(key) ?? null);
  jest.mocked(storage.setItemAsync).mockImplementation(async (key, value) => { records.set(key, value); });
  jest.mocked(storage.deleteItemAsync).mockImplementation(async (key) => { records.delete(key); });

  expect(await isMemoProtected('account', 'memo')).toBe(false);
  await enrollMemoPin('account', 'memo', '123456', '123456');
  expect(await isMemoProtected('account', 'memo')).toBe(true);
  await expect(verifyMemoPin('account', 'memo', '654321')).rejects.toThrow('Incorrect PIN');
  await expect(removeMemoPin('account', 'memo', '654321')).rejects.toThrow('Incorrect PIN');
  expect(await isMemoProtected('account', 'memo')).toBe(true);
  await verifyMemoPin('account', 'memo', '123456');
  await removeMemoPin('account', 'memo', '123456');
  expect(await isMemoProtected('account', 'memo')).toBe(false);
});
