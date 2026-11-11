/**
 * The single chat-list query (M2-08, F2, D-44, D-94, proposed D-159).
 *
 * D-44 requires the unread counts to come from one query. The cache holds every synced row
 * (6.4), so one statement returns every chat the caller is a member of with its own member row,
 * its newest message, that message's sender name and media type, the unread count, the other
 * members' highest read sequence and the other member of a direct chat. Archived chats are
 * returned too, so the same read feeds the Archive view and the archive count in the header.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  ChatListSourceRow,
  ChatMemberRow,
  ChatRow,
  MediaType,
  MessageRow,
} from '@dologram/shared';

const MEDIA_TYPES: readonly MediaType[] = ['photo', 'video', 'voice', 'file'];

type QueryRow = {
  chat_payload: string;
  member_payload: string;
  last_message_payload: string | null;
  last_sender_name: string | null;
  last_media_payload: string | null;
  unread_count: number;
  other_max_read_seq: number;
  other_member_id: string | null;
  other_member_name: string | null;
};

/**
 * Unread = messages from other senders with a seq above the caller's last_read_seq, excluding
 * deleted and expired messages (D-92); a deleted message keeps its seq and is filtered by
 * `deleted_at`, and V2 expiry clears the content and sets deleted_at as well (D-111).
 */
const CHAT_LIST_SQL = `
SELECT
  c.payload AS chat_payload,
  m.payload AS member_payload,
  lm.payload AS last_message_payload,
  COALESCE(
    (SELECT n.nickname FROM cache_chat_members n WHERE n.chat_id = c.chat_id AND n.user_id = lm.sender_id AND n.nickname IS NOT NULL),
    (SELECT p.display_name FROM cache_profiles p WHERE p.user_id = lm.sender_id)
  ) AS last_sender_name,
  (SELECT mm.payload FROM cache_message_media mm WHERE mm.message_id = lm.message_id LIMIT 1)
    AS last_media_payload,
  (SELECT COUNT(*) FROM cache_messages u
     WHERE u.chat_id = c.chat_id
       AND u.sender_id <> ?
       AND u.seq IS NOT NULL
       AND u.seq > m.last_read_seq
       AND u.deleted_at IS NULL) AS unread_count,
  (SELECT COALESCE(MAX(o.last_read_seq), 0) FROM cache_chat_members o
     WHERE o.chat_id = c.chat_id AND o.user_id <> ?) AS other_max_read_seq,
  (SELECT o.user_id FROM cache_chat_members o
     WHERE o.chat_id = c.chat_id AND o.user_id <> ? LIMIT 1) AS other_member_id,
  COALESCE(
    (SELECT n.nickname FROM cache_chat_members n WHERE n.chat_id = c.chat_id AND n.user_id =
      (SELECT o.user_id FROM cache_chat_members o WHERE o.chat_id = c.chat_id AND o.user_id <> ? LIMIT 1)
      AND n.nickname IS NOT NULL),
    (SELECT p.display_name FROM cache_profiles p WHERE p.user_id =
      (SELECT o.user_id FROM cache_chat_members o WHERE o.chat_id = c.chat_id AND o.user_id <> ? LIMIT 1))
  ) AS other_member_name
FROM cache_chats c
JOIN cache_chat_members m ON m.chat_id = c.chat_id AND m.user_id = ?
LEFT JOIN cache_messages lm ON lm.message_id = (
  SELECT y.message_id FROM cache_messages y
   WHERE y.chat_id = c.chat_id
   ORDER BY y.created_at DESC, y.seq DESC
   LIMIT 1
)
`;

function parseJson(payload: string | null): unknown {
  if (payload === null) return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function parseMediaType(payload: string | null): MediaType | null {
  const media = parseJson(payload);
  if (typeof media !== 'object' || media === null) return null;
  const value = (media as { media_type?: unknown }).media_type;
  return MEDIA_TYPES.find((type) => type === value) ?? null;
}

/** Reads every cached chat as one chat-list row; malformed payloads are skipped, never thrown. */
export async function loadChatListRows(
  db: SQLiteDatabase,
  userId: string,
): Promise<ChatListSourceRow[]> {
  const rows = await db.getAllAsync<QueryRow>(CHAT_LIST_SQL, [userId, userId, userId, userId, userId, userId, userId]);

  const result: ChatListSourceRow[] = [];
  for (const row of rows) {
    const chat = parseJson(row.chat_payload) as ChatRow | null;
    const myMember = parseJson(row.member_payload) as ChatMemberRow | null;
    if (!chat || !myMember) continue;

    result.push({
      chat,
      myMember,
      lastMessage: parseJson(row.last_message_payload) as MessageRow | null,
      lastMediaType: parseMediaType(row.last_media_payload),
      lastSenderName: row.last_sender_name,
      unreadCount: row.unread_count,
      otherMaxReadSeq: row.other_max_read_seq,
      otherMemberId: row.other_member_id,
      otherMemberName: row.other_member_name,
    });
  }
  return result;
}
