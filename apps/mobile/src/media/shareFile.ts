import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { strings, validateAttachment } from '@dologram/shared';
import type { ChatAttachment } from './model';

/** Download only from an authenticated signed URL and remove the private share copy afterward. */
export async function shareMediaFile(attachment: ChatAttachment, uri: string, mime: string | undefined): Promise<void> {
  if (!await Sharing.isAvailableAsync()) throw new Error(strings.media.shareUnavailable);
  if (attachment.localUri) {
    await Sharing.shareAsync(attachment.localUri, { mimeType: mime });
    return;
  }
  // mediaId is a UUID from the database, never an arbitrary filename supplied by a route.
  if (!/^[0-9a-f-]{36}$/i.test(attachment.mediaId)) throw new Error(strings.media.unavailable);
  const directory = new Directory(Paths.cache, 'media-share', attachment.mediaId);
  directory.create({ intermediates: true, idempotent: true });
  const destination = new File(directory, attachment.mediaId);
  try {
    if (destination.exists) destination.delete();
    const downloaded = await File.downloadFileAsync(uri, destination);
    const actualMime = mime ?? downloaded.type;
    if (!validateAttachment({ mediaType: 'file', mime: actualMime, sizeBytes: downloaded.size }).ok) throw new Error(strings.media.unavailable);
    await Sharing.shareAsync(downloaded.uri, { mimeType: actualMime });
  } finally {
    if (destination.exists) destination.delete();
    if (directory.exists) directory.delete();
  }
}
