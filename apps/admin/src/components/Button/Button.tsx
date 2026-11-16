import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from '../Icon/Icon';
import type { IconName } from '@dologram/shared/src/theme/icons';
import styles from './Button.module.css';

type NativeButton = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'>;
export interface ButtonProps extends NativeButton {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'text';
  loading?: boolean;
}

export function Button({ children, variant = 'primary', loading = false, disabled, className = '', type = 'button', ...props }: ButtonProps) {
  return <button {...props} type={type} disabled={disabled || loading} aria-busy={loading || undefined}
    className={`${styles.button} ${styles[variant]} ${className}`}>
    {loading ? <><span className={styles.hidden}>{children}</span><Icon name="ui.loading" size="sm" className={styles.spinner} /></> : children}
  </button>;
}

export interface IconButtonProps extends Omit<NativeButton, 'title'> {
  label: string;
  name: IconName;
  loading?: boolean;
}

export function IconButton({ label, name, loading = false, disabled, className = '', type = 'button', ...props }: IconButtonProps) {
  return <button {...props} type={type} aria-label={label} title={label} aria-busy={loading || undefined}
    disabled={disabled || loading} className={`${styles.button} ${styles.text} ${styles['icon-button']} ${className}`}>
    <Icon name={loading ? 'ui.loading' : name} size="sm" className={loading ? styles.spinner : undefined} />
  </button>;
}
