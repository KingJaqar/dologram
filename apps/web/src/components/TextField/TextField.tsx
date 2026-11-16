'use client';

import { useId, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { strings } from '@dologram/shared/src/strings';
import { Icon } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';
import styles from './TextField.module.css';

type SharedProps = { label: string; helper?: string; error?: string; counter?: string; loading?: boolean };
export type TextFieldProps = SharedProps & (
  (InputHTMLAttributes<HTMLInputElement> & { multiline?: false }) |
  (TextareaHTMLAttributes<HTMLTextAreaElement> & { multiline: true; type?: never })
);

export function TextField({ label, helper, error, counter, loading = false, ...props }: TextFieldProps) {
  const generatedId = useId();
  const id = props.id || generatedId;
  const [visible, setVisible] = useState(false);
  const describedBy = [props['aria-describedby'], helper || error ? `${id}-message` : undefined, counter ? `${id}-counter` : undefined].filter(Boolean).join(' ') || undefined;
  const password = !props.multiline && props.type === 'password';
  const common = { id, 'aria-invalid': !!error, 'aria-describedby': describedBy, readOnly: loading || props.readOnly };
  return <div className={styles.field} data-error={!!error}>
    <label htmlFor={id}>{label}</label>
    <div className={styles.control}>
      {props.multiline ? (() => { const { multiline, ...rest } = props; return multiline && <textarea {...rest} {...common} rows={rest.rows ?? 3} />; })()
        : (() => { const { multiline, ...rest } = props; return !multiline && <input {...rest} {...common} type={password && visible ? 'text' : rest.type} />; })()}
      {password && <IconButton label={visible ? strings.action.hidePassword : strings.action.showPassword} icon={visible ? 'action.hidePassword' : 'action.showPassword'} onClick={() => setVisible((value) => !value)} disabled={props.disabled} aria-controls={id} aria-pressed={visible} />}
    </div>
    {(helper || error || counter) && <div id={`${id}-help`} className={styles.help}>
      <span id={`${id}-message`} aria-live="polite">{error ? <><Icon name="status.failed" size="xs" /> {error}</> : helper}</span>
      {counter && <span id={`${id}-counter`} className={styles.counter}>{counter}</span>}
    </div>}
  </div>;
}
