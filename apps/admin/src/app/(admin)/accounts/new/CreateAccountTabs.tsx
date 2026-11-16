import Link from 'next/link';
import { strings } from '../../../../strings';
import styles from './create.module.css';

/** CMP-14 tabs: the selected label carries a 2 px brand underline and aria-selected. */
export function CreateAccountTabs({ active }: { active: 'single' | 'csv' }) {
  return <div className={styles.tabs} role="tablist" aria-label={strings.createAccount.tabsLabel}>
    <Link role="tab" aria-selected={active === 'single'} className={styles.tab} href="/accounts/new">
      {strings.createAccount.single}
    </Link>
    <Link role="tab" aria-selected={active === 'csv'} className={styles.tab} href="/accounts/import">
      {strings.createAccount.csv}
    </Link>
  </div>;
}
