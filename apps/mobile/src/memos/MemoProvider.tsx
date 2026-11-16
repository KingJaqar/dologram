import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { memoScope, subscribeMemoScope } from './lifecycle';
import { enrollMemoAccount } from './vault';

const EnrollmentContext = createContext<string | null>(null);
export function MemoProvider({ children }: { children: React.ReactNode }) {
  const { status, session } = useAuth();
  const [failure, setFailure] = useState<{ accountId: string; message: string } | null>(null);
  const accountId = session?.user.id;
  useEffect(() => {
    if (!accountId || (status !== 'signedIn' && status !== 'mustChangePassword')) return;
    let active = true;
    void enrollMemoAccount(accountId, status === 'mustChangePassword').then(() => {
      if (active) setFailure(null);
    }).catch((error: unknown) => {
      if (active) setFailure({ accountId, message: error instanceof Error ? error.message : 'Memo enrollment failed. Retry after signing in.' });
    });
    return () => { active = false; };
  }, [accountId, status]);
  return <EnrollmentContext.Provider value={failure?.accountId === accountId ? failure?.message ?? null : null}>{children}</EnrollmentContext.Provider>;
}
export function useMemoAccess() {
  const scope = useSyncExternalStore(subscribeMemoScope, memoScope, memoScope);
  const error = useContext(EnrollmentContext);
  return { scope, error };
}
