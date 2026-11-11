import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { buildPushPayload, type PushToken } from './payload.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const webhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET');
const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
});

type WebhookPayload = {
  type?: unknown;
  schema?: unknown;
  table?: unknown;
  record?: { message_id?: unknown };
};

type PushTicket = { status: 'ok' | 'error'; details?: { error?: string } };

function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
}

function isCurrentlyMuted(mutedUntil: string | null): boolean {
  if (!mutedUntil) return false;
  const time = Date.parse(mutedUntil);
  return Number.isNaN(time) || time > Date.now();
}

async function isActiveUser(userId: string): Promise<boolean> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error?.status === 404) return false;
  if (error) throw error;
  if (!data.user) return false;
  const mustChangePassword = data.user.app_metadata?.['must_change_password'] === true;
  const bannedUntil = data.user.banned_until ? Date.parse(data.user.banned_until) : NaN;
  return !mustChangePassword && !(Number.isFinite(bannedUntil) && bannedUntil > Date.now());
}

async function sendExpoPushMessages(
  deliveries: { token: PushToken; message: ReturnType<typeof buildPushPayload> }[],
) {
  let sent = 0;
  let failed = 0;
  for (let start = 0; start < deliveries.length; start += 100) {
    const batch = deliveries.slice(start, start + 100);
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(expoAccessToken ? { Authorization: `Bearer ${expoAccessToken}` } : {}),
      },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify(batch.map(({ message }) => message)),
    });
    if (!response.ok) throw new Error(`Expo Push API returned ${response.status}.`);
    const { data } = await response.json() as { data?: PushTicket[] };
    if (!Array.isArray(data) || data.length !== batch.length) throw new Error('Expo returned incomplete push tickets.');
    await Promise.all(batch.map(async ({ token }, index) => {
      const ticket = data[index];
      if (ticket.status === 'ok') {
        sent++;
      } else if (ticket.details?.error === 'DeviceNotRegistered') {
        const { error } = await admin.from('push_tokens').delete().eq('token', token.token)
          .eq('user_id', token.user_id).eq('last_seen_at', token.last_seen_at);
        if (error) console.error('Could not remove an expired push registration:', error.code);
      } else {
        failed++;
        console.error('Expo rejected a push ticket:', ticket.details?.error ?? 'unknown');
      }
    }));
  }
  return { sent, failed };
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 });
  if (!webhookSecret || request.headers.get('authorization') !== `Bearer ${webhookSecret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let payload: WebhookPayload | null;
  try {
    payload = await request.json() as WebhookPayload | null;
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (payload?.type !== 'INSERT' || payload.table !== 'messages' ||
      (payload.schema !== undefined && payload.schema !== 'public')) {
    return Response.json({ sent: 0, ignored: true });
  }
  const messageId = payload.record?.message_id;
  if (!isValidUuid(messageId)) return Response.json({ error: 'invalid_record' }, { status: 400 });

  try {
    const { data: message, error: messageError } = await admin.from('messages')
      .select('message_id, chat_id, sender_id, content, attachment_count, seq, created_at')
      .eq('message_id', messageId).is('deleted_at', null).maybeSingle();
    if (messageError) throw messageError;
    if (!message) return Response.json({ sent: 0 });

    const { data: members, error: membersError } = await admin.from('chat_members')
      .select('user_id, muted_until').eq('chat_id', message.chat_id).neq('user_id', message.sender_id)
      .lt('last_read_seq', message.seq).lte('joined_at', message.created_at);
    if (membersError) throw membersError;
    const eligibleIds = members.filter(({ muted_until }) => !isCurrentlyMuted(muted_until)).map(({ user_id }) => user_id);
    if (!eligibleIds.length) return Response.json({ sent: 0 });

    const { data: tokens, error: tokenError } = await admin.from('push_tokens')
      .select('token, user_id, last_seen_at, platform, android_channel_id, message_previews, preview_text, sounds, badges')
      .in('user_id', eligibleIds);
    if (tokenError) throw tokenError;
    const recipients = [...new Set(tokens.map(({ user_id }) => user_id))];
    const activeIds = new Set<string>();
    // Limit concurrent Auth requests to members with a registered device.
    for (let start = 0; start < recipients.length; start += 10) {
      await Promise.all(recipients.slice(start, start + 10).map(async (userId) => {
        if (await isActiveUser(userId)) activeIds.add(userId);
      }));
    }
    const devices = (tokens as PushToken[]).filter(({ user_id }) => activeIds.has(user_id));
    if (!devices.length) return Response.json({ sent: 0 });

    let title: string | null = null;
    if (devices.some(({ message_previews, preview_text }) => message_previews && preview_text)) {
      const { data: chat, error: chatError } = await admin.from('chats').select('type, title')
        .eq('chat_id', message.chat_id).maybeSingle();
      if (chatError) throw chatError;
      if (chat?.type === 'group') title = chat.title || 'DoloGram';
      if (chat?.type === 'direct') {
        const { data: sender, error: senderError } = await admin.from('profiles').select('display_name')
          .eq('user_id', message.sender_id).maybeSingle();
        if (senderError) throw senderError;
        title = sender?.display_name || 'DoloGram';
      }
    }

    const badgeUsers = [...new Set(devices.filter((device) => device.platform === 'ios' && device.badges)
      .map(({ user_id }) => user_id))];
    const unreadCounts = new Map<string, number>();
    if (badgeUsers.length) {
      const { data, error } = await admin.rpc('push_unread_counts', { recipient_ids: badgeUsers });
      if (error) throw error;
      for (const row of data as { user_id: string; unread_count: number }[]) {
        unreadCounts.set(row.user_id, row.unread_count);
      }
    }

    const result = await sendExpoPushMessages(devices.map((token) => ({
      token,
      message: buildPushPayload(token, message, title, unreadCounts.get(token.user_id) ?? 0),
    })));
    return Response.json(result);
  } catch (error) {
    console.error('Push webhook failed:', error instanceof Error ? error.message : 'database request failed');
    return Response.json({ error: 'delivery_failed' }, { status: 502 });
  }
});
