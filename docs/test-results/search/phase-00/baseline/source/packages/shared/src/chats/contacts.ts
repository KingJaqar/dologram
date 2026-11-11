/**
 * People the caller may put into a group (M2-07, AND-11, D-58, D-70).
 *
 * D-70 only allows adding a member who already shares a chat with the member adding them, so the
 * eligible set is exactly the other members of the chats the caller already belongs to. The rows
 * come from the local cache, which holds every synced `chat_members` row, so the list works with
 * the same data the chat list already uses.
 */
import { strings } from '../strings';

export type ContactCandidate = {
  userId: string;
  displayName: string;
};

/** One `chat_members` row joined with the cached profile name, as the SQL adapter returns it. */
export type CachedContactRow = {
  user_id: string;
  display_name: string | null;
};

/** Group members besides the creator (D-58: at most 100 members, so at most 99 added). */
export const maxSelectableMembers = 99;

function compareContacts(a: ContactCandidate, b: ContactCandidate): number {
  const left = a.displayName.toLowerCase();
  const right = b.displayName.toLowerCase();
  if (left < right) return -1;
  if (left > right) return 1;
  return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
}

/**
 * Distinct people who share a chat with the caller, without the caller and without `exclude`
 * (the members a chat already has). Sorted by display name, then user id.
 */
export function buildContactList(
  rows: readonly CachedContactRow[],
  userId: string,
  exclude: readonly string[] = [],
): ContactCandidate[] {
  const seen = new Set<string>(exclude);
  const contacts: ContactCandidate[] = [];

  for (const row of rows) {
    if (row.user_id === userId || seen.has(row.user_id)) continue;
    seen.add(row.user_id);
    contacts.push({
      userId: row.user_id,
      displayName: row.display_name ?? strings.chatList.unknownMember,
    });
  }

  return contacts.sort(compareContacts);
}

/**
 * Adds or removes one selected member, never exceeding `max` (D-58). A selection at the limit is
 * returned unchanged, so the screen can disable the further checkboxes.
 */
export function toggleContactSelection(
  selected: readonly string[],
  userId: string,
  max: number,
): readonly string[] {
  if (selected.includes(userId)) {
    return selected.filter((id) => id !== userId);
  }
  if (selected.length >= max) {
    return selected;
  }
  return [...selected, userId];
}
