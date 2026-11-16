import { strings } from '../../strings';
import styles from './Skeleton.module.css';

export function Skeleton({ variant = 'block' }: { variant?: 'block' | 'adminTable' }) {
  return <div aria-busy="true" aria-label={strings.common.loading} className={styles.skeleton}>
    {Array.from({ length: variant === 'adminTable' ? 10 : 1 }, (_, index) => <div key={index} className={styles.block} />)}
  </div>;
}
