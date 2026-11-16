import { createDgClient, type DgClient, type DgFetch, type DgStorage } from '@dologram/shared';

type ProblemCode = 'configuration' | 'storage' | 'browser';
const messages: Record<ProblemCode, string> = {
  configuration: 'DoloGram could not load its connection settings. Check the public configuration and reload the page.',
  storage: 'DoloGram cannot access browser storage. Allow site storage or free some space, then try again. Your session has not been moved to temporary storage.',
  browser: 'Open DoloGram in a browser to connect.',
};

class BrowserClientError extends Error {
  constructor(readonly code: ProblemCode) {
    super(messages[code]);
    this.name = 'BrowserClientError';
  }
}

let problem: BrowserClientError | null = null;
const listeners = new Set<() => void>();
let client: DgClient | undefined;
let clientFetch: DgFetch | undefined;

function report(code: ProblemCode): BrowserClientError {
  const error = new BrowserClientError(code);
  if (problem?.code !== code) {
    problem = error;
    listeners.forEach((listener) => listener());
  }
  return error;
}

export const getBrowserClientProblem = () => problem;
export function subscribeBrowserClientProblem(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function storageOperation<T>(operation: (storage: Storage) => T): T {
  if (typeof window === 'undefined') throw new BrowserClientError('browser');
  try {
    return operation(window.localStorage);
  } catch {
    throw report('storage');
  }
}

/** No in-memory fallback: a failed session write must remain visible and recoverable. */
export const browserStorage: DgStorage = {
  async getItem(key) { return storageOperation((storage) => storage.getItem(key)); },
  async setItem(key, value) { storageOperation((storage) => storage.setItem(key, value)); },
  async removeItem(key) { storageOperation((storage) => storage.removeItem(key)); },
};

function checkStorage(): void {
  storageOperation((storage) => {
    const key = `dg.storage-check.${window.crypto.randomUUID()}`;
    try {
      storage.setItem(key, '1');
      if (storage.getItem(key) !== '1') throw new BrowserClientError('storage');
    } finally {
      storage.removeItem(key);
    }
  });
}

function publicConfiguration(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
        parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error();
    let publicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
    if (!publicKey && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) {
      const encoded = key.split('.')[1];
      if (!encoded) throw new Error();
      const payload: unknown = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')));
      publicKey = typeof payload === 'object' && payload !== null && 'role' in payload && payload.role === 'anon';
    }
    if (!publicKey) throw new Error();
    return { url: parsed.origin, key };
  } catch {
    throw report('configuration');
  }
}

/** Call from a browser event/effect only. The first caller may inject the transport. */
export function getSupabase(options: { fetch?: DgFetch } = {}): DgClient {
  if (typeof window === 'undefined') throw new BrowserClientError('browser');
  if (client) {
    if (options.fetch && options.fetch !== clientFetch) throw report('configuration');
    return client;
  }
  const configuration = publicConfiguration();
  checkStorage();
  clientFetch = options.fetch;
  client = createDgClient({ ...configuration, storage: browserStorage, fetch: clientFetch ?? deadlineFetch });
  return client;
}

/** Abort transport work itself, rather than allowing timed-out auth writes to finish later. */
const deadlineFetch: DgFetch = (input, init) => {
  const inherited = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const timeout = AbortSignal.timeout(10_000);
  const signal = inherited ? AbortSignal.any([inherited, timeout]) : timeout;
  return fetch(input, { ...init, signal });
};

export function retryBrowserClient(): void {
  getSupabase();
  checkStorage();
  problem = null;
  listeners.forEach((listener) => listener());
}
