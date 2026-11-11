import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

export const SEARCH_HISTORY_KEY_PREFIX = 'dg.searchHistory:';
const HISTORY_VERSION = 1;
const MAX_HISTORY_ENTRIES = 20;
const HISTORY_DEADLINE_MS = 15_000;

export type SearchHistoryEntry = {
  kind: 'person' | 'chat';
  id: string;
  selectedAt: number;
};

export type SearchHistorySnapshot = {
  entries: SearchHistoryEntry[];
  available: boolean;
};

export class SearchHistoryUnavailableError extends Error {
  constructor() {
    super('Search history is unavailable.');
    this.name = 'SearchHistoryUnavailableError';
  }
}

export class SearchHistoryTimeoutError extends Error {
  constructor() {
    super('Search history storage took too long.');
    this.name = 'SearchHistoryTimeoutError';
  }
}

type DecodedHistory = SearchHistorySnapshot & { version: number };

const writeChains = new Map<string, Promise<void>>();
const generations = new Map<string, number>();
let cleanupBarrier: Promise<void> = Promise.resolve();

function keyFor(userId: string): string {
  return `${SEARCH_HISTORY_KEY_PREFIX}${userId}`;
}

function generationFor(userId: string): number {
  return generations.get(userId) ?? 0;
}

function isHistoryEntry(value: unknown): value is SearchHistoryEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Partial<SearchHistoryEntry>;
  return (entry.kind === 'person' || entry.kind === 'chat')
    && typeof entry.id === 'string'
    && entry.id.length > 0
    && typeof entry.selectedAt === 'number'
    && Number.isFinite(entry.selectedAt);
}

function normalizeEntries(value: unknown): SearchHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  const unique = new Map<string, SearchHistoryEntry>();
  for (const candidate of value) {
    if (!isHistoryEntry(candidate)) continue;
    const entry = { ...candidate };
    const identity = `${entry.kind}:${entry.id}`;
    const previous = unique.get(identity);
    if (!previous || entry.selectedAt > previous.selectedAt) unique.set(identity, entry);
  }
  return [...unique.values()]
    .sort((a, b) => b.selectedAt - a.selectedAt || `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`))
    .slice(0, MAX_HISTORY_ENTRIES);
}

async function readPayload(userId: string): Promise<DecodedHistory> {
  const raw = await AsyncStorage.getItem(keyFor(userId));
  if (!raw) return { version: HISTORY_VERSION, entries: [], available: true };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { version: HISTORY_VERSION, entries: [], available: true };
    }
    const payload = parsed as { version?: unknown; entries?: unknown };
    if (typeof payload.version === 'number' && payload.version > HISTORY_VERSION) {
      return { version: payload.version, entries: [], available: false };
    }
    return { version: HISTORY_VERSION, entries: normalizeEntries(payload.entries), available: true };
  } catch {
    return { version: HISTORY_VERSION, entries: [], available: true };
  }
}

function withDeadline<T>(operation: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new SearchHistoryTimeoutError());
    }, HISTORY_DEADLINE_MS);

    operation.then((value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    }, (error: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });
}

function enqueue(userId: string, operation: () => Promise<void>): Promise<void> {
  const previous = writeChains.get(userId) ?? Promise.resolve();
  const next = previous.then(operation);
  writeChains.set(userId, next.catch(() => undefined));
  return next;
}

function nextEntries(entries: readonly SearchHistoryEntry[], entry: SearchHistoryEntry): SearchHistoryEntry[] {
  const next = [entry, ...entries.filter((item) => !(item.kind === entry.kind && item.id === entry.id))];
  return next.slice(0, MAX_HISTORY_ENTRIES);
}

export async function loadSearchHistory(userId: string): Promise<SearchHistorySnapshot> {
  if (!userId) return { entries: [], available: true };
  const operation = cleanupBarrier.then(() => enqueue(userId, async () => undefined).then(() => readPayload(userId)));
  return withDeadline(operation);
}

