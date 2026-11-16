'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Button } from '../../components/Button/Button';
import { useSession } from '../session/SessionProvider';
import { IndexedDbStore, storageMessage } from './IndexedDbStore';
import { BrowserQueueWorker } from '../queue/worker';
import { createSupabaseSender } from '../queue/supabaseSender';
import { getSupabase } from '../supabase';
import { BrowserSyncHost, type SyncStatus } from '../sync/host';

const Context = createContext<IndexedDbStore | null>(null);
const FeedbackContext = createContext<ReactNode>(null);
export function StoreFeedback() { return useContext(FeedbackContext); }
export function StoreProvider({ children }: { children: ReactNode }) {
  const { status, session } = useSession();
  const owner = status === 'signedIn' ? session?.user.id : undefined;
  return owner ? <AccountStore key={owner} owner={owner}>{children}</AccountStore> : null;
}
function AccountStore({ owner, children }: { owner: string; children: ReactNode }) {
  const { controller } = useSession();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ store: IndexedDbStore | null; error: string | null }>({ store: null, error: null });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('syncing');
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const store = new IndexedDbStore(owner);
    let worker: BrowserQueueWorker | undefined;
    let sync: BrowserSyncHost | undefined;
    const valid = () => { const current = controller.getSnapshot(); return active && current.status === 'signedIn' && current.session?.user.id === owner; };
    const fail = (error: unknown) => {
      if (active) setState({ store: null, error: error instanceof Error && error.message ? error.message : storageMessage });
      sync?.stop(); store.close();
      void worker?.stop();
    };
    const unregister = controller.registerLocalCleanup(async () => {
      sync?.stop(); store.quiesce();
      await worker?.stop();
      store.close();
      const cleanupStore = new IndexedDbStore(owner);
      try {
        const result = await cleanupStore.wipe();
        if (result === 'retained') return 'Your local records were cleared. Database deletion is blocked; close other DoloGram tabs to finish cleanup.';
      } finally { cleanupStore.close(); }
    });
    // A quiesce means this browser's owner was cleared elsewhere: stop work and leave no owner visible.
    store.onQuiesce = () => { sync?.stop(); void worker?.stop(); controller.remoteSignOut(); };
    store.onClosed = () => fail(new Error('Browser storage closed. Reload to continue with the current account.'));
    void store.init().then(() => {
      if (!active) { store.close(); return; }
      worker = new BrowserQueueWorker(store, createSupabaseSender({ client: getSupabase(),
        cache: (row, current) => store.upsertMessage(row, current), invalidSession: () => { sync?.stop(); worker?.suspend(); } }),
      valid,
      (message) => { if (active) setDeliveryError(message); }, undefined, undefined, undefined, (lease) => {
        sync?.stop();
        sync = new BrowserSyncHost(store, lease, getSupabase(), (status) => { if (active) setSyncStatus(status); }, valid);
        sync.start();
      });
      worker.start();
      setState({ store, error: null });
    }).catch(fail);
    return () => { active = false; unregister(); sync?.stop(); void worker?.stop(); store.close(); };
  }, [owner, controller, attempt]);
  if (state.error) return <main><h1>Browser storage unavailable</h1><p role="alert">{state.error}</p><Button onClick={() => { setState({ store: null, error: null }); setAttempt((value) => value + 1); }}>Retry</Button><Button variant="text" onClick={() => void controller.signOut()}>Sign out on this browser</Button></main>;
  if (!state.store) return <main><p role="status">Opening browser storage…</p></main>;
  return <Context.Provider value={state.store}><FeedbackContext value={<>
    {syncStatus !== 'synced' && <p role="status">{syncStatus === 'syncing' ? 'Syncing your history…' : syncStatus === 'offline' ? 'Offline. Cached history is available.' : syncStatus === 'paused' ? 'Sync paused after repeated failures. Reload to retry; cached history is retained.' : 'Live sync is unavailable. Catch-up is delayed; cached history is retained.'}</p>}
    {deliveryError && <section aria-label="Delivery recovery"><p role="alert">{deliveryError}</p><Button onClick={() => {
      void controller.restore().then(() => { setDeliveryError(null); setState({ store: null, error: null }); setAttempt((value) => value + 1); }, () => setDeliveryError('Could not restore your session. Check your connection and retry.'));
    }}>Restore delivery</Button></section>}</>}>{children}</FeedbackContext></Context.Provider>;
}
export function useStore() {
  const store = useContext(Context);
  if (!store) throw new Error('StoreProvider is required');
  return store;
}
