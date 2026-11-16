import { AppState } from 'react-native';
import { nextMemoReminderOccurrence, type MemoReminder } from '@dologram/shared';
import { isMemoScopeCurrent, type MemoScope } from './lifecycle';
import { withMemoStore } from './vault';
import { cancelMemoAlarm, memoAlarmAvailability, scheduleMemoAlarm, getMemoAlarmModule } from './alarm';
import {
  cancelMemoReminderNotification,
  isMemoReminderNotificationContent,
  memoReminderChannelId,
  prepareMemoReminderChannels,
  scheduleMemoReminderNotification,
  setMemoReminderPresentationPreferences,
  type MemoReminderNotificationData,
} from '../notifications/pushNotifications';
import { loadMemoReminderPreferences } from '../notifications/memoPreferences';
import { registerAlarmReconcile } from '../calls/audioOwnership';

export type MemoReminderRoute = { pathname: '/memo/[memoId]/reminders'; params: { memoId: string; reminderId: string; occurrenceId: string } };

function occurrenceAt(reminder: MemoReminder, now: number): number | null {
  if (reminder.snooze_until && reminder.snooze_until > now) return reminder.snooze_until;
  if (reminder.next_occurrence_at && reminder.next_occurrence_at > now) return reminder.next_occurrence_at;
  if (reminder.schedule_kind === 'one_time' && reminder.trigger_at && reminder.trigger_at > now) return reminder.trigger_at;
  const schedule = reminder.schedule_kind === 'one_time'
    ? { kind: 'one_time' as const, at: reminder.trigger_at ?? 0, timezone: reminder.timezone, recurrence: 'none' as const }
    : reminder.recurrence === 'daily'
      ? { kind: 'wall_clock' as const, timezone: reminder.timezone, recurrence: 'daily' as const, hour: reminder.hour ?? 0, minute: reminder.minute ?? 0 }
      : reminder.recurrence === 'weekly'
        ? { kind: 'wall_clock' as const, timezone: reminder.timezone, recurrence: 'weekly' as const, hour: reminder.hour ?? 0, minute: reminder.minute ?? 0, weekday: reminder.weekday ?? 1 }
        : { kind: 'wall_clock' as const, timezone: reminder.timezone, recurrence: 'monthly' as const, hour: reminder.hour ?? 0, minute: reminder.minute ?? 0, day_of_month: reminder.day_of_month ?? 1 };
  return nextMemoReminderOccurrence(schedule, now);
}

async function cancelStoredSchedule(reminder: MemoReminder): Promise<void> {
  if (reminder.mode === 'alarm') await cancelMemoAlarm(reminder.os_schedule_id);
  else await cancelMemoReminderNotification(reminder.os_schedule_id);
}

async function scheduleReminder(scope: MemoScope, reminder: MemoReminder, now: number): Promise<void> {
  const at = occurrenceAt(reminder, now);
  if (!at) {
    await withMemoStore(scope, (store) => store.completeReminder(reminder.reminder_id, `${reminder.reminder_id}:${reminder.schedule_revision}:${reminder.next_occurrence_at ?? now}`, now), true).catch(() => undefined);
    return;
  }
  const delivery = await withMemoStore(scope, (store) => store.prepareReminderOccurrence(reminder.reminder_id, at, now));
  const data: MemoReminderNotificationData = {
    event_kind: 'memo_reminder', account_id: scope.accountId, memo_id: reminder.memo_id, memo_generation: scope.generation,
    reminder_id: reminder.reminder_id, occurrence_id: delivery.occurrence_id, mode: reminder.mode,
  };
  let scheduleId: string;
  if (reminder.mode === 'alarm') {
    const module = getMemoAlarmModule();
    if (!module || await memoAlarmAvailability() !== 'available') {
      await withMemoStore(scope, (store) => store.recordReminderSchedule(reminder.reminder_id, 'pending', 'unavailable', null, delivery.occurrence_id, now));
      return;
    }
    scheduleId = (await scheduleMemoAlarm(delivery.occurrence_id, at, `dologram://memo-reminder?memo_id=${encodeURIComponent(reminder.memo_id)}&reminder_id=${encodeURIComponent(reminder.reminder_id)}&occurrence_id=${encodeURIComponent(delivery.occurrence_id)}`)).scheduleId;
  } else {
    scheduleId = await scheduleMemoReminderNotification({ data, at, mode: reminder.mode });
  }
  await withMemoStore(scope, (store) => store.recordReminderSchedule(reminder.reminder_id, 'scheduled', 'scheduled', scheduleId, delivery.occurrence_id, now), true);
}

