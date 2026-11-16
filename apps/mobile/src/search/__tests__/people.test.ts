import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadDirectoryPeople, loadSearchGroups, loadSearchPeople, rankSearchNames } from '../people';
import { loadChatListRows } from '../../chatList/query';
import { DEFAULT_CHAT_PREFERENCES, saveChatPreferences } from '../../chats/preferences';
import { setChatListPreference } from '../../chatList/preferences';

const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => ({
  abortSignal: () => mockRpc(...args),
}) } }));

let sqlite: DatabaseSync;
let db: SQLiteDatabase;
beforeEach(async () => {
  await AsyncStorage.clear();
  mockRpc.mockReset();
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE cache_chats (chat_id TEXT PRIMARY KEY, payload TEXT);
    CREATE TABLE cache_chat_members (chat_id TEXT, user_id TEXT, payload TEXT, nickname TEXT, last_read_seq INTEGER);
    CREATE TABLE cache_profiles (user_id TEXT, display_name TEXT, payload TEXT);
    CREATE TABLE cache_messages (message_id TEXT, chat_id TEXT, sender_id TEXT, seq INTEGER, deleted_at TEXT, created_at TEXT, payload TEXT);
    CREATE TABLE cache_message_media (message_id TEXT, payload TEXT);
    CREATE TABLE pending_read_states (user_id TEXT, chat_id TEXT, last_read_seq INTEGER, membership_joined_at TEXT);`);
  sqlite.exec('ALTER TABLE cache_chat_members ADD COLUMN confirmed_last_read_seq INTEGER DEFAULT 0');
  db = { getAllAsync: async (sql: string, params: (string | number)[]) => sqlite.prepare(sql).all(...params) } as unknown as SQLiteDatabase;
});
afterEach(() => sqlite.close());

function chat(id: string, members: string[], group = true) {
  sqlite.prepare('INSERT INTO cache_chats VALUES (?, ?)').run(id, JSON.stringify({ chat_id: id,
    created_at: '2026-11-01T00:00:00Z', created_by: members[0], direct_key: members.length === 1 ? members[0] : id,
    next_seq: 0, title: group ? id : null, type: group ? 'group' : 'direct' }));
  for (const userId of members) sqlite.prepare('INSERT INTO cache_chat_members (chat_id, user_id, payload, nickname, last_read_seq) VALUES (?, ?, ?, NULL, 0)').run(id, userId,
    JSON.stringify({ chat_id: id, user_id: userId, archived: false, joined_at: '2026-11-01', last_read_seq: 0, muted_until: null, role: 'member' }));
}
function person(id: string, name: string, username = `${id}_user`) {
  sqlite.prepare('INSERT INTO cache_profiles VALUES (?, ?, ?)').run(id, name, JSON.stringify({ user_id: id, display_name: name, username }));
}
const signal = () => new AbortController().signal;

test.each(['JAMES123', 'jAm', 'James Stranger', 'sTrAnGeR', '@james123'])(
  'directory matches unrelated profiles by username and display name: %s', async (query) => {
    mockRpc.mockResolvedValue({ data: [{ user_id: 'stranger', username: 'james123', display_name: 'James Stranger' }], error: null });
    const result = await loadDirectoryPeople(db, 'me', [], query, signal());
    expect(result).toEqual([expect.objectContaining({ kind: 'directory', userId: 'stranger', chatId: null })]);
    expect(mockRpc).toHaveBeenCalledWith('search_people', { p_query: query.toLowerCase().replace(/^@/, '') });
  },
);

test('directory deduplicates contacts, retains nicknames, and excludes blocked people', async () => {
  chat('known-chat', ['me', 'known'], false);
  chat('blocked-chat', ['me', 'blocked'], false);
  person('known', 'James Known', 'james123');
  await saveChatPreferences('me', 'known-chat', { ...DEFAULT_CHAT_PREFERENCES, nickname: 'Captain' });
  await saveChatPreferences('me', 'blocked-chat', { ...DEFAULT_CHAT_PREFERENCES, blocked: true });
  mockRpc.mockResolvedValue({ data: [
    { user_id: 'known', username: 'james123', display_name: 'James Known' },
    { user_id: 'blocked', username: 'james456', display_name: 'James Blocked' },
    { user_id: 'me', username: 'james789', display_name: 'James Me' },
  ], error: null });
  expect(await loadDirectoryPeople(db, 'me', ['known-chat'], 'james', signal())).toEqual([
    expect.objectContaining({ userId: 'known', title: 'Captain', chatId: 'known-chat' }),
  ]);
});

test('directory surfaces RPC errors and cancellation instead of reporting no matches', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
  await expect(loadDirectoryPeople(db, 'me', [], 'james', signal())).rejects.toMatchObject({ message: 'permission denied' });
  const controller = new AbortController(); controller.abort();
  mockRpc.mockClear();
  await expect(loadDirectoryPeople(db, 'me', [], 'james', controller.signal)).rejects.toMatchObject({ kind: 'cancelled' });
  expect(mockRpc).not.toHaveBeenCalled();
});

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

test('matches a cached username as well as the display name', async () => {
  chat('direct', ['me', 'known'], false);
  person('known', 'Ada', 'ada_123');
  const result = await loadSearchPeople(db, 'me', ['direct'], 'ada_123', signal());
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ userId: 'known', username: 'ada_123', displayName: 'Ada' });
});

test('returns only groups shared with the caller when a member name or username matches', async () => {
  chat('group', ['me', 'member']);
  chat('foreign', ['other', 'member']);
  person('member', 'Ada', 'ada_123');

  expect(await loadSearchGroups(db, 'me', ['group', 'foreign'], 'ada_123', signal())).toEqual(['group']);
});

test('preflight read failure/cancellation/deadline never returns success or attempts a mutation', async () => {
  jest.spyOn(db, 'getAllAsync').mockRejectedValueOnce(new Error('cache failed'));
  await expect(loadSearchPeople(db, 'me', ['group'], '', signal())).rejects.toThrow('cache failed');
  const controller = new AbortController(); controller.abort();
  await expect(loadSearchPeople(db, 'me', [], '', controller.signal)).rejects.toMatchObject({ kind: 'cancelled' });
  await expect(loadSearchPeople(db, 'me', [], '', signal(), Date.now() - 1)).rejects.toMatchObject({ kind: 'timeout' });
});

test('cached profile photos reach direct lists and people search, including updates and removal', async () => {
  chat('direct', ['me', 'known'], false);
  person('known', 'Ada');
  for (const avatarUrl of ['known/first.jpg', 'known/second.jpg', null]) {
    sqlite.prepare('UPDATE cache_profiles SET payload = ? WHERE user_id = ?')
      .run(JSON.stringify({ user_id: 'known', display_name: 'Ada', avatar_url: avatarUrl }), 'known');
    expect((await loadChatListRows(db, 'me'))[0].otherMemberAvatarUrl).toBe(avatarUrl);
    expect((await loadSearchPeople(db, 'me', ['direct'], 'Ada', signal()))[0].avatarUrl).toBe(avatarUrl);
  }
});
