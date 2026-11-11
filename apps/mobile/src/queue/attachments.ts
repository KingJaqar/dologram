/** Android attachment queue entry points (M3-02, D-100). Picker UI is Phase 12. */
import { Directory, File, Paths } from 'expo-file-system';
import {
  config,
  validateAttachment,
  validateAttachmentCount,
  validateMessageText,
  type EnqueueResult,
  type MediaType,
  type QueuedAttachment,
} from '@dologram/shared';
import { ids } from '../lib/ids';
import { notifyQueueChange } from './events';
import { getQueueCore, requestQueueDrain } from './localQueue';
import { deleteQueuedAttachmentCopies } from './attachmentFiles';
import { getForceLowSignalMode } from '../net/lowSignalPreferences';
import { markSendStarted } from '../metrics/latency';

export type AttachmentSource = {
  uri: string;
  mediaType: MediaType;
  mime: string;
  sizeBytes: number;
};

export type AttachmentEnqueueResult =
  | EnqueueResult
  | { ok: false; reason: 'tooManyAttachments' | 'invalidText' | 'invalidAttachment' | 'copyFailed' };

function attachmentCopyPath(messageId: string, mediaId: string): File {
  return new File(new Directory(Paths.document, 'queued-attachments', messageId), mediaId);
}

/** Copies source files before inserting the queue row, so picker URIs never become dependencies. */
export async function enqueueAttachmentMessage(input: {
  chatId: string;
  senderId: string;
  content: string;
  replyTo?: string | null;
  attachments: readonly AttachmentSource[];
}): Promise<AttachmentEnqueueResult> {
  if (!validateAttachmentCount(input.attachments.length)) return { ok: false, reason: 'tooManyAttachments' };
  if (validateMessageText(input.content, input.attachments.length).ok === false) {
    return { ok: false, reason: 'invalidText' };
  }
  for (const attachment of input.attachments) {
    if (!validateAttachment({ mediaType: attachment.mediaType, mime: attachment.mime, sizeBytes: attachment.sizeBytes }).ok) {
      return { ok: false, reason: 'invalidAttachment' };
    }
  }

  const core = await getQueueCore();
  const forceLowSignal = await getForceLowSignalMode();
  if (await core.countUnsent() >= config.queue.maxUnsent) return { ok: false, reason: 'queueFull' };

  const messageId = ids.messageId();
  markSendStarted(messageId);
  const copied: QueuedAttachment[] = [];
  try {
    for (const source of input.attachments) {
      const mediaId = ids.mediaId();
      const destination = attachmentCopyPath(messageId, mediaId);
      destination.parentDirectory.create({ intermediates: true, idempotent: true });
      copied.push({
        media_id: mediaId,
        media_type: source.mediaType,
        mime: source.mime.trim().toLowerCase(),
        size_bytes: source.sizeBytes,
        local_uri: destination.uri,
        compressed: false,
      });
      await new File(source.uri).copy(destination);
    }

    const result = await core.enqueue({
      messageId,
      payload: {
        kind: 'text',
        chat_id: input.chatId,
        sender_id: input.senderId,
        content: input.content,
        reply_to: input.replyTo ?? null,
        attachment_count: copied.length,
        attachments: copied,
        force_low_signal: forceLowSignal,
      },
    });
    if (!result.ok) {
      await deleteQueuedAttachmentCopies(copied);
      return result;
    }
    notifyQueueChange();
    requestQueueDrain();
    return result;
  } catch {
    await deleteQueuedAttachmentCopies(copied);
    return { ok: false, reason: 'copyFailed' };
  }
}
