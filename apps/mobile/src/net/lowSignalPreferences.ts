import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'dg.forceLowSignal';
let current = false;
let loaded = false;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

async function load(): Promise<void> {
  if (loaded) return;
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        current = value === 'true';
        loaded = true;
      })
      .catch(() => {
        loaded = true;
      })
      .finally(() => {
        loadPromise = null;
        notify();
      });
  }
  await loadPromise;
}

export async function getForceLowSignalMode(): Promise<boolean> {
  await load();
  return current;
}

export async function setForceLowSignalMode(value: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  current = value;
  loaded = true;
  notify();
}

export function useForceLowSignalMode(): boolean {
  const value = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => current,
  );

  useEffect(() => {
    void load();
  }, []);

  return value;
}
