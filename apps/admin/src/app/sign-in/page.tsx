import Image from 'next/image';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { SignInForm } from './SignInForm';
import logo from '../../../assets/logo/dologram_admin_logo.png';
import { assertLocalRequest, validSession } from '../../server/guards';
import { SignOutButton } from '../(admin)/SignOutButton';
import styles from './sign-in.module.css';

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  await connection();
  if (await assertLocalRequest() && await validSession()) redirect('/');
  const { reason } = await searchParams;
  return <main className={styles.screen}>
    <section className={styles.card} aria-labelledby="sign-in-title">
      <Image src={logo} alt="" width={56} height={56} className={styles.logo} unoptimized />
      <h1 id="sign-in-title" className={styles.title}>DoloGram Admin</h1>
      <SignInForm accessFailed={reason === 'access'} />
      {reason === 'access' && <SignOutButton />}
    </section>
  </main>;
}
