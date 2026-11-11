/**
 * Shared private Realtime topics and event names (D-57, D-92, D-118, proposed D-152).
 *
 * Keeping these values in the shared package prevents the Android and web clients from joining
 * different channels or silently drifting on the Broadcast payload names.
 */
export const realtimeEvents = {
  typing: 'typing',
  read: 'read',
} as const;

export type TypingBroadcast = {
  user_id: string;
  active: boolean;
};

export type ReadBroadcast = {
  user_id: string;
  last_read_seq: number;
};

export function chatTopic(chatId: string): string {
  return `chat:${chatId}`;
}
