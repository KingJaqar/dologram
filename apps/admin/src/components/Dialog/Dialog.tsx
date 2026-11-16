'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ErrorState } from '../ErrorState/ErrorState';
import styles from './Dialog.module.css';

export interface DialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  size?: 'confirm' | 'form';
  busy?: boolean;
  error?: string;
}

export function Dialog({ open, title, children, onClose, size = 'confirm', busy = false, error }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const opener = document.activeElement;
    dialog.showModal();
    const first = dialog.querySelector<HTMLElement>('input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [data-dialog-cancel]:not(:disabled)');
    first?.focus();
    return () => {
      if (dialog.open) dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [open]);

  return <dialog ref={ref} aria-labelledby={titleId} aria-busy={busy || undefined}
    className={`${styles.dialog} ${styles[size]}`}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    {open && <><h2 id={titleId} className={styles.title}>{title}</h2>{children}
      {error && <ErrorState error={error} />}</>}
  </dialog>;
}
