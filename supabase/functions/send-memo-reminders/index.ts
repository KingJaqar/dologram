import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { nextMemoReminderOccurrence, type MemoReminderSchedule } from '../../../packages/shared/src/memos/types.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false } });
const webhookSecret = Deno.env.get('MEMO_REMINDER_WEBHOOK_SECRET');
const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
type Occurrence = { occurrence_id: string; memo_id: string; generation: string; reminder_id: string; claimed_by: string };
type Recipient = { token: string; user_id: string; device_id: string; sounds: boolean; vibration: boolean };
function recipients(value: unknown): Recipient[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('Invalid reminder recipient batch.');
  return value.map((row: unknown) => {
    if (!row || typeof row !== 'object' || !('token' in row) || typeof row.token !== 'string' || !('user_id' in row) || typeof row.user_id !== 'string' || !('device_id' in row) || typeof row.device_id !== 'string' || !('sounds' in row) || typeof row.sounds !== 'boolean' || !('vibration' in row) || typeof row.vibration !== 'boolean') throw new Error('Invalid reminder recipient.');
    return { token: row.token, user_id: row.user_id, device_id: row.device_id, sounds: row.sounds, vibration: row.vibration };
  });
}
Deno.serve(async (request) => {
  if (request.method !== 'POST' || !webhookSecret || request.headers.get('authorization') !== `Bearer ${webhookSecret}`) return Response.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const maintenance = await admin.rpc('memo_run_maintenance', { p_limit: 100 });
    if (maintenance.error) throw maintenance.error;
    const claimed = await admin.rpc('memo_claim_reminder_occurrences', { p_limit: 5 });
    if (claimed.error) throw claimed.error;
    const occurrences = (claimed.data ?? []) as Occurrence[];
    let accepted = 0;
    for (const occurrence of occurrences) {
      let complete = false;
      let nextAt: number | null = null;
      try {
        const schedule = await admin.rpc('memo_dispatch_schedule', { p_occurrence_id: occurrence.occurrence_id, p_lease: occurrence.claimed_by });
        if (schedule.error) throw schedule.error;
        const metadata: unknown = schedule.data;
        let mode: 'regular' | 'alarm' = 'regular';
        if (metadata && typeof metadata === 'object' && 'schedule' in metadata) {
          nextAt = nextMemoReminderOccurrence(metadata.schedule as MemoReminderSchedule, Date.now());
          if ('mode' in metadata && metadata.mode === 'alarm') mode = 'alarm';
        }
        const result = await admin.rpc('memo_reminder_recipients', { p_occurrence_id: occurrence.occurrence_id, p_lease: occurrence.claimed_by });
        if (result.error) throw result.error;
        const targets = recipients(result.data);
        // No enrolled recipient is a retryable state; do not discard the occurrence.
        if (targets.length > 0) {
          const messages = targets.map((recipient) => ({
            to: recipient.token, title: 'DoloGram reminder', body: 'You have a memo reminder.',
            data: { event_kind: 'memo_reminder', account_id: recipient.user_id, memo_id: occurrence.memo_id, memo_generation: occurrence.generation, reminder_id: occurrence.reminder_id, occurrence_id: occurrence.occurrence_id, mode },
            sound: recipient.sounds ? 'default' : undefined, priority: mode === 'alarm' ? 'high' : 'default',
          }));
          const response = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'content-type': 'application/json', ...(expoAccessToken ? { authorization: `Bearer ${expoAccessToken}` } : {}) }, signal: AbortSignal.timeout(10_000), body: JSON.stringify(messages) });
          if (!response.ok) throw new Error('Push service unavailable.');
          const body: unknown = await response.json();
          if (!body || typeof body !== 'object' || !('data' in body) || !Array.isArray(body.data) || body.data.length !== targets.length) throw new Error('Push service returned invalid tickets.');
          complete = true;
          for (let index = 0; index < targets.length; index++) {
            const ticket: unknown = body.data[index];
            if (!ticket || typeof ticket !== 'object' || !('status' in ticket) || ticket.status !== 'ok') { complete = false; continue; }
            const recorded = await admin.rpc('memo_record_reminder_delivery', { p_occurrence_id: occurrence.occurrence_id, p_lease: occurrence.claimed_by, p_device_id: targets[index].device_id });
            if (recorded.error) throw recorded.error;
            accepted++;
          }
        }
      } catch {
        // The persisted lease/attempt bounds survive worker loss and provider failures.
        complete = false;
      }
      const finished = await admin.rpc('memo_finish_reminder', { p_occurrence_id: occurrence.occurrence_id, p_lease: occurrence.claimed_by, p_accepted: complete, p_next_at: nextAt });
      if (finished.error) throw finished.error;
    }
    return Response.json({ claimed: occurrences.length, accepted });
  } catch {
    return Response.json({ error: 'dispatch_failed' }, { status: 502 });
  }
});
