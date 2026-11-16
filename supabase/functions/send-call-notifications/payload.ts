export type CallPushToken = {
  token: string;
  user_id: string;
  last_seen_at: string;
  platform: 'android' | 'ios';
  call_android_channel_id: string | null;
  call_notifications: boolean;
  sounds: boolean;
  badges: boolean;
  vibration: boolean;
};

export type CallNotificationEvent =
  | 'invitation'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'missed'
  | 'ended'
  | 'failed';

export type CallNotification = {
  call_id: string;
  chat_id: string;
  media_type: 'voice' | 'video';
  event_type: CallNotificationEvent;
  call_revision: string;
  expires_at: string;
};

function ttlSeconds(expiresAt: string, now: number): number {
  const expiry = Date.parse(expiresAt);
  if (!Number.isFinite(expiry)) return 1;
  return Math.max(1, Math.min(3600, Math.ceil((expiry - now) / 1000)));
}

function bodyFor(event: CallNotificationEvent, mediaType: CallNotification['media_type']): string {
  if (event === 'invitation') return mediaType === 'video' ? 'Incoming video call' : 'Incoming voice call';
  if (event === 'accepted') return 'Call answered';
  if (event === 'declined') return 'Call declined';
  if (event === 'cancelled') return 'Call cancelled';
  if (event === 'missed') return 'Missed call';
  if (event === 'ended') return 'Call ended';
  return 'Call unavailable';
}

export function buildCallPushPayload(
  token: CallPushToken,
  notification: CallNotification,
  now = Date.now(),
) {
  const ttl = ttlSeconds(notification.expires_at, now);
  const expiration = Math.floor(Date.parse(notification.expires_at) / 1000);
  const base = {
    to: token.token,
    title: 'DoloGram',
    body: bodyFor(notification.event_type, notification.media_type),
    data: {
      notification_type: notification.event_type === 'invitation' ? 'call_invite' : 'call_ended',
      call_id: notification.call_id,
      chat_id: notification.chat_id,
      recipient_id: token.user_id,
      call_event: notification.event_type,
      call_revision: notification.call_revision,
      call_expires_at: notification.expires_at,
    },
    ttl,
    expiration,
    priority: 'high' as const,
    collapseId: `call-${notification.call_id}`,
  };
  return token.platform === 'android'
    ? {
      ...base,
      channelId: notification.event_type === 'invitation'
        ? token.call_android_channel_id ?? `calls-v1-1${Number(token.vibration)}`
        : `calls-v1-0${Number(token.vibration)}`,
      tag: `call-${notification.call_id}`,
    }
    : {
      ...base,
      sound: notification.event_type === 'invitation' && token.sounds ? 'default' : null,
    };
}
