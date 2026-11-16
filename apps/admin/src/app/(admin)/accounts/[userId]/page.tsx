import { EmptyState } from '../../../../components/EmptyState/EmptyState';
import { PageTitle } from '../../../../components/PageTitle/PageTitle';

export default function AccountDetailPage() {
  return (
    <>
      <PageTitle>Account detail</PageTitle>
      <EmptyState icon="admin.accounts" title="Built in Phase 10" />
    </>
  );
}
