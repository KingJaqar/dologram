import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadSearchPeople, rankSearchNames } from '../people';
import { DEFAULT_CHAT_PREFERENCES, saveChatPreferences } from '../../chats/preferences';
import { setChatListPreference } from '../../chatList/preferences';

let sqlite: DatabaseSync;
let db: SQLiteDatabase;
beforeEach(async () => {
  await AsyncStorage.clear();
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE cache_chats (chat_id TEXT PRIMARY KEY, payload TEXT);
    CREATE TABLE cache_chat_members (chat_id TEXT, user_id TEXT, payload TEXT, nickname TEXT, last_read_seq INTEGER);
    CREATE TABLE cache_profiles (user_id TEXT, display_name TEXT);
    CREATE TABLE cache_messages (message_id TEXT, chat_id TEXT, sender_id TEXT, seq INTEGER, deleted_at TEXT, created_at TEXT, payload TEXT);
    CREATE TABLE cache_message_media (message_id TEXT, payload TEXT);`);
  db = { getAllAsync: async (sql: string, params: (string | number)[]) => sqlite.prepare(sql).all(...params) } as unknown as SQLiteDatabase;
});
afterEach(() => sqlite.close());

function chat(id: string, members: string[], group = true) {
  sqlite.prepare('INSERT INTO cache_chats VALUES (?, ?)').run(id, JSON.stringify({ chat_id: id,
    created_at: '2026-11-01T00:00:00Z', created_by: members[0], direct_key: members.length === 1 ? members[0] : id,
    next_seq: 0, title: group ? id : null, type: group ? 'group' : 'direct' }));
  for (const userId of members) sqlite.prepare('INSERT INTO cache_chat_members VALUES (?, ?, ?, NULL, 0)').run(id, userId,
    JSON.stringify({ chat_id: id, user_id: userId, archived: false, joined_at: '2026-11-01', last_read_seq: 0, muted_until: null, role: 'member' }));
}
function person(id: string, name: string) { sqlite.prepare('INSERT INTO cache_profiles VALUES (?, ?)').run(id, name); }
const signal = () => new AbortController().signal;

test('membership plus allowlist isolates accounts; group-only people dedupe and Saved Messages is a shortcut', async () => {
  chat('group', ['me', 'known', 'group-only']); chat('ignored', ['me', 'known']);
  chat('foreign', ['other-account', 'stranger']); chat('deleted', ['me', 'deleted-only']);
  chat('saved', ['me'], false);
  person('known', 'Ada'); person('group-only', 'Grace'); person('stranger', 'Secret');
  await setChatListPreference('me', 'ignored', 'ignored', true);
  await setChatListPreference('me', 'deleted', 'deleted', true);
  const result = await loadSearchPeople(db, 'me', ['group', 'ignored', 'foreign', 'deleted', 'saved'], '', signal());
  expect(result.map((item) => item.userId).sort()).toEqual(['group-only', 'known', 'me']);
  expect(result.find((item) => item.userId === 'group-only')).toMatchObject({ kind: 'person', chatId: null });
  expect(result.find((item) => item.userId === 'me')).toMatchObject({ kind: 'saved', chatId: 'saved' });
  expect((await loadSearchPeople(db, 'other-account', ['group', 'foreign'], '', signal())).map((item) => item.userId)).toEqual(['stranger']);
});

test('blocked direct targets cannot reappear through a group; direct nickname and canonical name both match', async () => {
  chat('group', ['me', 'blocked', 'known']); chat('blocked-direct', ['me', 'blocked'], false);
  chat('direct', ['me', 'known'], false); person('known', 'Ada'); person('blocked', 'Blocked');
  await saveChatPreferences('me', 'blocked-direct', { ...DEFAULT_CHAT_PREFERENCES, blocked: true });
  await saveChatPreferences('me', 'direct', { ...DEFAULT_CHAT_PREFERENCES, nickname: 'Captain' });
  const result = await loadSearchPeople(db, 'me', ['group', 'direct'], '', signal());
  expect(result.map((item) => item.userId)).toEqual(['known']);
  for (const query of ['ada', 'captain']) expect(await loadSearchPeople(db, 'me', ['group', 'direct'], query, signal())).toEqual([
    expect.objectContaining({ userId: 'known', title: 'Captain', displayName: 'Ada', chatId: 'direct' }),
  ]);
  await setChatListPreference('me', 'direct', 'deleted', true);
  expect((await loadSearchPeople(db, 'me', ['group'], 'ada', signal()))[0].chatId).toBe('direct');
});

test('ranking is exact/prefix/substring, activity/name/id, independent of input order', () => {
  const input = [
    { id: 'substring', title: 'The Ada', sortMs: 999 }, { id: 'prefix', title: 'Adam', sortMs: 999 },
    { id: 'b', title: 'Ada', sortMs: 2 }, { id: 'a', title: 'ＡＤＡ', sortMs: 2 },
    { id: 'old', title: 'Ada', sortMs: 1 }, { id: 'none', title: 'Grace', sortMs: 9999 },
  ];
  expect(rankSearchNames(input, 'ada').map((item) => item.id)).toEqual(['a', 'b', 'old', 'prefix', 'substring']);
  expect(rankSearchNames([...input].reverse(), 'ada')).toEqual(rankSearchNames(input, 'ada'));
});

test('preflight read failure/cancellation/deadline never returns success or attempts a mutation', async () => {
  jest.spyOn(db, 'getAllAsync').mockRejectedValueOnce(new Error('cache failed'));
  await expect(loadSearchPeople(db, 'me', ['group'], '', signal())).rejects.toThrow('cache failed');
  const controller = new AbortController(); controller.abort();
  await expect(loadSearchPeople(db, 'me', [], '', controller.signal)).rejects.toMatchObject({ kind: 'cancelled' });
  await expect(loadSearchPeople(db, 'me', [], '', signal(), Date.now() - 1)).rejects.toMatchObject({ kind: 'timeout' });
});
