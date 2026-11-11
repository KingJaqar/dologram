/**
 * Foreground delivery worker (LS-3, LS-7, D-77, D-109, D-117, M2-03).
 *
 * It attempts delivery on every connectivity change and on the D-27 timer, only while the app is
 * in the foreground and the device reports a connection. Queued items send on the next open; the
 * worker never runs in the background.
 */
import { AppState, type AppStateStatus } from 'react-native';
import { File } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import type { Action } from 'expo-image-manipulator';
import {
  config,
  classifyError,
  createQueueRunner,
  insertMessageMedia,
  insertMessage,
  uploadAttachment,
  type DeliveryResult,
  type QueueItem,
  type QueueRunner,
  type QueuedAttachment,
} from '@dologram/shared';
import { supabase } from '../lib/supabase';
import { subscribeNetState } from '../net/netState';
import { cleanupSentQueueItems, getQueueCore, setActiveRunner } from './localQueue';
import { notifyForwardOutcome, notifyQueueChange } from './events';
import { uploadMobileAttachment } from './mediaUploader';
import type { NetState } from '../net/netState';
import { attachmentDeliveryPolicy } from '../net/lowSignal';

export type QueueWorkerHandle = { stop: () => void };

let activeWorker: QueueWorkerHandle | null = null;

/**
 * The message-row insert of M2-03. `message_id` is the client-generated id, so a retry of a stored
 * row is rejected with 23505, which is a delivery (LS-8) and not a failure.
 */
const OFFLINE_STATE: NetState = { isConnected: false, type: 'none', cellularGeneration: null };

async function compressPhotoAttachment(attachment: QueuedAttachment): Promise<QueuedAttachment> {
  const source = new File(attachment.local_uri);
  const probe = await ImageManipulator.manipulateAsync(
    source.uri,
    [],
    { format: ImageManipulator.SaveFormat.JPEG, compress: 1 },
  );
  const longEdge = Math.max(probe.width, probe.height);
  if (probe.uri !== source.uri) {
    const probeFile = new File(probe.uri);
    if (probeFile.exists) probeFile.delete();
  }
  const actions: Action[] = longEdge > config.lowSignal.photoLongEdgePx
    ? [{ resize: probe.width >= probe.height
      ? { width: config.lowSignal.photoLongEdgePx }
      : { height: config.lowSignal.photoLongEdgePx } }]
    : [];
  const result = await ImageManipulator.manipulateAsync(
    source.uri,
    actions,
    { format: ImageManipulator.SaveFormat.JPEG, compress: config.lowSignal.photoQuality },
  );
  const destination = new File(source.parentDirectory, `${attachment.media_id}.jpg`);
  if (destination.exists) destination.delete();
  const generated = new File(result.uri);
  try {
    await generated.copy(destination);
  } finally {
    if (result.uri !== destination.uri && generated.exists) generated.delete();
  }
  if (source.uri !== destination.uri && source.exists) source.delete();
  return {
    ...attachment,
    mime: config.lowSignal.photoOutputMime,
    size_bytes: destination.size,
    local_uri: destination.uri,
    compressed: true,
  };
}

export async function deliverQueueItem(item: QueueItem, netState: NetState = OFFLINE_STATE): Promise<DeliveryResult> {
  if (!netState.isConnected) return { error: { kind: 'network' }, rowStored: false };
  const { error } = await insertMessage(supabase, {
    message_id: item.temp_id,
    chat_id: item.chat_id,
    sender_id: item.payload.sender_id,
    content: item.payload.content,
    reply_to: item.payload.reply_to,
    attachment_count: item.payload.attachment_count,
  });

  if (!error) {
    return deliverAttachments(item, netState);
  }
  if (error.kind === 'delivered') return deliverAttachments(item, netState);
  return { error, rowStored: false };
}

