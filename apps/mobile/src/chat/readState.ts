/** Persisted read-state updates and the private read hint (D-23, D-92). */
import type { SQLiteDatabase } from 'expo-sqlite';
import type { ChatMemberRow, DgResult } from '@dologram/shared';
import { createSqliteCacheStore } from '../sync/cacheStore';
import { setChatListPreference } from '../chatList/preferences';

type PendingReadRow = { chat_id: string; last_read_seq: number };
type MemberPayloadRow = { payload: string };
type LatestMessageRow = { chat_id: string; max_seq: number | null };

function parseMember(value: string): ChatMemberRow | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const member = parsed as Partial<ChatMemberRow>;
    return typeof member.chat_id === 'string' &&
      typeof member.user_id === 'string' &&
      typeof member.last_read_seq === 'number'
      ? (member as ChatMemberRow)
      : null;
  } catch {
    return null;
  }
}

async function cacheReadSeq(
  db: SQLiteDatabase,
  chatId: string,
  userId: string,
  seq: number,
): Promise<number> {
  const row = await db.getFirstAsync<MemberPayloadRow>(
    'SELECT payload FROM cache_chat_members WHERE chat_id = ? AND user_id = ?',
    [chatId, userId],
  );
  const member = row ? parseMember(row.payload) : null;
  const next = Math.max(member?.last_read_seq ?? 0, seq);
  if (!member || next === member.last_read_seq) return next;
  const updated = { ...member, last_read_seq: next };
  await db.runAsync(
    `UPDATE cache_chat_members SET last_read_seq = ?, payload = ?
       WHERE chat_id = ? AND user_id = ?`,
    [next, JSON.stringify(updated), chatId, userId],
  );
  return next;
}

async function rememberPending(db: SQLiteDatabase, chatId: string, seq: number): Promise<void> {
  await db.runAsync(
    `INSERT INTO pending_read_states (chat_id, last_read_seq) VALUES (?, ?)
       ON CONFLICT(chat_id) DO UPDATE SET last_read_seq = MAX(pending_read_states.last_read_seq, excluded.last_read_seq)`,
    [chatId, seq],
  );
}

export type ReadStateSender = (chatId: string, seq: number) => Promise<DgResult<ChatMemberRow>>;

export async function flushPendingReadStates(
  db: SQLiteDatabase,
  send: ReadStateSender,
  sendHint: (chatId: string, seq: number) => Promise<boolean>,
): Promise<void> {
  const pending = await db.getAllAsync<PendingReadRow>(
    'SELECT chat_id, last_read_seq FROM pending_read_states ORDER BY chat_id ASC',
  );
  for (const row of pending) {
    const result = await send(row.chat_id, row.last_read_seq);
    if (result.error) continue;
    await db.runAsync('DELETE FROM pending_read_states WHERE chat_id = ?', [row.chat_id]);
    await sendHint(row.chat_id, row.last_read_seq);
  }
}

export async function markChatRead(
  db: SQLiteDatabase,
  chatId: string,
  userId: string,
  seq: number,
  online: boolean,
  send: ReadStateSender,
  sendHint: (chatId: string, seq: number) => Promise<boolean>,
): Promise<number> {
  await setChatListPreference(userId, chatId, 'unread', false);
  const next = await cacheReadSeq(db, chatId, userId, seq);
  await rememberPending(db, chatId, next);
  if (online) {
    await flushPendingReadStates(db, send, sendHint);
  }
  return next;
}

/** Marks several chats read using the newest sequence currently available in the local cache. */
export async function markChatsRead(
  db: SQLiteDatabase,
  chatIds: readonly string[],
  userId: string,
  online: boolean,
  send: ReadStateSender,
  sendHint: (chatId: string, seq: number) => Promise<boolean>,
): Promise<number> {
  const uniqueChatIds = [...new Set(chatIds)];
  if (uniqueChatIds.length === 0) return 0;

  const placeholders = uniqueChatIds.map(() => '?').join(', ');
  const latestRows = await db.getAllAsync<LatestMessageRow>(
    `SELECT chat_id, MAX(seq) AS max_seq
       FROM cache_messages
      WHERE chat_id IN (${placeholders})
      GROUP BY chat_id`,
    uniqueChatIds,
  );
  const latestByChat = new Map(latestRows.map((row) => [row.chat_id, row.max_seq]));
  let markedCount = 0;

  for (const chatId of uniqueChatIds) {
    await setChatListPreference(userId, chatId, 'unread', false);
    const seq = latestByChat.get(chatId);
    if (typeof seq !== 'number' || seq <= 0) continue;
    await markChatRead(db, chatId, userId, seq, false, send, sendHint);
    markedCount += 1;
  }

  if (online) await flushPendingReadStates(db, send, sendHint);
  return markedCount;
}

/** Merges fresh member rows received after a read Broadcast into the local cache. */
export async function cacheMembers(
  db: SQLiteDatabase,
  rows: readonly ChatMemberRow[],
): Promise<void> {
  const store = createSqliteCacheStore(db);
  for (const row of rows) await store.upsertMember(row);
}
