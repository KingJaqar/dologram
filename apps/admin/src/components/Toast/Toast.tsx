'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from '@dologram/shared/src/theme/tokens';
import styles from './Toast.module.css';

export interface ToastMessage { message: string; action?: { label: string; onClick: () => void } }

function subscribeToDialogs(notify: () => void) {
  const observer = new MutationObserver(notify);
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
  return () => observer.disconnect();
}

const toastHost = () => document.querySelector('dialog[open]') ?? document.body;
const serverHost = () => null;

export function Toast({ message, action, onDismiss }: ToastMessage & { onDismiss: () => void }) {
  // A native modal's top layer covers body-level z-indexes. Keep notifications
  // inside that layer while open, returning to the body when the modal closes.
  const host = useSyncExternalStore(subscribeToDialogs, toastHost, serverHost);
  useEffect(() => {
    const timer = setTimeout(onDismiss, action ? motion.toast.durationLong : motion.toast.duration);
    return () => clearTimeout(timer);
  }, [action, onDismiss]);
  const content = <div role="status" className={styles.toast}>
    <span>{message}</span>
    {action && <button type="button" className={styles.action} onClick={() => { onDismiss(); action.onClick(); }}>{action.label}</button>}
  </div>;
  return host ? createPortal(content, host) : content;
}

const ToastContext = createContext<((toast: ToastMessage) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastMessage & { id: number }) | null>(null);
  const sequence = useRef(0);
  const show = useCallback((message: ToastMessage) => setToast({ ...message, id: ++sequence.current }), []);
  const dismiss = useCallback(() => setToast(null), []);
  return <ToastContext.Provider value={show}>{children}
    {toast && <Toast key={toast.id} message={toast.message} action={toast.action} onDismiss={dismiss} />}
  </ToastContext.Provider>;
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast requires ToastProvider.');
  return show;
}
