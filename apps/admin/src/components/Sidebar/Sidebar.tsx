'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { IconName } from '@dologram/shared/src/theme/icons';
import { Icon } from '../Icon/Icon';
import logo from '../../../assets/logo/dologram_admin_logo.png';
import styles from './Sidebar.module.css';

interface SidebarItem {
  label: string;
  href: string;
  icon: IconName;
}

export const sidebarItems: readonly SidebarItem[] = [
  { label: 'Overview', href: '/', icon: 'admin.overview' },
  { label: 'Accounts', href: '/accounts', icon: 'admin.accounts' },
  { label: 'Maintenance', href: '/maintenance', icon: 'admin.maintenance' },
  { label: 'Audit log', href: '/audit', icon: 'admin.audit' },
  { label: 'Settings check', href: '/settings-check', icon: 'admin.settingsCheck' },
];

/** Every nested path keeps its section current; Overview matches exactly. */
export function isCurrentPath(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname() ?? '/';
  return (
    <nav aria-label="Admin" className={styles.sidebar}>
      <div className={styles.brand}>
        <Image src={logo} alt="" width={28} height={28} className={styles.mark} unoptimized />
        <span>DoloGram Admin</span>
      </div>
      <ul className={styles.items}>
        {sidebarItems.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className={styles.item} aria-current={isCurrentPath(pathname, item.href) ? 'page' : undefined}>
              <Icon name={item.icon} size="md" />
              <span className={styles.label}>{item.label}</span>
              <span aria-hidden="true" className={styles.tooltip}>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
