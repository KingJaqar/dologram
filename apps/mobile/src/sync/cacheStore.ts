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
import { deleteCachedChat } from './localCache';
import { markMessageReceived } from '../metrics/latency';

export function createSqliteCacheStore(db: SQLiteDatabase): SyncCacheStore {
  return {
    async init(): Promise<void> {
      // The schema is created and upgraded by getLocalDatabase().
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
      const row = await db.getFirstAsync<{ chat_id: string }>(
        'SELECT chat_id FROM cache_chats WHERE chat_id = ?',
        [chatId],
      );
      return row !== null;
    },

    async listChatIds(): Promise<string[]> {
      const rows = await db.getAllAsync<{ chat_id: string }>('SELECT chat_id FROM cache_chats');
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
      await db.runAsync(
        `INSERT INTO cache_chat_members (chat_id, user_id, nickname, last_read_seq, payload)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(chat_id, user_id) DO UPDATE SET
             nickname = excluded.nickname,
             last_read_seq = excluded.last_read_seq,
             payload = excluded.payload`,
        [row.chat_id, row.user_id, row.nickname ?? null, row.last_read_seq, JSON.stringify(row)],
      );
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
             payload = excluded.payload`,
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
             payload = excluded.payload`,
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
             payload = excluded.payload`,
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
      await deleteCachedChat(db, chatId);
    },
  };
}
