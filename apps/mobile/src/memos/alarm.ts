import { requireOptionalNativeModule } from 'expo';

export type MemoAlarmAvailability = 'available' | 'permission' | 'unavailable';
export type MemoAlarmNativeModule = {
  canScheduleExactAlarms(): Promise<boolean>;
  openExactAlarmSettings(): Promise<boolean>;
  scheduleExact(occurrenceId: string, at: number, url: string): Promise<{ scheduleId: string }>;
  cancel(scheduleId: string): Promise<void>;
};

export const MEMO_ALARM_MODULE_NAME = 'DoloGramMemoAlarm' as const;

export function getMemoAlarmModule(): MemoAlarmNativeModule | null {
  return requireOptionalNativeModule<MemoAlarmNativeModule>(MEMO_ALARM_MODULE_NAME);
}

export async function memoAlarmAvailability(): Promise<MemoAlarmAvailability> {
  const module = getMemoAlarmModule();
  if (!module) return 'unavailable';
  return await module.canScheduleExactAlarms() ? 'available' : 'permission';
}

export async function openMemoAlarmSettings(): Promise<boolean> {
  return (await getMemoAlarmModule()?.openExactAlarmSettings()) ?? false;
}

export async function scheduleMemoAlarm(occurrenceId: string, at: number, url: string): Promise<{ scheduleId: string }> {
  const module = getMemoAlarmModule();
  if (!module) throw new Error('Alarm mode is unavailable in this app build. Regular reminders remain available.');
  if (!await module.canScheduleExactAlarms()) throw new Error('Exact alarm access is disabled. Enable it in Android settings or choose a regular reminder.');
  return module.scheduleExact(occurrenceId, at, url);
}

export async function cancelMemoAlarm(scheduleId: string | null): Promise<void> {
  if (scheduleId) await getMemoAlarmModule()?.cancel(scheduleId);
}
