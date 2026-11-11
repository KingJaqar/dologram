/**
 * The device-local database (M2-02, D-06, LS-9).
 *
 * One expo-sqlite database holds the outgoing queue, the synced cache (chats, chat members,
 * messages, message media, reactions, profiles) and the per-chat sync cursor of 6.2. The cache
 * tables store the server row as JSON plus the columns the chat list queries on (`chat_id`, `seq`,
 * `sync_seq`, `sender_id`, `created_at`, `deleted_at`, `last_read_seq`), so D-44's single unread
 * query needs no JSON parsing. Schema changes are applied once through `PRAGMA user_version`.
 */
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

const DATABASE_NAME = 'dologram.db';
const SCHEMA_VERSION = 7;

const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS queue_items (
  temp_id TEXT PRIMARY KEY NOT NULL,
  chat_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL,
  row_may_exist INTEGER NOT NULL DEFAULT 0,
  row_state TEXT NOT NULL DEFAULT 'absent',
  last_error TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS queue_items_status_next ON queue_items(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS queue_items_chat ON queue_items(chat_id, created_at);

CREATE TABLE IF NOT EXISTS cache_chats (
  chat_id TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cache_chat_members (
  chat_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  nickname TEXT,
  payload TEXT NOT NULL,
  PRIMARY KEY (chat_id, user_id)
);
CREATE TABLE IF NOT EXISTS cache_messages (
  message_id TEXT PRIMARY KEY NOT NULL,
  chat_id TEXT NOT NULL,
  seq INTEGER,
  sync_seq INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS cache_messages_chat_seq ON cache_messages(chat_id, seq);
CREATE TABLE IF NOT EXISTS cache_message_media (
  media_id TEXT PRIMARY KEY NOT NULL,
  message_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  sync_seq INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cache_reactions (
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  sync_seq INTEGER NOT NULL DEFAULT 0,
  removed_at TEXT,
  payload TEXT NOT NULL,
  PRIMARY KEY (message_id, user_id, emoji)
);
CREATE TABLE IF NOT EXISTS sync_state (
  chat_id TEXT PRIMARY KEY NOT NULL,
  cursor INTEGER NOT NULL DEFAULT 0
);
`;

/**
 * Version 2 adds the chat list's query columns (M2-08, D-44) and the profile cache AND-03 needs
 * for titles and sender names. Existing rows are backfilled from their JSON payload, so an
 * upgrade keeps the offline cache.
 */
const SCHEMA_V2_ADDITIONS = `
ALTER TABLE cache_messages ADD COLUMN sender_id TEXT NOT NULL DEFAULT '';
ALTER TABLE cache_messages ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
ALTER TABLE cache_messages ADD COLUMN deleted_at TEXT;
ALTER TABLE cache_chat_members ADD COLUMN last_read_seq INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS cache_messages_chat_created ON cache_messages(chat_id, created_at);
CREATE TABLE IF NOT EXISTS cache_profiles (
  user_id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL
);
`;

/** Phase 9 persists read updates that were made while offline (D-23, D-92). */
const SCHEMA_V3_ADDITIONS = `
CREATE TABLE IF NOT EXISTS pending_read_states (
  chat_id TEXT PRIMARY KEY NOT NULL,
  last_read_seq INTEGER NOT NULL
);
`;

/** Phase 11 tracks the stored message row separately from attachment completion (LS-4, D-93). */
const SCHEMA_V4_ADDITIONS = `
ALTER TABLE queue_items ADD COLUMN row_state TEXT NOT NULL DEFAULT 'absent';
UPDATE queue_items SET row_state = CASE WHEN row_may_exist = 1 THEN 'unknown' ELSE 'absent' END;
`;

/** Phase 14 caches per-user folders locally so the list remains useful offline. */
const SCHEMA_V5_ADDITIONS = `
CREATE TABLE IF NOT EXISTS cache_folders (
  folder_id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS cache_folders_user ON cache_folders(user_id, folder_id);
CREATE TABLE IF NOT EXISTS cache_folder_chats (
  folder_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  PRIMARY KEY (folder_id, chat_id)
);
CREATE INDEX IF NOT EXISTS cache_folder_chats_chat ON cache_folder_chats(chat_id);
`;

/** Phase 17 keeps the chat-list latest-message and media lookups indexed as the cache grows. */
const SCHEMA_V6_ADDITIONS = `
CREATE INDEX IF NOT EXISTS cache_messages_chat_latest
  ON cache_messages(chat_id, created_at DESC, seq DESC);
CREATE INDEX IF NOT EXISTS cache_message_media_message
  ON cache_message_media(message_id);
`;

const SCHEMA_V7_ADDITIONS = `
ALTER TABLE cache_chat_members ADD COLUMN nickname TEXT;
`;

let databasePromise: Promise<SQLiteDatabase> | null = null;

function asRecord(payload: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(payload);
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function stringField(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

function nullableStringField(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' ? value : null;
}

/** Copies the version 2 query columns out of the payloads written under version 1. */
async function backfillCacheColumns(db: SQLiteDatabase): Promise<void> {
  const messages = await db.getAllAsync<{ message_id: string; payload: string }>(
    'SELECT message_id, payload FROM cache_messages',
  );
  for (const message of messages) {
    const row = asRecord(message.payload);
    if (!row) continue;
    await db.runAsync(
      'UPDATE cache_messages SET sender_id = ?, created_at = ?, deleted_at = ? WHERE message_id = ?',
      [
        stringField(row, 'sender_id'),
        stringField(row, 'created_at'),
        nullableStringField(row, 'deleted_at'),
        message.message_id,
      ],
    );
  }

  const members = await db.getAllAsync<{ chat_id: string; user_id: string; payload: string }>(
    'SELECT chat_id, user_id, payload FROM cache_chat_members',
  );
  for (const member of members) {
    const row = asRecord(member.payload);
    if (!row) continue;
    const lastRead = row.last_read_seq;
    await db.runAsync(
      'UPDATE cache_chat_members SET last_read_seq = ? WHERE chat_id = ? AND user_id = ?',
      [typeof lastRead === 'number' ? lastRead : 0, member.chat_id, member.user_id],
    );
  }
}

async function backfillMemberNicknames(db: SQLiteDatabase): Promise<void> {
  const members = await db.getAllAsync<{ chat_id: string; user_id: string; payload: string }>(
    'SELECT chat_id, user_id, payload FROM cache_chat_members',
  );
  for (const member of members) {
    const row = asRecord(member.payload);
    await db.runAsync(
      'UPDATE cache_chat_members SET nickname = ? WHERE chat_id = ? AND user_id = ?',
      [row && typeof row.nickname === 'string' ? row.nickname : null, member.chat_id, member.user_id],
    );
  }
}

async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;
  if (currentVersion >= SCHEMA_VERSION) return;

  if (currentVersion === 0) {
    await db.execAsync(SCHEMA_V1);
  }

  if (currentVersion < 2) {
    await db.execAsync(SCHEMA_V2_ADDITIONS);
    await backfillCacheColumns(db);
  }

  if (currentVersion < 3) {
    await db.execAsync(SCHEMA_V3_ADDITIONS);
  }

  // Fresh databases already receive row_state from SCHEMA_V1; only upgrades need ALTER TABLE.
  if (currentVersion > 0 && currentVersion < 4) {
    await db.execAsync(SCHEMA_V4_ADDITIONS);
  }

  if (currentVersion < 5) {
    await db.execAsync(SCHEMA_V5_ADDITIONS);
  }

  if (currentVersion < 6) {
    await db.execAsync(SCHEMA_V6_ADDITIONS);
  }

  if (currentVersion > 0 && currentVersion < 7) {
    await db.execAsync(SCHEMA_V7_ADDITIONS);
    await backfillMemberNicknames(db);
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

/** Opens the single device database and applies the schema once per app start. */
export function getLocalDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    // Expo's Android native cache can return a handle released by another JS wrapper
    // (expo/expo#48999). Own one connection here instead of sharing that native handle.
    // All queue, sync and UI callers still share this promise and the same database file.
    databasePromise = openDatabaseAsync(DATABASE_NAME, { useNewConnection: true }).then(async (db) => {
      try {
        // These settings belong to the connection, including when the schema is up to date.
        await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
        await migrate(db);
        return db;
      } catch (error) {
        // A failed initialization never reaches callers, so it is safe to close here.
        // Keep the original failure even if the native handle is already unusable.
        await db.closeAsync().catch(() => undefined);
        throw error;
      }
    });
    // A failed open must not poison every later call: forget it so the next call retries.
    databasePromise.catch(() => {
      databasePromise = null;
    });
  }
  return databasePromise;
}
