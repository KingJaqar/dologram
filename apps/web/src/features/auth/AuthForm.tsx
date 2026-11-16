'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { dgTrim, strings, validateDisplayName, validateEmail, validateNewPassword, validateUsername } from '@dologram/shared';
import { Button } from '../../components/Button/Button';
import { TextField } from '../../components/TextField/TextField';
import { useSession } from '../../lib/session/SessionProvider';
import { authMessage } from '../../lib/session/errors';
import logo from '../../../assets/logo/dologram_web_logo.png';
import styles from './AuthForm.module.css';

export type AuthMode = 'sign-in' | 'sign-up' | 'forgot-password' | 'reset-password' | 'change-password';
const titles: Record<AuthMode, string> = {
  'sign-in': strings.signIn.title, 'sign-up': strings.signUp.title, 'forgot-password': strings.forgotPassword.title,
  'reset-password': strings.resetPassword.title, 'change-password': strings.changePassword.title,
};

export function AuthForm({ mode }: { mode: AuthMode }) {
  const { status, session, error: sessionError, online, recoveryReady, pendingRevocation, passwordUpdated, controller } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState('');
  const passwordChange = mode === 'change-password' || mode === 'reset-password';
  const forced = status === 'mustChangePassword';
  const destination = status === 'passwordRecovery' && mode !== 'reset-password' ? '/reset-password'
    : forced && mode !== 'change-password' ? '/change-password'
    : status === 'signedIn' && !passwordChange ? '/'
    : mode === 'change-password' && status === 'signedOut' ? '/sign-in' : null;
  useEffect(() => { if (destination) router.replace(destination); }, [destination, router]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const disabled = !online || busy || status === 'loading' || status === 'error' || !!destination || (passwordChange && (!session || (mode === 'reset-password' && !recoveryReady)));
  const submitLabel = mode === 'sign-in' ? strings.signIn.title : mode === 'sign-up' ? strings.signUp.submit : mode === 'forgot-password' ? strings.forgotPassword.submit : strings.changePassword.save;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || disabled) return;
    const form = new FormData(event.currentTarget);
    const value = (name: string) => { const entry = form.get(name); return typeof entry === 'string' ? entry : ''; };
    const email = dgTrim(value('email'));
    const password = value('password');
    const confirm = value('confirm');
    const username = dgTrim(value('username')).toLowerCase();
    const displayName = dgTrim(value('displayName'));
    const next: Record<string, string> = {};
    if (mode === 'sign-in') {
      if (!validateEmail(email) && !validateUsername(email.toLowerCase())) next.email = strings.signIn.invalidIdentifier;
    } else if (!passwordChange && !validateEmail(email)) next.email = strings.signIn.invalidEmail;
    if (mode === 'sign-in' && !password) next.password = strings.signIn.passwordRequired;
    if ((passwordChange || mode === 'sign-up') && !validateNewPassword(password)) next.password = strings.changePassword.tooShort;
    if ((passwordChange || mode === 'sign-up') && password !== confirm) next.confirm = strings.changePassword.mismatch;
    if (mode === 'sign-up' && !validateUsername(username)) next.username = strings.signUp.usernameInvalid;
    if (mode === 'sign-up' && !validateDisplayName(displayName)) next.displayName = 'Use 1–64 characters for your display name.';
    setErrors(next);
    setFailure('');
    if (Object.keys(next).length) {
      const name = Object.keys(next)[0];
      const input = name ? event.currentTarget.elements.namedItem(name) : null;
      if (input instanceof HTMLElement) input.focus();
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      if (mode === 'sign-in') await controller.signIn(email, password);
      else if (mode === 'sign-up') {
        if (await controller.signUp(email, password, username, displayName)) {
          if (mounted.current) setMessage(strings.signUp.checkEmail);
        }
      } else if (mode === 'forgot-password') {
        await controller.forgotPassword(email);
        if (mounted.current) setMessage(strings.forgotPassword.sent);
      } else {
        await controller.changePassword(password);
        if (mounted.current) router.replace('/');
      }
    } catch (error) {
      if (mounted.current) setFailure(authMessage(error, mode === 'sign-in' ? "Couldn't sign in. Try again." : mode === 'sign-up' ? strings.signUp.failed : mode === 'forgot-password' ? strings.forgotPassword.failed : strings.resetPassword.saveFailed, mode === 'sign-in'));
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function verify() {
    if (submitting.current || !online) return;
    submitting.current = true;
    setBusy(true);
    try { await controller.verifyPassword(); if (mounted.current) router.replace('/'); }
    catch { if (mounted.current) setFailure('Access is still restricted or verification failed. Check your connection and retry; contact the administrator if access remains restricted.'); }
    finally { submitting.current = false; if (mounted.current) setBusy(false); }
  }

  return <main className={styles.page}><div className={styles.column}>
    <p className={styles.wordmark}><Image src={logo} alt="" width={40} height={40} className={styles.logo} unoptimized />DoloGram</p><h1 className={styles.title}>{titles[mode]}</h1>
    {forced && <p>{strings.changePassword.body}</p>}
    {!online && <p role="status">{strings.common.noConnection}</p>}
    {pendingRevocation && <p role="status">Signed out locally. Server revocation has not been confirmed.</p>}
    {(failure || sessionError) && <p role="alert" className={styles.error}>{failure || sessionError}</p>}
    {status === 'loading' && <p role="status">Loading your session…</p>}
    {status === 'error' && <><Button disabled={busy} onClick={() => void controller.restore()}>Retry session</Button><Button variant="text" disabled={busy} onClick={() => void controller.signOut()}>{pendingRevocation ? 'Retry local sign-out' : 'Sign out on this browser'}</Button><p>To sign in again, sign out on this browser to clear the saved session.</p></>}
    {message ? <p role="status">{message}</p> : <form className={styles.form} noValidate onSubmit={(event) => { void submit(event); }}>
      {!passwordChange && <TextField label={mode === 'sign-in' ? strings.signIn.emailOrUsername : strings.signIn.email} name="email" type={mode === 'sign-in' ? 'text' : 'email'} autoComplete={mode === 'sign-in' ? 'username' : 'email'} autoCapitalize="none" spellCheck={false} error={errors.email} disabled={busy} required />}
      {mode !== 'forgot-password' && <TextField label={passwordChange ? strings.changePassword.newPassword : strings.signIn.password} name="password" type="password" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} helper={mode === 'sign-in' ? undefined : strings.changePassword.helper} error={errors.password} disabled={busy} required />}
      {(passwordChange || mode === 'sign-up') && <TextField label={strings.changePassword.confirmPassword} name="confirm" type="password" autoComplete="new-password" error={errors.confirm} disabled={busy} required />}
      {mode === 'sign-up' && <><TextField label={strings.signUp.username} name="username" autoComplete="username" helper={strings.signUp.usernameHelper} error={errors.username} disabled={busy} required /><TextField label={strings.signUp.displayName} name="displayName" autoComplete="name" error={errors.displayName} disabled={busy} required /></>}
      <Button type="submit" loading={busy} disabled={disabled}>{submitLabel}</Button>
    </form>}
    <nav className={styles.links} aria-label="Account actions">
      {mode === 'sign-in' && <><Link href="/forgot-password">{strings.signIn.forgot}</Link><Link href="/sign-up">{strings.signIn.createAccount}</Link></>}
      {mode === 'reset-password' && <><Link href="/forgot-password" onClick={(event) => { if (status === 'passwordRecovery') { event.preventDefault(); void controller.signOut().then(() => router.replace('/forgot-password')); } }}>{strings.resetPassword.requestNew}</Link><Button variant="text" disabled={busy} onClick={() => { void controller.signOut().then(() => router.replace('/sign-in')); }}>Cancel recovery</Button></>}
      {passwordChange && passwordUpdated && <Button variant="text" disabled={busy || !online || !session || (mode === 'reset-password' && !recoveryReady)} onClick={() => { void verify(); }}>Retry verification</Button>}
      {mode === 'change-password' && !forced && status === 'signedIn' && <Link href="/">Back</Link>}
      {(mode === 'sign-up' || mode === 'forgot-password') && <Link href="/sign-in">{strings.forgotPassword.back}</Link>}
    </nav>
  </div></main>;
}
