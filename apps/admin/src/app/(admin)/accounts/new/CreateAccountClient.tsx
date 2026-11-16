'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { validateDisplayName, validateEmail, validateUsername } from '@dologram/shared/src/validation/account';
import { dgTrim } from '@dologram/shared/src/validation/text';
import { AdminForm } from '../../../../components/AdminForm/AdminForm';
import { GeneratedPasswordPanel } from '../../../../components/AdminForm/GeneratedPasswordPanel';
import { Button } from '../../../../components/Button/Button';
import { ErrorState } from '../../../../components/ErrorState/ErrorState';
import { Icon } from '../../../../components/Icon/Icon';
import { TextField } from '../../../../components/TextField/TextField';
import { strings } from '../../../../strings';
import { createAccount, generatePassword, recoverAccountCreation } from './actions';
import type { CreateAccountField } from './types';
import styles from './create.module.css';

type Values = Record<CreateAccountField, string>;

const fields: readonly CreateAccountField[] = ['email', 'username', 'displayName'];
const emptyValues: Values = { email: '', username: '', displayName: '' };

function validationErrors(values: Values): Partial<Record<CreateAccountField, string>> {
  const errors: Partial<Record<CreateAccountField, string>> = {};
  if (!validateEmail(dgTrim(values.email).toLowerCase())) errors.email = strings.createAccount.emailInvalid;
  if (!validateUsername(dgTrim(values.username).toLowerCase())) errors.username = strings.createAccount.usernameInvalid;
  if (!validateDisplayName(dgTrim(values.displayName))) errors.displayName = strings.createAccount.displayNameInvalid;
  return errors;
}

