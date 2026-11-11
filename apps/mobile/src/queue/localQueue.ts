/**
 * Mobile entry points for the local queue (M2-02, M2-03, LS-1, LS-7, LS-9, D-10, D-93).
 *
 * `enqueueTextMessage` writes the item to SQLite before any network call (LS-1); nothing here
 * touches the network. The worker started in the root layout drains it.
 */
import {
  config,
  createQueueCore,
  softDeleteMessage,
  type DiscardResult,
  type EnqueueResult,
  type QueueCore,
  type QueueItem,
  type QueueRunner,
  type RetryResult,
} from '@dologram/shared';
import { supabase } from '../lib/supabase';
import { ids } from '../lib/ids';
import { getLocalDatabase } from './db';
import { createSqliteQueueStore } from './store';
import { notifyQueueChange } from './events';
import { deleteQueuedAttachmentFiles } from './attachmentFiles';
import { getForceLowSignalMode } from '../net/lowSignalPreferences';
import { markSendStarted } from '../metrics/latency';

let corePromise: Promise<QueueCore> | null = null;
let activeRunner: QueueRunner | null = null;

/** The single queue core of this app process; `init()` returns leftover `sending` items to `queued`. */
export function getQueueCore(): Promise<QueueCore> {
  if (!corePromise) {
    corePromise = getLocalDatabase()
      .then((db) =>
        createQueueCore({
          store: createSqliteQueueStore(db),
          timing: config.queue,
          now: () => Date.now(),
          random: () => Math.random(),
        }),
      )
      .then(async (core) => {
        await core.init();
        const sent = await core.cleanup();
        await deleteQueuedAttachmentFiles(sent);
        return core;
      });

    // A failed open must not poison every later call.
    corePromise.catch(() => {
      corePromise = null;
    });
  }
  return corePromise;
}

/** Called by enqueue paths so a newly durable item can start delivery at once. */
export function setActiveRunner(runner: QueueRunner | null): void {
  activeRunner = runner;
}

/**
 * Wakes the foreground worker after any kind of message is enqueued.
 *
 * Attachments are copied before their queue row is written, so relying only on the worker timer
 * makes a good connection look like a stuck "Queued" upload for up to 15 seconds. Keep this
 * fire-and-forget just like the connectivity/timer triggers; the runner serializes overlapping
 * drains.
 */
export function requestQueueDrain(): void {
  if (!activeRunner) return;
  void activeRunner.drain().catch((error: unknown) => {
    console.error('DoloGram queue: background drain failed.', error);
  });
}

/**
 * Writes a text item to the queue and asks the worker to try it immediately (LS-1, LS-3). The
 * item is durable even when the request never leaves the device.
 */
export async function enqueueTextMessage(input: {
  chatId: string;
  senderId: string;
  content: string;
  replyTo?: string | null;
  feedback?: 'forward';
  onQueued?: (messageId: string) => void;
}): Promise<EnqueueResult> {
  const core = await getQueueCore();
  const forceLowSignal = await getForceLowSignalMode();
  const messageId = ids.messageId();
  markSendStarted(messageId);
  const result = await core.enqueue({
    messageId,
    payload: {
      kind: 'text',
      chat_id: input.chatId,
      sender_id: input.senderId,
      content: input.content,
      reply_to: input.replyTo ?? null,
      attachment_count: 0,
      attachments: [],
      force_low_signal: forceLowSignal,
      ...(input.feedback ? { feedback: input.feedback } : {}),
    },
  });

  if (result.ok) {
    notifyQueueChange();
    input.onQueued?.(result.item.temp_id);
    requestQueueDrain();
  }
  return result;
}

/** Removes private attachment copies after sent queue rows have been cleaned up. */
export async function cleanupSentQueueItems(): Promise<void> {
  const core = await getQueueCore();
  const sent = await core.cleanup();
  await deleteQueuedAttachmentFiles(sent);
  if (sent.length > 0) notifyQueueChange();
}

/** Every item not yet sent, oldest first; the chat shows these with their LS-2 status. */
export async function getUnsentItems(): Promise<QueueItem[]> {
  const core = await getQueueCore();
  return core.listUnsent();
}

/** D-93: Retry resets the attempt count and makes the item due at once. */
export async function retryQueueItem(tempId: string): Promise<RetryResult> {
  const core = await getQueueCore();
  const result = await core.retry(tempId);
  if (result.ok) {
    notifyQueueChange();
    requestQueueDrain();
  }
  return result;
}

/**
 * D-93: Discard removes an item whose row was never stored and soft-deletes the row first when it
 * may exist, so it needs a connection then.
 */
export async function discardQueueItem(tempId: string, online: boolean): Promise<DiscardResult> {
  const core = await getQueueCore();
  const result = await core.discard(tempId, {
    online,
    softDelete: (messageId) => softDeleteMessage(supabase, messageId),
  });
  if (result.ok) notifyQueueChange();
  return result;
}
