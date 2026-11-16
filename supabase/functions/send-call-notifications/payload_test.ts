import { deepStrictEqual, equal, ok } from 'node:assert/strict';
import { buildCallPushPayload, type CallNotification, type CallPushToken } from './payload.ts';

const token: CallPushToken = {
  token: 'ExponentPushToken[call-test]',
  user_id: 'recipient',
  last_seen_at: '2026-11-12T00:00:00Z',
  platform: 'android',
  call_android_channel_id: 'calls-v1-01',
  call_notifications: true,
  sounds: false,
  badges: false,
  vibration: true,
};

const notification: CallNotification = {
  call_id: 'call-id',
  chat_id: 'chat-id',
  media_type: 'video',
  event_type: 'invitation',
  call_revision: '1',
  expires_at: '2026-11-12T00:00:30.000Z',
};

Deno.test('call invitations use generic privacy-safe copy and the registered channel', () => {
  const payload = buildCallPushPayload(token, notification, Date.parse('2026-11-12T00:00:00.000Z'));
  equal(payload.title, 'DoloGram');
  equal(payload.body, 'Incoming video call');
  deepStrictEqual(payload.data, {
    notification_type: 'call_invite',
    call_id: 'call-id',
    chat_id: 'chat-id',
    recipient_id: 'recipient',
    call_event: 'invitation',
    call_revision: '1',
    call_expires_at: '2026-11-12T00:00:30.000Z',
  });
  equal(payload.channelId, 'calls-v1-01');
  equal(payload.ttl, 30);
  ok(payload.expiration > 0);
});

Deno.test('iOS call payload respects sound and badge preferences', () => {
  const payload = buildCallPushPayload({ ...token, platform: 'ios', call_android_channel_id: null, sounds: true, badges: true }, notification);
  equal(payload.sound, 'default');
  ok(!('badge' in payload));
});
