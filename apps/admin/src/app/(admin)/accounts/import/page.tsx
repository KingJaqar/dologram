import { connection } from 'next/server';
import { getCreationCapability } from '@dologram/admin-core';
import { PageTitle } from '../../../../components/PageTitle/PageTitle';
import { requirePageSession } from '../../../../server/guards';
import { CreateAccountTabs } from '../new/CreateAccountTabs';
import { ImportAccountsClient } from './ImportAccountsClient';
import styles from '../new/create.module.css';

export default async function ImportAccountsPage() {
  await connection();
  await requirePageSession();
  const capability = await getCreationCapability();
  return (
    <div className={styles.page}>
      <PageTitle>Import accounts</PageTitle>
      <CreateAccountTabs active="csv" />
      <ImportAccountsClient prerequisite={capability.prerequisite} />
    </div>
  );
}
