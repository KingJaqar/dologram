import Link from 'next/link';
import { connection } from 'next/server';
import { listAccounts, type AccountListRow } from '@dologram/admin-core';
import buttonStyles from '../../../components/Button/Button.module.css';
import { PageTitle } from '../../../components/PageTitle/PageTitle';
import { requirePageSession } from '../../../server/guards';
import { getProjectDashboardUrl } from '../../../server/projectLabel';
import { AccountsClient } from './AccountsClient';
import styles from './accounts.module.css';

interface AccountsSearchParams {
  q?: string | string[];
  filter?: string | string[];
  page?: string | string[];
}

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export default async function AccountsPage({ searchParams }: { searchParams: Promise<AccountsSearchParams> }) {
  await connection();
  await requirePageSession();
  const params = await searchParams;
  const q = single(params.q) ?? '';
  let rows: AccountListRow[] = [];
  let page = 1;
  let total = 0;
  let failed = false;
  try {
    const result = await listAccounts({ q, filter: single(params.filter), page: single(params.page) });
    rows = result.rows;
    page = result.page;
    total = result.total;
  } catch {
    failed = true;
  }
  return (
    <>
      <div className={styles.header}>
        <PageTitle>Accounts</PageTitle>
        <div className={styles.actions}>
          <Link className={`${buttonStyles.button} ${buttonStyles.primary}`} href="/accounts/new">Create account</Link>
          <Link className={`${buttonStyles.button} ${buttonStyles.secondary}`} href="/accounts/import">Import CSV</Link>
        </div>
      </div>
      <AccountsClient rows={rows} page={page} total={total} q={q} filter={single(params.filter) ?? ''}
        failed={failed} dashboardUrl={getProjectDashboardUrl()} />
    </>
  );
}
