import { deepStrictEqual, equal, ok } from 'node:assert/strict';
import { buildPushPayload, type PushToken } from './payload.ts';

const token: PushToken = {
  token: 'ExponentPushToken[test]',
  user_id: 'recipient',
  last_seen_at: '2026-11-11T00:00:00Z',
  platform: 'android',
  android_channel_id: 'messages-v2-010',
  message_previews: true,
  preview_text: true,
  sounds: false,
  badges: false,
};
const message = { message_id: 'message', chat_id: 'chat', content: 'Hello there', attachment_count: 0 };

Deno.test('Android uses the registered channel, including silent vibration and badge choices', () => {
  const payload = buildPushPayload(token, message, 'Sender', 4);
  equal(payload.title, 'Sender');
  equal(payload.body, 'Hello there');
  deepStrictEqual(payload.data, { chat_id: 'chat' });
  ok('channelId' in payload);
  equal(payload.channelId, 'messages-v2-010');
  equal(payload.tag, message.message_id);
  equal('badge' in payload, false);
  equal('sound' in payload, false);
});

Deno.test('private, legacy and unsupported chat previews contain no sender or message text', () => {
  const payloads = [
    buildPushPayload({ ...token, message_previews: false }, message, 'Sender', 0),
    buildPushPayload({ ...token, preview_text: false, android_channel_id: null }, message, 'Sender', 0),
    buildPushPayload(token, message, null, 0),
  ];
  for (const payload of payloads) {
    equal(payload.title, 'DoloGram');
    equal(payload.body, 'New message');
    deepStrictEqual(payload.data, { chat_id: 'chat' });
  }
  ok('channelId' in payloads[1]);
  equal(payloads[1].channelId, 'messages');
});

Deno.test('iOS sets the real unread badge count and respects sound and badge opt-outs', () => {
  const ios = { ...token, platform: 'ios' as const, android_channel_id: null };
  const on = buildPushPayload({ ...ios, sounds: true, badges: true }, message, 'Sender', 12);
  const off = buildPushPayload(ios, message, 'Sender', 12);
  ok('sound' in on && 'sound' in off);
  equal(on.sound, 'default');
  equal(on.badge, 12);
  equal(off.sound, null);
  equal(off.badge, 0);
});

Deno.test('previews truncate Unicode safely and give attachment-only messages a label', () => {
  const long = buildPushPayload(token, { ...message, content: '😀'.repeat(181) }, 'Sender', 0);
  const attachment = buildPushPayload(token, { ...message, content: '', attachment_count: 1 }, 'Sender', 0);
  equal(long.body, `${'😀'.repeat(179)}…`);
  equal(attachment.body, 'Attachment');
});
