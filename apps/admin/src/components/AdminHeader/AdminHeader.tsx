import type { ReactNode } from 'react';
import { getProjectLabel } from '../../server/projectLabel';
import styles from './AdminHeader.module.css';

/** CMP-21 admin header variant: project identity on the left, session action on the right. */
export function AdminHeader({ action }: { action: ReactNode }) {
  return (
    <header className={styles.header}>
      <p className={styles.project}>{getProjectLabel()}</p>
      <div className={styles.actions}>{action}</div>
    </header>
  );
}
