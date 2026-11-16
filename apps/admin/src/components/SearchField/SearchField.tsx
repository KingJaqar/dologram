'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { motion } from '@dologram/shared/src/theme/tokens';
import styles from './SearchField.module.css';

export interface SearchFieldProps {
  placeholder: string;
  label?: string;
  value: string;
  onSearch: (value: string) => void;
  disabled?: boolean;
}

export function SearchField({ placeholder, label = placeholder, value, onSearch, disabled = false }: SearchFieldProps) {
  const [previousValue, setPreviousValue] = useState(value);
  const [draft, setDraft] = useState(value);
  if (previousValue !== value) {
    setPreviousValue(value);
    setDraft(value);
  }
  const search = useEffectEvent(onSearch);
  useEffect(() => {
    if (draft === value || disabled) return;
    const timer = setTimeout(() => search(draft), motion.delay.search);
    return () => clearTimeout(timer);
  }, [draft, value, disabled]);
  return <input type="search" aria-label={label} placeholder={placeholder} value={draft}
    disabled={disabled} onChange={event => setDraft(event.target.value)} className={styles.search} />;
}
