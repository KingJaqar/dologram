'use client';

import type { Key, ReactNode } from 'react';
import type { IconName } from '@dologram/shared/src/theme/icons';
import { Button } from '../Button/Button';
import { EmptyState } from '../EmptyState/EmptyState';
import { Skeleton } from '../Skeleton/Skeleton';
import { useDelayedFlag } from '../Skeleton/useDelayedFlag';
import { strings } from '../../strings';
import styles from './DataTable.module.css';

export interface DataTableColumn<Row> {
  key: Extract<keyof Row, string>;
  header: string;
  widthPercent: number;
  align: 'left' | 'right';
  mono?: boolean;
  render?: (row: Row) => ReactNode;
}

export interface DataTableProps<Row> {
  columns: readonly DataTableColumn<Row>[];
  /** Current page only; total counts all matching rows. */
  rows: readonly Row[];
  rowKey: (row: Row) => Key;
  onRowOpen?: (row: Row) => void;
  rowClassName?: (row: Row) => string | undefined;
  page: number;
  pageSize: 50;
  total: number;
  onPageChange: (page: number) => void;
  state: 'ready' | 'loading' | 'error' | 'empty';
  emptyText: string;
  errorContent: ReactNode;
  label?: string;
  emptyIcon?: IconName;
}

function cellValue(value: unknown): ReactNode {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  throw new Error('Non-text table values require a column render function.');
}

export function DataTable<Row>({ columns, rows, rowKey, onRowOpen, rowClassName, page, pageSize, total, onPageChange,
  state, emptyText, errorContent, label = strings.table.label, emptyIcon = 'admin.accounts' }: DataTableProps<Row>) {
  const showSkeleton = useDelayedFlag(state === 'loading');
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(total) || total < 0 || pageSize !== 50 || rows.length > pageSize) {
    throw new Error('DataTable requires a positive page, a nonnegative total and at most 50 current-page rows.');
  }
  if (columns.length === 0 || columns.some(column => !Number.isFinite(column.widthPercent) || column.widthPercent <= 0 || column.widthPercent > 100)) {
    throw new Error('DataTable columns require percentage widths between 0 and 100.');
  }
  const offset = (page - 1) * pageSize;
  const ready = state === 'ready' && rows.length > 0 && offset < total;
  const first = ready ? offset + 1 : 0;
  const last = ready ? Math.min(offset + rows.length, total) : 0;
  const pending = state === 'loading';
  const openFromTarget = (target: EventTarget | null, row: HTMLTableRowElement) =>
    target instanceof Element && !target.closest('a, button, input, select, textarea, [role="button"], [contenteditable="true"]') && row.contains(target);

  return <div className={styles.card} aria-busy={pending || undefined}>
    <div className={styles.scroll} role="region" aria-label={label}>
      <table className={styles.table} aria-label={label}>
        <colgroup>{columns.map(column => <col key={column.key} style={{ width: `${column.widthPercent}%` }} />)}</colgroup>
        <thead><tr>{columns.map(column => <th key={column.key} scope="col" className={styles[column.align]}>{column.header}</th>)}</tr></thead>
        <tbody>
          {ready ? rows.map(row => <tr key={rowKey(row)} tabIndex={onRowOpen ? 0 : undefined}
            className={`${onRowOpen ? styles.clickable : ''} ${rowClassName?.(row) ?? ''}`}
            onClick={onRowOpen ? event => { if (openFromTarget(event.target, event.currentTarget)) onRowOpen(row); } : undefined}
            onKeyDown={onRowOpen ? event => {
              if (event.key === 'Enter' && !event.repeat && event.target === event.currentTarget) { event.preventDefault(); onRowOpen(row); }
            } : undefined}>
            {columns.map(column => <td key={column.key} className={`${styles[column.align]} ${column.mono ? styles.mono : ''}`}>
              {column.render ? column.render(row) : cellValue(row[column.key])}
            </td>)}
          </tr>) : <tr><td colSpan={columns.length} className={styles.state}>
            {pending ? showSkeleton && <Skeleton variant="adminTable" /> : state === 'error' ? errorContent : <EmptyState icon={emptyIcon} title={emptyText} />}
          </td></tr>}
        </tbody>
      </table>
    </div>
    <div className={styles.footer}>
      <span role="status">{strings.table.range(first, last, total)}</span>
      <Button variant="secondary" disabled={pending || page <= 1} onClick={() => onPageChange(page - 1)}>{strings.table.previous}</Button>
      <Button variant="secondary" disabled={pending || page >= Math.ceil(total / pageSize)} onClick={() => onPageChange(page + 1)}>{strings.table.next}</Button>
    </div>
  </div>;
}
