import type { SQLiteDatabase } from 'expo-sqlite';
import { strings } from '@dologram/shared';
import { getUnsentItems } from '../queue/localQueue';
import { parseCachedAttachment, type ChatAttachment } from './model';

export async function loadMediaAttachment(db: SQLiteDatabase, chatId: string, mediaId: string, userId: string): Promise<ChatAttachment> {
  const member = await db.getFirstAsync<{ user_id: string }>('SELECT user_id FROM cache_chat_members WHERE chat_id = ? AND user_id = ?', [chatId, userId]);
  if (!member) throw new Error(strings.media.unavailable);
  const row = await db.getFirstAsync<{ payload: string }>(
    `SELECT media.payload FROM cache_message_media AS media
     JOIN cache_messages AS message ON message.message_id = media.message_id AND message.chat_id = media.chat_id
     WHERE media.chat_id = ? AND media.media_id = ? AND message.deleted_at IS NULL`, [chatId, mediaId],
  );
  const attachment = row ? parseCachedAttachment(row.payload) : null;
  if (attachment) return attachment;
  if (row && JSON.parse(row.payload).deleted_at != null) throw new Error(strings.media.unavailable);
  const queued = (await getUnsentItems()).find((item) => item.chat_id === chatId && item.payload.sender_id === userId && item.payload.attachments.some((media) => media.media_id === mediaId));
  if (queued) {
    const message = await db.getFirstAsync<{ deleted_at: string | null }>('SELECT deleted_at FROM cache_messages WHERE message_id = ?', [queued.temp_id]);
    const local = queued.payload.attachments.find((media) => media.media_id === mediaId);
    if (local && !message?.deleted_at) return { mediaId: local.media_id, mediaType: local.media_type, localUri: local.local_uri, mime: local.mime, sizeBytes: local.size_bytes };
  }
  throw new Error(strings.media.unavailable);
}
