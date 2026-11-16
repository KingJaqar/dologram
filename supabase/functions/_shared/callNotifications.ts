import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0';
import { buildCallPushPayload, type CallNotification, type CallNotificationEvent, type CallPushToken } from '../send-call-notifications/payload.ts';

type AdminClient = SupabaseClient;

type OutboxRow = {
  notification_id: string;
  call_id: string;
  recipient_id: string;
  event_type: CallNotificationEvent;
  call_revision: number;
  expires_at: string;
  state: 'pending' | 'sending' | 'failed';
  attempts: number;
  next_attempt_at: string;
  lease_id: string | null;
};

type CallRow = {
  call_id: string;
  chat_id: string;
  caller_id: string;
  callee_id: string;
  media_type: 'voice' | 'video';
  status: 'ringing' | 'accepted' | 'in_progress' | 'declined' | 'cancelled' | 'missed' | 'ended' | 'failed';
  revision: number;
  ring_expires_at: string;
  ended_at: string | null;
};

type PushTicket = { status: 'ok' | 'error'; details?: { error?: string } };

const retryDelaysSeconds = [5, 30, 120, 300] as const;

function isCurrentlyMuted(mutedUntil: string | null | undefined, now: number): boolean {
  if (!mutedUntil) return false;
  const time = Date.parse(mutedUntil);
  return !Number.isFinite(time) || time > now;
}

function eventMatchesCall(event: CallNotificationEvent, status: CallRow['status']): boolean {
  if (event === 'invitation') return status === 'ringing';
  if (event === 'accepted') return status === 'accepted' || status === 'in_progress';
  return event === status;
}

function isRecipient(call: CallRow, recipientId: string): boolean {
  return call.caller_id === recipientId || call.callee_id === recipientId;
}

async function markOutbox(
  admin: AdminClient,
  row: OutboxRow,
  patch: Record<string, string | number | null>,
): Promise<void> {
  if (!row.lease_id) throw new Error('missing_notification_lease');
  const { error } = await admin.from('call_notification_outbox')
    .update(patch)
    .eq('notification_id', row.notification_id)
    .eq('state', 'sending')
    .eq('lease_id', row.lease_id);
  if (error) throw error;
}

async function skipOutbox(admin: AdminClient, row: OutboxRow, reason: string): Promise<void> {
  await markOutbox(admin, row, {
    state: reason === 'expired' ? 'expired' : 'skipped',
    last_error: reason,
    lease_id: null,
    lease_expires_at: null,
  });
}

async function retryOutbox(admin: AdminClient, row: OutboxRow, reason: string): Promise<void> {
  const delay = retryDelaysSeconds[Math.min(Math.max(row.attempts - 1, 0), retryDelaysSeconds.length - 1)];
  const terminal = row.attempts >= 5;
  await markOutbox(admin, row, {
    state: 'failed',
    next_attempt_at: terminal
      ? '9999-12-31T00:00:00.000Z'
      : new Date(Date.now() + delay * 1000).toISOString(),
    last_error: reason,
    lease_id: null,
    lease_expires_at: null,
  });
}

