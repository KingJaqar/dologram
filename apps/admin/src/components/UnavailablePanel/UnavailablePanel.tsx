'use client';

import { Button } from '../Button/Button';
import buttonStyles from '../Button/Button.module.css';
import { strings } from '../../strings';
import styles from './UnavailablePanel.module.css';

export interface UnavailablePanelProps {
  dashboardUrl: string;
  onEnterByHand?: () => void;
  onRetry?: () => void;
  variant: 'panel' | 'row';
}

export function UnavailablePanel({ dashboardUrl, onEnterByHand, onRetry, variant }: UnavailablePanelProps) {
  const url = new URL(dashboardUrl);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Dashboard URL must use HTTPS without credentials.');
  }
  return <div className={styles[variant]}>
    <span className={styles.label}>{variant === 'panel' ? strings.common.unavailable : strings.common.checkByHand}</span>
    <a href={url.href} target="_blank" rel="noopener noreferrer" className={`${buttonStyles.button} ${buttonStyles.text}`}>
      {strings.common.openDashboard}
    </a>
    {onEnterByHand && <Button variant="text" onClick={onEnterByHand}>{strings.common.enterByHand}</Button>}
    {onRetry && <Button variant="text" onClick={onRetry}>{strings.common.retry}</Button>}
  </div>;
}
