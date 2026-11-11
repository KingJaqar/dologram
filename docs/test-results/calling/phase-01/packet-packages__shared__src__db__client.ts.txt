import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from '@supabase/supabase-js';
import type { Database } from './database.types';

export type DgClient = SupabaseClient<Database>;

type GlobalOptions = NonNullable<SupabaseClientOptions<'public'>['global']>;

/** The injectable fetch the queue uses to simulate faults (M2-03). */
export type DgFetch = NonNullable<GlobalOptions['fetch']>;

/** The AsyncStorage surface supabase-js needs for the persisted session (M2-04). */
export type DgStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type CreateDgClientOptions = {
  url: string;
  key: string;
  storage: DgStorage;
  fetch?: DgFetch;
};

/**
 * Creates the single Supabase client. Configuration is checked before any request exists: a client
 * must never be built from a placeholder URL or an empty key (M0-10).
 */
export function createDgClient({ url, key, storage, fetch }: CreateDgClientOptions): DgClient {
  if (!url.startsWith('https://')) {
    throw new Error('createDgClient: url must start with https://');
  }
  if (key === '') {
    throw new Error('createDgClient: key must not be empty');
  }
  return createClient<Database>(url, key, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    global: { fetch },
  });
}
