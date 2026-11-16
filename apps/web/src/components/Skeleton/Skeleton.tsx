'use client';

import { useDelayedFlag } from '../../lib/useDelayedFlag';
import styles from './Skeleton.module.css';

export function Skeleton({ active, shape = 'rectangle' }: { active: boolean; shape?: 'rectangle' | 'circle' }) {
  const visible = useDelayedFlag(active);
  return visible ? <div className={styles.skeleton} data-shape={shape} aria-busy="true" role="status" aria-label="Loading" /> : null;
}
