'use client';
import { useActionState, useState } from 'react';
import { Button } from '../../components/Button/Button';
import { TextField } from '../../components/TextField/TextField';
import { signIn } from './actions';
import type { SignInState } from './state';
import styles from './sign-in.module.css';

export function SignInForm({ accessFailed = false }: { accessFailed?: boolean }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [state, action, pending] = useActionState<SignInState, FormData>(async (previous, data) => {
    setPassword('');
    try { return await signIn(previous, data); }
    catch { return { ok: false, message: 'Could not reach the admin server. Try again.' }; }
  }, { ok: false });
  return <form action={action} className={styles.form}>
    <TextField label="Username or email" name="identifier" type="text" autoComplete="username" value={identifier}
      onChange={setIdentifier} required maxLength={254} disabled={pending} aria-describedby="sign-in-message" />
    <TextField label="Password" name="password" type="password" autoComplete="current-password" value={password}
      onChange={setPassword} required maxLength={1024} disabled={pending} aria-describedby="sign-in-message" />
    <p id="sign-in-message" role="status" className={styles.message}>
      {state.message ?? (accessFailed ? 'Admin access could not be verified. Sign in again or retry when the backend is available.' : 'Use your existing DoloGram account. Admin access requires database authorization.')}
    </p>
    <Button type="submit" loading={pending}>Sign in</Button>
  </form>;
}
