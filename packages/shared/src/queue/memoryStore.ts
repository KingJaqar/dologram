/**
 * In-memory LocalQueueStore (M2-02). It is the fake store the queue tests run against, so the
 * state machine is exercised without SQLite; the expo-sqlite adapter in `apps/mobile` implements
 * the same interface on the device.
 */
import type { LocalQueueStore, QueueItem } from './types';

export type MemoryStore = LocalQueueStore & {
  /** A copy of every stored row, for assertions. */
  snapshot(): QueueItem[];
};

function clone(item: QueueItem): QueueItem {
  return {
    ...item,
    payload: { ...item.payload, attachments: item.payload.attachments.map((attachment) => ({ ...attachment })) },
  };
}

function byCreatedAt(a: QueueItem, b: QueueItem): number {
  if (a.created_at !== b.created_at) return a.created_at - b.created_at;
  return a.temp_id < b.temp_id ? -1 : a.temp_id > b.temp_id ? 1 : 0;
}

export function createMemoryStore(initial: QueueItem[] = []): MemoryStore {
  const rows = new Map<string, QueueItem>();
  for (const item of initial) {
    rows.set(item.temp_id, clone(item));
  }

  const unsent = (): QueueItem[] =>
    [...rows.values()].filter((item) => item.status !== 'sent').sort(byCreatedAt);

  return {
    async init(): Promise<void> {
      // Nothing to create.
    },

    async insert(item: QueueItem): Promise<void> {
      if (rows.has(item.temp_id)) {
        throw new Error(`duplicate queue item ${item.temp_id}`);
      }
      rows.set(item.temp_id, clone(item));
    },

    async update(item: QueueItem): Promise<void> {
      if (!rows.has(item.temp_id)) {
        throw new Error(`unknown queue item ${item.temp_id}`);
      }
      rows.set(item.temp_id, clone(item));
    },

    async get(tempId: string): Promise<QueueItem | null> {
      const item = rows.get(tempId);
      return item ? clone(item) : null;
    },

    async listUnsent(): Promise<QueueItem[]> {
      return unsent();
    },

    async countUnsent(): Promise<number> {
      return unsent().length;
    },

    async resetSending(): Promise<void> {
      for (const [tempId, item] of rows) {
        if (item.status === 'sending') {
          rows.set(tempId, { ...item, status: 'queued' });
        }
      }
    },

    async makeAllDue(now: number): Promise<void> {
      for (const [tempId, item] of rows) {
        if (item.status === 'queued') {
          rows.set(tempId, { ...item, next_attempt_at: now });
        }
      }
    },

    async delete(tempId: string): Promise<void> {
      rows.delete(tempId);
    },

    async deleteSent(): Promise<void> {
      for (const [tempId, item] of rows) {
        if (item.status === 'sent') rows.delete(tempId);
      }
    },

    async listSent(): Promise<QueueItem[]> {
      return [...rows.values()].filter((item) => item.status === 'sent').map(clone).sort(byCreatedAt);
    },

    snapshot(): QueueItem[] {
      return [...rows.values()].map(clone).sort(byCreatedAt);
    },
  };
}
