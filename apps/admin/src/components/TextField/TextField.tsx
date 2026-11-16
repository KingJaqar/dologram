'use client';

import { useId, type InputHTMLAttributes } from 'react';
import { Icon } from '../Icon/Icon';
import styles from './TextField.module.css';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  mono?: boolean;
}

export function TextField({ label, value, onChange, error, mono = false, type = 'text', id, className = '', 'aria-describedby': describedBy, ...props }: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;
  return <div className={styles.field}>
    <label htmlFor={fieldId} className={styles.label}>{label}</label>
    <input {...props} id={fieldId} type={type} value={value} onChange={event => onChange(event.target.value)}
      aria-invalid={error ? true : props['aria-invalid']} aria-describedby={[describedBy, error ? errorId : undefined].filter(Boolean).join(' ') || undefined}
      className={`${styles.input} ${mono || type === 'password' ? styles.mono : ''} ${className}`} />
    {error && <p id={errorId} className={styles.error}><Icon name="status.failed" size="xs" />{error}</p>}
  </div>;
}
