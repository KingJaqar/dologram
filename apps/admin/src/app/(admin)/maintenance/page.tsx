import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { PageTitle } from '../../../components/PageTitle/PageTitle';

export default function MaintenancePage() {
  return (
    <>
      <PageTitle>Maintenance</PageTitle>
      <EmptyState icon="admin.maintenance" title="Built in Phase 14" />
    </>
  );
}