export function CreateAccountClient({ prerequisite }: { prerequisite?: string }) {
  const [values, setValues] = useState<Values>(emptyValues);
  const [touched, setTouched] = useState<Partial<Record<CreateAccountField, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<Partial<Record<CreateAccountField, string>>>({});
  const [password, setPassword] = useState('');
  const [passwordDraftId, setPasswordDraftId] = useState('');
  const [draftPending, setDraftPending] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [retry, setRetry] = useState<'draft' | 'create'>('draft');
  const [failedUserId, setFailedUserId] = useState<string>();
  const [operationId, setOperationId] = useState<string>();
  const [created, setCreated] = useState<{ userId: string; password: string; auditRecorded: boolean; refreshFailed?: boolean }>();
  const started = useRef(false);
  const mounted = useRef(true);
  const busy = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Regenerating replaces the server draft, so a superseded id can never be submitted.
  const refreshPassword = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setPassword('');
    setPasswordDraftId('');
    setDraftPending(true);
    setMessage(undefined);
    setRetry('draft');
    try {
      const result = await generatePassword();
      if (!mounted.current) return;
      if (result.ok) {
        setPassword(result.password);
        setPasswordDraftId(result.passwordDraftId);
      } else {
        setMessage(result.message);
      }
    } catch {
      if (mounted.current) setMessage(strings.common.requestFailed);
    } finally {
      busy.current = false;
      if (mounted.current) setDraftPending(false);
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void refreshPassword();
  }, [refreshPassword]);

  // Editing a field clears the server's field error; the value is re-checked on submit.
  function update(field: CreateAccountField, value: string) {
    setValues(current => ({ ...current, [field]: value }));
    setServerErrors(current => {
      if (current[field] === undefined) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function create() {
    const validation = validationErrors(values);
    if (busy.current || prerequisite || failedUserId || operationId || !passwordDraftId
      || fields.some(field => validation[field] !== undefined)) return;
    busy.current = true;
    setPending(true);
    setServerErrors({});
    setMessage(undefined);
    setRetry('create');
    try {
      const result = await createAccount({ ...values, passwordDraftId });
      if (!mounted.current) return;
      if (result.ok && 'result' in result) return;
      if (result.ok) {
        setCreated(result);
        setOperationId(result.auditRecorded ? undefined : result.operationId);
        setPassword('');
        setPasswordDraftId('');
        return;
      }
      if ('field' in result && result.field) {
        const field = result.field;
        setTouched(current => ({ ...current, [field]: true }));
        setServerErrors({ [field]: result.message });
      } else {
        setMessage(result.message);
        if (result.userId) setFailedUserId(result.userId);
        if (result.operationId) setOperationId(result.operationId);
        else if (!result.userId) setRetry('draft');
      }
    } catch {
      if (mounted.current) {
        // The response may have been lost after Auth committed. The consumed
        // draft is also the operation identity; recovery never creates again.
        setOperationId(passwordDraftId);
        setMessage(strings.createAccount.recoveryRequired);
      }
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }

  async function recover() {
    if (busy.current || prerequisite || !operationId) return;
    busy.current = true;
    setPending(true);
    setMessage(undefined);
    try {
      const result = await recoverAccountCreation(operationId);
      if (!mounted.current) return;
      if (result.ok) {
        setCreated({ ...result, password: created?.password ?? password });
        if (result.auditRecorded) setOperationId(undefined);
        setFailedUserId(undefined);
        setPassword('');
        setPasswordDraftId('');
      } else {
        setMessage(result.message);
        if (result.userId) setFailedUserId(result.userId);
      }
    } catch {
      if (mounted.current) setMessage(strings.common.requestFailed);
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void create();
  }

  if (created) {
    return <section className={styles.created} aria-live="polite">
      <p className={styles.success}><Icon name="admin.success" size="sm" />{strings.createAccount.created}</p>
      <GeneratedPasswordPanel mode="created" password={created.password} />
      {!created.auditRecorded && <p role="alert" className={styles.message}>{strings.createAccount.auditFailed}</p>}
      {created.refreshFailed && <p role="alert" className={styles.message}>{strings.createAccount.refreshFailed}</p>}
      {message && <ErrorState error={message} />}
      {operationId && <Button loading={pending} disabled={pending} onClick={() => void recover()}>{strings.createAccount.recover}</Button>}
      <Link className={styles.link} href={`/accounts/${created.userId}`}>{strings.createAccount.openAccount}</Link>
    </section>;
  }

  const validation = validationErrors(values);
  const errors: Partial<Record<CreateAccountField, string>> = {};
  for (const field of fields) {
    const serverError = serverErrors[field];
    if (serverError) {
      errors[field] = serverError;
      continue;
    }
    const clientError = validation[field];
    if (clientError && touched[field]) errors[field] = clientError;
  }
  const valid = fields.every(field => validation[field] === undefined);

  return <div className={styles.view}>
    {prerequisite && <p role="alert" className={styles.prerequisite}>
      <Icon name="admin.warning" size="sm" /><span>{prerequisite}</span>
    </p>}
    <AdminForm
      title={strings.createAccount.formTitle}
      onSubmit={submit}
      actions={<Button type="submit" loading={pending} disabled={Boolean(prerequisite || failedUserId || operationId) || !valid || draftPending || !passwordDraftId}>
        {strings.createAccount.submit}
      </Button>}
    >
      <TextField label={strings.accounts.email} name="email" type="email" autoComplete="off" maxLength={254}
        value={values.email} disabled={pending || Boolean(operationId)} required error={errors.email}
        onChange={value => update('email', value)}
        onBlur={() => setTouched(current => ({ ...current, email: true }))} />
      <TextField label={strings.accounts.username} name="username" mono autoComplete="off" maxLength={32}
        value={values.username} disabled={pending || Boolean(operationId)} required error={errors.username}
        onChange={value => update('username', value)}
        onBlur={() => setTouched(current => ({ ...current, username: true }))} />
      <TextField label={strings.accounts.displayName} name="displayName" autoComplete="off" maxLength={128}
        value={values.displayName} disabled={pending || Boolean(operationId)} required error={errors.displayName}
        onChange={value => update('displayName', value)}
        onBlur={() => setTouched(current => ({ ...current, displayName: true }))} />
      {draftPending
        ? <p role="status" className={styles.status}>{strings.createAccount.generating}</p>
        : password && <GeneratedPasswordPanel password={password} mode="beforeCreate" disabled={pending || Boolean(operationId)}
          onRegenerate={() => void refreshPassword()} />}
      {message && <ErrorState error={message}
        onRetry={pending || draftPending || failedUserId || operationId || prerequisite ? undefined
          : () => { void (retry === 'draft' ? refreshPassword() : create()); }} />}
      {failedUserId && <Link className={styles.link} href={`/accounts/${failedUserId}`}>
        {strings.createAccount.openAccount}
      </Link>}
      {operationId && <Button loading={pending} disabled={pending} onClick={() => void recover()}>{strings.createAccount.recover}</Button>}
    </AdminForm>
  </div>;
}
