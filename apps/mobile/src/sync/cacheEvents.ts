/**
 * Change notifications for the local cache (M2-08).
 *
 * The sync engine writes the SQLite cache outside React, so the chat list and the Archive refresh
 * themselves when a pass or a Realtime event has merged rows instead of polling (F2: "the order
 * updates when a message arrives").
 */

const listeners = new Set<() => void>();

/** Subscribes to cache updates; returns the unsubscribe function. */
export function subscribeCacheChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Called by the sync lifecycle after rows were merged or a pass finished. */
export function notifyCacheChange(): void {
  for (const listener of listeners) listener();
}
