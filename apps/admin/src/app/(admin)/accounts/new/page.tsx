import { connection } from 'next/server';
import { getCreationCapability } from '@dologram/admin-core';
import { PageTitle } from '../../../../components/PageTitle/PageTitle';
import { requirePageSession } from '../../../../server/guards';
import { strings } from '../../../../strings';
import { CreateAccountClient } from './CreateAccountClient';
import { CreateAccountTabs } from './CreateAccountTabs';
import styles from './create.module.css';

export default async function CreateAccountPage() {
  // Configuration and the current forced-password contract are read per request.
  await connection();
  await requirePageSession();
  const capability = await getCreationCapability();
  return <div className={styles.page}>
    <PageTitle>{strings.createAccount.pageTitle}</PageTitle>
    <CreateAccountTabs active="single" />
    <CreateAccountClient prerequisite={capability.prerequisite} />
  </div>;
}
