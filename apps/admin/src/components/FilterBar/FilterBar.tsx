'use client';

import { useId } from 'react';
import { SearchField, type SearchFieldProps } from '../SearchField/SearchField';
import styles from './FilterBar.module.css';

export interface FilterBarProps {
  search: Pick<SearchFieldProps, 'placeholder' | 'value' | 'onSearch'>;
  chips?: readonly { id: string; label: string }[];
  selectedChip?: string;
  onChip?: (id: string) => void;
  select?: { label: string; options: readonly string[]; value: string; onChange: (value: string) => void };
}

export function FilterBar({ search, chips = [], selectedChip, onChip, select }: FilterBarProps) {
  const selectId = useId();
  return <div className={styles.bar}>
    <div className={styles.search}><SearchField {...search} /></div>
    {chips.map(chip => <button key={chip.id} type="button" aria-pressed={chip.id === selectedChip}
      disabled={!onChip} onClick={() => onChip?.(chip.id)} className={styles.chip}>{chip.label}</button>)}
    {select && <div className={styles.selection}>
      <label htmlFor={selectId}>{select.label}</label>
      <select id={selectId} value={select.value} onChange={event => select.onChange(event.target.value)} className={styles.select}>
        {select.options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>}
  </div>;
}
