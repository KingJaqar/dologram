import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { PageTitle } from '../../../components/PageTitle/PageTitle';

export default function SettingsCheckPage() {
  return (
    <>
      <PageTitle>Settings check</PageTitle>
      <EmptyState icon="admin.settingsCheck" title="Built in Phase 12" />
    </>
  );
}
