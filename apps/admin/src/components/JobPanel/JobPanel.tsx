'use client';

import { useId } from 'react';
import { Button } from '../Button/Button';
import { StatusPill } from '../StatusPill/StatusPill';
import { useDelayedFlag } from '../Skeleton/useDelayedFlag';
import { strings } from '../../strings';
import styles from './JobPanel.module.css';

export interface JobPanelProps {
  title: string;
  lastRun?: string;
  due: 'ok' | 'due' | 'overdue';
  running: boolean;
  blockedReason?: string;
  logLines: readonly string[];
  failed: boolean;
  onRun: () => void;
  onRetry: () => void;
  onRetryFailed?: () => void;
}

export function JobPanel({ title, lastRun, due, running, blockedReason, logLines, failed, onRun, onRetry, onRetryFailed }: JobPanelProps) {
  const id = useId();
  const showProgress = useDelayedFlag(running);
  const blockedId = `${id}-blocked`;
  return <section className={styles.card} aria-labelledby={id} aria-busy={running || undefined}>
    <h3 id={id} className={styles.title}>{title}</h3>
    <p className={styles.text}>{strings.job.lastRun(lastRun ?? strings.job.never)}</p>
    <div className={styles.actions}>
      {due !== 'ok' && <StatusPill value={due} />}
      {failed && !running && <StatusPill value="failed" />}
      <Button variant="secondary" disabled={running || Boolean(blockedReason)} aria-describedby={blockedReason ? blockedId : undefined}
        onClick={failed ? onRetry : onRun}>{failed ? strings.common.retry : strings.job.run}</Button>
      {failed && onRetryFailed && <Button variant="secondary" disabled={running || Boolean(blockedReason)}
        aria-describedby={blockedReason ? blockedId : undefined} onClick={onRetryFailed}>{strings.job.retryFailed}</Button>}
    </div>
    {blockedReason && <p id={blockedId} role="status" className={styles.text}>{blockedReason}</p>}
    {showProgress && <div role="progressbar" aria-label={`${title}: ${strings.job.running}`} className={styles.track}><div className={styles.bar} /></div>}
    {(running || failed) && <pre role="log" aria-label={strings.job.log} aria-live="polite" aria-relevant="text" className={styles.log}>
      {logLines.slice(-8).join('\n')}
    </pre>}
  </section>;
}
