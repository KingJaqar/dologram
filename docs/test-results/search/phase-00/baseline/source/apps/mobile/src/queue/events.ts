/** Queue change notifications used by the chat screen to repaint LS-2 status captions. */
const listeners = new Set<() => void>();

export function subscribeQueueChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyQueueChange(): void {
  for (const listener of listeners) listener();
}

export type ForwardOutcome = { userId: string; messageId: string; status: 'sent' | 'failed' };
const outcomeListeners = new Set<(outcome: ForwardOutcome) => void>();
export function subscribeForwardOutcome(listener: (outcome: ForwardOutcome) => void): () => void {
  outcomeListeners.add(listener);
  return () => { outcomeListeners.delete(listener); };
}
export function notifyForwardOutcome(outcome: ForwardOutcome): void {
  for (const listener of outcomeListeners) listener(outcome);
}
