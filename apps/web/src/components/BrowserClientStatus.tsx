'use client';

import { useSyncExternalStore } from 'react';
import { getBrowserClientProblem, retryBrowserClient, subscribeBrowserClientProblem } from '../lib/supabase';

export function BrowserClientStatus() {
  const problem = useSyncExternalStore(subscribeBrowserClientProblem, getBrowserClientProblem, () => null);
  if (!problem) return null;
  return (
    <section aria-label="Connection recovery">
      <p role="alert">{problem.message}</p>
      <button type="button" onClick={() => {
        try { retryBrowserClient(); } catch { /* The shared problem store retains the safe recovery message. */ }
      }}>Try again</button>
    </section>
  );
}
