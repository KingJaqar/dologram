import { useId } from 'react';
import type { IconName } from '@dologram/shared/src/theme/icons';
import { Icon } from '../Icon/Icon';
import styles from './EmptyState.module.css';

export function EmptyState({ icon, title, body }: { icon: IconName; title: string; body?: string }) {
  const id = useId();
  return <section aria-labelledby={id} className={styles.empty}>
    <span className={styles.circle}><Icon name={icon} size="lg" /></span>
    <h2 id={id} className={styles.title}>{title}</h2>
    {body && <p className={styles.body}>{body}</p>}
  </section>;
}
