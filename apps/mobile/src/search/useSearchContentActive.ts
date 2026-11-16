import { useEffect, useState } from 'react';
import { SEARCH_TRANSITION_MS } from './transition';

export function useSearchContentActive(focused: boolean, reduceMotion: boolean): boolean {
  const [retain, setRetain] = useState(focused);
  if (focused && !retain) setRetain(true);

  useEffect(() => {
    if (focused || reduceMotion) return;
    // A blurred card is still visible during its fade. Keep its result rows
    // mounted until it is covered, then release its search subscriptions.
    const timeout = setTimeout(() => setRetain(false), SEARCH_TRANSITION_MS);
    return () => clearTimeout(timeout);
  }, [focused, reduceMotion]);

  return focused || (retain && !reduceMotion);
}
