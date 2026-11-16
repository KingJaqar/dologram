import { Icon } from '../Icon/Icon';
import styles from './Avatar.module.css';

export type AvatarSize = 24 | 28 | 40 | 48 | 56 | 64 | 96;
export interface AvatarProps { id: string; displayName: string; size?: AvatarSize; variant?: 'normal' | 'saved' | 'deleted' | 'former' }
export function Avatar({ id, displayName, size = 40, variant = 'normal' }: AvatarProps) {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => Array.from(word)[0] ?? '').join('').toUpperCase() || '?';
  let sum = 0;
  for (let index = 0; index < id.length; index++) sum += id.charCodeAt(index);
  return <span className={styles.avatar} data-size={size} data-fill={sum % 7} data-variant={variant} aria-hidden="true">
    {variant === 'normal' ? initials : <Icon name={variant === 'saved' ? 'chat.saved' : variant === 'former' ? 'person.former' : 'person.deleted'} size={size <= 28 ? 'sm' : 'lg'} />}
  </span>;
}
