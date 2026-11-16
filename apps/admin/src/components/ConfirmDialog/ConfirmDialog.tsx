'use client';

import { useEffect, useRef, useState } from 'react';
import { Dialog } from '../Dialog/Dialog';
import { Button } from '../Button/Button';
import { TextField } from '../TextField/TextField';
import { strings } from '../../strings';
import styles from './ConfirmDialog.module.css';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
  actionLabel: string;
  tone: 'danger' | 'primary';
  typedConfirmation?: string;
  disabledReason?: string;
  onConfirm: () => Promise<{ ok: true } | { ok: false; message: string }>;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  // Each opening owns fresh confirmation/error state, including after interrupted unmounts.
  return props.open ? <Confirmation key={props.typedConfirmation} {...props} /> : null;
}

function Confirmation({ title, body, actionLabel, tone, typedConfirmation, disabledReason, onConfirm, onClose }: ConfirmDialogProps) {
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const disabled = Boolean(disabledReason) || (typedConfirmation !== undefined && value !== typedConfirmation);
  async function confirm() {
    if (disabled || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(undefined);
    try {
      const result = await onConfirm();
      if (!mounted.current) return;
      if (result.ok) onClose();
      else setError(result.message || strings.common.refused);
    } catch {
      if (mounted.current) setError(strings.common.requestFailed);
    } finally {
      inFlight.current = false;
      if (mounted.current) setPending(false);
    }
  }
  return <Dialog open title={title} onClose={() => { if (!inFlight.current) onClose(); }} busy={pending} error={error}>
    <p className={styles.body}>{body}</p>
    {typedConfirmation !== undefined && <TextField label={strings.confirm.typeToConfirm(typedConfirmation)} value={value}
      onChange={setValue} disabled={pending} autoComplete="off" />}
    {disabledReason && <p className={styles.body}>{disabledReason}</p>}
    <div className={styles.actions}>
      <Button variant="secondary" data-dialog-cancel disabled={pending} onClick={onClose}>{strings.common.cancel}</Button>
      <Button variant={tone} loading={pending} disabled={disabled} onClick={confirm}>{actionLabel}</Button>
    </div>
  </Dialog>;
}
