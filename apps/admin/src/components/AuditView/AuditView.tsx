'use client';

import { useId, useState } from 'react';
import { DataTable, type DataTableColumn, type DataTableProps } from '../DataTable/DataTable';
import { FilterBar } from '../FilterBar/FilterBar';
import { IconButton } from '../Button/Button';
import { LocalTime } from '../LocalTime/LocalTime';
import { StatusPill } from '../StatusPill/StatusPill';
import { strings } from '../../strings';
import styles from './AuditView.module.css';

export interface AuditRow {
  id: string;
  at: string;
  action: string;
  targetUsername: string | null;
  result: 'success' | 'failed';
  /** Safe, redacted display text supplied by the audit query. */
  detail: string;
}

export interface AuditViewProps extends Pick<DataTableProps<AuditRow>, 'rows' | 'page' | 'total' | 'onPageChange' | 'state' | 'errorContent'> {
  actionNames: readonly string[];
  action: string;
  onActionChange: (value: string) => void;
  target: string;
  onTargetChange: (value: string) => void;
}

function Detail({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return <div className={styles.detail}>
    <span className={styles.summary}>{text}</span>
    <IconButton label={expanded ? strings.audit.hideDetail : strings.audit.showDetail} name={expanded ? 'action.hidePassword' : 'action.view'}
      aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)} />
    <pre id={id} hidden={!expanded} className={styles.full}>{text}</pre>
  </div>;
}

export function AuditView({ rows, page, total, onPageChange, state, errorContent, actionNames, action, onActionChange, target, onTargetChange }: AuditViewProps) {
  const columns: DataTableColumn<AuditRow>[] = [
    { key: 'at', header: strings.audit.time, widthPercent: 18, align: 'left', render: row => <LocalTime value={row.at} /> },
    { key: 'action', header: strings.audit.action, widthPercent: 18, align: 'left', mono: true },
    { key: 'targetUsername', header: strings.audit.username, widthPercent: 18, align: 'left', render: row => row.targetUsername ?? '—' },
    { key: 'result', header: strings.audit.result, widthPercent: 12, align: 'left', render: row => <StatusPill value={row.result} /> },
    { key: 'detail', header: strings.audit.detail, widthPercent: 34, align: 'left', render: row => <Detail key={row.id} text={row.detail} /> },
  ];
  return <div className={styles.view}>
    <FilterBar search={{ placeholder: strings.audit.target, value: target, onSearch: onTargetChange }}
      select={{ label: strings.audit.action, options: [strings.audit.allActions, ...actionNames], value: action || strings.audit.allActions,
        onChange: value => onActionChange(value === strings.audit.allActions ? '' : value) }} />
    <DataTable columns={columns} rows={rows} rowKey={row => row.id} page={page} pageSize={50} total={total} onPageChange={onPageChange}
      state={state} emptyText={strings.audit.empty} errorContent={errorContent} label={strings.audit.label} emptyIcon="admin.audit" />
  </div>;
}