async function deliverAttachments(item: QueueItem, netState: NetState): Promise<DeliveryResult> {
  let workingItem = item;
  for (const attachment of item.payload.attachments) {
    let currentAttachment = workingItem.payload.attachments.find((candidate) => candidate.media_id === attachment.media_id) ?? attachment;
    const policy = attachmentDeliveryPolicy(
      netState,
      workingItem.payload.force_low_signal === true,
      currentAttachment.media_type,
      currentAttachment.size_bytes,
    );
    if (policy.compressPhoto && !currentAttachment.compressed) {
      try {
        currentAttachment = await compressPhotoAttachment(currentAttachment);
        workingItem = {
          ...workingItem,
          payload: {
            ...workingItem.payload,
            attachments: workingItem.payload.attachments.map((candidate) => candidate.media_id === currentAttachment.media_id ? currentAttachment : candidate),
          },
        };
      } catch (error) {
        return { error: classifyError(error), rowStored: true, item: workingItem };
      }
    }
    if (policy.waitForWifi) {
      return { error: { kind: 'deferred' }, rowStored: true, item: workingItem };
    }
    let body: ArrayBuffer | undefined;
    try {
      body = currentAttachment.size_bytes > config.media.tusThresholdBytes
        ? undefined
        : await new File(currentAttachment.local_uri).arrayBuffer();
    } catch (error) {
      return { error: classifyError(error), rowStored: true, item: workingItem };
    }
    const uploaded = await uploadAttachment(supabase, {
      chatId: item.chat_id,
      mediaId: currentAttachment.media_id,
      mediaType: currentAttachment.media_type,
      mime: currentAttachment.mime,
      sizeBytes: currentAttachment.size_bytes,
      body,
      resumableUpload: (options) => uploadMobileAttachment({
        uri: currentAttachment.local_uri,
        mime: options.mime,
        sizeBytes: currentAttachment.size_bytes,
        bucket: options.bucket,
        path: options.path,
      }),
    });
    if (uploaded.error) return { error: uploaded.error, rowStored: true, item: workingItem };

    const media = await insertMessageMedia(supabase, {
      mediaId: currentAttachment.media_id,
      messageId: item.temp_id,
      mediaType: currentAttachment.media_type,
      compressed: currentAttachment.compressed,
    });
    if (media.error) return { error: media.error, rowStored: true, item: workingItem };
  }
  return { error: null, rowStored: true, item: workingItem };
}

export function startQueueWorker(): QueueWorkerHandle {
  if (activeWorker) return activeWorker;

  let stopped = false;
  // NetInfo answers soon after subscribing, so the worker waits for that first answer rather than
  // assuming a connection and counting an attempt while offline (D-77).
  let connected = false;
  let foreground = AppState.currentState === 'active';
  let netState: NetState = OFFLINE_STATE;
  let runner: QueueRunner | null = null;

  function reportBackgroundFailure(error: unknown): void {
    console.error('DoloGram queue: background drain failed.', error);
  }

  const timer = setInterval(() => {
    if (!stopped && foreground && connected && runner) {
      void runner.drain().catch(reportBackgroundFailure);
    }
  }, config.queue.timerMs);

  const unsubscribeNet = subscribeNetState((state) => {
    const wasConnected = connected;
    connected = state.isConnected;
    netState = state;
    if (stopped || !runner) return;
    if (connected && !wasConnected) {
      // D-77: a returning connection makes every queued item due at once.
      void runner.handleConnectivity(true).catch(reportBackgroundFailure);
    }
  });

  const appStateSubscription = AppState.addEventListener('change', (next: AppStateStatus) => {
    const wasForeground = foreground;
    foreground = next === 'active';
    if (!stopped && foreground && !wasForeground && connected && runner) {
      void runner.drain().catch(reportBackgroundFailure);
    }
  });

  getQueueCore()
    .then((core) => {
      if (stopped) return;
      const forwards = new Map<string, string>();
      runner = createQueueRunner({
        core,
        deliver: (item) => {
          if (item.payload.feedback === 'forward') forwards.set(item.temp_id, item.payload.sender_id);
          if (item.payload.attachments.length > 0) notifyQueueChange();
          return deliverQueueItem(item, netState);
        },
        onAttempt: ({ tempId, outcome }) => {
          const sender = forwards.get(tempId);
          if (sender && (outcome.status === 'sent' || outcome.status === 'failed')) {
            forwards.delete(tempId);
            notifyForwardOutcome({ userId: sender, messageId: tempId, status: outcome.status });
          }
          notifyQueueChange();
          if (outcome.status === 'sent') {
            void cleanupSentQueueItems().catch((error: unknown) => {
              console.error('DoloGram queue: sent attachment cleanup failed.', error);
            });
          }
        },
      });
      setActiveRunner(runner);
      // NetInfo can deliver its initial state before the queue database finishes opening. In that
      // case the connectivity callback has no runner to wake, so perform the missed initial drain
      // as soon as the runner is ready.
      if (!stopped && foreground && connected) {
        void runner.drain().catch((error: unknown) => {
          console.error('DoloGram queue: initial background drain failed.', error);
        });
      }
    })
    .catch((error: unknown) => {
      // The queue is unusable without its database; report it instead of failing silently.
      console.error('DoloGram queue: the local database could not be opened.', error);
    });

  const handle: QueueWorkerHandle = {
    stop(): void {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      unsubscribeNet();
      appStateSubscription.remove();
      setActiveRunner(null);
      if (activeWorker === handle) activeWorker = null;
    },
  };

  activeWorker = handle;
  return handle;
}

/** Stops the process-wide foreground worker before local data is wiped (D-109). */
export function stopQueueWorker(): void {
  activeWorker?.stop();
}
