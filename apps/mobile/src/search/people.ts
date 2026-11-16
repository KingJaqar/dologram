import type { SQLiteDatabase } from 'expo-sqlite';
import { findDirectChatId, strings, type ContactCandidate, type Database } from '@dologram/shared';
import { loadChatListRows } from '../chatList/query';
import { loadChatListPreferences } from '../chatList/preferences';
import { loadChatPreferences } from '../chats/preferences';
import { normalizeSearch } from './matching';
import { readSearch, SEARCH_DEADLINE_MS } from './request';
import { supabase } from '../lib/supabase';

type DirectoryPerson = Database['public']['Functions']['search_people']['Returns'][number];

export type SearchPerson = ContactCandidate & {
  kind: 'person' | 'saved' | 'directory'; chatId: string | null; title: string; sortMs: number;
  aliases: readonly string[];
  username?: string;
};
type NamedResult = { id: string; title: string; sortMs: number; aliases?: readonly string[] };

/** Returns group ids whose cached members match the query by display name or username. */
export async function loadSearchGroups(
  db: SQLiteDatabase, userId: string, allowedChatIds: readonly string[], query: string,
  signal: AbortSignal, deadline = Date.now() + SEARCH_DEADLINE_MS,
): Promise<string[]> {
  const normalized = normalizeSearch(query);
  if (!userId || !normalized || allowedChatIds.length === 0) return [];

  const rows = await readSearch(() => db.getAllAsync<{
    chat_id: string;
    display_name: string | null;
    payload: string | null;
  }>(
    `SELECT member.chat_id, profile.display_name, profile.payload
       FROM cache_chat_members member
       JOIN cache_chat_members own ON own.chat_id = member.chat_id AND own.user_id = ?
       JOIN cache_chats chat ON chat.chat_id = member.chat_id
       LEFT JOIN cache_profiles profile ON profile.user_id = member.user_id
       WHERE chat.chat_id IN (SELECT value FROM json_each(?))
         AND json_extract(chat.payload, '$.type') = 'group'`,
    [userId, JSON.stringify(allowedChatIds)],
  ), signal, deadline);

  const matched = new Set<string>();
  for (const row of rows) {
    let username = '';
    if (row.payload) {
      try {
        const profile = JSON.parse(row.payload) as { username?: unknown };
        username = typeof profile.username === 'string' ? profile.username : '';
      } catch {
        // A malformed profile payload should not make group search fail.
      }
    }
    if ([row.display_name ?? '', username].some((value) => normalizeSearch(value).includes(normalized))) {
      matched.add(row.chat_id);
    }
  }
  return [...matched];
}

function rank(title: string, query: string): number {
  const name = normalizeSearch(title);
  return name === query ? 0 : name.startsWith(query) ? 1 : name.includes(query) ? 2 : 3;
}

/** Exact, prefix, substring; ties use activity, normalized title, then stable entity ID. */
export function rankSearchNames<T extends NamedResult>(items: readonly T[], query: string): T[] {
  const normalized = normalizeSearch(query);
  const score = (item: T) => Math.min(...[item.title, ...(item.aliases ?? [])].map((name) => rank(name, normalized)));
  const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
  return items.filter((item) => !normalized || score(item) < 3).sort((a, b) =>
    score(a) - score(b) || b.sortMs - a.sortMs || compare(normalizeSearch(a.title), normalizeSearch(b.title)) || compare(a.id, b.id));
}

