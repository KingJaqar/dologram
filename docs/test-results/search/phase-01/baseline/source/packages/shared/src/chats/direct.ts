/**
 * Direct-chat lookup (M2-07, D-70, C-8).
 *
 * chats.direct_key is unique on the server, so a second direct chat for the same pair is rejected.
 * Before inserting the three rows of a direct chat the client checks the synced local cache for an
 * existing chat with that member and opens it instead. Archived direct chats still count: D-70 says
 * a user hides an unwanted direct chat by archiving it, so archiving must not create a second one.
 * Saved Messages is a direct chat with only the caller as a member. A self-chat lookup therefore
 * resolves to that one-member chat instead of trying to create a two-member direct chat.
 */
import type { ChatListSourceRow } from '../chatList/types';

export type DirectChatLookup = {
  /** The signed-in user. */
  userId: string;
  /** The user the caller wants to message. */
  otherUserId: string;
};

/** The cached direct chat with `otherUserId`, or null when there is none. */
export function findDirectChatId(
  rows: readonly ChatListSourceRow[],
  lookup: DirectChatLookup,
): string | null {
  for (const row of rows) {
    if (row.chat.type !== 'direct') continue;
    if (lookup.otherUserId === lookup.userId) {
      if (row.chat.direct_key === lookup.userId) {
        return row.chat.chat_id;
      }
      continue;
    }
    if (row.otherMemberId === lookup.otherUserId) {
      return row.chat.chat_id;
    }
  }
  return null;
}
