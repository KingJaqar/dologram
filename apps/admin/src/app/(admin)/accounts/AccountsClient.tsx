'use client';

import { useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { AccountListRow } from '@dologram/admin-core';
import { DataTable, type DataTableColumn } from '../../../components/DataTable/DataTable';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { FilterBar } from '../../../components/FilterBar/FilterBar';
import { LocalTime } from '../../../components/LocalTime/LocalTime';
import { StatusPill } from '../../../components/StatusPill/StatusPill';
import { UnavailablePanel } from '../../../components/UnavailablePanel/UnavailablePanel';
import { strings } from '../../../strings';
import styles from './accounts.module.css';

export interface AccountsClientProps {
  rows: readonly AccountListRow[];
  page: number;
  total: number;
  q: string;
  /** Raw `filter` search parameter; `listAccounts` validated it server-side. */
  filter: string;
  failed: boolean;
  dashboardUrl?: string;
}

const chips = [
  { id: 'all', label: strings.accounts.all },
  { id: 'active', label: strings.status.active },
  { id: 'banned', label: strings.status.banned },
  { id: 'mustChange', label: strings.status.mustChangePassword },
] as const;

export function AccountsClient({ rows, page, total, q, filter, failed, dashboardUrl }: AccountsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const retry = () => startTransition(() => router.refresh());
  // Every search, filter or page change is a server render; nothing is cached here.
  // A changed search or filter resets the page so no stale offset is requested.
  const apply = (next: { q?: string; filter?: string; page?: number }) => {
    const params = new URLSearchParams();
    const nextQ = next.q ?? q;
    const nextFilter = next.filter ?? filter;
    const nextPage = next.page ?? 1;
    if (nextQ) params.set('q', nextQ);
    if (nextFilter && nextFilter !== 'all') params.set('filter', nextFilter);
    if (nextPage > 1) params.set('page', String(nextPage));
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };
  const columns: DataTableColumn<AccountListRow>[] = [
    {
      key: 'username', header: strings.accounts.username, widthPercent: 14, align: 'left', mono: true,
      render: row => <span className={styles.identity}>{row.username ?? '—'}{row.admin && <StatusPill value="admin" />}</span>,
    },
    { key: 'displayName', header: strings.accounts.displayName, widthPercent: 18, align: 'left', render: row => row.displayName ?? '—' },
    { key: 'email', header: strings.accounts.email, widthPercent: 22, align: 'left', render: row => row.email ?? '—' },
    { key: 'createdAt', header: strings.accounts.created, widthPercent: 12, align: 'left', render: row => <LocalTime value={row.createdAt} mode="date" /> },
    {
      key: 'lastSignInAt', header: strings.accounts.lastSignIn, widthPercent: 14, align: 'left',
      render: row => row.lastSignInAt ? <LocalTime value={row.lastSignInAt} mode="datetime" /> : strings.accounts.never,
    },
    { key: 'status', header: strings.accounts.status, widthPercent: 10, align: 'left', render: row => <StatusPill value={row.status} /> },
    {
      key: 'premiumFlags', header: strings.accounts.premium, widthPercent: 10, align: 'left',
      render: row => row.premiumFlags.length === 0 ? null : row.premiumFlags.join(', '),
    },
  ];
  const errorContent = failed
    ? (dashboardUrl
      ? <UnavailablePanel variant="panel" dashboardUrl={dashboardUrl} onRetry={retry} />
      : <ErrorState error={strings.common.requestFailed} onRetry={retry} />)
    : undefined;
  return <div className={styles.view}>
    <FilterBar
      search={{ placeholder: strings.accounts.search, value: q, onSearch: value => apply({ q: value }) }}
      chips={chips}
      selectedChip={chips.some(chip => chip.id === filter) ? filter : 'all'}
      onChip={id => apply({ filter: id })}
    />
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={row => row.userId}
      onRowOpen={row => startTransition(() => router.push(`/accounts/${row.userId}`))}
      page={page}
      pageSize={50}
      total={total}
      onPageChange={next => apply({ page: next })}
      state={failed ? 'error' : pending ? 'loading' : rows.length === 0 ? 'empty' : 'ready'}
      emptyText={strings.accounts.empty}
      errorContent={errorContent}
      label={strings.accounts.label}
      emptyIcon="admin.accounts"
    />
  </div>;
}
