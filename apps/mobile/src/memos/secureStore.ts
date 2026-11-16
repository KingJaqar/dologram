import { requireOptionalNativeModule } from 'expo';

/** Keep routes loadable on older binaries without weakening memo storage. */
export async function secureStore(): Promise<typeof import('expo-secure-store')> {
  if (!requireOptionalNativeModule('ExpoSecureStore')) {
    throw new Error('Update DoloGram to use encrypted memos. Your existing memos have been kept.');
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- The package throws on import when its native module is missing.
  return require('expo-secure-store');
}
