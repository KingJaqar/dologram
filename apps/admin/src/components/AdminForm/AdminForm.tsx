import { useId, type FormHTMLAttributes, type ReactNode } from 'react';
import styles from './AdminForm.module.css';

export interface AdminFormProps extends Omit<FormHTMLAttributes<HTMLFormElement>, 'title' | 'children'> {
  title: string;
  children: ReactNode;
  actions: ReactNode;
}

export function AdminForm({ title, children, actions, ...props }: AdminFormProps) {
  const titleId = useId();
  return <form {...props} aria-labelledby={titleId} className={`${styles.card} ${props.className ?? ''}`}>
    <h2 id={titleId} className={styles.title}>{title}</h2>
    <div className={styles.fields}>{children}</div>
    <div className={styles.actions}>{actions}</div>
  </form>;
}
