'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { notifyOverlayNavigation } from './useOverlayHistory';

/** Covers persistent overlay consumers during both pathname and query navigation. */
export function OverlayHistoryObserver() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => notifyOverlayNavigation(), [pathname, search]);
  return null;
}
