import type { ChatPreferences } from '../chats/preferences';
import type { NotificationPreferences } from '../notifications/preferences';

export function isChatMutedUntil(mutedUntil: string | null | undefined, now = Date.now()): boolean {
  if (!mutedUntil) return false;
  if (mutedUntil === 'infinity') return true;
  const timestamp = Date.parse(mutedUntil);
  return Number.isFinite(timestamp) && timestamp > now;
}

export function shouldPresentIncomingCall(input: {
  chatPreferences: Pick<ChatPreferences, 'blocked' | 'notifications'> | null;
  notificationPreferences: Pick<NotificationPreferences, 'enabled'> | null;
  serverMuted: boolean;
}): boolean {
  return input.chatPreferences?.blocked !== true
    && input.chatPreferences?.notifications !== false
    && input.notificationPreferences?.enabled !== false
    && !input.serverMuted;
}
