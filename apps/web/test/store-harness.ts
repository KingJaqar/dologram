import { IndexedDbStore } from '../src/lib/store/IndexedDbStore';
import { WorkerLeader, type WorkerLease } from '../src/lib/worker/leader';
import type { QueueItem } from '@dologram/shared/src/queue/types';

export { IndexedDbStore, WorkerLeader };
export function queueItem(id: string, owner = 'a'): QueueItem {
  return { temp_id: id, chat_id: 'chat', status: 'queued', retry_count: 0, next_attempt_at: 0, row_may_exist: false, row_state: 'absent', last_error: null, created_at: 1, payload: { kind: 'text', chat_id: 'chat', sender_id: owner, content: 'Retained draft', reply_to: null, attachment_count: 0, attachments: [] } };
}
/** Test-only visibility source; worker code still uses real browser locks and storage. */
export class Visibility extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible';
  set(value: DocumentVisibilityState) { this.visibilityState = value; this.dispatchEvent(new Event('visibilitychange')); }
}
export async function runtime(owner = 'a') {
  const store = new IndexedDbStore(owner); await store.init();
  const visibility = new Visibility();
  const leases: WorkerLease[] = [];
  const failures: string[] = [];
  const leader = new WorkerLeader(owner, store.sessionEpoch, async (lease) => {
    await store.workerStore(lease.current).resetSending(); leases.push(lease);
  }, (error) => failures.push(String(error)), navigator.locks, visibility);
  store.onQuiesce = () => { void leader.stop(); };
  leader.start();
  return { store, visibility, leader, leases, failures };
}
