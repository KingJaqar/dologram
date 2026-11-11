export type PushToken = {
  token: string;
  user_id: string;
  last_seen_at: string;
  platform: 'android' | 'ios';
  android_channel_id: string | null;
  message_previews: boolean;
  preview_text: boolean;
  sounds: boolean;
  badges: boolean;
};

type PushMessage = {
  message_id: string;
  chat_id: string;
  content: string;
  attachment_count: number;
};

function preview(content: string, attachmentCount: number): string {
  const characters = Array.from(content.replace(/\s+/gu, ' ').trim());
  if (characters.length === 0) return attachmentCount > 0 ? 'Attachment' : 'New message';
  if (characters.length <= 180) return characters.join('');
  return `${characters.slice(0, 179).join('')}…`;
}

export function buildPushPayload(
  token: PushToken,
  message: PushMessage,
  chatTitle: string | null,
  unreadCount: number,
) {
  // A missing title means this chat does not support plaintext push previews.
  const showPreview = token.message_previews && token.preview_text && chatTitle !== null;
  return {
    to: token.token,
    title: showPreview ? chatTitle : 'DoloGram',
    body: showPreview ? preview(message.content, message.attachment_count) : 'New message',
    data: { chat_id: message.chat_id },
    ttl: 3600,
    priority: 'high',
    collapseId: message.message_id,
    ...(token.platform === 'android'
      ? { channelId: token.android_channel_id ?? 'messages', tag: message.message_id }
      : { sound: token.sounds ? 'default' : null, badge: token.badges ? unreadCount : 0 }),
  };
}