/** Search-only adapter. Group-picker contact reads retain their existing contract. */
export async function loadSearchPeople(
  db: SQLiteDatabase, userId: string, allowedChatIds: readonly string[], query: string,
  signal: AbortSignal, deadline = Date.now() + SEARCH_DEADLINE_MS,
  directory: readonly DirectoryPerson[] = [],
): Promise<SearchPerson[]> {
  if (!userId) return [];
  const rows = await readSearch(() => loadChatListRows(db, userId), signal, deadline);
  const organization = await readSearch(() => loadChatListPreferences(userId), signal, deadline);
  const preferences = await readSearch(() => Promise.all(rows.map((row) => loadChatPreferences(userId, row.chat.chat_id))), signal, deadline);
  const blockedPeople = new Set(rows.filter((row, index) => row.chat.type === 'direct' && preferences[index].blocked)
    .map((row) => row.otherMemberId).filter((id): id is string => id !== null));
  const unblocked = rows.filter((row, index) => row.myMember.user_id === userId && !preferences[index].blocked);
  const allowed = new Set(allowedChatIds);
  const eligible = unblocked.filter((row) => allowed.has(row.chat.chat_id) && !organization.deleted.includes(row.chat.chat_id));
  const contacts = await readSearch(() => db.getAllAsync<{ user_id: string; display_name: string | null; payload?: string | null }>(
    `SELECT DISTINCT member.user_id, profile.display_name, profile.payload
       FROM cache_chat_members member
       JOIN cache_chat_members own ON own.chat_id = member.chat_id AND own.user_id = ?
       LEFT JOIN cache_profiles profile ON profile.user_id = member.user_id
       WHERE member.chat_id IN (SELECT value FROM json_each(?)) AND member.user_id <> ?`,
    [userId, JSON.stringify(eligible.map((row) => row.chat.chat_id)), userId],
  ), signal, deadline);
  const candidates = new Map<string, SearchPerson>();
  for (const contact of contacts) {
    if (blockedPeople.has(contact.user_id) || candidates.has(contact.user_id)) continue;
    // Deleted direct chats can be explicitly reopened, but cannot supply searchable content.
    const chatId = findDirectChatId(unblocked, { userId, otherUserId: contact.user_id });
    const direct = unblocked.find((row) => row.chat.chat_id === chatId);
    const pref = rows.findIndex((row) => row.chat.chat_id === chatId);
    const displayName = contact.display_name || strings.chatList.unknownMember;
    let username: string | undefined;
    let avatarUrl: string | null = null;
    if (contact.payload) {
      try {
        const parsed = JSON.parse(contact.payload) as { username?: unknown; avatar_url?: unknown };
        avatarUrl = typeof parsed.avatar_url === 'string' ? parsed.avatar_url : null;
        username = typeof parsed.username === 'string' && parsed.username.length > 0 ? parsed.username : undefined;
      } catch {
        // A malformed profile payload should not make the whole people search fail.
      }
    }
    const title = (pref >= 0 ? preferences[pref].nickname : '') || direct?.otherMemberName || displayName;
    const activity = direct?.lastMessage?.created_at ?? direct?.chat.created_at;
    const parsedTime = activity ? Date.parse(activity) : 0;
    candidates.set(contact.user_id, { kind: 'person', userId: contact.user_id, displayName, avatarUrl, chatId,
      title, aliases: [displayName, username ?? '', direct?.otherMemberName ?? ''], username,
      sortMs: Number.isFinite(parsedTime) ? parsedTime : 0 });
  }
  const savedId = findDirectChatId(eligible, { userId, otherUserId: userId });
  if (savedId) {
    const saved = eligible.find((row) => row.chat.chat_id === savedId);
    const time = Date.parse(saved?.lastMessage?.created_at ?? saved?.chat.created_at ?? '');
    candidates.set(userId, { kind: 'saved', userId, displayName: strings.chatList.savedMessages,
      title: strings.chatList.savedMessages, aliases: [], chatId: savedId, sortMs: Number.isFinite(time) ? time : 0 });
  }
  for (const person of directory) {
    if (person.user_id === userId || blockedPeople.has(person.user_id) || candidates.has(person.user_id)) continue;
    candidates.set(person.user_id, {
      kind: 'directory', userId: person.user_id, displayName: person.display_name,
      username: person.username ?? undefined, title: person.display_name, aliases: [person.username ?? '', person.display_name],
      chatId: findDirectChatId(unblocked, { userId, otherUserId: person.user_id }), sortMs: 0,
    });
  }
  return rankSearchNames([...candidates.values()].map((item) => ({ ...item, id: item.userId })), query);
}

/** Global discovery exposes only public names; full profiles and avatars retain their RLS. */
export async function loadDirectoryPeople(
  db: SQLiteDatabase, userId: string, allowedChatIds: readonly string[], query: string, signal: AbortSignal,
): Promise<SearchPerson[]> {
  const normalized = normalizeSearch(query).replace(/^@/, '').trim();
  if (!userId || !normalized) return [];
  const deadline = Date.now() + SEARCH_DEADLINE_MS;
  const { data, error } = await readSearch(
    async () => supabase.rpc('search_people', { p_query: normalized }).abortSignal(signal), signal, deadline,
  );
  if (error) throw error;
  return loadSearchPeople(db, userId, allowedChatIds, normalized, signal, deadline, data ?? []);
}
