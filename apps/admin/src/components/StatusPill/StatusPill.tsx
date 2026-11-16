import type { IconName } from '@dologram/shared/src/theme/icons';
import { Icon } from '../Icon/Icon';
import { strings } from '../../strings';
import styles from './StatusPill.module.css';

export type StatusPillValue = keyof typeof strings.status;

const appearance: Record<StatusPillValue, { tone: string; icon: IconName }> = {
  active: { tone: 'success', icon: 'admin.pass' },
  pass: { tone: 'success', icon: 'admin.pass' },
  success: { tone: 'success', icon: 'admin.pass' },
  banned: { tone: 'danger', icon: 'admin.fail' },
  fail: { tone: 'danger', icon: 'admin.fail' },
  failed: { tone: 'danger', icon: 'admin.fail' },
  overdue: { tone: 'danger', icon: 'admin.fail' },
  mustChangePassword: { tone: 'warning', icon: 'admin.warning' },
  due: { tone: 'warning', icon: 'admin.warning' },
  admin: { tone: 'info', icon: 'person.badge' },
  premiumBadge: { tone: 'neutral', icon: 'person.badge' },
  premiumExtraReactions: { tone: 'neutral', icon: 'emoji.heart' },
  premiumStickers: { tone: 'neutral', icon: 'emoji.laugh' },
};

export function StatusPill({ value }: { value: StatusPillValue }) {
  const { tone, icon } = appearance[value];
  return <span className={`${styles.pill} ${styles[tone]}`}>
    <Icon name={icon} size="sm" />{strings.status[value]}
  </span>;
}
