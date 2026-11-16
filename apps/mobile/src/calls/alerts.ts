import { loadChatPreferences } from '../chats/preferences';
import { loadNotificationPreferences } from '../notifications/preferences';
import { supabase } from '../lib/supabase';
import { isChatMutedUntil, shouldPresentIncomingCall } from './alertsPolicy';
export { isChatMutedUntil, shouldPresentIncomingCall } from './alertsPolicy';

export type IncomingCallAlertState = {
  blocked: boolean;
  shouldPresent: boolean;
};

export async function loadIncomingCallAlertState(userId: string, chatId: string): Promise<IncomingCallAlertState> {
  const [chatPreferences, notificationPreferences, memberResult] = await Promise.all([
    loadChatPreferences(userId, chatId).catch(() => null),
    loadNotificationPreferences(userId).catch(() => null),
    supabase.from('chat_members').select('muted_until').eq('chat_id', chatId).eq('user_id', userId).maybeSingle(),
  ]);
  const serverMuted = !memberResult.error && isChatMutedUntil(memberResult.data?.muted_until);
  return {
    blocked: chatPreferences?.blocked === true,
    shouldPresent: shouldPresentIncomingCall({
      chatPreferences,
      notificationPreferences,
      serverMuted,
    }),
  };
}
