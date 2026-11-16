'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from '@dologram/shared/src/theme/tokens';
import styles from './Toast.module.css';

export interface ToastMessage { text: string; action?: { label: string; onClick: () => void } }
const ToastContext = createContext<{ show: (message: ToastMessage) => void } | null>(null);

export function Toast({ message, onDismiss }: { message: ToastMessage; onDismiss: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const remaining = useRef<number>(message.action ? motion.toast.durationLong : motion.toast.duration);
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hovered = useRef(false);
  const focused = useRef(false);
  const stop = useCallback(() => {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
    remaining.current = Math.max(0, remaining.current - (Date.now() - started.current));
  }, []);
  const resume = useCallback(() => {
    if (timer.current !== null || hovered.current || focused.current) return;
    started.current = Date.now();
    timer.current = setTimeout(onDismiss, remaining.current);
  }, [onDismiss]);
  useEffect(() => { resume(); return stop; }, [resume, stop]);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const enter = () => { hovered.current = true; stop(); };
    const leave = () => { hovered.current = false; resume(); };
    const focus = () => { focused.current = true; stop(); };
    const blur = (event: FocusEvent) => { if (!(event.relatedTarget instanceof Node) || !element.contains(event.relatedTarget)) { focused.current = false; resume(); } };
    element.addEventListener('mouseenter', enter);
    element.addEventListener('mouseleave', leave);
    element.addEventListener('focusin', focus);
    element.addEventListener('focusout', blur);
    return () => {
      element.removeEventListener('mouseenter', enter);
      element.removeEventListener('mouseleave', leave);
      element.removeEventListener('focusin', focus);
      element.removeEventListener('focusout', blur);
    };
  }, [resume, stop]);
  return <div ref={ref} className={styles.toast} role="status" aria-atomic="true">
    <span>{message.text}</span>
    {message.action && <button type="button" className={styles.action} onClick={() => { onDismiss(); message.action?.onClick(); }}>{message.action.label}</button>}
  </div>;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<{ id: number; message: ToastMessage } | null>(null);
  const sequence = useRef(0);
  const show = useCallback((message: ToastMessage) => { sequence.current += 1; setCurrent({ id: sequence.current, message }); }, []);
  const dismiss = useCallback(() => setCurrent(null), []);
  return <ToastContext value={{ show }}>{children}{current && createPortal(<Toast key={current.id} message={current.message} onDismiss={dismiss} />, document.body)}</ToastContext>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast requires ToastProvider.');
  return context;
}
