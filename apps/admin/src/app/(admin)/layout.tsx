import type { ReactNode } from 'react';
import { AdminHeader } from '../../components/AdminHeader/AdminHeader';
import { Sidebar } from '../../components/Sidebar/Sidebar';
import { requirePageSession } from '../../server/guards';
import { SignOutButton } from './SignOutButton';
import styles from './shell.module.css';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Supplementary shell gate: every privileged page and action verifies identity itself.
  await requirePageSession();
  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#admin-content">Skip to content</a>
      <Sidebar />
      <div className={styles.column}>
        <AdminHeader action={<SignOutButton />} />
        <main id="admin-content" className={styles.content} tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
