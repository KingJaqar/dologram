import type { SQLiteDatabase } from 'expo-sqlite';
import { strings, type MediaType, type QueueItem, type QueueStatus } from '@dologram/shared';
import { attachmentLabel } from '../media/model';
import { normalizeSearch, searchPreview } from './matching';
import { readSearch, SEARCH_DEADLINE_MS, SearchFailure } from './request';

export { normalizeSearch } from './matching';
export type SearchCursor = { createdAt: string; messageId: string };
export type MatchSource = 'content' | 'sender' | 'attachment';
export type MessageMatch = SearchCursor & {
  chatId: string; sender: string; preview: string;
  sources?: MatchSource[];
  pendingStatus?: QueueStatus;
};
export type MessagePage = { matches: MessageMatch[]; next: SearchCursor | null };
export type ConversationSummary = { chatId: string; deliveredMatchCount: number; latestMatch: MessageMatch };
export type SearchScope = { userId: string; allowedChatIds: readonly string[]; chatId?: string };
export type SearchIdentity = SearchScope & { normalizedQuery: string; generation: number };

type CachedMessage = {
  message_id: string; chat_id: string; created_at: string;
  content: string | null; sender: string; media_types: string | null;
};
const BATCH_SIZE = 200;
const PAGE_SIZE = 30;
const MEDIA_TYPES: readonly MediaType[] = ['photo', 'video', 'voice', 'file'];

function messageMatch(row: CachedMessage, query: string): MessageMatch | null {
  const labels = MEDIA_TYPES.filter((type) => row.media_types?.split(',').includes(type)).map(attachmentLabel).join(' · ');
  const fields = { content: row.content ?? '', sender: row.sender, attachment: labels };
  const sources = (Object.keys(fields) as MatchSource[]).filter((key) => normalizeSearch(fields[key]).includes(query));
  if (sources.length === 0) return null;
  const explanation = sources.includes('content') || (!row.content && sources.includes('attachment')) ? '' : sources.includes('attachment')
    ? strings.search.attachmentMatch(labels) : strings.search.senderMatch(row.sender);
  const text = row.content || labels || strings.chat.attachmentOnly;
  return {
    chatId: row.chat_id, messageId: row.message_id, createdAt: row.created_at,
    sender: row.sender, sources,
    preview: explanation ? `${explanation} · ${searchPreview(text, query)}` : searchPreview(text, query),
  };
}

function scopeIds(scope: SearchScope): string[] {
  if (!scope.userId || scope.allowedChatIds.some((id) => typeof id !== 'string' || !id)) throw new SearchFailure('invalid');
  if (scope.chatId !== undefined && !scope.allowedChatIds.includes(scope.chatId)) throw new SearchFailure('unavailable');
  return scope.chatId === undefined ? [...new Set(scope.allowedChatIds)] : [scope.chatId];
}

