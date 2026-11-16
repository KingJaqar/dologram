import type { ReactNode } from 'react';
import type { IconName } from '@dologram/shared/src/theme/icons';
import { Icon } from '../Icon/Icon';
import styles from './EmptyState.module.css';
export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  return <section className={styles.state} aria-label={title}><span className={styles.icon}><Icon name={icon} size="xl" /></span><h2>{title}</h2>{body && <p>{body}</p>}{action && <div className={styles.action}>{action}</div>}</section>;
}
