/**
 * Persisted Supabase client for the mobile app (M2-04, D-56).
 * Import react-native-url-polyfill/auto BEFORE anything else — supabase-js
 * requires it for RN URL resolution (D-100).
 */
import 'react-native-url-polyfill/auto';

import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@dologram/shared';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

let accountClientId = 0;

// Each attempt starts empty so reading a previous account cannot rotate its saved token.
export function createAccountAuthClient(): typeof supabase {
  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      storageKey: `dg.accountAuth.${accountClientId++}`,
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Session auto-refresh on Android (M2-04, D-85 item 11, Assumption A-09).
 * supabase-js cannot see the Android foreground state, so the app starts the
 * refresh timer while the app is active and stops it otherwise. Registered once:
 * this module is the single client and is imported once.
 */
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});
