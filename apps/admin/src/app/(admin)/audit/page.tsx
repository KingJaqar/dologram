import { connection } from 'next/server';
import { auditActions, listAudit, type AuditListRow } from '@dologram/admin-core';
import { PageTitle } from '../../../components/PageTitle/PageTitle';
import { flushAudit } from '../../../server/auditLog';
import { requirePageSession } from '../../../server/guards';
import { getProjectDashboardUrl } from '../../../server/projectLabel';
import { AuditClient } from './AuditClient';

interface AuditSearchParams {
  page?: string | string[];
  action?: string | string[];
  target?: string | string[];
}

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<AuditSearchParams> }) {
  await connection();
  await requirePageSession();
  const params = await searchParams;
  const action = single(params.action) ?? '';
  const target = single(params.target) ?? '';
  // A page visit reconciles any event journaled while the audit database was down.
  await flushAudit();
  let rows: AuditListRow[] = [];
  let page = 1;
  let total = 0;
  let failed = false;
  try {
    const result = await listAudit({ page: single(params.page), action, target });
    rows = result.rows;
    page = result.page;
    total = result.total;
  } catch {
    failed = true;
  }
  return (
    <>
      <PageTitle>Audit log</PageTitle>
      <AuditClient rows={rows} page={page} total={total} action={action} target={target}
        actionNames={auditActions} failed={failed} dashboardUrl={getProjectDashboardUrl()} />
    </>
  );
}
