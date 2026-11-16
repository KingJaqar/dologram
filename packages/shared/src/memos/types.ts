/** Phase 6 enables opt-in private cloud synchronization; local-only remains the default. */
export const memoCapabilities = Object.freeze({ text: true, attachments: true, notes: true, search: true, sync: true, reminders: true, protection: true });

export type Memo = {
  memo_id: string;
  account_id: string;
  title: string;
  description: string;
  replication: 'local' | 'synced';
  residency: 'keep_all' | 'on_demand';
  revision: number;
  created_at: number;
  updated_at: number;
  pinned: number;
  archived: number;
  ignored: number;
  unread: number;
  muted_until: string | null;
  preview: string;
  deleted_at: number | null;
  purge_after: number | null;
  trash_mode: MemoTrashMode;
};
export type MemoTextItem = { item_id: string; memo_id: string; author_id: string; text: string; created_at: number; revision: number; operation_id: string };
export type MemoAssetType = 'photo' | 'video' | 'voice' | 'file';
export type MemoAssetAvailability = 'staging' | 'verified' | 'repair';
export type MemoTrashMode = 'manual' | 'retention';
export type MemoAsset = {
  asset_id: string;
  memo_id: string;
  opaque_path: string;
  original_name: string;
  mime_type: string;
  detected_type: MemoAssetType;
  byte_size: number;
  checksum: string | null;
  availability: MemoAssetAvailability;
  created_at: number;
  trashed_at: number | null;
};
export type MemoAttachmentItem = MemoTextItem & { kind: 'attachment'; display_name: string; asset: MemoAsset };
export type MemoTimelineItem = (MemoTextItem & { kind?: 'text'; display_name?: string }) | MemoAttachmentItem;
export type MemoAssetJob = {
  operation_id: string;
  memo_id: string;
  item_id: string;
  asset_id: string;
  original_name: string;
  mime_type: string;
  detected_type: MemoAssetType;
  byte_size: number;
  checksum: string | null;
  staging_path: string | null;
  final_path: string | null;
  created_at: number;
  stage: 'prepared' | 'staged' | 'committed';
};
export type MemoStorageAccounting = { live_bytes: number; trash_bytes: number; staging_bytes: number; repair_bytes: number; total_bytes: number };
export type MemoArchiveJob = { operation_id: string; kind: 'export' | 'import'; path: string; stage: 'prepared' | 'running' | 'complete' | 'failed'; bytes: number; error: string | null; created_at: number; updated_at: number };
export type MemoShareJob = { operation_id: string; fingerprint: string; memo_id: string; stage: 'prepared' | 'committed' | 'failed'; created_at: number; updated_at: number };
export type MemoLargestContent = Pick<MemoAsset, 'asset_id' | 'memo_id' | 'original_name' | 'byte_size' | 'detected_type' | 'availability'> & { memo_title: string; deleted_at: number | null };
export type MemoCursor = Pick<MemoTextItem, 'created_at' | 'item_id'>;
export type MemoPreference = 'pinned' | 'archived' | 'ignored' | 'unread';
export type MemoSaveState = 'saving' | 'saved' | 'error';
export type ConversationIdentity = { kind: 'chat'; chatId: string } | { kind: 'memo'; memoId: string };
export type MemoOrganizationRole = 'owner' | 'admin' | 'senior' | 'junior' | 'viewer';
export type MemoSearchFilter = 'all' | 'messages' | 'photos' | 'videos' | 'photosVideos' | 'audios' | 'files' | 'links' | 'others';
export type MemoTag = { tag_id: string; memo_id: string; display_name: string; normalized_name: string; created_at: number; updated_at: number };
export type MemoPin = { memo_id: string; item_id: string; user_id: string; visibility: 'personal' | 'shared'; position: number; created_at: number };
export type MemoBulkSelection = { selection_id: string; memo_id: string; item_ids: string[]; captured_at: number };
export type MemoSearchResult = {
  memo_id: string;
  item_id: string;
  memo_title: string;
  item_kind: 'text' | 'attachment';
  display_name: string;
  detected_type: MemoAssetType | null;
  snippet: string;
  block_start: number;
  created_at: number;
  author_id: string;
  pinned: boolean;
  tags: string[];
};
export type MemoSearchState = { status: 'ready' | 'rebuilding' | 'error'; indexed_items: number; total_items: number; last_error: string | null };
export type MemoNote = { memo_id: string; item_id: string; title: string; description: string; body: string; revision: number; updated_at: number };
export type MemoNoteRevision = { revision_id: string; memo_id: string; revision: number; title: string; description: string; body: string; named: string | null; created_at: number };
export type MemoNoteDraft = { memo_id: string; title: string; description: string; body: string; revision: number; updated_at: number };
export type MemoReminderMode = 'regular' | 'alarm';
export type MemoReminderRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';
export type MemoReminderState = 'building' | 'ready' | 'suspended' | 'completed' | 'cancelled';
export type MemoReminderTargetState = 'building' | 'ready' | 'cancelled';
export type MemoReminderSchedule =
  | { kind: 'one_time'; at: number; timezone: string; recurrence: 'none' }
  | { kind: 'wall_clock'; timezone: string; recurrence: 'daily'; hour: number; minute: number }
  | { kind: 'wall_clock'; timezone: string; recurrence: 'weekly'; hour: number; minute: number; weekday: number }
  | { kind: 'wall_clock'; timezone: string; recurrence: 'monthly'; hour: number; minute: number; day_of_month: number };
