/**
 * The "people you already share a chat with" list (AND-11, AND-12, D-70).
 *
 * Read from the cache, so the checklist renders offline; `exclude` leaves out the caller and the
 * members a chat already has.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { buildContactList, type ContactCandidate } from '@dologram/shared';
import { useAuth } from '../auth/AuthProvider';
import { getLocalDatabase } from '../queue/db';
import { subscribeCacheChange } from '../sync/cacheEvents';
import { loadCachedContacts } from './infoQuery';

export type ContactsData = {
  loading: boolean;
  error: boolean;
  contacts: ContactCandidate[];
  reload: () => Promise<void>;
};

export function useContacts(exclude: readonly string[] = []): ContactsData {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [loaded, setLoaded] = useState<{ userId: string; contacts: ContactCandidate[] } | null>(
    null,
  );
  const [error, setError] = useState(false);
  const inflight = useRef(false);
  const excludeKey = [...exclude].sort().join(',');

  const reload = useCallback(async () => {
    if (!userId) return;
    if (inflight.current) return;
    inflight.current = true;
    try {
      const db = await getLocalDatabase();
      const rows = await loadCachedContacts(db, userId);
      const excluded = excludeKey === '' ? [] : excludeKey.split(',');
      setLoaded({ userId, contacts: buildContactList(rows, userId, excluded) });
      setError(false);
    } catch {
      setError(true);
    } finally {
      inflight.current = false;
    }
  }, [userId, excludeKey]);

  useEffect(() => subscribeCacheChange(() => void reload()), [reload]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const contacts = useMemo(
    () => (loaded !== null && loaded.userId === userId ? loaded.contacts : []),
    [loaded, userId],
  );

  return { loading: loaded === null && !error, error, contacts, reload };
}
