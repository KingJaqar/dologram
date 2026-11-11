/**
 * Cache reads for AND-12 (M2-07, D-44, D-91).
 *
 * Chat info renders from the synced local cache, so opening it does not depend on the network. The
 * rows are stored as the server JSON (6.4); a malformed payload is skipped rather than thrown.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import type { ChatMemberRow, ChatRow, ProfileRow } from '@dologram/shared';

export type ChatInfoSource = {
  chat: ChatRow | null;
  members: ChatMemberRow[];
  profiles: ProfileRow[];
};

function parsePayload<T>(payload: string | null): T | null {
  if (payload === null) return null;
  try {
    const parsed: unknown = JSON.parse(payload);
    return typeof parsed === 'object' && parsed !== null ? (parsed as T) : null;
  } catch {
    return null;
  }
}

export async function loadChatInfoSource(
  db: SQLiteDatabase,
  chatId: string,
): Promise<ChatInfoSource> {
  const chatRow = await db.getFirstAsync<{ payload: string }>(
    'SELECT payload FROM cache_chats WHERE chat_id = ?',
    [chatId],
  );
  const chat = parsePayload<ChatRow>(chatRow?.payload ?? null);

  const memberRows = await db.getAllAsync<{ payload: string }>(
    'SELECT payload FROM cache_chat_members WHERE chat_id = ?',
    [chatId],
  );
  const members: ChatMemberRow[] = [];
  for (const row of memberRows) {
    const member = parsePayload<ChatMemberRow>(row.payload);
    if (member) members.push(member);
  }

  const profiles: ProfileRow[] = [];
  if (members.length > 0) {
    const placeholders = members.map(() => '?').join(', ');
    const profileRows = await db.getAllAsync<{ payload: string }>(
      `SELECT payload FROM cache_profiles WHERE user_id IN (${placeholders})`,
      members.map((member) => member.user_id),
    );
    for (const row of profileRows) {
      const profile = parsePayload<ProfileRow>(row.payload);
      if (profile) profiles.push(profile);
    }
  }

  return { chat, members, profiles };
}

export type CachedContactRow = { user_id: string; display_name: string | null };

/**
 * Every other member of every cached chat: the people the caller already shares a chat with, which
 * is exactly who D-70 lets the caller put into a group.
 */
export async function loadCachedContacts(db: SQLiteDatabase, userId: string): Promise<CachedContactRow[]> {
  return db.getAllAsync<CachedContactRow>(
    `SELECT DISTINCT m.user_id AS user_id, p.display_name AS display_name
       FROM cache_chat_members m
       LEFT JOIN cache_profiles p ON p.user_id = m.user_id
      WHERE m.user_id <> ?`,
    [userId],
  );
}
