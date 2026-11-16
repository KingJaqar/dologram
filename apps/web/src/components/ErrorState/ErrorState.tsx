'use client';

import { strings } from '@dologram/shared/src/strings';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import styles from './ErrorState.module.css';

type StringValues<T> = T extends string ? T : T extends object ? { [K in keyof T]: StringValues<T[K]> }[keyof T] : never;
/** Static shared wording only; map transport failures before they reach presentation. */
export function ErrorState({ title, body, onRetry, loading = false }: { title: string; body: StringValues<typeof strings>; onRetry?: () => void; loading?: boolean }) {
  return <section className={styles.state} role="alert" aria-label={title}><span className={styles.icon}><Icon name="status.failed" size="xl" /></span><h2>{title}</h2><p>{body}</p>
    {onRetry && <div className={styles.action}><Button onClick={onRetry} loading={loading}>{strings.common.retry}</Button></div>}
  </section>;
}
