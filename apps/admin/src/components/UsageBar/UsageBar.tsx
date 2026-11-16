import { useId } from 'react';
import { Icon } from '../Icon/Icon';
import { strings } from '../../strings';
import styles from './UsageBar.module.css';

export interface UsageBarProps {
  name: string;
  used: number;
  limit: number;
  unit: 'bytes' | 'count';
  action?: string;
  enteredByHandOn?: string;
}

function quantity(value: number, unit: 'bytes' | 'count') {
  if (unit === 'count') return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
  const gb = 1024 ** 3;
  return value >= gb ? `${(value / gb).toFixed(2)} GB` : `${(value / 1024 ** 2).toFixed(2)} MB`;
}

export function UsageBar({ name, used, limit, unit, action, enteredByHandOn }: UsageBarProps) {
  const labelId = useId();
  if (!Number.isFinite(used) || used < 0 || !Number.isFinite(limit) || limit <= 0 || !Number.isFinite(used / limit)) {
    throw new Error('UsageBar requires finite nonnegative usage and a positive limit.');
  }
  const ratio = used / limit;
  const tone = ratio >= 1 ? 'danger' : ratio >= 0.8 ? 'warning' : 'normal';
  const percent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(Math.floor(ratio * 1000) / 10);
  const summary = strings.usage.summary(quantity(used, unit), quantity(limit, unit), percent);
  return <section className={styles.usage}>
    <h3 id={labelId} className={styles.title}>{name}</h3>
    <p className={styles.text}>{summary}</p>
    <div role="progressbar" aria-labelledby={labelId} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(used, limit)}
      aria-valuetext={summary} className={styles.track}>
      <div className={`${styles.fill} ${styles[tone]}`} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
    </div>
    {tone !== 'normal' && <p className={`${styles.threshold} ${styles[tone]}`}>
      <Icon name={tone === 'danger' ? 'status.failed' : 'admin.warning'} size="sm" />
      {tone === 'danger' ? strings.usage.reached : strings.usage.warning}
    </p>}
    {tone !== 'normal' && action && <p className={styles.text}>{action}</p>}
    {enteredByHandOn && <p className={styles.text}>{strings.usage.entered(enteredByHandOn)}</p>}
  </section>;
}