export type MemoReminder = {
  reminder_id: string; memo_id: string; owner_id: string; mode: MemoReminderMode;
  state: MemoReminderState; target_set_state: MemoReminderTargetState;
  schedule_kind: MemoReminderSchedule['kind']; trigger_at: number | null; timezone: string;
  recurrence: MemoReminderRecurrence; hour: number | null; minute: number | null;
  weekday: number | null; day_of_month: number | null; schedule_revision: number;
  desired_schedule_status: 'pending' | 'scheduled' | 'cancelled'; actual_schedule_status: 'unknown' | 'scheduled' | 'cancelled' | 'unavailable' | 'failed';
  os_schedule_id: string | null; next_occurrence_at: number | null; snooze_until: number | null;
  selected_count: number; live_count: number; unavailable_count: number; last_delivery_status: MemoReminderDeliveryStatus | null;
  created_at: number; updated_at: number;
};
export type MemoReminderTarget = { reminder_id: string; item_id: string; captured_revision: number | null; state: 'live' | 'unavailable'; unavailable_reason: string | null };
export type MemoReminderDeliveryStatus = 'scheduled' | 'presented' | 'snoozed' | 'completed' | 'missed' | 'cancelled' | 'unavailable' | 'failed';
export type MemoReminderDelivery = { occurrence_id: string; reminder_id: string; occurrence_at: number; schedule_revision: number; os_schedule_id: string | null; status: MemoReminderDeliveryStatus; presented_at: number | null; completed_at: number | null };
export type MemoReminderCreateInput = { reminder_id: string; memo_id: string; mode: MemoReminderMode; schedule: MemoReminderSchedule; item_ids: readonly string[]; now: number };
export const MEMO_NOTE_BODY_LIMIT = 500000;
export const MEMO_NOTE_TITLE_LIMIT = 128;
export const MEMO_NOTE_DESCRIPTION_LIMIT = 500;

export function memoListKey(memoId: string): string { return `memo:${memoId}`; }
export function conversationIdentity(key: string): ConversationIdentity {
  return key.startsWith('memo:') ? { kind: 'memo', memoId: key.slice(5) } : { kind: 'chat', chatId: key };
}
export function validateMemoId(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error('Invalid memo identifier');
  return value;
}
export function validateMemoText(value: string): string {
  if (!value.trim() || [...value].length > 4096) throw new Error('Enter between 1 and 4,096 characters. Your draft has been kept.');
  return value;
}
export function validateMemoDetails(title: string, description: string): void {
  if (!title.trim() || [...title].length > 128 || [...description].length > 500) throw new Error('Use a title of 1–128 characters and a description of up to 500 characters.');
}
export function validateMemoNote(title: string, description: string, body: string): void {
  if (!title.trim() || [...title].length > MEMO_NOTE_TITLE_LIMIT || [...description].length > MEMO_NOTE_DESCRIPTION_LIMIT) throw new Error('Use a title of 1–128 characters and a description of up to 500 characters.');
  if ([...body].length > MEMO_NOTE_BODY_LIMIT) throw new Error('This note is limited to 500,000 characters. Your existing draft was kept.');
}

export function validateMemoReminderSchedule(schedule: MemoReminderSchedule): MemoReminderSchedule {
  if (schedule.kind === 'one_time' && (!Number.isSafeInteger(schedule.at) || schedule.at <= 0)) throw new Error('Reminder time is invalid.');
  try { new Intl.DateTimeFormat('en-US', { timeZone: schedule.timezone }).format(); }
  catch { throw new Error('Reminder timezone is invalid.'); }
  if (schedule.kind === 'one_time') return schedule;
  if (!Number.isInteger(schedule.hour) || schedule.hour < 0 || schedule.hour > 23 || !Number.isInteger(schedule.minute) || schedule.minute < 0 || schedule.minute > 59) throw new Error('Reminder time is invalid.');
  if (schedule.recurrence === 'weekly' && (!Number.isInteger(schedule.weekday) || schedule.weekday < 1 || schedule.weekday > 7)) throw new Error('Reminder weekday is invalid.');
  if (schedule.recurrence === 'monthly' && (!Number.isInteger(schedule.day_of_month) || schedule.day_of_month < 1 || schedule.day_of_month > 31)) throw new Error('Reminder day is invalid.');
  return schedule;
}

