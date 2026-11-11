/**
 * Queue contracts (M2-02, M2-03, LS-1 to LS-3, LS-7 to LS-9, D-06, D-10, D-27, D-77, D-93).
 *
 * The queue is the device-local record of 6.2: `temp_id` equals the `message_id` the row will use
 * (D-10), the payload is the insert it will send, and the status is the LS-2 set. Storage is a
 * platform adapter (expo-sqlite on mobile); everything here is platform-agnostic so the state
 * machine can be tested with a fake store, a fake clock and an injected fetch.
 */

/** LS-2. The two Low Signal labels are presentation refinements, not extra states (D-17). */
export type QueueStatus = 'queued' | 'sending' | 'sent' | 'failed';

import type { MediaType } from '../config';

/** A file copied into app-private storage before a message enters the durable queue (M3-02). */
export type QueuedAttachment = {
  media_id: string;
  media_type: MediaType;
  mime: string;
  size_bytes: number;
  local_uri: string;
  compressed: boolean;
};

/** The payload of an outgoing message, including its optional attachment work (M3-02). */
export type TextQueuePayload = {
  kind: 'text';
  chat_id: string;
  sender_id: string;
  content: string;
  reply_to: string | null;
  attachment_count: number;
  attachments: QueuedAttachment[];
  /** LS-6: the Force Low Signal Mode preference captured when the item was queued. */
  force_low_signal?: boolean;
  /** Device-only feedback intent, never included in the server message insert. */
  feedback?: 'forward';
};

export type QueuePayload = TextQueuePayload;

export type QueueItem = {
  /** Equals the message_id the delivered row uses (D-10). */
  temp_id: string;
  /** Copy of `payload.chat_id`, so per-chat strict order needs no JSON parse (D-93). */
  chat_id: string;
  payload: QueuePayload;
  status: QueueStatus;
  /** D-77: counts only attempts made while connected that failed with a network or server error. */
  retry_count: number;
  /** Epoch milliseconds; the worker attempts the item only once this has passed (D-77). */
  next_attempt_at: number;
  /**
   * True once an insert was attempted, so the row may exist on the server. Discard needs a
   * connection and a soft delete in that case, and works offline only while this is false (D-93).
   */
  row_may_exist: boolean;
  /** Whether the message row is absent, may exist, or is confirmed stored (D-93). */
  row_state: 'absent' | 'unknown' | 'stored';
  /** The kind of the last failure, for the item's caption in the chat (D-17, D-93). */
  last_error: 'network' | 'server' | 'rateLimited' | 'waitingWifi' | null;
  created_at: number;
};

/** The D-27 values the queue machine needs; `config.queue` satisfies it. */
export type QueueTiming = {
  timerMs: number;
  backoffBaseMs: number;
  backoffFactor: number;
  backoffCapMs: number;
  jitter: number;
  maxAttempts: number;
  maxUnsent: number;
};

/**
 * The storage contract every platform adapter implements (M2-02). The cache, cache rows and
 * `sync_state` belong to the same database (6.2) but are not reached here yet.
 */
export interface LocalQueueStore {
  /** Creates or upgrades the schema. Idempotent. */
  init(): Promise<void>;
  insert(item: QueueItem): Promise<void>;
  update(item: QueueItem): Promise<void>;
  get(tempId: string): Promise<QueueItem | null>;
  /** Every item that is not yet sent, oldest first (LS-7 counts queued, sending and failed). */
  listUnsent(): Promise<QueueItem[]>;
  countUnsent(): Promise<number>;
  /** LS-9: items left in `sending` at startup return to `queued`. */
  resetSending(): Promise<void>;
  /** D-77: a returning connection makes every queued item due at once without resetting counts. */
  makeAllDue(now: number): Promise<void>;
  delete(tempId: string): Promise<void>;
  /** Removes sent items; the chat shows delivered rows from the server from then on. */
  deleteSent(): Promise<void>;
  /** Returns sent items before cleanup so mobile can remove their private attachment copies. */
  listSent(): Promise<QueueItem[]>;
}

export type EnqueueResult =
  | { ok: true; item: QueueItem }
  | { ok: false; reason: 'queueFull' };
