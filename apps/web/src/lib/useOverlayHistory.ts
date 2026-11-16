'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';

interface OverlayEntry { url: string; ids: string[] }
const listeners = new Set<() => void>();
let closing: string | null = null;
function entry(): OverlayEntry | null {
  const state: unknown = window.history.state;
  if (!state || typeof state !== 'object' || !('dgOverlay' in state)) return null;
  const value: unknown = state.dgOverlay;
  if (!value || typeof value !== 'object' || !('url' in value) || !('ids' in value)) return null;
  return typeof value.url === 'string' && Array.isArray(value.ids) && value.ids.every((id: unknown) => typeof id === 'string')
    ? { url: value.url, ids: value.ids } : null;
}
function ids(): string[] {
  const current = entry();
  return current?.url === window.location.href ? current.ids : [];
}
function emit() { for (const listener of listeners) listener(); }
function popped() { closing = null; emit(); }
export function notifyOverlayNavigation() { popped(); }
function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener('popstate', popped);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('popstate', popped);
  };
}
const snapshot = () => JSON.stringify(ids());
const serverSnapshot = () => '[]';

export interface OverlayHistory { id: string; open: boolean; show: () => void; close: () => void }

/** The sole history writer. Keep handles mounted to allow Forward to reopen an overlay.
 * Dialog/BottomSheet only consume handles; future shell state must use this same owner.
 */
export function useOverlayHistory(id: string): OverlayHistory {
  usePathname(); // Next navigation rerenders persistent consumers; URL mismatches close them.
  const current: string[] = JSON.parse(useSyncExternalStore(subscribe, snapshot, serverSnapshot));
  const show = useCallback(() => {
    const stack = ids();
    if (stack.includes(id) || closing) return;
    const state: unknown = window.history.state;
    window.history.pushState({ ...(state && typeof state === 'object' ? state : {}), dgOverlay: { url: window.location.href, ids: [...stack, id] } }, '', window.location.href);
    emit();
  }, [id]);
  const close = useCallback(() => {
    const stack = ids();
    if (stack.at(-1) !== id || closing) return;
    closing = id;
    window.history.back();
  }, [id]);
  return { id, open: current.includes(id), show, close };
}
