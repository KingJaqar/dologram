/** Persisted read-state updates and the private read hint (D-23, D-92). */
import type { SQLiteDatabase } from 'expo-sqlite';
import type { ChatMemberRow, DgResult } from '@dologram/shared';
import { createSqliteCacheStore } from '../sync/cacheStore';
import { notifyCacheChange } from '../sync/cacheEvents';
import { setChatListPreference } from '../chatList/preferences';

type PendingReadRow = {
  chat_id: string;
  last_read_seq: number;
  membership_joined_at: string | null;
};
type MemberCacheRow = {
  payload: string;
  confirmed_last_read_seq: number | null;
};
type LatestMessageRow = { chat_id: string; max_seq: number | null };

const READ_SEND_TIMEOUT_MS = 10_000;
const MAX_AUTOMATIC_RETRIES = 3;

function parseMember(value: string): ChatMemberRow | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const member = parsed as Partial<ChatMemberRow>;
    return typeof member.chat_id === 'string' &&
      typeof member.user_id === 'string' &&
      typeof member.joined_at === 'string' &&
      typeof member.last_read_seq === 'number' &&
      Number.isSafeInteger(member.last_read_seq) &&
      member.last_read_seq >= 0
      ? (member as ChatMemberRow)
      : null;
  } catch {
    return null;
  }
}

function validCandidate(seq: number): boolean {
  return Number.isSafeInteger(seq) && seq > 0;
}

async function cacheReadSeq(
  db: SQLiteDatabase,
  chatId: string,
  userId: string,
  seq: number,
): Promise<{ seq: number; changed: boolean }> {
  if (!validCandidate(seq)) return { seq: 0, changed: false };
  let next = 0;
  let changed = false;
  await db.withExclusiveTransactionAsync(async (txn) => {
    const row = await txn.getFirstAsync<MemberCacheRow>(
      `SELECT payload, confirmed_last_read_seq
         FROM cache_chat_members WHERE chat_id = ? AND user_id = ?`,
      [chatId, userId],
    );
    if (!row) return;
    const member = parseMember(row.payload);
    if (!member || member.chat_id !== chatId || member.user_id !== userId) return;
    const pending = await txn.getFirstAsync<PendingReadRow>(
      `SELECT chat_id, last_read_seq, membership_joined_at
         FROM pending_read_states WHERE user_id = ? AND chat_id = ?`,
      [userId, chatId],
    );
    const confirmed = row.confirmed_last_read_seq ?? 0;
    const matchingPending = pending?.membership_joined_at === member.joined_at ? pending.last_read_seq : 0;
    const effective = Math.max(confirmed, matchingPending);
    next = Math.max(effective, seq);
    changed = next > effective;
    if (!changed) {
      if (pending && pending.membership_joined_at === null && confirmed >= pending.last_read_seq) {
        await txn.runAsync('DELETE FROM pending_read_states WHERE user_id = ? AND chat_id = ?', [userId, chatId]);
      }
      return;
    }

    await txn.runAsync(
      `INSERT INTO pending_read_states (user_id, chat_id, last_read_seq, membership_joined_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, chat_id) DO UPDATE SET
           last_read_seq = CASE
             WHEN pending_read_states.membership_joined_at = excluded.membership_joined_at
               THEN MAX(pending_read_states.last_read_seq, excluded.last_read_seq)
             ELSE excluded.last_read_seq
           END,
           membership_joined_at = excluded.membership_joined_at`,
      [userId, chatId, next, member.joined_at],
    );
  });
  return { seq: next, changed };
}

export type ReadStateSender = (
  chatId: string,
  seq: number,
  membershipJoinedAt: string,
  signal?: AbortSignal,
) => Promise<DgResult<ChatMemberRow>>;

export type ReadStateFlushOptions = {
  isActive?: () => boolean;
  retryBudget?: Map<string, { attempts: number; lastReason: string | null; consecutiveFailures: number }>;
  onMembershipChanged?: (chatId: string) => Promise<void>;
};

const pendingFlushes = new Map<string, Promise<void>>();

function errorReason(result: DgResult<ChatMemberRow>): string {
  if (!result.error) return 'unknown';
  return result.error.kind === 'server'
    ? `${result.error.kind}:${result.error.code ?? result.error.status ?? 'unknown'}`
    : result.error.kind;
}

function acknowledgedRow(row: ChatMemberRow, chatId: string, userId: string, joinedAt: string): boolean {
  return row.chat_id === chatId && row.user_id === userId && row.joined_at === joinedAt
    && Number.isSafeInteger(row.last_read_seq) && row.last_read_seq >= 0;
}

