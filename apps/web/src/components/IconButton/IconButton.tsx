import type { ButtonHTMLAttributes, Ref } from 'react';
import type { IconName } from '@dologram/shared/src/theme/icons';
import { Icon } from '../Icon/Icon';
import styles from './IconButton.module.css';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { label: string; icon: IconName; ref?: Ref<HTMLButtonElement> }
export function IconButton({ label, icon, className, type = 'button', ref, ...props }: IconButtonProps) {
  return <button {...props} ref={ref} type={type} aria-label={label} title={label} data-icon-button className={[styles.target, className].filter(Boolean).join(' ')}><span className={styles.circle}><Icon name={icon} size="lg" /></span></button>;
}
