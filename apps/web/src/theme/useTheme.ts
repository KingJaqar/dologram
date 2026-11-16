'use client';

import { useSyncExternalStore } from 'react';

export type ThemeSetting = 'system' | 'light' | 'dark';
const changeEvent = 'dg-theme-change';
const query = '(prefers-color-scheme: dark)';

export function getThemeSetting(): ThemeSetting {
  if (typeof document === 'undefined') return 'system';
  const explicit = document.documentElement.dataset.theme;
  return explicit === 'light' || explicit === 'dark' ? explicit : 'system';
}

function apply(setting: ThemeSetting): void {
  if (setting === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = setting;
}

/** Apply immediately; return a visible persistence error without losing the choice. */
export function setThemeSetting(setting: ThemeSetting): string | null {
  if (!['system', 'light', 'dark'].includes(setting)) throw new Error('Invalid theme setting.');
  apply(setting);
  let error: string | null = null;
  try { localStorage.setItem('dg.theme', setting); }
  catch { error = 'Your theme changed for this tab, but could not be saved. Allow site storage and try again.'; }
  window.dispatchEvent(new Event(changeEvent));
  return error;
}

function subscribe(listener: () => void): () => void {
  const media = window.matchMedia(query);
  const storage = (event: StorageEvent) => {
    if (event.key !== 'dg.theme' && event.key !== null) return;
    apply(event.newValue === 'dark' || event.newValue === 'light' ? event.newValue : 'system');
    listener();
  };
  window.addEventListener(changeEvent, listener);
  window.addEventListener('storage', storage);
  media.addEventListener('change', listener);
  return () => {
    window.removeEventListener(changeEvent, listener);
    window.removeEventListener('storage', storage);
    media.removeEventListener('change', listener);
  };
}

function resolved(): 'light' | 'dark' {
  const setting = getThemeSetting();
  return setting === 'system' ? (window.matchMedia(query).matches ? 'dark' : 'light') : setting;
}

export function useResolvedTheme(): 'light' | 'dark' {
  return useSyncExternalStore(subscribe, resolved, () => 'light');
}

export function useThemeSetting(): ThemeSetting {
  return useSyncExternalStore(subscribe, getThemeSetting, () => 'system');
}
