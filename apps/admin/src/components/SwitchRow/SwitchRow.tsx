'use client';

import { Icon } from '../Icon/Icon';
import buttonStyles from '../Button/Button.module.css';
import styles from './SwitchRow.module.css';

export interface SwitchRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  pending?: boolean;
  disabled?: boolean;
}

/** Controlled: only a successful caller update changes the displayed value. */
export function SwitchRow({ label, checked, onChange, pending = false, disabled = false }: SwitchRowProps) {
  return <button type="button" role="switch" aria-checked={checked} aria-busy={pending || undefined}
    disabled={disabled || pending} onClick={() => onChange(!checked)} className={styles.row}>
    <span>{label}</span>
    <span aria-hidden="true" className={`${styles.track} ${checked ? styles.checked : ''}`}>
      <span className={styles.thumb}>{pending && <Icon name="ui.loading" size="sm" className={buttonStyles.spinner} />}</span>
    </span>
  </button>;
}
