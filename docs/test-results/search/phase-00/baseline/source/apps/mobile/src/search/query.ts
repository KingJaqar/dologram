import type { SQLiteDatabase } from 'expo-sqlite';
import { strings, type MediaType } from '@dologram/shared';
import { attachmentLabel } from '../media/model';

export type SearchCursor = { createdAt: string; messageId: string };
export type MessageMatch = SearchCursor & { chatId: string; sender: string; preview: string };

type CachedMessage = {
  message_id: string;
  chat_id: string;
  created_at: string;
  content: string;
  sender: string;
  media_types: string | null;
};

const BATCH_SIZE = 200;
const PAGE_SIZE = 30;
const MEDIA_TYPES: readonly MediaType[] = ['photo', 'video', 'voice', 'file'];

export function normalizeSearch(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase();
}

function previewOf(content: string, query: string): string {
  const normalized = content.normalize('NFKC').trim();
  const match = normalized.toLowerCase().indexOf(query);
  const start = Math.max(0, match - 36);
  const end = Math.max(start + 160, match + query.length);
  return `${start > 0 ? '…' : ''}${normalized.slice(start, end)}${end < normalized.length ? '…' : ''}`;
}

/** Walk the synced cache in bounded batches. JS normalization also handles non-ASCII text. */
export async function searchCachedMessages(
  db: SQLiteDatabase,
  userId: string,
  chatIds: string,
  query: string,
  cursor: SearchCursor | null,
  signal: AbortSignal,
): Promise<{ matches: MessageMatch[]; next: SearchCursor | null }> {
  const matches: MessageMatch[] = [];
  if (!query) return { matches, next: null };
  let after = cursor;
  while (!signal.aborted) {
    const rows = await db.getAllAsync<CachedMessage>(
      `SELECT m.message_id, m.chat_id, m.created_at,
          json_extract(m.payload, '$.content') AS content,
          CASE WHEN m.sender_id = own.user_id THEN 'You'
            ELSE COALESCE(NULLIF(sender.nickname, ''), profile.display_name, ?) END AS sender,
          (SELECT group_concat(DISTINCT json_extract(media.payload, '$.media_type'))
             FROM cache_message_media media
             WHERE media.message_id = m.message_id AND json_extract(media.payload, '$.deleted_at') IS NULL
          ) AS media_types
        FROM cache_messages m
        JOIN cache_chat_members own ON own.chat_id = m.chat_id AND own.user_id = ?
        LEFT JOIN cache_chat_members sender ON sender.chat_id = m.chat_id AND sender.user_id = m.sender_id
        LEFT JOIN cache_profiles profile ON profile.user_id = m.sender_id
        WHERE m.chat_id IN (SELECT value FROM json_each(?))
          AND m.deleted_at IS NULL AND m.seq IS NOT NULL
          ${after ? 'AND (m.created_at, m.message_id) < (?, ?)' : ''}
        ORDER BY m.created_at DESC, m.message_id DESC LIMIT ?`,
      [strings.chatList.unknownMember, userId, chatIds, ...(after ? [after.createdAt, after.messageId] : []), BATCH_SIZE],
    );
    if (signal.aborted) break;
    for (const row of rows) {
      const types = row.media_types?.split(',') ?? [];
      const labels = MEDIA_TYPES.filter((type) => types.includes(type)).map(attachmentLabel).join(' · ');
      const content = row.content ?? '';
      if (![content, row.sender, labels].some((value) => normalizeSearch(value).includes(query))) continue;
      if (matches.length === PAGE_SIZE) return { matches, next: matches[PAGE_SIZE - 1] };
      const text = normalizeSearch(labels).includes(query) && content ? `${labels} · ${content}` : content || labels;
      matches.push({
        chatId: row.chat_id,
        messageId: row.message_id,
        createdAt: row.created_at,
        sender: row.sender,
        preview: text ? previewOf(text, query) : strings.chat.attachmentOnly,
      });
    }
    if (rows.length < BATCH_SIZE) break;
    const last = rows[rows.length - 1];
    after = { createdAt: last.created_at, messageId: last.message_id };
  }
  return { matches, next: null };
}
