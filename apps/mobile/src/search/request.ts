import { strings } from '@dologram/shared';

export class SearchFailure extends Error {
  constructor(public readonly kind: 'timeout' | 'cancelled' | 'unavailable' | 'invalid') {
    super(kind === 'timeout' ? strings.search.timeout : strings.search.unavailable);
    this.name = 'SearchFailure';
  }
}

export const SEARCH_DEADLINE_MS = 15_000;

const serializedSearchTails = new Map<string, Promise<void>>();

/**
 * Serializes the underlying cache read for a scope. AbortController prevents a stale
 * read from publishing, but SQLite/native promises may still settle after abort. Keeping
 * the actual loader promise in this queue prevents the next scan from overlapping it.
 */
export function readSerializedSearch<T>(
  key: string,
  read: () => Promise<T>,
  signal: AbortSignal,
  deadline: number,
): Promise<T> {
  const previous = serializedSearchTails.get(key) ?? Promise.resolve();
  let release: (() => void) | undefined;
  const slot = new Promise<void>((resolve) => { release = resolve; });
  serializedSearchTails.set(key, slot);

  return previous.catch(() => undefined).then(async () => {
    try {
      if (signal.aborted) throw new SearchFailure('cancelled');
      if (Date.now() >= deadline) throw new SearchFailure('timeout');
      return await read();
    } finally {
      release?.();
      if (serializedSearchTails.get(key) === slot) serializedSearchTails.delete(key);
    }
  });
}

/** Logical cancellation: late native settlements are observed but cannot publish results. */
export function readSearch<T>(read: () => Promise<T>, signal: AbortSignal, deadline: number): Promise<T> {
  if (signal.aborted) return Promise.reject(new SearchFailure('cancelled'));
  const remaining = deadline - Date.now();
  if (remaining <= 0) return Promise.reject(new SearchFailure('timeout'));
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', cancel); };
    const cancel = () => { cleanup(); reject(new SearchFailure('cancelled')); };
    const timer = setTimeout(() => { cleanup(); reject(new SearchFailure('timeout')); }, remaining);
    signal.addEventListener('abort', cancel, { once: true });
    Promise.resolve().then(() => {
      if (signal.aborted) throw new SearchFailure('cancelled');
      return read();
    }).then((value) => {
      cleanup();
      if (signal.aborted) reject(new SearchFailure('cancelled'));
      else if (Date.now() >= deadline) reject(new SearchFailure('timeout'));
      else resolve(value);
    }, (error: unknown) => { cleanup(); reject(error); });
  });
}