/** Only one bounded source batch is retained, irrespective of history size. */
async function* scanMatches(
  db: SQLiteDatabase, scope: SearchScope, query: string, cursor: SearchCursor | null,
  signal: AbortSignal, deadline: number,
): AsyncGenerator<MessageMatch> {
  const ids = scopeIds(scope);
  if (!query || ids.length === 0) return;
  let after = cursor;
  while (!signal.aborted) {
    const rows = await readSearch(() => db.getAllAsync<CachedMessage>(
      `SELECT m.message_id, m.chat_id, m.created_at,
          json_extract(m.payload, '$.content') AS content,
          CASE WHEN m.sender_id = own.user_id THEN ?
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
      [strings.search.you, strings.chatList.unknownMember, scope.userId, JSON.stringify(ids),
        ...(after ? [after.createdAt, after.messageId] : []), BATCH_SIZE],
    ), signal, deadline);
    for (const row of rows) {
      if (signal.aborted) throw new SearchFailure('cancelled');
      if (Date.now() >= deadline) throw new SearchFailure('timeout');
      const match = messageMatch(row, query);
      if (match) yield match;
    }
    if (rows.length < BATCH_SIZE) return;
    const last = rows[rows.length - 1];
    after = { createdAt: last.created_at, messageId: last.message_id };
  }
}

/** Backward-compatible delivered page API used by the existing global screen. */
export async function searchCachedMessages(
  db: SQLiteDatabase, userId: string, chatIds: string, query: string,
  cursor: SearchCursor | null, signal: AbortSignal,
): Promise<MessagePage> {
  const parsed: unknown = JSON.parse(chatIds);
  if (!Array.isArray(parsed) || !parsed.every((id): id is string => typeof id === 'string')) throw new SearchFailure('invalid');
  return searchMessagePage(db, { userId, allowedChatIds: parsed }, query, cursor, signal);
}

export async function searchMessagePage(
  db: SQLiteDatabase, scope: SearchScope, query: string, cursor: SearchCursor | null,
  signal: AbortSignal, deadline = Date.now() + SEARCH_DEADLINE_MS,
): Promise<MessagePage> {
  const matches: MessageMatch[] = [];
  if (signal.aborted) return { matches, next: null };
  for await (const match of scanMatches(db, scope, normalizeSearch(query), cursor, signal, deadline)) {
    if (matches.length === PAGE_SIZE) return { matches, next: matches[PAGE_SIZE - 1] };
    matches.push(match);
  }
  if (signal.aborted) throw new SearchFailure('cancelled');
  return { matches, next: null };
}

export async function countMessageMatches(
  db: SQLiteDatabase, scope: SearchScope, query: string, signal: AbortSignal,
  deadline = Date.now() + SEARCH_DEADLINE_MS,
): Promise<ConversationSummary[]> {
  const summaries = new Map<string, ConversationSummary>();
  for await (const match of scanMatches(db, scope, normalizeSearch(query), null, signal, deadline)) {
    const previous = summaries.get(match.chatId);
    if (previous) previous.deliveredMatchCount++;
    else summaries.set(match.chatId, { chatId: match.chatId, deliveredMatchCount: 1, latestMatch: match });
  }
  if (signal.aborted) throw new SearchFailure('cancelled');
  return [...summaries.values()]; // insertion order follows the latest matching timestamp and ID
}

export type ScopedMessagePage = MessagePage & { pendingMatches: MessageMatch[] };

/** Pending rows stay separate from delivered pagination/counts and retain their queue ID. */
export async function searchScopedMessages(
  db: SQLiteDatabase, scope: SearchScope & { chatId: string }, query: string,
  cursor: SearchCursor | null, signal: AbortSignal, getUnsent: () => Promise<QueueItem[]>,
  deadline = Date.now() + SEARCH_DEADLINE_MS,
): Promise<ScopedMessagePage> {
  scopeIds(scope);
  const membership = await readSearch(() => db.getAllAsync<{ user_id: string }>(
    'SELECT user_id FROM cache_chat_members WHERE chat_id = ? AND user_id = ?', [scope.chatId, scope.userId],
  ), signal, deadline);
  if (membership.length === 0) throw new SearchFailure('unavailable');
  const page = await searchMessagePage(db, scope, query, cursor, signal, deadline);
  const normalized = normalizeSearch(query);
  if (!normalized) return { ...page, pendingMatches: [] };
  const queued = (await readSearch(getUnsent, signal, deadline)).filter((item) =>
    item.status !== 'sent' && item.chat_id === scope.chatId && item.payload.chat_id === scope.chatId
    && item.payload.sender_id === scope.userId && Number.isFinite(item.created_at));
  const echoes = queued.length === 0 ? [] : await readSearch(() => db.getAllAsync<{ message_id: string }>(
    `SELECT message_id FROM cache_messages WHERE chat_id = ? AND (seq IS NOT NULL OR deleted_at IS NOT NULL)
       AND message_id IN (SELECT value FROM json_each(?))`,
    [scope.chatId, JSON.stringify(queued.map((item) => item.temp_id))],
  ), signal, deadline);
  const seen = new Set(echoes.map((row) => row.message_id));
  const pendingMatches: MessageMatch[] = [];
  for (const item of queued) {
    if (seen.has(item.temp_id)) continue;
    seen.add(item.temp_id);
    const match = messageMatch({ message_id: item.temp_id, chat_id: scope.chatId,
      created_at: new Date(item.created_at).toISOString(), content: item.payload.content,
      sender: strings.search.you, media_types: item.payload.attachments.map((attachment) => attachment.media_type).join(',') }, normalized);
    if (match) pendingMatches.push({ ...match, pendingStatus: item.status });
  }
  pendingMatches.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.messageId.localeCompare(a.messageId));
  return { ...page, pendingMatches };
}
