'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import { useToast } from '../Toast/Toast';
import { strings } from '../../strings';
import styles from './AdminForm.module.css';

type PasswordActions = { mode: 'beforeCreate'; onRegenerate: () => void; onDownloadCsv?: never }
  | { mode: 'csv'; onDownloadCsv: () => void; onRegenerate?: never }
  | { mode: 'created'; onRegenerate?: never; onDownloadCsv?: never };

export type GeneratedPasswordPanelProps = PasswordActions & { password: string; disabled?: boolean };

export function GeneratedPasswordPanel({ password, disabled = false, ...actions }: GeneratedPasswordPanelProps) {
  const showToast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const copying = useRef(false);
  const [fallback, setFallback] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function copy() {
    if (copying.current) return;
    copying.current = true;
    try {
      await navigator.clipboard.writeText(password);
      if (mounted.current) { setFallback(false); showToast({ message: strings.common.copied }); }
    } catch {
      if (mounted.current) {
        input.current?.focus();
        input.current?.select();
        setFallback(true);
      }
    } finally { copying.current = false; }
  }
  return <section className={styles['password-panel']} aria-label={strings.password.label}>
    <p className={styles.warning}><Icon name="admin.warning" size="sm" />{strings.password.warning}</p>
    <input ref={input} className={styles.password} aria-label={strings.password.label} readOnly value={password}
      autoComplete="off" spellCheck={false} />
    {fallback && <p role="status" className={styles.warning}>{strings.password.copyFallback}</p>}
    <div className={styles.actions}>
      <Button variant="secondary" disabled={disabled || !password} onClick={copy}>{strings.common.copy}</Button>
      {actions.mode === 'beforeCreate' && <Button variant="secondary" disabled={disabled} onClick={actions.onRegenerate}>{strings.password.regenerate}</Button>}
      {actions.mode === 'csv' && <Button variant="secondary" disabled={disabled || !password} onClick={actions.onDownloadCsv}>{strings.password.downloadCsv}</Button>}
    </div>
  </section>;
}
