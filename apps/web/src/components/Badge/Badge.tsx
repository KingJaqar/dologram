import type { ReactNode } from 'react';
import styles from './Badge.module.css';
export function Badge({ children, variant = 'brand' }: { children: ReactNode; variant?: 'brand' | 'muted' }) {
  return <span className={`${styles.badge} ${styles[variant]}`}>{children}</span>;
}
