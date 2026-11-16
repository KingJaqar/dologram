'use client';

import { useId, type InputHTMLAttributes } from 'react';
import { strings } from '@dologram/shared/src/strings';
import { Icon } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';
import styles from './SearchField.module.css';

export interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  label: string; value: string; onValueChange: (value: string) => void;
  helper?: string; error?: string; counter?: string;
}
/** Filtering/debouncing belongs to the consumer; clearing is immediate. */
export function SearchField({ label, value, onValueChange, id, helper, error, counter, ...props }: SearchFieldProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const describedBy = [props['aria-describedby'], helper || error ? `${inputId}-message` : undefined, counter ? `${inputId}-counter` : undefined].filter(Boolean).join(' ') || undefined;
  return <div className={styles.field} data-error={!!error}><div className={styles.search}>
    <label htmlFor={inputId} className="dg-visually-hidden">{label}</label>
    <Icon name="action.search" />
    <input {...props} id={inputId} type="search" aria-invalid={!!error} aria-describedby={describedBy} value={value} onChange={(event) => onValueChange(event.target.value)} />
    {value && <IconButton label={strings.search.clear} icon="nav.close" disabled={props.disabled} onClick={() => { onValueChange(''); document.getElementById(inputId)?.focus(); }} />}
  </div>{(helper || error || counter) && <div className={styles.help}>
    <span id={`${inputId}-message`} aria-live="polite">{error ? <><Icon name="status.failed" size="xs" /> {error}</> : helper}</span>
    {counter && <span id={`${inputId}-counter`}>{counter}</span>}
  </div>}</div>;
}
