import { strings, type MuteOptionId } from '@dologram/shared';
import type { ToastOptions } from '../components/Toast';

export type ToastAction = keyof typeof strings.toasts.actions;
export type ToastDetails = { folder?: string; mute?: MuteOptionId };

/** Only curated, localized copy reaches the toast. Never pass an exception message. */
export function actionToast(action: ToastAction, outcome: 'success' | 'error', details: ToastDetails = {}): ToastOptions {
  let message: string = strings.toasts.actions[action][outcome];
  if (outcome === 'success' && action === 'muteChat' && details.mute) message = strings.toasts.muted[details.mute];
  if (outcome === 'success' && action === 'addToFolder' && details.folder) message = strings.toasts.addedToFolder(details.folder);
  return { message, variant: outcome, placement: action.endsWith('Message') ? 'top' : 'bottom', ...(['login', 'createAccount', 'switchAccount'].includes(action) ? { surviveAccountChange: true } : {}) };
}

/** Single flight per account/resource, shared by mounted screens and retained through navigation. */
const pending = new Map<string, Promise<unknown>>();
export async function performToastAction<T>(
  show: (options: ToastOptions) => void,
  key: string,
  action: ToastAction,
  operation: () => Promise<T>,
  details?: ToastDetails,
): Promise<{ ok: true; value: T } | { ok: false }> {
  if (pending.has(key)) return { ok: false };
  const request = Promise.resolve().then(operation);
  pending.set(key, request);
  try {
    const value = await request;
    show(actionToast(action, 'success', details));
    return { ok: true, value };
  } catch {
    show(actionToast(action, 'error', details));
    return { ok: false };
  } finally {
    if (pending.get(key) === request) pending.delete(key);
  }
}
