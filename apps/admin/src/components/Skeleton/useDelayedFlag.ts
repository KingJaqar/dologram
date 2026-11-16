'use client';

import { useEffect, useState } from 'react';
import { motion } from '@dologram/shared/src/theme/tokens';

export function useDelayedFlag(loading: boolean, delay: number = motion.delay.loading): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setVisible(true), delay);
    return () => {
      clearTimeout(timer);
      setVisible(false);
    };
  }, [loading, delay]);
  return loading && visible;
}