export async function recordSearchHistory(
  userId: string,
  entry: SearchHistoryEntry,
): Promise<void> {
  if (!userId || !isHistoryEntry(entry)) return;
  const expectedGeneration = generationFor(userId);
  const operation = cleanupBarrier.then(() => enqueue(userId, async () => {
    if (generationFor(userId) !== expectedGeneration) return;
    const current = await readPayload(userId);
    if (!current.available) throw new SearchHistoryUnavailableError();
    if (generationFor(userId) !== expectedGeneration) return;
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify({
      version: HISTORY_VERSION,
      entries: nextEntries(current.entries, entry),
    }));
  }));
  return withDeadline(operation);
}

export async function removeSearchHistoryEntry(userId: string, entry: SearchHistoryEntry): Promise<void> {
  if (!userId || !isHistoryEntry(entry)) return;
  const expectedGeneration = generationFor(userId);
  const operation = cleanupBarrier.then(() => enqueue(userId, async () => {
    if (generationFor(userId) !== expectedGeneration) return;
    const current = await readPayload(userId);
    if (!current.available) throw new SearchHistoryUnavailableError();
    if (generationFor(userId) !== expectedGeneration) return;
    const entries = current.entries.filter((item) => !(item.kind === entry.kind && item.id === entry.id));
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify({ version: HISTORY_VERSION, entries }));
  }));
  return withDeadline(operation);
}

/** Explicit user action: this is the only operation allowed to replace an unsupported future payload. */
export async function clearSearchHistory(userId: string): Promise<void> {
  if (!userId) return;
  const expectedGeneration = generationFor(userId) + 1;
  generations.set(userId, expectedGeneration);
  const operation = cleanupBarrier.then(() => enqueue(userId, async () => {
    if (generationFor(userId) !== expectedGeneration) return;
    await AsyncStorage.removeItem(keyFor(userId));
  }));
  return withDeadline(operation);
}

/** Sign-out cleanup. It only removes this feature's prefixed keys and fences every older writer. */
export async function clearSearchHistoryStorage(): Promise<void> {
  const operation = cleanupBarrier.then(async () => {
    for (const userId of writeChains.keys()) generations.set(userId, generationFor(userId) + 1);
    await Promise.all([...writeChains.values()]);
    const keys = await AsyncStorage.getAllKeys();
    for (const key of keys) {
      if (key.startsWith(SEARCH_HISTORY_KEY_PREFIX)) await AsyncStorage.removeItem(key);
    }
  });
  cleanupBarrier = operation.catch(() => undefined);
  return withDeadline(operation);
}

export function useSearchHistory(userId: string | null) {
  const [state, setState] = useState<{
    status: 'loading' | 'ready' | 'unavailable' | 'error';
    entries: SearchHistoryEntry[];
    writeError: boolean;
  }>({ status: 'loading', entries: [], writeError: false });
  const revision = useRef(0);

  const reload = useCallback(async () => {
    if (!userId) {
      setState({ status: 'ready', entries: [], writeError: false });
      return;
    }
    const currentRevision = ++revision.current;
    setState((current) => ({ ...current, status: 'loading' }));
    try {
      const snapshot = await loadSearchHistory(userId);
      if (revision.current !== currentRevision) return;
      setState({ status: snapshot.available ? 'ready' : 'unavailable', entries: snapshot.entries, writeError: false });
    } catch {
      if (revision.current === currentRevision) setState((current) => ({ ...current, status: 'error' }));
    }
  }, [userId]);

  useEffect(() => {
    void reload();
    return () => { revision.current += 1; };
  }, [reload]);

  const record = useCallback(async (entry: SearchHistoryEntry) => {
    try {
      await recordSearchHistory(userId ?? '', entry);
      await reload();
    } catch (error: unknown) {
      setState((current) => ({ ...current, writeError: true }));
      throw error;
    }
  }, [reload, userId]);

  const remove = useCallback(async (entry: SearchHistoryEntry) => {
    try {
      await removeSearchHistoryEntry(userId ?? '', entry);
      await reload();
    } catch (error: unknown) {
      setState((current) => ({ ...current, writeError: true }));
      throw error;
    }
  }, [reload, userId]);

  const clear = useCallback(async () => {
    try {
      await clearSearchHistory(userId ?? '');
      await reload();
    } catch (error: unknown) {
      setState((current) => ({ ...current, writeError: true }));
      throw error;
    }
  }, [reload, userId]);

  return { ...state, reload, record, remove, clear };
}
