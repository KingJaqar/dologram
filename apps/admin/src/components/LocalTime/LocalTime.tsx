'use client';

import { useSyncExternalStore } from 'react';

export type LocalTimeMode = 'date' | 'datetime' | 'datetime-seconds';

function formatLocal(value: string, mode: LocalTimeMode): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('LocalTime requires a valid timestamp.');
  const two = (n: number) => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
  if (mode === 'date') return day;
  const time = `${two(date.getHours())}:${two(date.getMinutes())}`;
  return mode === 'datetime' ? `${day} ${time}` : `${day} ${time}:${two(date.getSeconds())}`;
}

const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** Renders a timestamp in the browser's own time zone without hydration drift. */
export function LocalTime({ value, mode = 'datetime-seconds' }: { value: string; mode?: LocalTimeMode }) {
  const hydrated = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
  return <time dateTime={value}>{hydrated ? formatLocal(value, mode) : '—'}</time>;
}
