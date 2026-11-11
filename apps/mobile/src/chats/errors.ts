/**
 * Wording for the failures the new chat, new group and chat info flows can reach (D-35, D-46, D-77).
 *
 * A network failure reads as "No connection", a DG429 bucket reads as its own limit text (the chat
 * creation limit of D-46 is shared by direct chats and groups) and anything else falls back to the
 * action's own message. Nothing is swallowed: every caller shows the result.
 */
import { strings, type ClassifiedError } from '@dologram/shared';

export function searchErrorMessage(error: ClassifiedError): string {
  switch (error.kind) {
    case 'network':
      return strings.common.noConnection;
    case 'rateLimited':
      return strings.newChat.tooManySearches;
    default:
      return strings.newChat.searchFailed;
  }
}

/** A mutation failure; `fallback` names the action that failed. */
export function mutationErrorMessage(error: ClassifiedError, fallback: string): string {
  switch (error.kind) {
    case 'network':
      return strings.common.noConnection;
    case 'rateLimited':
      return strings.common.chatLimit;
    default:
      return fallback;
  }
}
