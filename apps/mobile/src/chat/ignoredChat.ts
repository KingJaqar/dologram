/**
 * Ignore state is loaded asynchronously. Treat an unknown state as ignored so
 * opening a chat can never publish a read receipt before its preference loads.
 */
export function canPublishIgnoredChatReadReceipt(ignored: boolean | null): boolean {
  return ignored === false;
}
