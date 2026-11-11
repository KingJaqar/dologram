/**
 * The foreground delivery worker core (M2-03, LS-3, LS-7, D-77).
 *
 * It owns the drain loop and nothing platform-specific: the caller injects the send function
 * (so tests can drop a response after the server stored the row), and the mobile adapter injects
 * the connectivity source, the foreground state and the timer. One drain runs at a time, so an
 * item is never attempted twice concurrently.
 */
import type { ClassifiedError } from '../errors';
import { classifyError } from '../errors';
import type { AttemptOutcome, QueueCore } from './core';
import type { QueueItem } from './types';

/** Sends one item. Resolves null when the row is stored, or the classified failure. */
export type DeliverFn = (item: QueueItem) => Promise<ClassifiedError | null>;

/** Attachment delivery may store the message row before a later upload fails (LS-4, D-93). */
export type DeliveryResult = {
  error: ClassifiedError | null;
  rowStored: boolean;
  /** The delivery adapter may replace attachment paths after Low Signal compression. */
  item?: QueueItem;
};

export type AttachmentDeliverFn = (item: QueueItem) => Promise<ClassifiedError | null | DeliveryResult>;

export type DrainSummary = {
  attempted: number;
  sent: number;
  failed: number;
  retrying: number;
  deferred: number;
};

export type AttemptRecord = { tempId: string; outcome: AttemptOutcome };

export type QueueRunner = {
  /** Attempts every due item once. Safe to call while a drain is running. */
  drain(): Promise<DrainSummary>;
  /** Connectivity-change handler: regaining a connection makes every queued item due (D-77). */
  handleConnectivity(connected: boolean): Promise<DrainSummary>;
};

export type QueueRunnerDeps = {
  core: QueueCore;
  deliver: AttachmentDeliverFn;
  onAttempt?: (record: AttemptRecord) => void;
};

const EMPTY: DrainSummary = { attempted: 0, sent: 0, failed: 0, retrying: 0, deferred: 0 };

export function createQueueRunner({ core, deliver, onAttempt }: QueueRunnerDeps): QueueRunner {
  let inFlight: Promise<DrainSummary> | null = null;

  async function runDrain(): Promise<DrainSummary> {
    const due = await core.nextDueItems();
    const summary: DrainSummary = { ...EMPTY };

    for (const item of due) {
      const sending = await core.beginAttempt(item);
      let attemptItem = sending;
      let result: ClassifiedError | null;
      try {
        const delivered = await deliver(sending);
        if (isDeliveryResult(delivered)) {
          result = delivered.error;
          if (delivered.item) {
            attemptItem = delivered.item;
          }
          if (delivered.rowStored) {
            attemptItem = await core.markRowStored(attemptItem);
          }
        } else {
          result = delivered;
          if (delivered === null || delivered.kind === 'delivered') {
            attemptItem = await core.markRowStored(sending);
          }
        }
      } catch (error) {
        result = classifyError(error);
      }

      const outcome = await core.applyResult(attemptItem, result);
      summary.attempted += 1;
      switch (outcome.status) {
        case 'sent':
          summary.sent += 1;
          break;
        case 'failed':
          summary.failed += 1;
          break;
        case 'retrying':
          summary.retrying += 1;
          break;
        case 'deferred':
          summary.deferred += 1;
          break;
      }
      onAttempt?.({ tempId: sending.temp_id, outcome });
    }

    return summary;
  }

  function drain(): Promise<DrainSummary> {
    if (inFlight) return inFlight;
    inFlight = runDrain().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  async function handleConnectivity(connected: boolean): Promise<DrainSummary> {
    if (!connected) return { ...EMPTY };
    await core.makeAllDue();
    return drain();
  }

  return { drain, handleConnectivity };
}

function isDeliveryResult(value: ClassifiedError | null | DeliveryResult): value is DeliveryResult {
  return typeof value === 'object' && value !== null && 'error' in value && 'rowStored' in value;
}