function zonedParts(date: Date, timezone: string): { year: number; month: number; day: number; hour: number; minute: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23', weekday: 'short' }).formatToParts(date);
  const value = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const weekdays: Record<string, number> = { Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6, Sat: 7 };
  const weekday = typeof value.weekday === 'string' ? weekdays[value.weekday] ?? 1 : 1;
  return { year: Number(value.year), month: Number(value.month), day: Number(value.day), hour: Number(value.hour), minute: Number(value.minute), weekday };
}

function zonedDate(parts: { year: number; month: number; day: number; hour: number; minute: number }, timezone: string): Date {
  let candidate = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  for (let attempt = 0; attempt < 3; attempt++) {
    const actual = zonedParts(new Date(candidate), timezone);
    const expected = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    const observed = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute);
    candidate += expected - observed;
  }
  return new Date(candidate);
}

export function nextMemoReminderOccurrence(schedule: MemoReminderSchedule, now = Date.now()): number | null {
  validateMemoReminderSchedule(schedule);
  if (schedule.kind === 'one_time') return schedule.at > now ? schedule.at : null;
  const current = zonedParts(new Date(now), schedule.timezone);
  const day = current.day;
  const month = current.month;
  const year = current.year;
  const atOrAfter = (candidate: Date) => candidate.getTime() > now;
  for (let offset = 0; offset <= 370; offset++) {
    const probe = new Date(Date.UTC(year, month - 1, day + offset, 12));
    const probeParts = zonedParts(probe, 'UTC');
    const matches = schedule.recurrence === 'daily'
      || (schedule.recurrence === 'weekly' && probeParts.weekday === schedule.weekday)
      || (schedule.recurrence === 'monthly' && probeParts.day === Math.min(schedule.day_of_month, new Date(Date.UTC(probeParts.year, probeParts.month, 0)).getUTCDate()));
    if (matches) {
      const candidate = zonedDate({ year: probeParts.year, month: probeParts.month, day: probeParts.day, hour: schedule.hour, minute: schedule.minute }, schedule.timezone);
      if (atOrAfter(candidate)) return candidate.getTime();
    }
  }
  return null;
}

export function memoReminderOccurrenceId(reminderId: string, scheduleRevision: number, occurrenceAt: number): string {
  validateMemoId(reminderId);
  if (!Number.isSafeInteger(scheduleRevision) || scheduleRevision < 1 || !Number.isSafeInteger(occurrenceAt) || occurrenceAt <= 0) throw new Error('Reminder occurrence is invalid.');
  return `${reminderId}:${scheduleRevision}:${occurrenceAt}`;
}

export function normalizeMemoTagName(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('en-US');
}

export function validateMemoTagName(value: string): { display_name: string; normalized_name: string } {
  const display_name = value.normalize('NFKC').trim();
  const length = [...display_name].length;
  if (length < 1 || length > 64) throw new Error('Tags must contain between 1 and 64 characters.');
  return { display_name, normalized_name: normalizeMemoTagName(display_name) };
}

export function memoSearchFilterLabel(filter: MemoSearchFilter): string {
  const labels: Record<MemoSearchFilter, string> = {
    all: 'All', messages: 'Messages', photos: 'Photos', videos: 'Videos', photosVideos: 'Photos & Videos',
    audios: 'Audios', files: 'Files', links: 'Links', others: 'Others',
  };
  return labels[filter];
}

/** Converts plain user text into bound FTS5 syntax; callers must still bind the returned value. */
export function buildMemoMatchQuery(value: string): string {
  const normalized = value.normalize('NFKC').trim();
  if (!normalized) return '';
  const parts: string[] = [];
  const quoted = /"([^"\n]+)"|([^\s]+)/gu;
  for (const match of normalized.matchAll(quoted)) {
    const raw = (match[1] ?? match[2] ?? '').trim();
    if (!raw) continue;
    const escaped = raw.replaceAll('"', '""');
    parts.push(match[1] ? `"${escaped}"` : `"${escaped}"*`);
  }
  return parts.join(' AND ');
}
