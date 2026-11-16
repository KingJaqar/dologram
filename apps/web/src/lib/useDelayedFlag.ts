'use client';

import { useEffect, useState } from 'react';
import { motion } from '@dologram/shared/src/theme/tokens';

export function useDelayedFlag(active: boolean, delay: number = motion.delay.loading): boolean {
  const [ready, setReady] = useState(false);
  // Reset during render so a stopped/restarted wait never reuses the previous delay.
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    setReady(false);
  }
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setReady(true), delay);
    return () => window.clearTimeout(timer);
  }, [active, delay]);
  return active && ready;
}
