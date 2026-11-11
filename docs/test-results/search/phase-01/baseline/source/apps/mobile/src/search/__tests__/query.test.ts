import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { normalizeSearch, searchCachedMessages } from '../query';

let sqlite: DatabaseSync;
let db: SQLiteDatabase;

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE cache_messages (
      message_id TEXT PRIMARY KEY, chat_id TEXT, sender_id TEXT, seq INTEGER,
      created_at TEXT, deleted_at TEXT, payload TEXT
    );
    CREATE TABLE cache_chat_members (chat_id TEXT, user_id TEXT, nickname TEXT);
    CREATE TABLE cache_profiles (user_id TEXT, display_name TEXT);
    CREATE TABLE cache_message_media (message_id TEXT, payload TEXT);
    INSERT INTO cache_chat_members VALUES ('chat', 'me', NULL), ('chat', 'other', 'José');
  `);
  db = {
    getAllAsync: async (sql: string, params: string[]) => sqlite.prepare(sql).all(...params),
  } as unknown as SQLiteDatabase;
});

afterEach(() => sqlite.close());

function addMessage(id: string, content: string, options: {
  chatId?: string; senderId?: string; deleted?: boolean; seq?: number;
} = {}) {
  sqlite.prepare('INSERT INTO cache_messages VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    id, options.chatId ?? 'chat', options.senderId ?? 'me', options.seq ?? 1,
    '2026-11-11T00:00:00Z', options.deleted ? '2026-11-11T01:00:00Z' : null,
    JSON.stringify({ content }),
  );
}

function search(query: string, cursor: Parameters<typeof searchCachedMessages>[4] = null) {
  return searchCachedMessages(db, 'me', '["chat"]', normalizeSearch(query), cursor, new AbortController().signal);
}

test('searches beyond the newest 200 rows and preserves tied-date pagination', async () => {
  for (let index = 0; index < 260; index++) {
    addMessage(String(index).padStart(3, '0'), index < 35 ? 'Needle' : 'Unrelated');
  }
  const first = await search('needle');
  expect(first.matches).toHaveLength(30);
  expect(first.matches[0].messageId).toBe('034');
  expect(first.next).toBeTruthy();
  const second = await search('needle', first.next);
  expect(second.matches).toHaveLength(5);
  expect(second.next).toBeNull();
  expect(new Set([...first.matches, ...second.matches].map((message) => message.messageId)).size).toBe(35);
});

test('excludes deleted messages, other accounts, and hidden conversations', async () => {
  addMessage('valid', 'needle');
  addMessage('deleted', 'needle', { deleted: true });
  addMessage('foreign', 'needle', { chatId: 'foreign' });
  sqlite.prepare('INSERT INTO cache_chat_members VALUES (?, ?, NULL)').run('foreign', 'someone-else');
  addMessage('hidden', 'needle', { chatId: 'hidden' });
  sqlite.prepare('INSERT INTO cache_chat_members VALUES (?, ?, NULL)').run('hidden', 'me');
  const result = await searchCachedMessages(db, 'me', '["chat","foreign"]', 'needle', null, new AbortController().signal);
  expect(result.matches.map((message) => message.messageId)).toEqual(['valid']);
});

test('normalizes Unicode and treats SQL metacharacters literally', async () => {
  addMessage('unicode', 'ＣＡＦÉ');
  addMessage('literal', "100%_ ' OR 1=1 --");
  expect((await search('café')).matches.map((message) => message.messageId)).toEqual(['unicode']);
  expect((await search("%_ ' OR 1=1 --")).matches.map((message) => message.messageId)).toEqual(['literal']);
});

test('matches sender nicknames and live attachment types', async () => {
  addMessage('nickname', 'hello', { senderId: 'other' });
  addMessage('file', '');
  addMessage('removed-file', '');
  sqlite.prepare('INSERT INTO cache_message_media VALUES (?, ?)').run('file', JSON.stringify({ media_type: 'file', deleted_at: null }));
  sqlite.prepare('INSERT INTO cache_message_media VALUES (?, ?)').run('removed-file', JSON.stringify({ media_type: 'file', deleted_at: '2026-11-11' }));
  expect((await search('josé')).matches.map((message) => message.messageId)).toEqual(['nickname']);
  const files = await search('file');
  expect(files.matches.map((message) => message.messageId)).toEqual(['file']);
  expect(files.matches[0].preview).toBe('File');
});

test('stops a cancelled search and returns no matches for an empty query', async () => {
  const controller = new AbortController();
  controller.abort();
  const getAll = jest.spyOn(db, 'getAllAsync');
  await searchCachedMessages(db, 'me', '["chat"]', 'hello', null, controller.signal);
  await search('');
  expect(getAll).not.toHaveBeenCalled();
});
