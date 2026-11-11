import { useEffect, useRef, useState } from 'react';
import { config } from '@dologram/shared';

/** Delays transient loading UI so fast cache reads do not flash a spinner. */
export function useDelayedFlag(
  active: boolean,
  delayMs: number = config.ui.loadingDelayMs,
): boolean {
  const generationRef = useRef(0);
  const [readyGeneration, setReadyGeneration] = useState(-1);

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    if (!active) return;

    const timer = setTimeout(() => {
      if (generationRef.current === generation) setReadyGeneration(generation);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);

  return active && readyGeneration === generationRef.current;
}