async function sendToExpo(
  admin: AdminClient,
  row: OutboxRow,
  tokens: CallPushToken[],
  notification: CallNotification,
): Promise<void> {
  const messages = tokens.map((token) => buildCallPushPayload(token, notification));
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(Deno.env.get('EXPO_ACCESS_TOKEN') ? { Authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` } : {}),
    },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify(messages),
  });
  if (!response.ok) throw new Error(`expo_http_${response.status}`);
  const result = await response.json() as { data?: PushTicket[] };
  if (!Array.isArray(result.data) || result.data.length !== tokens.length) throw new Error('expo_incomplete_receipts');

  let retryable = false;
  await Promise.all(result.data.map(async (ticket, index) => {
    if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      const token = tokens[index];
      const { error } = await admin.from('push_tokens').delete()
        .eq('token', token.token).eq('user_id', token.user_id).eq('last_seen_at', token.last_seen_at);
      if (error) throw error;
    } else if (ticket.status !== 'ok') {
      retryable = true;
    }
  }));
  if (retryable) throw new Error('expo_ticket_rejected');
  await markOutbox(admin, row, {
    state: 'sent',
    sent_at: new Date().toISOString(),
    last_error: null,
    lease_id: null,
    lease_expires_at: null,
  });
}

async function processRow(admin: AdminClient, row: OutboxRow): Promise<'sent' | 'skipped' | 'retryable'> {
  const now = Date.now();
  const leaseId = crypto.randomUUID();
  const { data: claimed, error: claimError } = await admin.from('call_notification_outbox')
    .update({
      state: 'sending',
      attempts: row.attempts + 1,
      lease_id: leaseId,
      lease_expires_at: new Date(now + 15_000).toISOString(),
      last_error: null,
    })
    .eq('notification_id', row.notification_id)
    .in('state', ['pending', 'failed'])
    .lte('next_attempt_at', new Date(now).toISOString())
    .select('notification_id')
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return 'skipped';
  const claimedRow: OutboxRow = {
    ...row,
    state: 'sending',
    attempts: row.attempts + 1,
    lease_id: leaseId,
  };

  try {
    const { data: call, error: callError } = await admin.from('calls')
      .select('call_id, chat_id, caller_id, callee_id, media_type, status, revision, ring_expires_at, ended_at')
      .eq('call_id', row.call_id).maybeSingle();
    if (callError) throw callError;
    if (!call) {
      await skipOutbox(admin, claimedRow, 'call_missing');
      return 'skipped';
    }
    const currentCall = call as CallRow;
    if (!isRecipient(currentCall, row.recipient_id) || !eventMatchesCall(row.event_type, currentCall.status)) {
      await skipOutbox(admin, claimedRow, 'stale_call_state');
      return 'skipped';
    }
    const expiry = Date.parse(row.expires_at);
    if (!Number.isFinite(expiry) || expiry <= now) {
      await skipOutbox(admin, claimedRow, 'expired');
      return 'skipped';
    }

    const { data: membership, error: membershipError } = await admin.from('chat_members')
      .select('muted_until').eq('chat_id', currentCall.chat_id).eq('user_id', row.recipient_id).maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership || isCurrentlyMuted(membership.muted_until, now)) {
      await skipOutbox(admin, claimedRow, 'recipient_muted_or_not_member');
      return 'skipped';
    }

    const { data: user, error: userError } = await admin.auth.admin.getUserById(row.recipient_id);
    if (userError?.status === 404) {
      await skipOutbox(admin, claimedRow, 'recipient_inactive');
      return 'skipped';
    }
    if (userError) throw userError;
    if (!user.user || user.user.app_metadata?.['must_change_password'] === true
        || (user.user.banned_until !== null && Date.parse(user.user.banned_until) > now)) {
      await skipOutbox(admin, claimedRow, 'recipient_inactive');
      return 'skipped';
    }

    const { data: tokenRows, error: tokenError } = await admin.from('push_tokens')
      .select('token, user_id, last_seen_at, platform, call_android_channel_id, call_notifications, sounds, badges, vibration')
      .eq('user_id', row.recipient_id).eq('call_notifications', true);
    if (tokenError) throw tokenError;
    const rawTokens = (tokenRows ?? []) as CallPushToken[];
    if (rawTokens.length === 0) {
      await skipOutbox(admin, claimedRow, 'no_call_enabled_devices');
      return 'skipped';
    }
    const { data: preferenceRows, error: preferenceError } = await admin.from('call_device_preferences')
      .select('push_token, enabled, sounds, blocked')
      .eq('chat_id', currentCall.chat_id)
      .in('push_token', rawTokens.map((token) => token.token));
    if (preferenceError) throw preferenceError;
    const devicePreferences = new Map((preferenceRows ?? []).map((preference) => [preference.push_token, preference]));
    const tokens = rawTokens.flatMap((token) => {
      const preference = devicePreferences.get(token.token);
      if (!preference?.enabled || (row.event_type === 'invitation' && preference.blocked)) return [];
      return [{ ...token, sounds: token.sounds && preference.sounds }];
    });
    if (tokens.length === 0) {
      await skipOutbox(admin, claimedRow, 'no_call_enabled_devices');
      return 'skipped';
    }

    await sendToExpo(admin, claimedRow, tokens, {
      call_id: currentCall.call_id,
      chat_id: currentCall.chat_id,
      media_type: currentCall.media_type,
      event_type: row.event_type,
      call_revision: String(currentCall.revision),
      expires_at: row.expires_at,
    });
    return 'sent';
  } catch (error) {
    await retryOutbox(admin, claimedRow, error instanceof Error ? error.message.slice(0, 64) : 'dispatch_failed');
    return 'retryable';
  }
}

export async function dispatchPendingCallNotifications(admin: AdminClient, callId?: string): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  retryable: number;
}> {
  const now = new Date().toISOString();
  const { error: reclaimError } = await admin.from('call_notification_outbox')
    .update({ state: 'failed', next_attempt_at: now, lease_id: null, lease_expires_at: null, last_error: 'lease_expired' })
    .eq('state', 'sending')
    .lt('lease_expires_at', now);
  if (reclaimError) throw reclaimError;
  const base = admin.from('call_notification_outbox')
    .select('notification_id, call_id, recipient_id, event_type, call_revision, expires_at, state, attempts, next_attempt_at, lease_id')
    .in('state', ['pending', 'failed'])
    .lte('next_attempt_at', now)
    .order('created_at', { ascending: true })
    .limit(50);
  const { data, error } = callId ? await base.eq('call_id', callId) : await base;
  if (error) throw error;
  const rows = (data ?? []) as OutboxRow[];
  let sent = 0;
  let skipped = 0;
  let retryable = 0;
  for (const row of rows) {
    const result = await processRow(admin, row);
    if (result === 'sent') sent++;
    else if (result === 'retryable') retryable++;
    else skipped++;
  }
  return { processed: rows.length, sent, skipped, retryable };
}