export async function reconcileMemoReminderSchedules(scope: MemoScope, now = Date.now()): Promise<void> {
  const prefs = await loadMemoReminderPreferences(scope.accountId);
  setMemoReminderPresentationPreferences(prefs);
  await prepareMemoReminderChannels(prefs);
  await withMemoStore(scope, (store) => store.markMissedReminders(now));
  const reminders = await withMemoStore(scope, (store) => store.listReminders(undefined, false));
  for (const reminder of reminders) {
    if (!isMemoScopeCurrent(scope)) return;
    if (reminder.state !== 'ready') continue;
    if (reminder.actual_schedule_status === 'scheduled' && reminder.os_schedule_id && reminder.desired_schedule_status === 'scheduled') continue;
    await cancelStoredSchedule(reminder).catch(() => undefined);
    try { await scheduleReminder(scope, reminder, now); }
    catch { await withMemoStore(scope, (store) => store.recordReminderSchedule(reminder.reminder_id, 'pending', 'failed', null, null, now)).catch(() => undefined); }
  }
}

async function cancelScopeSchedules(scope: MemoScope): Promise<void> {
  try {
    const reminders = await withMemoStore(scope, (store) => store.listReminders(undefined, true));
    await Promise.all(reminders.map((reminder) => cancelStoredSchedule(reminder).catch(() => undefined)));
  } catch { /* account teardown may already have closed the vault */ }
}

export function startMemoReminderCoordinator(scope: MemoScope): () => void {
  void reconcileMemoReminderSchedules(scope).catch(() => undefined);
  const stopAlarmReconcile = registerAlarmReconcile(() => reconcileMemoReminderSchedules(scope));
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') void reconcileMemoReminderSchedules(scope).catch(() => undefined);
  });
  return () => {
    subscription.remove();
    stopAlarmReconcile();
    void cancelScopeSchedules(scope);
  };
}

export function isMemoReminderResponse(data: unknown): data is MemoReminderNotificationData {
  return isMemoReminderNotificationContent({ data });
}

export function memoReminderRoute(data: MemoReminderNotificationData): MemoReminderRoute {
  return { pathname: '/memo/[memoId]/reminders', params: { memoId: data.memo_id, reminderId: data.reminder_id, occurrenceId: data.occurrence_id } };
}

export async function acknowledgeMemoReminder(scope: MemoScope, reminderId: string, occurrenceId: string): Promise<void> {
  await withMemoStore(scope, (store) => store.recordReminderDelivery(reminderId, occurrenceId, 'presented', Date.now()));
}

export async function completeMemoReminder(scope: MemoScope, reminderId: string, occurrenceId: string): Promise<void> {
  const reminder = await withMemoStore(scope, (store) => store.reminder(reminderId));
  await cancelStoredSchedule(reminder);
  await withMemoStore(scope, (store) => store.completeReminder(reminderId, occurrenceId, Date.now()), true);
  await reconcileMemoReminderSchedules(scope);
}

export async function snoozeMemoReminder(scope: MemoScope, reminderId: string, occurrenceId: string, durationMs: number): Promise<void> {
  if (!Number.isSafeInteger(durationMs) || durationMs < 60_000 || durationMs > 30 * 24 * 60 * 60 * 1000) throw new Error('Snooze duration is invalid.');
  const reminder = await withMemoStore(scope, (store) => store.reminder(reminderId));
  await cancelStoredSchedule(reminder);
  await withMemoStore(scope, (store) => store.snoozeReminder(reminderId, occurrenceId, Date.now() + durationMs), true);
  await reconcileMemoReminderSchedules(scope);
}

export function reminderModeLabel(mode: MemoReminder['mode']): string {
  return mode === 'alarm' ? `Alarm (${memoReminderChannelId('alarm')})` : 'Regular reminder';
}
