'use client';

import type { ButtonHTMLAttributes, Ref } from 'react';
import { Icon } from '../Icon/Icon';
import { useDelayedFlag } from '../../lib/useDelayedFlag';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: Ref<HTMLButtonElement>;
  variant?: 'primary' | 'secondary' | 'text' | 'danger';
  loading?: boolean;
  loadingLabel?: string;
}

export function Button({ variant = 'primary', loading = false, loadingLabel = 'Loading', disabled, children, className, type = 'button', ...props }: ButtonProps) {
  const showSpinner = useDelayedFlag(loading);
  return <button {...props} type={type} className={[styles.button, styles[variant], className].filter(Boolean).join(' ')}
    disabled={disabled || loading} aria-busy={loading || undefined}>
    <span className={showSpinner ? styles.hiddenLabel : undefined}>{children}</span>
    {showSpinner && <span className={styles.progress}><Icon name="status.sending" className={styles.spinner} /><span>{loadingLabel}</span></span>}
  </button>;
}
