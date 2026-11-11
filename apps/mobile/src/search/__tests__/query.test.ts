import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { normalizeSearch, searchCachedMessages, countMessageMatches, searchScopedMessages } from '../query';
import type { QueueItem } from '@dologram/shared';

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

const scope = { userId: 'me', allowedChatIds: ['chat'], chatId: 'chat' };
const signal = () => new AbortController().signal;
function queued(id: string, status: QueueItem['status'] = 'queued'): QueueItem {
  return { temp_id: id, chat_id: 'chat', status, created_at: 1000, retry_count: 0,
    next_attempt_at: 0, row_may_exist: false, row_state: 'absent', last_error: null,
    payload: { kind: 'text', chat_id: 'chat', sender_id: 'me', content: 'needle', reply_to: null, attachment_count: 0, attachments: [] } };
}

test('completed summaries and scoped pages agree on 35 old matches', async () => {
  for (let i = 0; i < 260; i++) addMessage(String(i).padStart(3, '0'), i < 35 ? 'needle' : 'unrelated');
  const counts = await countMessageMatches(db, scope, 'needle', signal());
  expect(counts).toEqual([{ chatId: 'chat', deliveredMatchCount: 35, latestMatch: expect.objectContaining({ messageId: '034' }) }]);
  const first = await searchScopedMessages(db, scope, 'needle', null, signal(), async () => []);
  const second = await searchScopedMessages(db, scope, 'needle', first.next, signal(), async () => []);
  expect([...first.matches, ...second.matches].map((row) => row.messageId)).toEqual((await search('needle')).matches.map((row) => row.messageId).concat(['004', '003', '002', '001', '000']));
  expect(await countMessageMatches(db, scope, 'absent', signal())).toEqual([]);
});

test('pending rows preserve queue IDs/status and exclude foreign, sent, deleted and paged-out echoes', async () => {
  addMessage('echo', 'needle');
  addMessage('deleted', 'needle', { deleted: true });
  const foreign = queued('foreign'); foreign.payload.sender_id = 'someone-else';
  const otherChat = queued('other-chat'); otherChat.chat_id = 'other';
  const items = [queued('echo'), queued('deleted'), queued('q'), queued('s', 'sending'), queued('f', 'failed'), queued('sent', 'sent'), foreign, otherChat];
  const page = await searchScopedMessages(db, scope, 'needle', null, signal(), async () => items);
  expect(page.matches.map((row) => row.messageId)).toEqual(['echo']);
  expect(page.pendingMatches.map((row) => [row.messageId, row.pendingStatus])).toEqual([['s', 'sending'], ['q', 'queued'], ['f', 'failed']]);
  expect((await countMessageMatches(db, scope, 'needle', signal()))[0].deliveredMatchCount).toBe(1);
  const afterEcho = await searchScopedMessages(db, scope, 'needle', { createdAt: '2026-11-11T00:00:00Z', messageId: 'echo' }, signal(), async () => items);
  expect(afterEcho.pendingMatches.some((row) => row.messageId === 'echo')).toBe(false);
});

test('scoped authorization rejects missing membership and disallowed routes before reading the queue', async () => {
  const getUnsent = jest.fn(async () => []);
  await expect(searchScopedMessages(db, { ...scope, allowedChatIds: [] }, 'needle', null, signal(), getUnsent)).rejects.toMatchObject({ kind: 'unavailable' });
  await expect(searchScopedMessages(db, { ...scope, userId: 'foreign' }, 'needle', null, signal(), getUnsent)).rejects.toMatchObject({ kind: 'unavailable' });
  expect(getUnsent).not.toHaveBeenCalled();
});

test('source metadata explains independent sender and attachment matches', async () => {
  addMessage('sender', 'content', { senderId: 'other' });
  addMessage('attachment', 'content');
  sqlite.prepare('INSERT INTO cache_message_media VALUES (?, ?)').run('attachment', JSON.stringify({ media_type: 'file' }));
  expect((await search('josé')).matches[0]).toMatchObject({ sources: ['sender'], preview: 'Matched sender: José · content' });
  expect((await search('file')).matches[0]).toMatchObject({ sources: ['attachment'], preview: 'Matched attachment: File · content' });
  expect((await search('josé content')).matches).toEqual([]);
});

test('read errors stay errors; deadlines and cancellation discard late native reads', async () => {
  jest.useFakeTimers();
  try {
    let settle: (rows: never[]) => void = () => { throw new Error('read did not start'); };
    jest.spyOn(db, 'getAllAsync').mockImplementationOnce(() => new Promise((resolve) => { settle = resolve; }));
    const pending = countMessageMatches(db, scope, 'needle', signal(), Date.now() + 100);
    const rejected = expect(pending).rejects.toMatchObject({ kind: 'timeout' });
    await jest.advanceTimersByTimeAsync(100);
    await rejected;
    settle([]);
    await Promise.resolve();
    jest.spyOn(db, 'getAllAsync').mockRejectedValueOnce(new Error('read failed'));
    await expect(countMessageMatches(db, scope, 'needle', signal())).rejects.toThrow('read failed');
    const controller = new AbortController();
    jest.spyOn(db, 'getAllAsync').mockImplementationOnce(async () => { controller.abort(); return []; });
    await expect(countMessageMatches(db, scope, 'needle', controller.signal)).rejects.toMatchObject({ kind: 'cancelled' });
    expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});

test('10,000-message/100-chat scan retains summaries and batches at most 200 source rows', async () => {
  sqlite.exec('BEGIN');
  const ids = Array.from({ length: 100 }, (_, i) => `scope-${i}`);
  for (const id of ids) sqlite.prepare('INSERT INTO cache_chat_members VALUES (?, ?, NULL)').run(id, 'me');
  for (let i = 0; i < 10000; i++) addMessage(`stress-${String(i).padStart(5, '0')}`, 'needle', { chatId: ids[i % 100] });
  sqlite.exec('COMMIT');
  const read = jest.spyOn(db, 'getAllAsync');
  const result = await countMessageMatches(db, { userId: 'me', allowedChatIds: ids }, 'needle', signal());
  expect(result).toHaveLength(100);
  expect(result.every((summary) => summary.deliveredMatchCount === 100)).toBe(true);
  expect(result.reduce((total, summary) => total + summary.deliveredMatchCount, 0)).toBe(10000);
  for (const call of read.mock.calls) {
    const params: unknown = call[1];
    expect(Array.isArray(params) ? params.at(-1) : null).toBe(200);
  }
  expect(read).toHaveBeenCalledTimes(51);
});
