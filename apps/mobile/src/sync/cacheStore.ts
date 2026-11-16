/**
 * expo-sqlite cache adapter for the sync engine (M2-05, 6.2, 6.4, D-40, D-91).
 *
 * The tables are created by `getLocalDatabase()` (Phase 5): cache_chats, cache_chat_members,
 * cache_messages, cache_message_media, cache_reactions and sync_state. Each row is stored as the
 * server row JSON plus the columns the app queries on, so a merge by key is an UPSERT and a
 * replayed event changes nothing. The cursor only moves forwards.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  ChatMemberRow,
  ChatRow,
  MessageMediaRow,
  MessageRow,
  ProfileRow,
  ReactionRow,
  SyncCacheStore,
} from '@dologram/shared';
import { removeCachedMembership } from './localCache';
import { markMessageReceived } from '../metrics/latency';

type MemberConnection = Pick<SQLiteDatabase, 'getFirstAsync' | 'runAsync'>;

async function upsertConfirmedMember(db: MemberConnection, row: ChatMemberRow): Promise<void> {
  const current = await db.getFirstAsync<{
    confirmed_last_read_seq: number | null;
    confirmed_joined_at: string | null;
    payload: string;
  }>(
    `SELECT confirmed_last_read_seq, confirmed_joined_at, payload
       FROM cache_chat_members WHERE chat_id = ? AND user_id = ?`,
    [row.chat_id, row.user_id],
  );
  let cachedJoinedAt = current?.confirmed_joined_at ?? null;
  if (!cachedJoinedAt && current) {
    try {
      const payload: unknown = JSON.parse(current.payload);
      if (typeof payload === 'object' && payload !== null && typeof (payload as { joined_at?: unknown }).joined_at === 'string') {
        cachedJoinedAt = (payload as { joined_at: string }).joined_at;
      }
    } catch {
      cachedJoinedAt = null;
    }
  }
  if (cachedJoinedAt && cachedJoinedAt !== row.joined_at
    && Date.parse(cachedJoinedAt) > Date.parse(row.joined_at)) return;
  const sameMembership = cachedJoinedAt === row.joined_at;
  const confirmedSeq = sameMembership
    ? Math.max(current?.confirmed_last_read_seq ?? 0, row.last_read_seq)
    : row.last_read_seq;
  const storedRow = { ...row, last_read_seq: confirmedSeq };
  await db.runAsync(
    `INSERT INTO cache_chat_members
       (chat_id, user_id, nickname, last_read_seq, payload, confirmed_last_read_seq, confirmed_joined_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(chat_id, user_id) DO UPDATE SET
         nickname = excluded.nickname,
         last_read_seq = excluded.last_read_seq,
         payload = excluded.payload,
         confirmed_last_read_seq = excluded.confirmed_last_read_seq,
         confirmed_joined_at = excluded.confirmed_joined_at`,
    [row.chat_id, row.user_id, row.nickname ?? null, confirmedSeq, JSON.stringify(storedRow), confirmedSeq, row.joined_at],
  );
}

export function createSqliteCacheStore(db: SQLiteDatabase, userId?: string): SyncCacheStore {
  return {
    async init(): Promise<void> {
      // The schema is created and upgraded by getLocalDatabase().
    },

    async upgradeCheckpoints(): Promise<void> {
      await db.withExclusiveTransactionAsync(async (txn) => {
        const row = await txn.getFirstAsync<{ version: number }>('SELECT version FROM sync_checkpoint_upgrade');
        if (row && row.version > 1) throw new Error('Unsupported sync checkpoint version');
        if (row?.version === 1) return;
        await txn.runAsync('DELETE FROM sync_checkpoint_backup', []);
        await txn.runAsync('INSERT INTO sync_checkpoint_backup SELECT * FROM sync_state', []);
        await txn.runAsync('UPDATE sync_state SET cursor = 0', []);
        await txn.runAsync('INSERT INTO sync_checkpoint_upgrade(version) VALUES (1)', []);
      });
    },

    async getCursor(chatId: string): Promise<number> {
      const row = await db.getFirstAsync<{ cursor: number }>(
        'SELECT cursor FROM sync_state WHERE chat_id = ?',
        [chatId],
      );
      return row?.cursor ?? 0;
    },

    async setCursor(chatId: string, cursor: number): Promise<void> {
      await db.runAsync(
        `INSERT INTO sync_state (chat_id, cursor) VALUES (?, ?)
           ON CONFLICT(chat_id) DO UPDATE SET cursor = MAX(sync_state.cursor, excluded.cursor)`,
        [chatId, cursor],
      );
    },

    async hasChat(chatId: string): Promise<boolean> {
      if (!userId) return false;
      const row = await db.getFirstAsync<{ chat_id: string }>(
        `SELECT chat_id FROM cache_chat_members WHERE chat_id = ? AND user_id = ?`,
        [chatId, userId],
      );
      return row !== null;
    },

    async listChatIds(): Promise<string[]> {
      if (!userId) return [];
      const rows = await db.getAllAsync<{ chat_id: string }>(
        'SELECT chat_id FROM cache_chat_members WHERE user_id = ?', [userId],
      );
      return rows.map((row) => row.chat_id);
    },

    async upsertChat(row: ChatRow): Promise<void> {
      await db.runAsync(
        `INSERT INTO cache_chats (chat_id, payload) VALUES (?, ?)
           ON CONFLICT(chat_id) DO UPDATE SET payload = excluded.payload`,
        [row.chat_id, JSON.stringify(row)],
      );
    },

    async upsertMember(row: ChatMemberRow): Promise<void> {
      await db.withExclusiveTransactionAsync((txn) => upsertConfirmedMember(txn, row));
    },

    async replaceMembers(chatId: string, rows: readonly ChatMemberRow[]): Promise<void> {
      if (rows.length === 0) throw new Error('Cannot replace members with an empty snapshot');
      const memberIds = rows.map((row) => row.user_id);
      await db.withExclusiveTransactionAsync(async (txn) => {
        const placeholders = memberIds.map(() => '?').join(', ');
        await txn.runAsync(
          `DELETE FROM cache_chat_members WHERE chat_id = ? AND user_id NOT IN (${placeholders})`,
          [chatId, ...memberIds],
        );
        for (const row of rows) await upsertConfirmedMember(txn, row);
        if (userId) {
          const own = rows.find((row) => row.user_id === userId);
          if (own) {
            await txn.runAsync(
              `DELETE FROM pending_read_states
                 WHERE user_id = ? AND chat_id = ?
                   AND membership_joined_at IS NOT NULL AND membership_joined_at <> ?`,
              [userId, chatId, own.joined_at],
            );
          }
        }
      });
    },

    async upsertMessage(row: MessageRow): Promise<void> {
      markMessageReceived(row.message_id);
      await db.runAsync(
        `INSERT INTO cache_messages
           (message_id, chat_id, seq, sync_seq, sender_id, created_at, deleted_at, payload)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(message_id) DO UPDATE SET
             chat_id = excluded.chat_id,
             seq = excluded.seq,
             sync_seq = excluded.sync_seq,
             sender_id = excluded.sender_id,
             created_at = excluded.created_at,
             deleted_at = excluded.deleted_at,
             payload = excluded.payload WHERE excluded.sync_seq > cache_messages.sync_seq`,
        [
          row.message_id,
          row.chat_id,
          row.seq,
          row.sync_seq,
          row.sender_id,
          row.created_at,
          row.deleted_at,
          JSON.stringify(row),
        ],
      );
    },

    async upsertMedia(row: MessageMediaRow): Promise<void> {
      await db.runAsync(
        `INSERT INTO cache_message_media (media_id, message_id, chat_id, sync_seq, payload)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(media_id) DO UPDATE SET
             message_id = excluded.message_id,
             chat_id = excluded.chat_id,
             sync_seq = excluded.sync_seq,
             payload = excluded.payload WHERE excluded.sync_seq > cache_message_media.sync_seq`,
        [row.media_id, row.message_id, row.chat_id, row.sync_seq, JSON.stringify(row)],
      );
    },

    async upsertReaction(row: ReactionRow): Promise<void> {
      await db.runAsync(
        `INSERT INTO cache_reactions (message_id, user_id, emoji, chat_id, sync_seq, removed_at, payload)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(message_id, user_id, emoji) DO UPDATE SET
             chat_id = excluded.chat_id,
             sync_seq = excluded.sync_seq,
             removed_at = excluded.removed_at,
             payload = excluded.payload WHERE excluded.sync_seq > cache_reactions.sync_seq`,
        [
          row.message_id,
          row.user_id,
          row.emoji,
          row.chat_id,
          row.sync_seq,
          row.removed_at,
          JSON.stringify(row),
        ],
      );
    },

    async upsertProfile(row: ProfileRow): Promise<void> {
      await db.runAsync(
        `INSERT INTO cache_profiles (user_id, display_name, payload) VALUES (?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET
             display_name = excluded.display_name,
             payload = excluded.payload`,
        [row.user_id, row.display_name, JSON.stringify(row)],
      );
    },

    async deleteChat(chatId: string): Promise<void> {
      if (userId) await removeCachedMembership(db, chatId, userId);
    },
  };
}
