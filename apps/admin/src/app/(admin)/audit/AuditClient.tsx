'use client';

import { useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { AuditListRow } from '@dologram/admin-core';
import { AuditView, type AuditRow } from '../../../components/AuditView/AuditView';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { UnavailablePanel } from '../../../components/UnavailablePanel/UnavailablePanel';
import { strings } from '../../../strings';

export interface AuditClientProps {
  rows: readonly AuditListRow[];
  page: number;
  total: number;
  actionNames: readonly string[];
  action: string;
  target: string;
  failed: boolean;
  dashboardUrl?: string;
}

export function AuditClient({ rows, page, total, actionNames, action, target, failed, dashboardUrl }: AuditClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const retry = () => startTransition(() => router.refresh());
  // Every filter or page change is a server render; no audit data is cached here.
  const apply = (next: { page?: number; action?: string; target?: string }) => {
    const params = new URLSearchParams();
    const nextAction = next.action ?? action;
    const nextTarget = next.target ?? target;
    const nextPage = next.page ?? 1;
    if (nextAction) params.set('action', nextAction);
    if (nextTarget) params.set('target', nextTarget);
    if (nextPage > 1) params.set('page', String(nextPage));
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };
  const auditRows: AuditRow[] = rows.map(row => ({
    id: row.id,
    at: row.at,
    action: row.action,
    targetUsername: row.targetUsername,
    result: row.result,
    detail: row.detail,
  }));
  const errorContent = failed
    ? (dashboardUrl
      ? <UnavailablePanel variant="panel" dashboardUrl={dashboardUrl} onRetry={retry} />
      : <ErrorState error={strings.common.requestFailed} onRetry={retry} />)
    : undefined;
  return <AuditView
    rows={auditRows}
    page={page}
    total={total}
    onPageChange={next => apply({ page: next })}
    state={failed ? 'error' : pending ? 'loading' : auditRows.length === 0 ? 'empty' : 'ready'}
    errorContent={errorContent}
    actionNames={actionNames}
    action={action}
    onActionChange={next => apply({ action: next })}
    target={target}
    onTargetChange={next => apply({ target: next })}
  />;
}
