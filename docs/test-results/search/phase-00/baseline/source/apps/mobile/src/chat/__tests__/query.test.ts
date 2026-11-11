import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { loadChatSnapshotForMessage } from '../query';

jest.mock('../../queue/localQueue', () => ({ getUnsentItems: async () => [] }));

test('opens an older search match with bounded surrounding history and keeps current matches on the latest page', async () => {
  const sqlite = new DatabaseSync(':memory:');
  try {
    sqlite.exec(`
      CREATE TABLE cache_chats (chat_id TEXT, payload TEXT);
      CREATE TABLE cache_chat_members (chat_id TEXT, user_id TEXT, payload TEXT);
      CREATE TABLE cache_profiles (user_id TEXT, display_name TEXT, payload TEXT);
      CREATE TABLE cache_messages (chat_id TEXT, message_id TEXT, sender_id TEXT, seq INTEGER, deleted_at TEXT, payload TEXT);
      CREATE TABLE cache_message_media (chat_id TEXT, message_id TEXT, media_id TEXT, payload TEXT);
      CREATE TABLE cache_reactions (chat_id TEXT, message_id TEXT, removed_at TEXT, payload TEXT);
    `);
    sqlite.prepare('INSERT INTO cache_chats VALUES (?, ?)').run('chat', JSON.stringify({
      chat_id: 'chat', type: 'group', title: 'Group', created_at: '2026-11-11T00:00:00Z',
    }));
    sqlite.prepare('INSERT INTO cache_chat_members VALUES (?, ?, ?)').run('chat', 'me', JSON.stringify({
      chat_id: 'chat', user_id: 'me', last_read_seq: 0,
    }));
    for (let seq = 1; seq <= 400; seq++) {
      sqlite.prepare('INSERT INTO cache_messages VALUES (?, ?, ?, ?, NULL, ?)').run('chat', String(seq), 'me', seq, JSON.stringify({
        chat_id: 'chat', message_id: String(seq), sender_id: 'me', seq, content: 'hello',
        created_at: '2026-11-11T00:00:00Z', deleted_at: null,
      }));
    }
    const db = {
      getAllAsync: async (sql: string, params: (string | number)[]) => sqlite.prepare(sql).all(...params),
      getFirstAsync: async (sql: string, params: (string | number)[]) => sqlite.prepare(sql).get(...params) ?? null,
    } as unknown as SQLiteDatabase;

    const older = await loadChatSnapshotForMessage(db, 'chat', 'me', '100', 50);
    expect(older.snapshot.messages).toHaveLength(50);
    expect(older.snapshot.messages.map((message) => message.messageId)).toContain('100');
    expect(older.snapshot.messages.at(-1)?.seq).toBe(110);
    expect(older.snapshot.hasMoreBefore).toBe(true);
    expect(older.beforeSeq).toBe(111);

    const recent = await loadChatSnapshotForMessage(db, 'chat', 'me', '395', 50);
    expect(recent.beforeSeq).toBeUndefined();
    expect(recent.snapshot.messages.at(-1)?.seq).toBe(400);

    const missing = await loadChatSnapshotForMessage(db, 'chat', 'me', 'missing', 50);
    expect(missing.beforeSeq).toBeUndefined();
    expect(missing.snapshot.messages.at(-1)?.seq).toBe(400);
  } finally {
    sqlite.close();
  }
});