export async function flushPendingReadStates(
  db: SQLiteDatabase,
  userId: string,
  send: ReadStateSender,
  sendHint: (chatId: string, seq: number) => Promise<boolean>,
  options: ReadStateFlushOptions = {},
): Promise<void> {
  const flush = (pendingFlushes.get(userId) ?? Promise.resolve()).catch(() => undefined).then(async () => {
    const pending = await db.getAllAsync<PendingReadRow>(
      `SELECT chat_id, last_read_seq, membership_joined_at
         FROM pending_read_states WHERE user_id = ? ORDER BY chat_id ASC`, [userId],
    );
    for (const row of pending) {
      if (options.isActive && !options.isActive()) return;
      // v8 intent has no provable membership generation. It remains fail-closed until a
      // confirmed cursor covers it or a new displayed candidate replaces it.
      if (!row.membership_joined_at) continue;

      const budget = options.retryBudget?.get(row.chat_id);
      if (budget && budget.attempts >= MAX_AUTOMATIC_RETRIES) continue;
      const attempt = budget ?? { attempts: 0, lastReason: null, consecutiveFailures: 0 };
      let result: DgResult<ChatMemberRow> | null = null;
      while (result === null) {
        attempt.attempts += 1;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), READ_SEND_TIMEOUT_MS);
        try {
          result = await send(row.chat_id, row.last_read_seq, row.membership_joined_at, controller.signal);
        } catch {
          result = { data: null, error: { kind: 'network' } };
        } finally {
          clearTimeout(timer);
        }
        if (!result.error && result.data && acknowledgedRow(result.data, row.chat_id, userId, row.membership_joined_at)) break;

        const reason = errorReason(result);
        attempt.consecutiveFailures = attempt.lastReason === reason ? attempt.consecutiveFailures + 1 : 1;
        attempt.lastReason = reason;
        options.retryBudget?.set(row.chat_id, attempt);
        if (result.error?.kind === 'server' && result.error.code === 'DG409') {
          await db.runAsync(
            `DELETE FROM pending_read_states WHERE user_id = ? AND chat_id = ? AND membership_joined_at = ?`,
            [userId, row.chat_id, row.membership_joined_at],
          );
          await options.onMembershipChanged?.(row.chat_id).catch(() => undefined);
        }
        const canRetry = Boolean(options.retryBudget)
          && attempt.attempts < MAX_AUTOMATIC_RETRIES
          && attempt.consecutiveFailures < 2;
        if (!canRetry) break;
        await new Promise<void>((resolve) => setTimeout(resolve, 2 ** (attempt.attempts - 1) * 1000));
        if (options.isActive && !options.isActive()) return;
        result = null;
      }
      if (!result || result.error || !result.data || !acknowledgedRow(result.data, row.chat_id, userId, row.membership_joined_at)) continue;

      const store = createSqliteCacheStore(db);
      await store.upsertMember(result.data);
      await db.runAsync(
        `DELETE FROM pending_read_states
           WHERE user_id = ? AND chat_id = ? AND membership_joined_at = ? AND last_read_seq <= ?`,
        [userId, row.chat_id, row.membership_joined_at, row.last_read_seq],
      );
      await sendHint(row.chat_id, result.data.last_read_seq);
      options.retryBudget?.delete(row.chat_id);
    }
  });
  pendingFlushes.set(userId, flush);
  try {
    await flush;
  } finally {
    if (pendingFlushes.get(userId) === flush) pendingFlushes.delete(userId);
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
  flushOptions: ReadStateFlushOptions = {},
): Promise<number> {
  await setChatListPreference(userId, chatId, 'unread', false);
  const next = await cacheReadSeq(db, chatId, userId, seq);
  if (next.changed) notifyCacheChange();
  if (online) await flushPendingReadStates(db, userId, send, sendHint, flushOptions);
  return next.seq;
}

/** Marks several chats read using the newest sequence currently available in the local cache. */
export async function markChatsRead(
  db: SQLiteDatabase,
  chatIds: readonly string[],
  userId: string,
  online: boolean,
  send: ReadStateSender,
  sendHint: (chatId: string, seq: number) => Promise<boolean>,
  flushOptions: ReadStateFlushOptions = {},
): Promise<number> {
  const uniqueChatIds = [...new Set(chatIds)];
  if (uniqueChatIds.length === 0) return 0;

  const placeholders = uniqueChatIds.map(() => '?').join(', ');
  const latestRows = await db.getAllAsync<LatestMessageRow>(
    `SELECT chat_id, MAX(seq) AS max_seq FROM cache_messages
      WHERE chat_id IN (${placeholders}) GROUP BY chat_id`,
    uniqueChatIds,
  );
  const latestByChat = new Map(latestRows.map((row) => [row.chat_id, row.max_seq]));
  let markedCount = 0;
  let changed = false;

  for (const targetChatId of uniqueChatIds) {
    await setChatListPreference(userId, targetChatId, 'unread', false);
    const latest = latestByChat.get(targetChatId);
    if (typeof latest !== 'number' || !validCandidate(latest)) continue;
    const result = await cacheReadSeq(db, targetChatId, userId, latest);
    changed = changed || result.changed;
    markedCount += 1;
  }

  if (changed) notifyCacheChange();
  if (online) await flushPendingReadStates(db, userId, send, sendHint, flushOptions);
  return markedCount;
}

/** Merges one authoritative member row received from a settings or mutation response. */
export async function cacheMember(db: SQLiteDatabase, row: ChatMemberRow): Promise<void> {
  await createSqliteCacheStore(db).upsertMember(row);
}

/** Merges a validated complete member snapshot received after a read Broadcast. */
export async function cacheMembers(
  db: SQLiteDatabase,
  chatId: string,
  userId: string,
  rows: readonly ChatMemberRow[],
): Promise<void> {
  if (rows.length === 0 || rows.some((row) => row.chat_id !== chatId)) return;
  await createSqliteCacheStore(db, userId).replaceMembers(chatId, rows);
}
