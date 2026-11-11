import { File } from 'expo-file-system';
import type { QueueItem, QueuedAttachment } from '@dologram/shared';

async function removeFiles(attachments: readonly QueuedAttachment[]): Promise<void> {
  for (const attachment of attachments) {
    const file = new File(attachment.local_uri);
    if (file.exists) file.delete();
  }
}

export async function deleteQueuedAttachmentFiles(items: readonly QueueItem[]): Promise<void> {
  for (const item of items) await removeFiles(item.payload.attachments);
}

export async function deleteQueuedAttachmentCopies(attachments: readonly QueuedAttachment[]): Promise<void> {
  await removeFiles(attachments);
}
