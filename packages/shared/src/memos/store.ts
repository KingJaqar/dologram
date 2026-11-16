import { buildMemoMatchQuery, memoReminderOccurrenceId, nextMemoReminderOccurrence, validateMemoDetails, validateMemoId, validateMemoNote, validateMemoReminderSchedule, validateMemoTagName, validateMemoText, type Memo, type MemoArchiveJob, type MemoAsset, type MemoAssetJob, type MemoAssetType, type MemoAttachmentItem, type MemoBulkSelection, type MemoCursor, type MemoLargestContent, type MemoNote, type MemoNoteDraft, type MemoNoteRevision, type MemoOrganizationRole, type MemoPin, type MemoPreference, type MemoReminder, type MemoReminderCreateInput, type MemoReminderDelivery, type MemoReminderDeliveryStatus, type MemoReminderSchedule, type MemoReminderTarget, type MemoSearchFilter, type MemoSearchResult, type MemoSearchState, type MemoShareJob, type MemoStorageAccounting, type MemoTag, type MemoTextItem, type MemoTimelineItem, type MemoTrashMode } from './types';
import type { MemoRemoteState, MemoRemoteStatus, MemoResidency, MemoReplication, MemoSyncChange, MemoSyncConflict, MemoSyncEntity, MemoSyncOperation } from './sync';

export interface MemoDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: (string | number | null)[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

export const memoSchemaVersion = 7;
function fallbackUuid(): string {
  const runtime = globalThis as typeof globalThis & { crypto?: { getRandomValues?: (values: Uint8Array) => Uint8Array } };
  const bytes = new Uint8Array(16);
  const crypto = runtime.crypto;
  if (crypto?.getRandomValues) crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const schema = `
CREATE TABLE vault_identity (account_id TEXT PRIMARY KEY NOT NULL);
CREATE TABLE memos (
 memo_id TEXT PRIMARY KEY NOT NULL, account_id TEXT NOT NULL REFERENCES vault_identity(account_id),
 title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', replication TEXT NOT NULL DEFAULT 'local' CHECK(replication='local'),
 residency TEXT NOT NULL DEFAULT 'keep_all' CHECK(residency='keep_all'), revision INTEGER NOT NULL DEFAULT 1,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, pinned INTEGER NOT NULL DEFAULT 0,
 archived INTEGER NOT NULL DEFAULT 0, ignored INTEGER NOT NULL DEFAULT 0, unread INTEGER NOT NULL DEFAULT 0,
 muted_until TEXT, preview TEXT NOT NULL DEFAULT '', deleted_at INTEGER, purge_after INTEGER,
 trash_mode TEXT NOT NULL DEFAULT 'manual' CHECK(trash_mode IN ('manual','retention'))
);
CREATE TABLE memo_items (
 item_id TEXT PRIMARY KEY NOT NULL, memo_id TEXT NOT NULL REFERENCES memos(memo_id),
 author_id TEXT NOT NULL REFERENCES vault_identity(account_id), text TEXT NOT NULL, created_at INTEGER NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1, operation_id TEXT NOT NULL UNIQUE,
 kind TEXT NOT NULL DEFAULT 'text' CHECK(kind IN ('text','attachment')), display_name TEXT NOT NULL DEFAULT ''
);
CREATE INDEX memo_timeline ON memo_items(memo_id,created_at DESC,item_id DESC);
CREATE TABLE memo_drafts (memo_id TEXT PRIMARY KEY NOT NULL REFERENCES memos(memo_id), text TEXT NOT NULL, revision INTEGER NOT NULL);
CREATE TABLE memo_jobs (
 operation_id TEXT PRIMARY KEY NOT NULL, memo_id TEXT NOT NULL REFERENCES memos(memo_id), item_id TEXT NOT NULL UNIQUE,
 text TEXT NOT NULL, created_at INTEGER NOT NULL, stage TEXT NOT NULL CHECK(stage IN ('prepared','staged','committed'))
);
CREATE TABLE memo_folder_links (memo_id TEXT NOT NULL REFERENCES memos(memo_id), folder_id TEXT NOT NULL, PRIMARY KEY(memo_id,folder_id));
CREATE TABLE memo_assets (
 asset_id TEXT PRIMARY KEY NOT NULL, memo_id TEXT NOT NULL REFERENCES memos(memo_id),
 opaque_path TEXT NOT NULL UNIQUE, original_name TEXT NOT NULL, mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
 detected_type TEXT NOT NULL DEFAULT 'file' CHECK(detected_type IN ('photo','video','voice','file')),
 byte_size INTEGER NOT NULL CHECK(byte_size>=0), checksum TEXT, created_at INTEGER NOT NULL DEFAULT 0,
 availability TEXT NOT NULL CHECK(availability IN ('staging','verified','repair')), trashed_at INTEGER
);
CREATE TABLE memo_item_assets (
 item_id TEXT NOT NULL REFERENCES memo_items(item_id), asset_id TEXT NOT NULL REFERENCES memo_assets(asset_id), PRIMARY KEY(item_id,asset_id)
);
CREATE TRIGGER memo_asset_owner BEFORE INSERT ON memo_item_assets
 WHEN (SELECT memo_id FROM memo_items WHERE item_id=NEW.item_id) != (SELECT memo_id FROM memo_assets WHERE asset_id=NEW.asset_id)
 BEGIN SELECT RAISE(ABORT,'Foreign memo asset'); END;
CREATE TABLE memo_asset_jobs (
 operation_id TEXT PRIMARY KEY NOT NULL, memo_id TEXT NOT NULL REFERENCES memos(memo_id),
 item_id TEXT NOT NULL UNIQUE, asset_id TEXT NOT NULL UNIQUE, original_name TEXT NOT NULL,
 mime_type TEXT NOT NULL, detected_type TEXT NOT NULL CHECK(detected_type IN ('photo','video','voice','file')),
 byte_size INTEGER NOT NULL CHECK(byte_size>=0), checksum TEXT, staging_path TEXT, final_path TEXT,
 created_at INTEGER NOT NULL, stage TEXT NOT NULL CHECK(stage IN ('prepared','staged','committed'))
);
CREATE TABLE memo_events (
 event_id TEXT PRIMARY KEY NOT NULL, memo_id TEXT NOT NULL,
 event_type TEXT NOT NULL CHECK(event_type IN ('trashed','restored','purged')), created_at INTEGER NOT NULL
);
CREATE INDEX memo_trash ON memos(account_id,deleted_at,purge_after);
CREATE INDEX memo_asset_lookup ON memo_assets(memo_id,availability,trashed_at);
CREATE TABLE memo_archive_jobs (
 operation_id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('export','import')), path TEXT NOT NULL,
 stage TEXT NOT NULL CHECK(stage IN ('prepared','running','complete','failed')), bytes INTEGER NOT NULL DEFAULT 0,
 error TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE memo_share_jobs (
 operation_id TEXT PRIMARY KEY NOT NULL, fingerprint TEXT NOT NULL UNIQUE, memo_id TEXT NOT NULL REFERENCES memos(memo_id),
 stage TEXT NOT NULL CHECK(stage IN ('prepared','committed','failed')), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE memo_tags (
 tag_id TEXT PRIMARY KEY NOT NULL, memo_id TEXT NOT NULL REFERENCES memos(memo_id), display_name TEXT NOT NULL,
 normalized_name TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 UNIQUE(memo_id,normalized_name)
);
CREATE INDEX memo_tags_memo ON memo_tags(memo_id,normalized_name);
CREATE TABLE memo_item_tags (
 item_id TEXT NOT NULL REFERENCES memo_items(item_id), tag_id TEXT NOT NULL REFERENCES memo_tags(tag_id),
 PRIMARY KEY(item_id,tag_id)
);
CREATE TABLE memo_pins (
 memo_id TEXT NOT NULL REFERENCES memos(memo_id), item_id TEXT NOT NULL REFERENCES memo_items(item_id), user_id TEXT NOT NULL,
 visibility TEXT NOT NULL CHECK(visibility IN ('personal','shared')), position INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
 PRIMARY KEY(memo_id,item_id,user_id,visibility)
);
CREATE INDEX memo_pins_user ON memo_pins(user_id,visibility,position,created_at);
CREATE TABLE memo_bulk_selections (
 selection_id TEXT NOT NULL, memo_id TEXT NOT NULL REFERENCES memos(memo_id), item_id TEXT NOT NULL REFERENCES memo_items(item_id),
 captured_at INTEGER NOT NULL, PRIMARY KEY(selection_id,item_id)
);
CREATE INDEX memo_bulk_selection_memo ON memo_bulk_selections(memo_id,selection_id,item_id);
CREATE VIRTUAL TABLE memo_search_index USING fts5(
 memo_id UNINDEXED, item_id UNINDEXED, revision UNINDEXED, chunk_index UNINDEXED, chunk_start UNINDEXED,
 item_kind UNINDEXED, title, description, body, display_name, tags,
 tokenize='unicode61 remove_diacritics 2'
);
CREATE TABLE memo_search_state (
 account_id TEXT PRIMARY KEY NOT NULL, status TEXT NOT NULL CHECK(status IN ('ready','rebuilding','error')),
 indexed_items INTEGER NOT NULL DEFAULT 0, total_items INTEGER NOT NULL DEFAULT 0, last_error TEXT
);
CREATE TABLE memo_notes (
 memo_id TEXT PRIMARY KEY NOT NULL REFERENCES memos(memo_id), item_id TEXT NOT NULL UNIQUE REFERENCES memo_items(item_id),
 title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL
);
CREATE TABLE memo_note_revisions (
 revision_id TEXT PRIMARY KEY NOT NULL, memo_id TEXT NOT NULL REFERENCES memos(memo_id), revision INTEGER NOT NULL,
 title TEXT NOT NULL, description TEXT NOT NULL, body TEXT NOT NULL, named TEXT, created_at INTEGER NOT NULL,
 UNIQUE(memo_id,revision)
);
CREATE INDEX memo_note_revisions_lookup ON memo_note_revisions(memo_id,revision DESC);
CREATE TABLE memo_reminders (
 reminder_id TEXT PRIMARY KEY NOT NULL, memo_id TEXT NOT NULL REFERENCES memos(memo_id), owner_id TEXT NOT NULL REFERENCES vault_identity(account_id),
 mode TEXT NOT NULL CHECK(mode IN ('regular','alarm')), state TEXT NOT NULL CHECK(state IN ('building','ready','suspended','completed','cancelled')),
 target_set_state TEXT NOT NULL CHECK(target_set_state IN ('building','ready','cancelled')), schedule_kind TEXT NOT NULL CHECK(schedule_kind IN ('one_time','wall_clock')),
 trigger_at INTEGER, timezone TEXT NOT NULL, recurrence TEXT NOT NULL CHECK(recurrence IN ('none','daily','weekly','monthly')), hour INTEGER, minute INTEGER,
 weekday INTEGER, day_of_month INTEGER, schedule_revision INTEGER NOT NULL DEFAULT 1,
 desired_schedule_status TEXT NOT NULL CHECK(desired_schedule_status IN ('pending','scheduled','cancelled')) DEFAULT 'pending',
 actual_schedule_status TEXT NOT NULL CHECK(actual_schedule_status IN ('unknown','scheduled','cancelled','unavailable','failed')) DEFAULT 'unknown',
 os_schedule_id TEXT, next_occurrence_at INTEGER, snooze_until INTEGER, selected_count INTEGER NOT NULL DEFAULT 0, live_count INTEGER NOT NULL DEFAULT 0,
 unavailable_count INTEGER NOT NULL DEFAULT 0, last_delivery_status TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX memo_reminders_memo ON memo_reminders(memo_id,state,updated_at DESC);
CREATE TABLE memo_reminder_targets (
 reminder_id TEXT NOT NULL REFERENCES memo_reminders(reminder_id), item_id TEXT NOT NULL, captured_revision INTEGER,
 state TEXT NOT NULL CHECK(state IN ('live','unavailable')), unavailable_reason TEXT, PRIMARY KEY(reminder_id,item_id)
);
CREATE TABLE memo_reminder_deliveries (
 occurrence_id TEXT PRIMARY KEY NOT NULL, reminder_id TEXT NOT NULL REFERENCES memo_reminders(reminder_id), occurrence_at INTEGER NOT NULL,
 schedule_revision INTEGER NOT NULL, os_schedule_id TEXT, status TEXT NOT NULL CHECK(status IN ('scheduled','presented','snoozed','completed','missed','cancelled','unavailable','failed')),
 presented_at INTEGER, completed_at INTEGER
);
CREATE TABLE memo_sync_state (
 memo_id TEXT PRIMARY KEY NOT NULL REFERENCES memos(memo_id), account_id TEXT NOT NULL REFERENCES vault_identity(account_id),
 replication TEXT NOT NULL DEFAULT 'local' CHECK(replication IN ('local','synced')), residency TEXT NOT NULL DEFAULT 'keep_all' CHECK(residency IN ('keep_all','on_demand')),
 generation TEXT NOT NULL, remote_memo_id TEXT, cursor INTEGER NOT NULL DEFAULT 0, remote_revision INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'local_only' CHECK(status IN ('local_only','pending','bootstrapping','uploading','finalizing','synced','available_offline','downloading','online_required','waiting_for_wifi','quota_exceeded','conflict','access_removed','sync_failed','paused')),
 complete INTEGER NOT NULL DEFAULT 1, error TEXT, bootstrap_operation_id TEXT, updated_at INTEGER NOT NULL
);
CREATE INDEX memo_sync_state_account ON memo_sync_state(account_id,replication,status);
CREATE TABLE memo_protection_requirements(memo_id TEXT PRIMARY KEY NOT NULL REFERENCES memos(memo_id),required INTEGER NOT NULL CHECK(required IN (0,1)));
CREATE TABLE memo_sync_operations (
 operation_id TEXT PRIMARY KEY NOT NULL, memo_id TEXT NOT NULL REFERENCES memos(memo_id), account_id TEXT NOT NULL REFERENCES vault_identity(account_id),
 generation TEXT NOT NULL, entity_id TEXT NOT NULL, entity_type TEXT NOT NULL, base_revision INTEGER NOT NULL, predecessor_id TEXT,
 payload TEXT NOT NULL, frozen_payload TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('pending','uploading','acknowledged','conflict','failed','cancelled')),
 attempt INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER NOT NULL, remote_revision INTEGER, change_position INTEGER, error TEXT, created_at INTEGER NOT NULL
);
CREATE INDEX memo_sync_operations_due ON memo_sync_operations(memo_id,state,next_attempt_at,created_at);
CREATE TABLE memo_sync_conflicts (
 conflict_id TEXT PRIMARY KEY NOT NULL, memo_id TEXT NOT NULL REFERENCES memos(memo_id), generation TEXT NOT NULL, entity_id TEXT NOT NULL,
 entity_type TEXT NOT NULL, local_operation_id TEXT NOT NULL REFERENCES memo_sync_operations(operation_id), remote_revision INTEGER NOT NULL,
 local_payload TEXT NOT NULL, remote_payload TEXT NOT NULL, created_at INTEGER NOT NULL, resolved_at INTEGER
);
CREATE TABLE memo_sync_deletion_markers (
 memo_id TEXT NOT NULL REFERENCES memos(memo_id), generation TEXT NOT NULL, entity_id TEXT NOT NULL, entity_type TEXT NOT NULL,
 remote_revision INTEGER NOT NULL, change_position INTEGER NOT NULL, deleted_at INTEGER NOT NULL, PRIMARY KEY(memo_id,generation,entity_id,entity_type)
);
CREATE TABLE memo_sync_reminder_preferences (
 memo_id TEXT NOT NULL REFERENCES memos(memo_id), user_id TEXT NOT NULL, device_id TEXT NOT NULL, enabled INTEGER NOT NULL,
 sounds INTEGER NOT NULL, vibration INTEGER NOT NULL, timezone TEXT, updated_at INTEGER NOT NULL, PRIMARY KEY(memo_id,user_id,device_id)
);
`;

const searchSchema = `
CREATE TABLE IF NOT EXISTS memo_tags (
 tag_id TEXT PRIMARY KEY NOT NULL, memo_id TEXT NOT NULL REFERENCES memos(memo_id), display_name TEXT NOT NULL,
 normalized_name TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 UNIQUE(memo_id,normalized_name)
);
CREATE INDEX IF NOT EXISTS memo_tags_memo ON memo_tags(memo_id,normalized_name);
CREATE TABLE IF NOT EXISTS memo_item_tags (
 item_id TEXT NOT NULL REFERENCES memo_items(item_id), tag_id TEXT NOT NULL REFERENCES memo_tags(tag_id), PRIMARY KEY(item_id,tag_id)
);
CREATE TABLE IF NOT EXISTS memo_pins (
 memo_id TEXT NOT NULL REFERENCES memos(memo_id), item_id TEXT NOT NULL REFERENCES memo_items(item_id), user_id TEXT NOT NULL,
 visibility TEXT NOT NULL CHECK(visibility IN ('personal','shared')), position INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
 PRIMARY KEY(memo_id,item_id,user_id,visibility)
);
CREATE INDEX IF NOT EXISTS memo_pins_user ON memo_pins(user_id,visibility,position,created_at);
CREATE TABLE IF NOT EXISTS memo_bulk_selections (
 selection_id TEXT NOT NULL, memo_id TEXT NOT NULL REFERENCES memos(memo_id), item_id TEXT NOT NULL REFERENCES memo_items(item_id),
 captured_at INTEGER NOT NULL, PRIMARY KEY(selection_id,item_id)
);
CREATE INDEX IF NOT EXISTS memo_bulk_selection_memo ON memo_bulk_selections(memo_id,selection_id,item_id);
CREATE VIRTUAL TABLE IF NOT EXISTS memo_search_index USING fts5(
 memo_id UNINDEXED, item_id UNINDEXED, revision UNINDEXED, chunk_index UNINDEXED, chunk_start UNINDEXED,
 item_kind UNINDEXED, title, description, body, display_name, tags,
 tokenize='unicode61 remove_diacritics 2'
);
CREATE TABLE IF NOT EXISTS memo_search_state (
 account_id TEXT PRIMARY KEY NOT NULL, status TEXT NOT NULL CHECK(status IN ('ready','rebuilding','error')),
 indexed_items INTEGER NOT NULL DEFAULT 0, total_items INTEGER NOT NULL DEFAULT 0, last_error TEXT
);
`;

const SEARCH_CHUNK_SIZE = 2048;
const SEARCH_CHUNK_OVERLAP = 256;
const memoFilterSql: Record<MemoSearchFilter, string> = {
  all: '1=1',
  messages: "i.kind='text'",
  photos: "a.detected_type='photo'",
  videos: "a.detected_type='video'",
  photosVideos: "a.detected_type IN ('photo','video')",
  audios: "a.detected_type='voice'",
  files: "a.detected_type='file' AND (lower(a.mime_type) IN ('application/pdf','text/plain','text/markdown','application/rtf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') OR lower(a.original_name) LIKE '%.pdf' OR lower(a.original_name) LIKE '%.doc' OR lower(a.original_name) LIKE '%.docx' OR lower(a.original_name) LIKE '%.xls' OR lower(a.original_name) LIKE '%.xlsx' OR lower(a.original_name) LIKE '%.txt' OR lower(a.original_name) LIKE '%.md')",
  links: "lower(i.text) LIKE '%http://%' OR lower(i.text) LIKE '%https://%'",
  others: "a.detected_type='file' AND NOT (lower(a.mime_type) IN ('application/pdf','text/plain','text/markdown','application/rtf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') OR lower(a.original_name) LIKE '%.pdf' OR lower(a.original_name) LIKE '%.doc' OR lower(a.original_name) LIKE '%.docx' OR lower(a.original_name) LIKE '%.xls' OR lower(a.original_name) LIKE '%.xlsx' OR lower(a.original_name) LIKE '%.txt' OR lower(a.original_name) LIKE '%.md')",
};

function roleCanManageTags(role: MemoOrganizationRole): boolean { return role === 'owner' || role === 'admin' || role === 'senior'; }
function roleCanTagOwn(role: MemoOrganizationRole): boolean { return role !== 'viewer'; }
function uniqueIds(values: readonly string[]): string[] { return [...new Set(values)]; }
function searchChunks(text: string): { text: string; start: number; index: number }[] {
  const points = [...text];
  if (points.length === 0) return [{ text: '', start: 0, index: 0 }];
  const chunks: { text: string; start: number; index: number }[] = [];
  const step = SEARCH_CHUNK_SIZE - SEARCH_CHUNK_OVERLAP;
  for (let start = 0, index = 0; start < points.length; start += step, index++) {
    chunks.push({ text: points.slice(start, start + SEARCH_CHUNK_SIZE).join(''), start, index });
    if (start + SEARCH_CHUNK_SIZE >= points.length) break;
  }
  return chunks;
}

/** All calls, including initialize/read, must run inside the account handle's serial executor. */
export class MemoStore {
  constructor(private readonly db: MemoDatabase, readonly accountId: string, private readonly randomUUID: () => string = fallbackUuid) { validateMemoId(accountId); }

  async initialize(existing: boolean): Promise<void> {
    const version = await this.db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if (!version || version.user_version > memoSchemaVersion) throw new Error('Update DoloGram to open this memo vault. Existing data has been kept.');
    if (version.user_version === 0) {
      if (existing) throw new Error('Memo vault needs recovery. Existing data has been kept.');
      await this.db.withTransactionAsync(async () => {
        await this.db.execAsync(schema);
        await this.db.runAsync('INSERT INTO vault_identity(account_id) VALUES (?)', this.accountId);
        await this.db.execAsync(`PRAGMA user_version=${memoSchemaVersion}`);
      });
    } else if (version.user_version === 1) {
      await this.migrateV1();
    }
    let current = await this.db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if ((current?.user_version ?? 0) < 3) await this.migrateSearch();
    current = await this.db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if (current?.user_version === 3) await this.migrateNotes();
    current = await this.db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if ((current?.user_version ?? 0) < 5) await this.migrateReminders();
    current = await this.db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if ((current?.user_version ?? 0) < 6) await this.migrateSync();
    current = await this.db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if ((current?.user_version ?? 0) < 7) await this.db.withTransactionAsync(async () => {
      await this.db.execAsync('CREATE TABLE IF NOT EXISTS memo_protection_requirements(memo_id TEXT PRIMARY KEY NOT NULL REFERENCES memos(memo_id),required INTEGER NOT NULL CHECK(required IN (0,1))); PRAGMA user_version=7;');
    });
    await this.db.execAsync(`CREATE TABLE IF NOT EXISTS memo_note_drafts (
      memo_id TEXT PRIMARY KEY NOT NULL REFERENCES memos(memo_id), title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );`);
    const identity = await this.db.getFirstAsync<{ account_id: string }>('SELECT account_id FROM vault_identity');
    if (identity?.account_id !== this.accountId) throw new Error('Memo vault belongs to another account.');
    const memos = await this.db.getAllAsync<Memo>('SELECT * FROM memos WHERE account_id=? AND deleted_at IS NULL ORDER BY created_at,memo_id', this.accountId);
    const seen = new Set<string>();
    for (const memo of memos) {
      const key = memo.title.trim().toLowerCase();
      if (seen.has(key)) await this.details(memo.memo_id, memo.title, memo.description, Date.now());
      else seen.add(key);
    }
    await this.ensureSearchReady();
    await this.recover();
  }

  private async migrateSync(): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS memo_sync_state (
          memo_id TEXT PRIMARY KEY NOT NULL REFERENCES memos(memo_id), account_id TEXT NOT NULL REFERENCES vault_identity(account_id),
          replication TEXT NOT NULL DEFAULT 'local' CHECK(replication IN ('local','synced')), residency TEXT NOT NULL DEFAULT 'keep_all' CHECK(residency IN ('keep_all','on_demand')),
          generation TEXT NOT NULL, remote_memo_id TEXT, cursor INTEGER NOT NULL DEFAULT 0, remote_revision INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'local_only' CHECK(status IN ('local_only','pending','bootstrapping','uploading','finalizing','synced','available_offline','downloading','online_required','waiting_for_wifi','quota_exceeded','conflict','access_removed','sync_failed','paused')),
          complete INTEGER NOT NULL DEFAULT 1, error TEXT, bootstrap_operation_id TEXT, updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS memo_sync_state_account ON memo_sync_state(account_id,replication,status);
        CREATE TABLE IF NOT EXISTS memo_sync_operations (
          operation_id TEXT PRIMARY KEY NOT NULL, memo_id TEXT NOT NULL REFERENCES memos(memo_id), account_id TEXT NOT NULL REFERENCES vault_identity(account_id),
          generation TEXT NOT NULL, entity_id TEXT NOT NULL, entity_type TEXT NOT NULL, base_revision INTEGER NOT NULL, predecessor_id TEXT,
          payload TEXT NOT NULL, frozen_payload TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('pending','uploading','acknowledged','conflict','failed','cancelled')),
          attempt INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER NOT NULL, remote_revision INTEGER, change_position INTEGER, error TEXT, created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS memo_sync_operations_due ON memo_sync_operations(memo_id,state,next_attempt_at,created_at);
        CREATE TABLE IF NOT EXISTS memo_sync_conflicts (
          conflict_id TEXT PRIMARY KEY NOT NULL, memo_id TEXT NOT NULL REFERENCES memos(memo_id), generation TEXT NOT NULL, entity_id TEXT NOT NULL,
          entity_type TEXT NOT NULL, local_operation_id TEXT NOT NULL REFERENCES memo_sync_operations(operation_id), remote_revision INTEGER NOT NULL,
          local_payload TEXT NOT NULL, remote_payload TEXT NOT NULL, created_at INTEGER NOT NULL, resolved_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS memo_sync_deletion_markers (
          memo_id TEXT NOT NULL REFERENCES memos(memo_id), generation TEXT NOT NULL, entity_id TEXT NOT NULL, entity_type TEXT NOT NULL,
          remote_revision INTEGER NOT NULL, change_position INTEGER NOT NULL, deleted_at INTEGER NOT NULL, PRIMARY KEY(memo_id,generation,entity_id,entity_type)
        );
        CREATE TABLE IF NOT EXISTS memo_sync_reminder_preferences (
          memo_id TEXT NOT NULL REFERENCES memos(memo_id), user_id TEXT NOT NULL, device_id TEXT NOT NULL, enabled INTEGER NOT NULL,
          sounds INTEGER NOT NULL, vibration INTEGER NOT NULL, timezone TEXT, updated_at INTEGER NOT NULL, PRIMARY KEY(memo_id,user_id,device_id)
        );
        PRAGMA user_version=6;`);
      await this.db.runAsync(`INSERT OR IGNORE INTO memo_sync_state(memo_id,account_id,generation,updated_at) SELECT memo_id,account_id,'00000000-0000-4000-8000-000000000000',? FROM memos WHERE account_id=?`, Date.now(), this.accountId);
    });
  }

  private async migrateNotes(): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.execAsync(`CREATE TABLE IF NOT EXISTS memo_notes (
        memo_id TEXT PRIMARY KEY NOT NULL REFERENCES memos(memo_id), item_id TEXT NOT NULL UNIQUE REFERENCES memo_items(item_id),
        title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS memo_note_revisions (
        revision_id TEXT PRIMARY KEY NOT NULL, memo_id TEXT NOT NULL REFERENCES memos(memo_id), revision INTEGER NOT NULL,
        title TEXT NOT NULL, description TEXT NOT NULL, body TEXT NOT NULL, named TEXT, created_at INTEGER NOT NULL, UNIQUE(memo_id,revision)
      );
      CREATE INDEX IF NOT EXISTS memo_note_revisions_lookup ON memo_note_revisions(memo_id,revision DESC);
      PRAGMA user_version=4;`);
    });
  }

  private async migrateV1(): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.execAsync(`
        ALTER TABLE memos ADD COLUMN deleted_at INTEGER;
        ALTER TABLE memos ADD COLUMN purge_after INTEGER;
        ALTER TABLE memos ADD COLUMN trash_mode TEXT NOT NULL DEFAULT 'manual' CHECK(trash_mode IN ('manual','retention'));
        ALTER TABLE memo_items ADD COLUMN kind TEXT NOT NULL DEFAULT 'text' CHECK(kind IN ('text','attachment'));
        ALTER TABLE memo_items ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
        ALTER TABLE memo_assets ADD COLUMN mime_type TEXT NOT NULL DEFAULT 'application/octet-stream';
        ALTER TABLE memo_assets ADD COLUMN detected_type TEXT NOT NULL DEFAULT 'file' CHECK(detected_type IN ('photo','video','voice','file'));
        ALTER TABLE memo_assets ADD COLUMN checksum TEXT;
        ALTER TABLE memo_assets ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE memo_assets ADD COLUMN trashed_at INTEGER;
        CREATE TABLE memo_asset_jobs (
          operation_id TEXT PRIMARY KEY NOT NULL, memo_id TEXT NOT NULL REFERENCES memos(memo_id),
          item_id TEXT NOT NULL UNIQUE, asset_id TEXT NOT NULL UNIQUE, original_name TEXT NOT NULL,
          mime_type TEXT NOT NULL, detected_type TEXT NOT NULL CHECK(detected_type IN ('photo','video','voice','file')),
          byte_size INTEGER NOT NULL CHECK(byte_size>=0), checksum TEXT, staging_path TEXT, final_path TEXT,
          created_at INTEGER NOT NULL, stage TEXT NOT NULL CHECK(stage IN ('prepared','staged','committed'))
        );
        CREATE TABLE memo_events (
          event_id TEXT PRIMARY KEY NOT NULL, memo_id TEXT NOT NULL,
          event_type TEXT NOT NULL CHECK(event_type IN ('trashed','restored','purged')), created_at INTEGER NOT NULL
        );
        CREATE INDEX memo_trash ON memos(account_id,deleted_at,purge_after);
        CREATE INDEX memo_asset_lookup ON memo_assets(memo_id,availability,trashed_at);
        CREATE TABLE memo_archive_jobs (
          operation_id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('export','import')), path TEXT NOT NULL,
          stage TEXT NOT NULL CHECK(stage IN ('prepared','running','complete','failed')), bytes INTEGER NOT NULL DEFAULT 0,
          error TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
        );
        PRAGMA user_version=2;
      `);
    });
  }

  private async migrateSearch(): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.execAsync(searchSchema);
      await this.db.execAsync('PRAGMA user_version=3');
    });
    await this.rebuildSearch();
  }

  private async migrateReminders(): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS memo_reminders (
          reminder_id TEXT PRIMARY KEY NOT NULL, memo_id TEXT NOT NULL REFERENCES memos(memo_id), owner_id TEXT NOT NULL REFERENCES vault_identity(account_id),
          mode TEXT NOT NULL CHECK(mode IN ('regular','alarm')), state TEXT NOT NULL CHECK(state IN ('building','ready','suspended','completed','cancelled')),
          target_set_state TEXT NOT NULL CHECK(target_set_state IN ('building','ready','cancelled')), schedule_kind TEXT NOT NULL CHECK(schedule_kind IN ('one_time','wall_clock')),
          trigger_at INTEGER, timezone TEXT NOT NULL, recurrence TEXT NOT NULL CHECK(recurrence IN ('none','daily','weekly','monthly')), hour INTEGER, minute INTEGER,
          weekday INTEGER, day_of_month INTEGER, schedule_revision INTEGER NOT NULL DEFAULT 1,
          desired_schedule_status TEXT NOT NULL CHECK(desired_schedule_status IN ('pending','scheduled','cancelled')) DEFAULT 'pending',
          actual_schedule_status TEXT NOT NULL CHECK(actual_schedule_status IN ('unknown','scheduled','cancelled','unavailable','failed')) DEFAULT 'unknown',
          os_schedule_id TEXT, next_occurrence_at INTEGER, snooze_until INTEGER, selected_count INTEGER NOT NULL DEFAULT 0, live_count INTEGER NOT NULL DEFAULT 0,
          unavailable_count INTEGER NOT NULL DEFAULT 0, last_delivery_status TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS memo_reminders_memo ON memo_reminders(memo_id,state,updated_at DESC);
        CREATE TABLE IF NOT EXISTS memo_reminder_targets (
          reminder_id TEXT NOT NULL REFERENCES memo_reminders(reminder_id), item_id TEXT NOT NULL, captured_revision INTEGER,
          state TEXT NOT NULL CHECK(state IN ('live','unavailable')), unavailable_reason TEXT, PRIMARY KEY(reminder_id,item_id)
        );
        CREATE TABLE IF NOT EXISTS memo_reminder_deliveries (
          occurrence_id TEXT PRIMARY KEY NOT NULL, reminder_id TEXT NOT NULL REFERENCES memo_reminders(reminder_id), occurrence_at INTEGER NOT NULL,
          schedule_revision INTEGER NOT NULL, os_schedule_id TEXT, status TEXT NOT NULL CHECK(status IN ('scheduled','presented','snoozed','completed','missed','cancelled','unavailable','failed')),
          presented_at INTEGER, completed_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS memo_share_jobs (
          operation_id TEXT PRIMARY KEY NOT NULL, fingerprint TEXT NOT NULL UNIQUE, memo_id TEXT NOT NULL REFERENCES memos(memo_id),
          stage TEXT NOT NULL CHECK(stage IN ('prepared','committed','failed')), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
        );
        PRAGMA user_version=5;`);
    });
  }

  private async ensureSearchReady(): Promise<void> {
    const state = await this.db.getFirstAsync<MemoSearchState>('SELECT status,indexed_items,total_items,last_error FROM memo_search_state WHERE account_id=?', this.accountId);
    if (!state) {
      await this.rebuildSearch();
      return;
    }
    if (state.status === 'rebuilding') await this.rebuildSearch();
  }

  private async uniqueTitle(title: string, memoId: string): Promise<string> {
    const rows = await this.db.getAllAsync<{ title: string }>('SELECT title FROM memos WHERE account_id=? AND memo_id<>?', this.accountId, memoId);
    const occupied = new Set(rows.map((row) => row.title.trim().toLowerCase()));
    const requested = title.trim();
    if (!occupied.has(requested.toLowerCase())) return requested;
    const base = requested.replace(/ \(\d+\)$/, '');
    for (let number = 2; ; number++) {
      const suffix = ` (${number})`;
      const candidate = [...base].slice(0, 128 - suffix.length).join('').trimEnd() + suffix;
      if (!occupied.has(candidate.toLowerCase())) return candidate;
    }
  }

  async create(memoId: string, now: number, title: string): Promise<Memo> {
    validateMemoId(memoId); validateMemoDetails(title, '');
    await this.db.withTransactionAsync(async () => {
      const uniqueTitle = await this.uniqueTitle(title, memoId);
      await this.db.runAsync('INSERT OR IGNORE INTO memos(memo_id,account_id,title,created_at,updated_at) VALUES (?,?,?,?,?)', memoId, this.accountId, uniqueTitle, now, now);
      await this.db.runAsync(`INSERT OR IGNORE INTO memo_sync_state(memo_id,account_id,generation,updated_at) VALUES (?,?,?,?)`, memoId, this.accountId, '00000000-0000-4000-8000-000000000000', now);
    });
    return this.get(memoId);
  }
  async get(memoId: string, includeTrash = false): Promise<Memo> {
    validateMemoId(memoId);
    const memo = await this.db.getFirstAsync<Memo>(`SELECT * FROM memos WHERE memo_id=? AND account_id=? ${includeTrash ? '' : 'AND deleted_at IS NULL'}`, memoId, this.accountId);
    if (!memo) throw new Error('This memo is unavailable for this account.');
    return memo;
  }
  list(): Promise<Memo[]> { return this.db.getAllAsync<Memo>(`SELECT m.*,CASE WHEN EXISTS(SELECT 1 FROM memo_protection_requirements p WHERE p.memo_id=m.memo_id AND p.required=1) THEN '' ELSE m.preview END AS preview FROM memos m WHERE account_id=? AND deleted_at IS NULL ORDER BY pinned DESC,updated_at DESC,memo_id`, this.accountId); }

  async importRemoteMemo(memoId: string, generation: string, title: string, description: string, now = Date.now(), protectionRequired = false): Promise<void> {
    validateMemoId(memoId); validateMemoId(generation); validateMemoDetails(title, description);
    await this.db.withTransactionAsync(async () => {
      const existing = await this.db.getFirstAsync<{ memo_id: string }>('SELECT memo_id FROM memos WHERE memo_id=?', memoId);
      if (existing) return; // A remote listing cannot replace local-only or unacknowledged work.
      await this.db.runAsync('INSERT INTO memos(memo_id,account_id,title,description,created_at,updated_at) VALUES (?,?,?,?,?,?)', memoId, this.accountId, title, description, now, now);
      await this.db.runAsync("INSERT INTO memo_sync_state(memo_id,account_id,replication,generation,remote_memo_id,status,complete,updated_at) VALUES (?,?,'synced',?,?,'downloading',0,?)", memoId, this.accountId, generation, memoId, now);
      await this.db.runAsync('INSERT INTO memo_protection_requirements(memo_id,required) VALUES (?,?)', memoId, Number(protectionRequired));
    });
  }

  async remoteState(memoId: string): Promise<MemoRemoteState> {
    validateMemoId(memoId);
    const row = await this.db.getFirstAsync<Omit<MemoRemoteState, 'complete'> & { complete: number }>('SELECT memo_id,replication,residency,generation,remote_memo_id,cursor,remote_revision,status,complete,error,updated_at FROM memo_sync_state WHERE memo_id=? AND account_id=?', memoId, this.accountId);
    if (!row) throw new Error('Memo sync state is unavailable.');
    // Older workers wrote account-wide cloud failures onto local-only memos.
    // Replication is authoritative, including when reading those saved states.
    if (row.replication === 'local') return { ...row, status: 'local_only', error: null, complete: true };
    return { ...row, complete: row.complete === 1 };
  }

  async configureSync(memoId: string, replication: MemoReplication, residency: MemoResidency, generation: string, operationId: string, now = Date.now()): Promise<MemoRemoteState> {
    validateMemoId(memoId); validateMemoId(generation); validateMemoId(operationId);
    if (replication !== 'local' && replication !== 'synced') throw new Error('Memo replication setting is invalid.');
    if (residency !== 'keep_all' && residency !== 'on_demand') throw new Error('Memo residency setting is invalid.');
    const memo = await this.get(memoId);
    const currentSync = await this.remoteState(memoId);
    if (currentSync.replication === 'synced') throw new Error('Close the existing remote copy before starting another generation.');
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(`INSERT OR IGNORE INTO memo_sync_state(memo_id,account_id,generation,updated_at) VALUES (?,?,?,?)`, memoId, this.accountId, generation, now);
      await this.db.runAsync(`UPDATE memo_sync_state SET replication=?,residency=?,generation=?,remote_memo_id=NULL,cursor=0,remote_revision=0,status=?,complete=?,error=NULL,bootstrap_operation_id=?,updated_at=? WHERE memo_id=? AND account_id=?`, replication, residency, generation, replication === 'synced' ? 'bootstrapping' : 'local_only', replication === 'synced' ? 0 : 1, replication === 'synced' ? operationId : null, now, memoId, this.accountId);
      if (replication === 'synced') {
        const payload = JSON.stringify({ title: memo.title, description: memo.description, residency, manifest_watermark: memo.revision, protection_required: await this.protectionRequired(memoId) });
        await this.db.runAsync(`INSERT OR IGNORE INTO memo_sync_operations(operation_id,memo_id,account_id,generation,entity_id,entity_type,base_revision,predecessor_id,payload,frozen_payload,state,next_attempt_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?, ?,?)`, operationId, memoId, this.accountId, generation, memoId, 'bootstrap', 0, null, payload, payload, 'pending', now, now);
        let predecessorId = operationId;
        let remoteRevision = 1;
        const items = await this.db.getAllAsync<{ item_id: string; text: string; created_at: number; kind: string; display_name: string }>("SELECT item_id,text,created_at,kind,display_name FROM memo_items WHERE memo_id=? AND display_name<>'__memo_note__' ORDER BY created_at,item_id", memoId);
        for (const item of items) {
          const itemOperationId = this.syncOperationId();
          const itemPayload = JSON.stringify({ text: item.text, created_at: item.created_at, kind: item.kind, display_name: item.display_name });
          await this.db.runAsync(`INSERT INTO memo_sync_operations(operation_id,memo_id,account_id,generation,entity_id,entity_type,base_revision,predecessor_id,payload,frozen_payload,state,next_attempt_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?, ?,?)`, itemOperationId, memoId, this.accountId, generation, item.item_id, 'item', remoteRevision, predecessorId, itemPayload, itemPayload, 'pending', now, now);
          predecessorId = itemOperationId; remoteRevision++;
        }
        const assets = await this.db.getAllAsync<{ asset_id: string; item_id: string; original_name: string; mime_type: string; byte_size: number; checksum: string | null }>('SELECT a.asset_id,ia.item_id,a.original_name,a.mime_type,a.byte_size,a.checksum FROM memo_assets a JOIN memo_item_assets ia ON ia.asset_id=a.asset_id WHERE a.memo_id=?', memoId);
        for (const asset of assets) {
          const assetOperationId = this.syncOperationId();
          const assetPayload = JSON.stringify({ asset_id: asset.asset_id, item_id: asset.item_id, original_name: asset.original_name, mime_type: asset.mime_type, byte_size: asset.byte_size, checksum: asset.checksum });
          await this.db.runAsync(`INSERT INTO memo_sync_operations(operation_id,memo_id,account_id,generation,entity_id,entity_type,base_revision,predecessor_id,payload,frozen_payload,state,next_attempt_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?, ?,?)`, assetOperationId, memoId, this.accountId, generation, asset.asset_id, 'asset', remoteRevision, predecessorId, assetPayload, assetPayload, 'pending', now, now);
          predecessorId = assetOperationId; remoteRevision++;
        }
        const notes = await this.db.getAllAsync<{ item_id: string; title: string; description: string; body: string }>('SELECT item_id,title,description,body FROM memo_notes WHERE memo_id=? ORDER BY item_id', memoId);
        for (const note of notes) {
          const retained = await this.db.getAllAsync<MemoNoteRevision>('SELECT * FROM memo_note_revisions WHERE memo_id=? ORDER BY revision', memoId);
          const versions = retained.length ? retained : [{ ...note, named: null }];
          for (const version of versions) {
            const noteOperationId = this.syncOperationId();
            const notePayload = JSON.stringify({ title: version.title, description: version.description, body: version.body, named: version.named, local_revision_id: 'revision_id' in version ? version.revision_id : noteOperationId });
            await this.db.runAsync(`INSERT INTO memo_sync_operations(operation_id,memo_id,account_id,generation,entity_id,entity_type,base_revision,predecessor_id,payload,frozen_payload,state,next_attempt_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?, ?,?)`, noteOperationId, memoId, this.accountId, generation, note.item_id, 'note', remoteRevision, predecessorId, notePayload, notePayload, 'pending', now, now);
            predecessorId = noteOperationId; remoteRevision++;
          }
        }
        const reminders = await this.db.getAllAsync<{ reminder_id: string }>('SELECT reminder_id FROM memo_reminders WHERE memo_id=?', memoId);
        for (const reminder of reminders) await this.queueReminderSync(reminder.reminder_id, this.syncOperationId(), now);
        await this.queueOrganizationSync(memoId, now, true);
      } else {
        await this.db.runAsync("UPDATE memo_sync_operations SET state='cancelled',error='Sync disabled by owner' WHERE memo_id=? AND state IN ('pending','uploading','failed','conflict')", memoId);
      }
    });
    return this.remoteState(memoId);
  }

  async setRemoteStatus(memoId: string, status: MemoRemoteStatus, error: string | null = null, complete?: boolean, now = Date.now()): Promise<void> {
    await this.remoteState(memoId);
    await this.db.runAsync("UPDATE memo_sync_state SET status=CASE WHEN replication='local' THEN 'local_only' ELSE ? END,error=CASE WHEN replication='local' THEN NULL ELSE ? END,complete=CASE WHEN replication='local' THEN 1 ELSE COALESCE(?,complete) END,updated_at=? WHERE memo_id=? AND account_id=?", status, error, complete === undefined ? null : Number(complete), now, memoId, this.accountId);
  }

  async setRemoteMemoId(memoId: string, remoteMemoId: string, now = Date.now()): Promise<void> {
    await this.remoteState(memoId); validateMemoId(remoteMemoId);
    await this.db.runAsync('UPDATE memo_sync_state SET remote_memo_id=?,updated_at=? WHERE memo_id=? AND account_id=?', remoteMemoId, now, memoId, this.accountId);
  }

  async pendingSyncOperations(memoId: string, now = Date.now(), limit = 20): Promise<MemoSyncOperation[]> {
    await this.remoteState(memoId);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Memo sync batch size is invalid.');
    const rows = await this.db.getAllAsync<Record<string, unknown>>(`SELECT * FROM memo_sync_operations o WHERE o.memo_id=? AND o.account_id=? AND o.state IN ('pending','failed') AND o.next_attempt_at<=?
      AND (o.predecessor_id IS NULL OR EXISTS (SELECT 1 FROM memo_sync_operations p WHERE p.operation_id=o.predecessor_id AND p.state='acknowledged'))
      ORDER BY o.created_at,o.operation_id LIMIT ${limit}`, memoId, this.accountId, now);
    return rows.map((row) => this.syncOperation(row));
  }

  async markSyncOperationUploading(operationId: string, now = Date.now()): Promise<MemoSyncOperation> {
    validateMemoId(operationId);
    await this.db.runAsync("UPDATE memo_sync_operations SET base_revision=CASE WHEN attempt=0 AND predecessor_id IS NOT NULL THEN COALESCE((SELECT p.remote_revision FROM memo_sync_operations p WHERE p.operation_id=memo_sync_operations.predecessor_id AND p.state='acknowledged'),base_revision) ELSE base_revision END,state='uploading',attempt=attempt+1,next_attempt_at=?,error=NULL WHERE operation_id=? AND account_id=? AND state IN ('pending','failed')", now, operationId, this.accountId);
    const row = await this.db.getFirstAsync<Record<string, unknown>>('SELECT * FROM memo_sync_operations WHERE operation_id=? AND account_id=?', operationId, this.accountId);
    if (!row) throw new Error('Memo sync operation is unavailable.');
    return this.syncOperation(row);
  }

  async acknowledgeSyncOperation(operationId: string, remoteRevision: number, changePosition: number, now = Date.now()): Promise<void> {
    validateMemoId(operationId);
    if (!Number.isSafeInteger(remoteRevision) || remoteRevision < 1 || !Number.isSafeInteger(changePosition) || changePosition < 0) throw new Error('Memo sync acknowledgment is invalid.');
    await this.db.withTransactionAsync(async () => {
      const operation = await this.db.getFirstAsync<{ memo_id: string; generation: string }>('SELECT memo_id,generation FROM memo_sync_operations WHERE operation_id=? AND account_id=?', operationId, this.accountId);
      if (!operation) throw new Error('Memo sync operation is unavailable.');
      await this.db.runAsync("UPDATE memo_sync_operations SET state='acknowledged',remote_revision=?,change_position=?,error=NULL WHERE operation_id=? AND account_id=?", remoteRevision, changePosition, operationId, this.accountId);
      // An upload receipt is not a read cursor: other devices may have committed
      // changes before this operation which this device has never downloaded.
      await this.db.runAsync(`UPDATE memo_sync_state SET remote_revision=MAX(remote_revision,?),status=CASE WHEN EXISTS(SELECT 1 FROM memo_sync_conflicts c WHERE c.memo_id=memo_sync_state.memo_id AND c.resolved_at IS NULL) THEN 'conflict' WHEN EXISTS(SELECT 1 FROM memo_sync_operations WHERE memo_id=? AND state IN ('pending','uploading','failed')) THEN 'pending' ELSE 'synced' END,error=NULL,updated_at=? WHERE memo_id=? AND generation=? AND account_id=?`, remoteRevision, operation.memo_id, now, operation.memo_id, operation.generation, this.accountId);
    });
  }

  async failSyncOperation(operationId: string, error: string, nextAttemptAt: number | null, terminal = false, now = Date.now()): Promise<void> {
    validateMemoId(operationId);
    if (!error.trim() || error.length > 500) throw new Error('Memo sync failure is invalid.');
    await this.db.runAsync(`UPDATE memo_sync_operations SET state=?,error=?,next_attempt_at=? WHERE operation_id=? AND account_id=?`, terminal ? 'failed' : 'pending', error, nextAttemptAt ?? Number.MAX_SAFE_INTEGER, operationId, this.accountId);
    const op = await this.db.getFirstAsync<{ memo_id: string }>('SELECT memo_id FROM memo_sync_operations WHERE operation_id=? AND account_id=?', operationId, this.accountId);
    if (op) await this.setRemoteStatus(op.memo_id, terminal ? 'sync_failed' : 'pending', error, false, now);
  }

  async applyRemoteSyncChange(change: MemoSyncChange, now = Date.now(), snapshot = false): Promise<void> {
    validateMemoId(change.memo_id); validateMemoId(change.operation_id); validateMemoId(change.entity_id); validateMemoId(change.generation);
    if (!Number.isSafeInteger(change.change_position) || change.change_position < 1 || !Number.isSafeInteger(change.revision) || change.revision < 1 || typeof change.deleted !== 'boolean' || !change.payload || typeof change.payload !== 'object' || Array.isArray(change.payload)) throw new Error('Memo sync change is invalid.');
    const state = await this.remoteState(change.memo_id);
    if (state.generation !== change.generation || change.change_position <= state.cursor) return;
    if (!snapshot && change.change_position !== state.cursor + 1) throw new Error('Memo sync snapshot required: change log has a gap.');
    await this.db.withTransactionAsync(async () => {
      const own = await this.db.getFirstAsync<{ operation_id: string }>('SELECT operation_id FROM memo_sync_operations WHERE operation_id=? AND memo_id=? AND generation=? AND account_id=?', change.operation_id, change.memo_id, change.generation, this.accountId);
      const pending = own ? null : await this.db.getFirstAsync<{ operation_id: string; payload: string }>(`SELECT operation_id,payload FROM memo_sync_operations WHERE memo_id=? AND generation=? AND entity_id=? AND entity_type=? AND state IN ('pending','uploading','failed','conflict') AND operation_id<>? ORDER BY created_at LIMIT 1`, change.memo_id, change.generation, change.entity_id, change.entity_type, change.operation_id);
      if (pending) {
        const conflictId = `${pending.operation_id}:${change.change_position}`;
        await this.db.runAsync(`INSERT OR IGNORE INTO memo_sync_conflicts(conflict_id,memo_id,generation,entity_id,entity_type,local_operation_id,remote_revision,local_payload,remote_payload,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`, conflictId, change.memo_id, change.generation, change.entity_id, change.entity_type, pending.operation_id, change.revision, pending.payload, JSON.stringify(change.payload), now);
        await this.db.runAsync("UPDATE memo_sync_operations SET state='conflict',error='Remote edit requires review' WHERE operation_id=?", pending.operation_id);
        await this.db.runAsync("UPDATE memo_sync_state SET status='conflict',complete=0,updated_at=? WHERE memo_id=?", now, change.memo_id);
      }
      if (!pending && !own) await this.materializeRemoteChange(change, now);
      if (change.deleted) await this.db.runAsync(`INSERT OR REPLACE INTO memo_sync_deletion_markers(memo_id,generation,entity_id,entity_type,remote_revision,change_position,deleted_at) VALUES (?,?,?,?,?,?,?)`, change.memo_id, change.generation, change.entity_id, change.entity_type, change.revision, change.change_position, now);
      await this.db.runAsync('UPDATE memo_sync_state SET cursor=MAX(cursor,?),remote_revision=MAX(remote_revision,?),updated_at=? WHERE memo_id=?', snapshot ? state.cursor : change.change_position, change.revision, now, change.memo_id);
    });
  }

  async finishSyncSnapshot(memoId: string, generation: string, watermark: number, now = Date.now()): Promise<void> {
    const state = await this.remoteState(memoId);
    if (state.generation !== generation || !Number.isSafeInteger(watermark) || watermark < state.cursor) throw new Error('Memo sync snapshot is stale.');
    await this.db.runAsync('UPDATE memo_sync_state SET cursor=?,updated_at=? WHERE memo_id=? AND generation=? AND account_id=?', watermark, now, memoId, generation, this.accountId);
  }

  async recordDownloadedAsset(assetId: string, opaquePath: string): Promise<void> {
    const asset = await this.asset(assetId);
    if (!opaquePath.startsWith('file:///')) throw new Error('Downloaded attachment path is invalid.');
    await this.db.runAsync("UPDATE memo_assets SET opaque_path=?,availability='verified' WHERE asset_id=? AND memo_id=?", opaquePath, assetId, asset.memo_id);
  }

  private async materializeRemoteChange(change: MemoSyncChange, now: number): Promise<void> {
    const { memo_id: memoId, entity_id: itemId, payload } = change;
    const text = (key: string): string => {
      const value = payload[key];
      if (typeof value !== 'string') throw new Error('Memo sync content is invalid.');
      return value;
    };
    const existing = await this.db.getFirstAsync<{ memo_id: string }>('SELECT memo_id FROM memo_items WHERE item_id=?', itemId);
    if (existing && existing.memo_id !== memoId) throw new Error('Foreign memo item in sync response.');
    if (change.entity_type === 'memo') {
      const title = text('title'); const description = text('description');
      validateMemoDetails(title, description);
      if (payload.protection_required !== undefined) {
        if (typeof payload.protection_required !== 'boolean') throw new Error('Memo protection requirement is invalid.');
        await this.db.runAsync('INSERT INTO memo_protection_requirements(memo_id,required) VALUES (?,?) ON CONFLICT(memo_id) DO UPDATE SET required=excluded.required', memoId, Number(payload.protection_required));
      }
      await this.db.runAsync('UPDATE memos SET title=?,description=?,updated_at=? WHERE memo_id=? AND account_id=?', title, description, now, memoId, this.accountId);
      const items = await this.db.getAllAsync<{ item_id: string }>('SELECT item_id FROM memo_items WHERE memo_id=?', memoId);
      for (const item of items) await this.reindexItem(item.item_id);
      return;
    }
    if (change.entity_type === 'asset') {
      const assetId = validateMemoId(text('asset_id'));
      const name = text('original_name'); const mime = text('mime_type');
      const size = payload.byte_size; const checksum = payload.checksum;
      if (!Number.isSafeInteger(size) || typeof size !== 'number' || size < 0 || size > 50 * 1024 * 1024 || name.length > 255 || (checksum !== null && typeof checksum !== 'string')) throw new Error('Memo asset metadata is invalid.');
      const asset = await this.db.getFirstAsync<{ memo_id: string }>('SELECT memo_id FROM memo_assets WHERE asset_id=?', assetId);
      if (asset && asset.memo_id !== memoId) throw new Error('Foreign memo asset in sync response.');
      const targetId = typeof payload.item_id === 'string' ? validateMemoId(payload.item_id) : itemId;
      const target = await this.db.getFirstAsync<{ memo_id: string }>('SELECT memo_id FROM memo_items WHERE item_id=?', targetId);
      if (target && target.memo_id !== memoId) throw new Error('Foreign memo attachment in sync response.');
      const detected = mime.startsWith('image/') ? 'photo' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'voice' : 'file';
      await this.db.runAsync(`INSERT OR IGNORE INTO memo_assets(asset_id,memo_id,opaque_path,original_name,mime_type,detected_type,byte_size,checksum,created_at,availability) VALUES (?,?,?,?,?,?,?,?,?,'repair')`, assetId, memoId, `remote:${assetId}`, name, mime, detected, size, checksum, now);
      await this.db.runAsync(`INSERT INTO memo_items(item_id,memo_id,author_id,text,created_at,revision,operation_id,kind,display_name) VALUES (?,?,?,?,?,?,?,'attachment',?) ON CONFLICT(item_id) DO UPDATE SET display_name=excluded.display_name,kind='attachment'`, targetId, memoId, this.accountId, '', typeof payload.created_at === 'number' ? payload.created_at : now, change.revision, change.operation_id, name);
      await this.db.runAsync('INSERT OR IGNORE INTO memo_item_assets(item_id,asset_id) VALUES (?,?)', targetId, assetId);
      await this.reindexItem(targetId);
      return;
    }
    if (change.entity_type === 'item' || change.entity_type === 'note') {
      if (change.deleted) throw new Error('Memo item deletion requires a compatible sync adapter.');
      const isNote = change.entity_type === 'note';
      const body = text(isNote ? 'body' : 'text');
      const title = isNote ? text('title') : '';
      const description = isNote ? text('description') : '';
      if (isNote) validateMemoNote(title, description, body); else if (payload.kind !== 'attachment') validateMemoText(body);
      const createdAt = payload.created_at ?? now;
      if (typeof createdAt !== 'number' || !Number.isSafeInteger(createdAt) || createdAt <= 0) throw new Error('Memo sync creation time is invalid.');
      if (!isNote && payload.kind !== undefined && payload.kind !== 'text' && payload.kind !== 'attachment') throw new Error('Memo item kind is invalid.');
      await this.db.runAsync(`INSERT INTO memo_items(item_id,memo_id,author_id,text,created_at,revision,operation_id,kind,display_name) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(item_id) DO UPDATE SET text=excluded.text,revision=excluded.revision`, itemId, memoId, this.accountId, body, createdAt, change.revision, change.operation_id, payload.kind === 'attachment' ? 'attachment' : 'text', isNote ? '__memo_note__' : typeof payload.display_name === 'string' ? payload.display_name : '');
      if (isNote) {
        const note = await this.note(memoId);
        if (note && note.item_id !== itemId) throw new Error('Remote note identity differs from the local note.');
        const named = payload.named ?? null;
        if (named !== null && typeof named !== 'string') throw new Error('Memo revision name is invalid.');
        await this.db.runAsync(`INSERT INTO memo_notes(memo_id,item_id,title,description,body,revision,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(memo_id) DO UPDATE SET title=excluded.title,description=excluded.description,body=excluded.body,revision=excluded.revision,updated_at=excluded.updated_at`, memoId, itemId, title, description, body, change.revision, now);
        await this.db.runAsync('INSERT OR IGNORE INTO memo_note_revisions(revision_id,memo_id,revision,title,description,body,named,created_at) VALUES (?,?,?,?,?,?,?,?)', change.operation_id, memoId, change.revision, title, description, body, named, now);
      }
      await this.db.runAsync('UPDATE memos SET preview=?,updated_at=? WHERE memo_id=?', [...body].slice(0, 200).join(''), now, memoId);
      await this.reindexItem(itemId);
      await this.updateSearchCounts();
      return;
    }
    if (change.entity_type === 'trash') {
      if (typeof payload.deleted !== 'boolean') throw new Error('Memo trash state is invalid.');
      await this.db.runAsync('UPDATE memos SET deleted_at=?,updated_at=? WHERE memo_id=? AND account_id=?', payload.deleted ? now : null, now, memoId, this.accountId);
      if (payload.deleted) await this.db.runAsync("UPDATE memo_reminders SET state='suspended',desired_schedule_status='cancelled' WHERE memo_id=? AND state='ready'", memoId);
      return;
    }
    if (change.entity_type === 'preference' && payload.kind === 'organization') {
      const rows = (key: string): Record<string, unknown>[] => {
        const value = payload[key];
        if (!Array.isArray(value) || value.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('Memo organization content is invalid.');
        return value as Record<string, unknown>[];
      };
      const id = (row: Record<string, unknown>, key: string) => {
        const value = row[key]; if (typeof value !== 'string') throw new Error('Memo organization identity is invalid.'); return validateMemoId(value);
      };
      const tags = rows('tags'); const associations = rows('associations'); const pins = rows('pins'); const folders = rows('folders');
      for (const key of ['pinned', 'archived', 'ignored', 'unread']) if (payload[key] !== 0 && payload[key] !== 1 && typeof payload[key] !== 'boolean') throw new Error('Memo preference is invalid.');
      if (payload.muted_until !== null && (typeof payload.muted_until !== 'string' || !Number.isFinite(Date.parse(payload.muted_until)))) throw new Error('Memo mute preference is invalid.');
      await this.db.runAsync('DELETE FROM memo_item_tags WHERE tag_id IN (SELECT tag_id FROM memo_tags WHERE memo_id=?)', memoId);
      await this.db.runAsync('DELETE FROM memo_tags WHERE memo_id=?', memoId);
      for (const tag of tags) {
        const tagId = id(tag, 'tag_id');
        if (typeof tag.display_name !== 'string') throw new Error('Memo tag name is invalid.');
        const name = validateMemoTagName(tag.display_name);
        await this.db.runAsync('INSERT INTO memo_tags(tag_id,memo_id,display_name,normalized_name,created_at,updated_at) VALUES (?,?,?,?,?,?)', tagId, memoId, name.display_name, name.normalized_name, now, now);
      }
      const verifyItem = async (item: string) => {
        if (!await this.db.getFirstAsync('SELECT item_id FROM memo_items WHERE memo_id=? AND item_id=?', memoId, item)) throw new Error('Memo organization references unavailable content.');
      };
      for (const association of associations) {
        const item = id(association, 'item_id'); const tag = id(association, 'tag_id'); await verifyItem(item);
        if (!tags.some((row) => row.tag_id === tag)) throw new Error('Foreign memo tag association.');
        await this.db.runAsync('INSERT INTO memo_item_tags(item_id,tag_id) VALUES (?,?)', item, tag);
      }
      await this.db.runAsync('DELETE FROM memo_pins WHERE memo_id=? AND user_id=?', memoId, this.accountId);
      for (const pin of pins) {
        const item = id(pin, 'item_id'); await verifyItem(item);
        if ((pin.visibility !== 'personal' && pin.visibility !== 'shared') || typeof pin.position !== 'number' || !Number.isSafeInteger(pin.position) || pin.position < 0) throw new Error('Memo pin is invalid.');
        await this.db.runAsync('INSERT INTO memo_pins(memo_id,item_id,user_id,visibility,position,created_at) VALUES (?,?,?,?,?,?)', memoId, item, this.accountId, pin.visibility, pin.position, now);
      }
      await this.db.runAsync('DELETE FROM memo_folder_links WHERE memo_id=?', memoId);
      for (const folder of folders) await this.db.runAsync('INSERT INTO memo_folder_links(memo_id,folder_id) VALUES (?,?)', memoId, id(folder, 'folder_id'));
      await this.db.runAsync('UPDATE memos SET pinned=?,archived=?,ignored=?,unread=?,muted_until=? WHERE memo_id=?', Number(payload.pinned), Number(payload.archived), Number(payload.ignored), Number(payload.unread), payload.muted_until as string | null, memoId);
      const items = await this.db.getAllAsync<{ item_id: string }>('SELECT item_id FROM memo_items WHERE memo_id=?', memoId);
      for (const item of items) await this.reindexItem(item.item_id);
      return;
    }
    if (change.entity_type === 'reminder') {
      if (!payload.schedule || typeof payload.schedule !== 'object' || Array.isArray(payload.schedule) || !Array.isArray(payload.item_ids) || payload.item_ids.some((id) => typeof id !== 'string')) throw new Error('Memo reminder sync content is invalid.');
      const schedule = payload.schedule as MemoReminderSchedule;
      validateMemoReminderSchedule(schedule);
      const values = this.reminderScheduleValues(schedule);
      const ids = uniqueIds(payload.item_ids as string[]);
      ids.forEach(validateMemoId);
      const mode = payload.mode; const reminderState = payload.state;
      const at = payload.next_occurrence_at;
      const revision = payload.schedule_revision;
      if ((mode !== 'regular' && mode !== 'alarm') || (reminderState !== 'ready' && reminderState !== 'suspended' && reminderState !== 'completed' && reminderState !== 'cancelled') || payload.target_set_state !== 'ready' && payload.target_set_state !== 'cancelled' || typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 1 || at !== null && (typeof at !== 'number' || !Number.isSafeInteger(at))) throw new Error('Memo reminder state is invalid.');
      const current = await this.db.getFirstAsync<{ memo_id: string }>('SELECT memo_id FROM memo_reminders WHERE reminder_id=?', itemId);
      if (current && current.memo_id !== memoId) throw new Error('Foreign memo reminder in sync response.');
      await this.db.runAsync(`INSERT INTO memo_reminders(reminder_id,memo_id,owner_id,mode,state,target_set_state,schedule_kind,trigger_at,timezone,recurrence,hour,minute,weekday,day_of_month,schedule_revision,desired_schedule_status,actual_schedule_status,next_occurrence_at,selected_count,live_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending','unknown',?,?,0,?,?) ON CONFLICT(reminder_id) DO UPDATE SET mode=excluded.mode,state=excluded.state,target_set_state=excluded.target_set_state,schedule_kind=excluded.schedule_kind,trigger_at=excluded.trigger_at,timezone=excluded.timezone,recurrence=excluded.recurrence,hour=excluded.hour,minute=excluded.minute,weekday=excluded.weekday,day_of_month=excluded.day_of_month,schedule_revision=excluded.schedule_revision,desired_schedule_status='pending',actual_schedule_status='unknown',next_occurrence_at=excluded.next_occurrence_at,updated_at=excluded.updated_at`, itemId, memoId, this.accountId, mode, reminderState, payload.target_set_state, ...values, revision, at, ids.length, now, now);
      await this.db.runAsync('DELETE FROM memo_reminder_targets WHERE reminder_id=?', itemId);
      let live = 0;
      for (const id of ids) {
        const target = await this.db.getFirstAsync<{ revision: number }>('SELECT revision FROM memo_items WHERE memo_id=? AND item_id=?', memoId, id);
        if (target) live++;
        await this.db.runAsync('INSERT INTO memo_reminder_targets(reminder_id,item_id,captured_revision,state,unavailable_reason) VALUES (?,?,?,?,?)', itemId, id, target?.revision ?? null, target ? 'live' : 'unavailable', target ? null : 'missing');
      }
      await this.db.runAsync('UPDATE memo_reminders SET live_count=?,unavailable_count=? WHERE reminder_id=?', live, ids.length - live, itemId);
      return;
    }
    // Never advance the read cursor past content this build did not apply.
    throw new Error('Memo sync content requires an updated adapter.');
  }

  syncConflicts(memoId: string): Promise<MemoSyncConflict[]> {
    validateMemoId(memoId);
    return this.db.getAllAsync<Record<string, unknown>>('SELECT * FROM memo_sync_conflicts WHERE memo_id=? AND resolved_at IS NULL ORDER BY created_at DESC', memoId).then((rows) => rows.map((row) => ({
      conflict_id: String(row.conflict_id), memo_id: String(row.memo_id), generation: String(row.generation), entity_id: String(row.entity_id), entity_type: String(row.entity_type) as MemoSyncConflict['entity_type'], local_operation_id: String(row.local_operation_id), remote_revision: Number(row.remote_revision), local_payload: JSON.parse(String(row.local_payload)) as Record<string, unknown>, remote_payload: JSON.parse(String(row.remote_payload)) as Record<string, unknown>, created_at: Number(row.created_at),
    })));
  }

  async resolveSyncConflict(memoId: string, conflictId: string, choice: 'local' | 'remote', now = Date.now()): Promise<void> {
    await this.get(memoId);
    if (choice !== 'local' && choice !== 'remote') throw new Error('Choose which memo version to keep.');
    await this.db.withTransactionAsync(async () => {
      const state = await this.remoteState(memoId);
      const conflicts = await this.syncConflicts(memoId);
      const conflict = conflicts.find((entry) => entry.conflict_id === conflictId);
      if (!conflict || conflict.generation !== state.generation) throw new Error('This conflict is no longer available.');
      const operations = await this.db.getAllAsync<Record<string, unknown>>("SELECT * FROM memo_sync_operations WHERE memo_id=? AND generation=? AND state IN ('pending','failed','conflict') ORDER BY rowid", memoId, state.generation);
      if (await this.db.getFirstAsync("SELECT operation_id FROM memo_sync_operations WHERE memo_id=? AND state='uploading'", memoId)) throw new Error('Wait for the active upload before resolving this conflict.');
      // Keep original immutable envelopes for recovery and allocate fresh IDs for
      // the explicitly rebased chain. Never rewrite a possibly submitted request.
      let predecessor: string | null = null;
      let revision = state.remote_revision;
      for (const row of operations) {
        const operation = this.syncOperation(row);
        const unreviewed = conflicts.some((entry) => entry.entity_id !== conflict.entity_id && entry.entity_id === operation.entity_id && entry.entity_type === operation.entity_type);
        if (unreviewed) {
          predecessor = operation.operation_id;
          revision = operation.base_revision + 1;
          continue;
        }
        await this.db.runAsync("UPDATE memo_sync_operations SET state='cancelled',error='Replaced after explicit conflict review' WHERE operation_id=?", operation.operation_id);
        if (choice === 'remote' && operation.entity_id === conflict.entity_id && operation.entity_type === conflict.entity_type) continue;
        if (operation.entity_type === 'bootstrap' || operation.entity_type === 'close_remote') throw new Error('Restart the cloud transition after reviewing this conflict.');
        const replacementId = this.syncOperationId();
        await this.db.runAsync(`INSERT INTO memo_sync_operations(operation_id,memo_id,account_id,generation,entity_id,entity_type,base_revision,predecessor_id,payload,frozen_payload,state,next_attempt_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,'pending',?,?)`, replacementId, memoId, this.accountId, state.generation, operation.entity_id, operation.entity_type, revision, predecessor, operation.frozen_payload, operation.frozen_payload, now, now);
        predecessor = replacementId; revision++;
      }
      if (choice === 'remote') await this.materializeRemoteChange({ memo_id: memoId, generation: state.generation, entity_id: conflict.entity_id, entity_type: conflict.entity_type, operation_id: this.syncOperationId(), change_position: state.cursor, revision: conflict.remote_revision, payload: conflict.remote_payload, deleted: false }, now);
      await this.db.runAsync('UPDATE memo_sync_conflicts SET resolved_at=? WHERE memo_id=? AND entity_id=? AND entity_type=?', now, memoId, conflict.entity_id, conflict.entity_type);
      await this.db.runAsync("UPDATE memo_sync_state SET status=CASE WHEN EXISTS(SELECT 1 FROM memo_sync_conflicts c WHERE c.memo_id=memo_sync_state.memo_id AND c.resolved_at IS NULL) THEN 'conflict' ELSE 'pending' END,error=NULL,complete=0 WHERE memo_id=?", memoId);
    });
  }

  async closeRemoteCopy(memoId: string, newGeneration: string, operationId: string, now = Date.now()): Promise<void> {
    validateMemoId(memoId); validateMemoId(newGeneration); validateMemoId(operationId);
    await this.get(memoId);
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync("UPDATE memo_sync_operations SET state='cancelled',error='Remote generation closed' WHERE memo_id=? AND state NOT IN ('acknowledged','cancelled')", memoId);
      await this.db.runAsync(`UPDATE memo_sync_state SET replication='local',generation=?,remote_memo_id=NULL,cursor=0,remote_revision=0,status='local_only',complete=1,error=NULL,bootstrap_operation_id=NULL,updated_at=? WHERE memo_id=? AND account_id=?`, newGeneration, now, memoId, this.accountId);
      await this.db.runAsync('INSERT OR IGNORE INTO memo_sync_deletion_markers(memo_id,generation,entity_id,entity_type,remote_revision,change_position,deleted_at) VALUES (?,?,?,?,?,?,?)', memoId, newGeneration, memoId, 'close_remote', 0, 0, now);
    });
  }

  async requestRemoteRemoval(memoId: string, operationId: string, newGeneration: string, now = Date.now()): Promise<void> {
    await this.get(memoId); validateMemoId(operationId); validateMemoId(newGeneration);
    await this.db.withTransactionAsync(async () => {
      const state = await this.remoteState(memoId);
      const pending = await this.db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM memo_sync_operations WHERE memo_id=? AND generation=? AND state NOT IN ('acknowledged','cancelled')", memoId, state.generation);
      if (state.replication !== 'synced' || !state.complete || Number(pending?.count ?? 0)>0) throw new Error('Finish synchronization and conflict review before removing the cloud copy.');
      const assets = await this.assets(memoId, true);
      if (assets.some((asset) => asset.availability !== 'verified')) throw new Error('Download every original before removing the cloud copy.');
      await this.queueSyncOperation(memoId, operationId, memoId, 'close_remote', { expected_revision: state.remote_revision, complete_local_copy: true, new_generation: newGeneration }, now);
      await this.db.runAsync("UPDATE memo_sync_state SET status='paused',complete=0 WHERE memo_id=?", memoId);
    });
  }

  async retrySync(memoId: string): Promise<void> {
    const state = await this.remoteState(memoId);
    await this.db.runAsync("UPDATE memo_sync_operations SET state='pending',attempt=0,next_attempt_at=?,error=NULL WHERE memo_id=? AND generation=? AND state='failed'", Date.now(), memoId, state.generation);
  }
  async protectionRequired(memoId: string): Promise<boolean> {
    validateMemoId(memoId);
    const row = await this.db.getFirstAsync<{ required: number }>('SELECT required FROM memo_protection_requirements WHERE memo_id=?', memoId);
    return row?.required === 1;
  }
  async setProtectionRequired(memoId: string, required: boolean, now = Date.now()): Promise<void> {
    const memo = await this.get(memoId);
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('INSERT INTO memo_protection_requirements(memo_id,required) VALUES (?,?) ON CONFLICT(memo_id) DO UPDATE SET required=excluded.required', memoId, Number(required));
      await this.queueSyncOperation(memoId, this.syncOperationId(), memoId, 'memo', { title: memo.title, description: memo.description, protection_required: required }, now);
    });
  }
  async nextSyncAttempt(): Promise<number | null> {
    const row = await this.db.getFirstAsync<{ due: number | null }>(`SELECT MIN(o.next_attempt_at) AS due FROM memo_sync_operations o JOIN memo_sync_state s ON s.memo_id=o.memo_id AND s.generation=o.generation WHERE s.replication='synced' AND o.account_id=? AND o.state IN ('pending','failed') AND o.attempt<5 AND o.next_attempt_at<? AND (o.predecessor_id IS NULL OR EXISTS(SELECT 1 FROM memo_sync_operations p WHERE p.operation_id=o.predecessor_id AND p.state='acknowledged'))`, this.accountId, Number.MAX_SAFE_INTEGER);
    return row?.due ?? null;
  }

  async setSyncResidency(memoId: string, residency: MemoResidency): Promise<void> {
    if (residency !== 'keep_all' && residency !== 'on_demand') throw new Error('Memo residency is invalid.');
    const state = await this.remoteState(memoId);
    if (state.replication !== 'synced') throw new Error('Enable synchronization before changing attachment storage.');
    await this.db.runAsync('UPDATE memo_sync_state SET residency=?,complete=0 WHERE memo_id=? AND account_id=?', residency, memoId, this.accountId);
  }

  async setReminderSyncPreferences(memoId: string, userId: string, deviceId: string, enabled: boolean, sounds: boolean, vibration: boolean, timezone: string | null, now = Date.now()): Promise<void> {
    await this.get(memoId); validateMemoId(userId); validateMemoId(deviceId);
    await this.db.runAsync('INSERT INTO memo_sync_reminder_preferences(memo_id,user_id,device_id,enabled,sounds,vibration,timezone,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(memo_id,user_id,device_id) DO UPDATE SET enabled=excluded.enabled,sounds=excluded.sounds,vibration=excluded.vibration,timezone=excluded.timezone,updated_at=excluded.updated_at', memoId, userId, deviceId, Number(enabled), Number(sounds), Number(vibration), timezone, now);
  }
  listTrash(): Promise<Memo[]> { return this.db.getAllAsync<Memo>(`SELECT m.*,CASE WHEN EXISTS(SELECT 1 FROM memo_protection_requirements p WHERE p.memo_id=m.memo_id AND p.required=1) THEN '' ELSE m.preview END AS preview FROM memos m WHERE account_id=? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC,memo_id`, this.accountId); }
  async listFiltered(filter: MemoSearchFilter): Promise<Memo[]> {
    const condition = memoFilterSql[filter];
    return this.db.getAllAsync<Memo>(`SELECT DISTINCT m.*,CASE WHEN EXISTS(SELECT 1 FROM memo_protection_requirements p WHERE p.memo_id=m.memo_id AND p.required=1) THEN '' ELSE m.preview END AS preview FROM memos m JOIN memo_items i ON i.memo_id=m.memo_id
      LEFT JOIN memo_item_assets ia ON ia.item_id=i.item_id LEFT JOIN memo_assets a ON a.asset_id=ia.asset_id AND a.availability='verified' AND a.trashed_at IS NULL
      WHERE m.account_id=? AND m.deleted_at IS NULL AND (${condition}) ORDER BY m.pinned DESC,m.updated_at DESC,m.memo_id`, this.accountId);
  }
  async filterCounts(): Promise<Record<MemoSearchFilter, number>> {
    const result = {} as Record<MemoSearchFilter, number>;
    for (const filter of Object.keys(memoFilterSql) as MemoSearchFilter[]) {
      const row = await this.db.getFirstAsync<{ count: number }>(`SELECT COUNT(DISTINCT i.item_id) AS count FROM memos m JOIN memo_items i ON i.memo_id=m.memo_id
        LEFT JOIN memo_item_assets ia ON ia.item_id=i.item_id LEFT JOIN memo_assets a ON a.asset_id=ia.asset_id AND a.availability='verified' AND a.trashed_at IS NULL
        WHERE m.account_id=? AND m.deleted_at IS NULL AND (${memoFilterSql[filter]})`, this.accountId);
      result[filter] = Number(row?.count ?? 0);
    }
    return result;
  }
  async listTags(memoId: string): Promise<MemoTag[]> {
    await this.get(memoId);
    return this.db.getAllAsync<MemoTag>('SELECT * FROM memo_tags WHERE memo_id=? ORDER BY normalized_name,tag_id', memoId);
  }
  async createTag(memoId: string, tagId: string, displayName: string, role: MemoOrganizationRole = 'owner', now = Date.now()): Promise<MemoTag> {
    await this.get(memoId); validateMemoId(tagId);
    if (!roleCanTagOwn(role)) throw new Error('Viewers cannot change memo tags.');
    const value = validateMemoTagName(displayName);
    const existing = await this.db.getFirstAsync<MemoTag>('SELECT * FROM memo_tags WHERE memo_id=? AND normalized_name=?', memoId, value.normalized_name);
    if (existing) return existing;
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('INSERT INTO memo_tags(tag_id,memo_id,display_name,normalized_name,created_at,updated_at) VALUES (?,?,?,?,?,?)', tagId, memoId, value.display_name, value.normalized_name, now, now);
      await this.queueOrganizationSync(memoId, now);
    });
    return (await this.db.getFirstAsync<MemoTag>('SELECT * FROM memo_tags WHERE tag_id=?', tagId)) as MemoTag;
  }
  async renameTag(memoId: string, tagId: string, displayName: string, role: MemoOrganizationRole = 'owner', now = Date.now()): Promise<void> {
    await this.get(memoId); validateMemoId(tagId);
    if (!roleCanManageTags(role)) throw new Error('This role cannot rename shared tags.');
    const value = validateMemoTagName(displayName);
    const current = await this.db.getFirstAsync<MemoTag>('SELECT * FROM memo_tags WHERE memo_id=? AND tag_id=?', memoId, tagId);
    if (!current) throw new Error('This tag is no longer available.');
    const collision = await this.db.getFirstAsync<{ tag_id: string }>('SELECT tag_id FROM memo_tags WHERE memo_id=? AND normalized_name=? AND tag_id<>?', memoId, value.normalized_name, tagId);
    if (collision) throw new Error('A tag with this name already exists.');
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('UPDATE memo_tags SET display_name=?,normalized_name=?,updated_at=? WHERE memo_id=? AND tag_id=?', value.display_name, value.normalized_name, now, memoId, tagId);
      await this.queueOrganizationSync(memoId, now);
    });
    await this.reindexTaggedItems(tagId);
  }
  async deleteTag(memoId: string, tagId: string, role: MemoOrganizationRole = 'owner'): Promise<void> {
    await this.get(memoId); validateMemoId(tagId);
    if (!roleCanManageTags(role)) throw new Error('This role cannot delete shared tags.');
    const tag = await this.db.getFirstAsync<{ tag_id: string }>('SELECT tag_id FROM memo_tags WHERE memo_id=? AND tag_id=?', memoId, tagId);
    if (!tag) throw new Error('This tag is no longer available.');
    const itemIds = await this.db.getAllAsync<{ item_id: string }>('SELECT item_id FROM memo_item_tags WHERE tag_id=?', tagId);
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('DELETE FROM memo_item_tags WHERE tag_id=?', tagId);
      await this.db.runAsync('DELETE FROM memo_tags WHERE memo_id=? AND tag_id=?', memoId, tagId);
      await this.queueOrganizationSync(memoId);
    });
    for (const item of itemIds) await this.reindexItem(item.item_id);
  }
  async tagItems(memoId: string, tagId: string, itemIds: readonly string[], role: MemoOrganizationRole = 'owner'): Promise<void> {
    await this.get(memoId); validateMemoId(tagId);
    if (!roleCanTagOwn(role)) throw new Error('Viewers cannot change memo tags.');
    const ids = uniqueIds(itemIds);
    if (ids.length === 0) throw new Error('Select at least one memo item.');
    const placeholders = ids.map(() => '?').join(',');
    const rows = await this.db.getAllAsync<{ item_id: string; author_id: string }>(`SELECT item_id,author_id FROM memo_items WHERE memo_id=? AND item_id IN (${placeholders})`, memoId, ...ids);
    if (rows.length !== ids.length) throw new Error('One selected memo item is unavailable.');
    if (role === 'junior' && rows.some((row) => row.author_id !== this.accountId)) throw new Error('Junior members can tag only their own memo items.');
    const tag = await this.db.getFirstAsync<MemoTag>('SELECT * FROM memo_tags WHERE memo_id=? AND tag_id=?', memoId, tagId);
    if (!tag) throw new Error('This tag is no longer available.');
    await this.db.withTransactionAsync(async () => {
      for (const id of ids) await this.db.runAsync('INSERT OR IGNORE INTO memo_item_tags(item_id,tag_id) VALUES (?,?)', id, tagId);
      await this.queueOrganizationSync(memoId);
    });
    for (const id of ids) await this.reindexItem(id);
  }
  async untagItems(memoId: string, tagId: string, itemIds: readonly string[], role: MemoOrganizationRole = 'owner'): Promise<void> {
    await this.get(memoId); validateMemoId(tagId);
    if (!roleCanTagOwn(role)) throw new Error('Viewers cannot change memo tags.');
    const ids = uniqueIds(itemIds);
    const placeholders = ids.map(() => '?').join(',');
    if (ids.length === 0) return;
    const tag = await this.db.getFirstAsync<{ tag_id: string }>('SELECT tag_id FROM memo_tags WHERE memo_id=? AND tag_id=?', memoId, tagId);
    if (!tag) throw new Error('This tag is no longer available.');
    const rows = await this.db.getAllAsync<{ item_id: string; author_id: string }>(`SELECT item_id,author_id FROM memo_items WHERE memo_id=? AND item_id IN (${placeholders})`, memoId, ...ids);
    if (rows.length !== ids.length) throw new Error('One selected memo item is unavailable.');
    if (role === 'junior' && rows.some((row) => row.author_id !== this.accountId)) throw new Error('Junior members can tag only their own memo items.');
    await this.db.withTransactionAsync(async () => { for (const id of ids) await this.db.runAsync('DELETE FROM memo_item_tags WHERE item_id=? AND tag_id=?', id, tagId); await this.queueOrganizationSync(memoId); });
    for (const id of ids) await this.reindexItem(id);
  }
  async createBulkSelection(memoId: string, selectionId: string, itemIds: readonly string[], capturedAt = Date.now()): Promise<MemoBulkSelection> {
    await this.get(memoId); validateMemoId(selectionId);
    const ids = uniqueIds(itemIds);
    if (ids.length === 0) throw new Error('Select at least one memo item.');
    const placeholders = ids.map(() => '?').join(',');
    const rows = await this.db.getAllAsync<{ item_id: string }>(`SELECT item_id FROM memo_items WHERE memo_id=? AND item_id IN (${placeholders})`, memoId, ...ids);
    if (rows.length !== ids.length) throw new Error('The selection changed before it was saved.');
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('DELETE FROM memo_bulk_selections WHERE selection_id=? AND memo_id=?', selectionId, memoId);
      for (const id of ids) await this.db.runAsync('INSERT INTO memo_bulk_selections(selection_id,memo_id,item_id,captured_at) VALUES (?,?,?,?)', selectionId, memoId, id, capturedAt);
    });
    return { selection_id: selectionId, memo_id: memoId, item_ids: ids, captured_at: capturedAt };
  }
  async bulkSelection(memoId: string, selectionId: string): Promise<MemoBulkSelection> {
    await this.get(memoId); validateMemoId(selectionId);
    const rows = await this.db.getAllAsync<{ item_id: string; captured_at: number }>('SELECT item_id,captured_at FROM memo_bulk_selections WHERE memo_id=? AND selection_id=? ORDER BY item_id', memoId, selectionId);
    if (rows.length === 0) throw new Error('This bulk selection is no longer available.');
    return { selection_id: selectionId, memo_id: memoId, item_ids: rows.map((row) => row.item_id), captured_at: rows[0]?.captured_at ?? Date.now() };
  }
  async setPin(memoId: string, itemId: string, userId: string, pinned: boolean, visibility: 'personal' | 'shared' = 'personal', role: MemoOrganizationRole = 'owner', now = Date.now()): Promise<void> {
    await this.get(memoId); validateMemoId(itemId); validateMemoId(userId);
    const item = await this.db.getFirstAsync<{ item_id: string }>('SELECT item_id FROM memo_items WHERE memo_id=? AND item_id=?', memoId, itemId);
    if (!item) throw new Error('This memo item is unavailable.');
    if (visibility === 'personal' && userId !== this.accountId) throw new Error('Personal pins belong to their user.');
    if (visibility === 'shared' && !roleCanManageTags(role)) throw new Error('This role cannot change shared pins.');
    await this.db.withTransactionAsync(async () => {
    if (pinned) await this.db.runAsync('INSERT OR IGNORE INTO memo_pins(memo_id,item_id,user_id,visibility,position,created_at) VALUES (?,?,?, ?,COALESCE((SELECT MAX(position)+1 FROM memo_pins WHERE memo_id=? AND visibility=?),0),?)', memoId, itemId, userId, visibility, memoId, visibility, now);
    else await this.db.runAsync('DELETE FROM memo_pins WHERE memo_id=? AND item_id=? AND user_id=? AND visibility=?', memoId, itemId, userId, visibility);
    await this.queueOrganizationSync(memoId, now);
    });
  }
  async pins(memoId: string, userId: string, visibility: 'personal' | 'shared' = 'personal'): Promise<MemoPin[]> {
    await this.get(memoId); validateMemoId(userId);
    if (visibility === 'personal' && userId !== this.accountId) throw new Error('Personal pins belong to their user.');
    return this.db.getAllAsync<MemoPin>('SELECT * FROM memo_pins WHERE memo_id=? AND user_id=? AND visibility=? ORDER BY position,created_at,item_id', memoId, userId, visibility);
  }
  async details(memoId: string, title: string, description: string, now: number): Promise<void> {
    await this.get(memoId); validateMemoDetails(title, description);
    const operationId = this.syncOperationId();
    await this.db.withTransactionAsync(async () => {
      title = await this.uniqueTitle(title, memoId);
      await this.db.runAsync('UPDATE memos SET title=?,description=?,revision=revision+1,updated_at=? WHERE memo_id=?', title.trim(), description, now, memoId);
      const items = await this.db.getAllAsync<{ item_id: string }>('SELECT item_id FROM memo_items WHERE memo_id=?', memoId);
      for (const item of items) await this.reindexItem(item.item_id);
      await this.queueSyncOperation(memoId, operationId, memoId, 'memo', { title: title.trim(), description }, now);
    });
  }
  async search(query: string, options: { filter?: MemoSearchFilter; userId?: string; limit?: number } = {}): Promise<MemoSearchResult[]> {
    const match = buildMemoMatchQuery(query);
    if (!match) return [];
    const filter = options.filter ?? 'all';
    const limit = Math.max(1, Math.min(100, Math.trunc(options.limit ?? 50)));
    const userId = options.userId ?? this.accountId;
    validateMemoId(userId);
    const rows = await this.db.getAllAsync<Record<string, unknown>>(`
      SELECT idx.memo_id,idx.item_id,m.title AS memo_title, i.kind AS item_kind, i.display_name,
        a.detected_type, substr(CASE WHEN i.kind='text' THEN i.text ELSE i.display_name END,1,220) AS snippet,
        CAST(idx.chunk_start AS INTEGER) AS block_start, i.created_at, i.author_id,
        EXISTS(SELECT 1 FROM memo_pins p WHERE p.memo_id=i.memo_id AND p.item_id=i.item_id AND p.user_id=? AND p.visibility='personal') AS pinned,
        COALESCE((SELECT group_concat(t.display_name,'|||') FROM memo_item_tags it JOIN memo_tags t ON t.tag_id=it.tag_id WHERE it.item_id=i.item_id),'') AS tags_csv
      FROM memo_search_index idx
      JOIN (SELECT MIN(rowid) AS rowid FROM memo_search_index WHERE memo_search_index MATCH ? GROUP BY item_id) hit ON hit.rowid=idx.rowid
      JOIN memo_items i ON i.item_id=idx.item_id
      JOIN memos m ON m.memo_id=idx.memo_id AND m.account_id=? AND m.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM memo_protection_requirements p WHERE p.memo_id=m.memo_id AND p.required=1)
      LEFT JOIN memo_item_assets ia ON ia.item_id=i.item_id
      LEFT JOIN memo_assets a ON a.asset_id=ia.asset_id AND a.availability='verified' AND a.trashed_at IS NULL
      WHERE (${memoFilterSql[filter]})
      GROUP BY idx.item_id ORDER BY i.created_at DESC,i.item_id DESC LIMIT ?`, userId, match, this.accountId, limit);
    return rows.map((row) => ({
      memo_id: String(row.memo_id), item_id: String(row.item_id), memo_title: String(row.memo_title),
      item_kind: row.item_kind === 'attachment' ? 'attachment' : 'text', display_name: String(row.display_name ?? ''),
      detected_type: typeof row.detected_type === 'string' ? row.detected_type as MemoAssetType : null,
      snippet: String(row.snippet ?? ''), block_start: Number(row.block_start ?? 0), created_at: Number(row.created_at),
      author_id: String(row.author_id), pinned: Number(row.pinned) === 1,
      tags: String(row.tags_csv ?? '').split('|||').filter(Boolean),
    }));
  }
  searchState(): Promise<MemoSearchState> {
    return this.db.getFirstAsync<MemoSearchState>('SELECT status,indexed_items,total_items,last_error FROM memo_search_state WHERE account_id=?', this.accountId)
      .then((state) => state ?? { status: 'rebuilding', indexed_items: 0, total_items: 0, last_error: null });
  }
  async rebuildSearch(): Promise<void> {
    const total = await this.db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM memo_items i JOIN memos m ON m.memo_id=i.memo_id WHERE m.account_id=? AND m.deleted_at IS NULL', this.accountId);
    await this.db.runAsync(`INSERT INTO memo_search_state(account_id,status,indexed_items,total_items,last_error) VALUES (?,'rebuilding',0,?,NULL)
      ON CONFLICT(account_id) DO UPDATE SET status='rebuilding',indexed_items=0,total_items=excluded.total_items,last_error=NULL`, this.accountId, Number(total?.count ?? 0));
    try {
      await this.db.runAsync('DELETE FROM memo_search_index WHERE memo_id IN (SELECT memo_id FROM memos WHERE account_id=?)', this.accountId);
      const items = await this.db.getAllAsync<{ item_id: string }>('SELECT i.item_id FROM memo_items i JOIN memos m ON m.memo_id=i.memo_id WHERE m.account_id=? AND m.deleted_at IS NULL ORDER BY i.created_at,i.item_id', this.accountId);
      let indexed = 0;
      for (const item of items) { await this.reindexItem(item.item_id); indexed++; if (indexed % 25 === 0) await this.db.runAsync('UPDATE memo_search_state SET indexed_items=? WHERE account_id=?', indexed, this.accountId); }
      await this.db.runAsync("UPDATE memo_search_state SET status='ready',indexed_items=?,total_items=?,last_error=NULL WHERE account_id=?", indexed, items.length, this.accountId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Search index rebuild failed.';
      await this.db.runAsync("UPDATE memo_search_state SET status='error',last_error=? WHERE account_id=?", message, this.accountId);
      throw new Error('Memo search index rebuild failed. Retry from search settings.');
    }
  }
  async timeline(memoId: string, before?: MemoCursor): Promise<MemoTimelineItem[]> {
    await this.get(memoId);
    const query = `SELECT i.*, a.asset_id AS asset_asset_id, a.memo_id AS asset_memo_id, a.opaque_path AS asset_opaque_path,
      a.original_name AS asset_original_name, a.mime_type AS asset_mime_type, a.detected_type AS asset_detected_type,
      a.byte_size AS asset_byte_size, a.checksum AS asset_checksum, a.availability AS asset_availability,
      a.created_at AS asset_created_at, a.trashed_at AS asset_trashed_at
      FROM memo_items i LEFT JOIN memo_item_assets ia ON ia.item_id=i.item_id LEFT JOIN memo_assets a ON a.asset_id=ia.asset_id
      WHERE i.memo_id=? AND i.display_name<>'__memo_note__' AND (i.kind='text' OR a.availability IN ('verified','repair'))
      ${before ? 'AND (i.created_at<? OR (i.created_at=? AND i.item_id<?))' : ''}
      ORDER BY i.created_at DESC,i.item_id DESC LIMIT 50`;
    const rows = before
      ? await this.db.getAllAsync<Record<string, unknown>>(query, memoId, before.created_at, before.created_at, before.item_id)
      : await this.db.getAllAsync<Record<string, unknown>>(query, memoId);
    return rows.map((row) => this.timelineItem(row));
  }
  async item(memoId: string, itemId: string): Promise<MemoTimelineItem> {
    await this.get(memoId); validateMemoId(itemId);
    const row = await this.db.getFirstAsync<Record<string, unknown>>(`SELECT i.*, a.asset_id AS asset_asset_id, a.memo_id AS asset_memo_id, a.opaque_path AS asset_opaque_path,
      a.original_name AS asset_original_name, a.mime_type AS asset_mime_type, a.detected_type AS asset_detected_type,
      a.byte_size AS asset_byte_size, a.checksum AS asset_checksum, a.availability AS asset_availability,
      a.created_at AS asset_created_at, a.trashed_at AS asset_trashed_at
      FROM memo_items i LEFT JOIN memo_item_assets ia ON ia.item_id=i.item_id LEFT JOIN memo_assets a ON a.asset_id=ia.asset_id
      WHERE i.memo_id=? AND i.item_id=? AND (i.kind='text' OR a.availability='verified')`, memoId, itemId);
    if (!row) throw new Error('This memo item is unavailable.');
    return this.timelineItem(row);
  }
  private timelineItem(row: Record<string, unknown>): MemoTimelineItem {
    const base = {
      item_id: String(row.item_id), memo_id: String(row.memo_id), author_id: String(row.author_id),
      text: String(row.text), created_at: Number(row.created_at), revision: Number(row.revision),
      operation_id: String(row.operation_id),
      display_name: String(row.display_name ?? ''),
    };
    if (row.kind !== 'attachment') return { ...base, kind: 'text' as const };
    if (typeof row.asset_asset_id !== 'string') throw new Error('Memo attachment metadata is incomplete.');
    const asset: MemoAsset = {
      asset_id: row.asset_asset_id, memo_id: String(row.asset_memo_id), opaque_path: String(row.asset_opaque_path),
      original_name: String(row.asset_original_name), mime_type: String(row.asset_mime_type),
      detected_type: row.asset_detected_type as MemoAssetType, byte_size: Number(row.asset_byte_size),
      checksum: typeof row.asset_checksum === 'string' ? row.asset_checksum : null,
      availability: row.asset_availability as MemoAsset['availability'], created_at: Number(row.asset_created_at),
      trashed_at: typeof row.asset_trashed_at === 'number' ? row.asset_trashed_at : null,
    };
    return { ...base, kind: 'attachment', asset };
  }

  async prepareAsset(input: {
    operation_id: string; memo_id: string; item_id: string; asset_id: string; original_name: string;
    mime_type: string; detected_type: MemoAssetType; byte_size: number; checksum: string | null; created_at: number;
  }): Promise<MemoAssetJob> {
    await this.get(input.memo_id);
    validateMemoId(input.operation_id); validateMemoId(input.item_id); validateMemoId(input.asset_id);
    if (!input.original_name.trim() || input.original_name.length > 255 || !Number.isSafeInteger(input.byte_size) || input.byte_size < 0) throw new Error('Attachment metadata is invalid.');
    await this.db.runAsync(`INSERT OR IGNORE INTO memo_asset_jobs(operation_id,memo_id,item_id,asset_id,original_name,mime_type,detected_type,byte_size,checksum,created_at,stage)
      VALUES (?,?,?,?,?,?,?,?,?,?,'prepared')`, input.operation_id, input.memo_id, input.item_id, input.asset_id, input.original_name, input.mime_type, input.detected_type, input.byte_size, input.checksum, input.created_at);
    const job = await this.db.getFirstAsync<MemoAssetJob>('SELECT * FROM memo_asset_jobs WHERE operation_id=?', input.operation_id);
    if (!job || job.memo_id !== input.memo_id || job.item_id !== input.item_id || job.asset_id !== input.asset_id || job.original_name !== input.original_name || job.byte_size !== input.byte_size) throw new Error('Attachment operation does not match its original envelope.');
    return job;
  }
  async stageAsset(operationId: string, stagingPath: string): Promise<void> {
    validateMemoId(operationId); if (!stagingPath.trim()) throw new Error('Attachment staging path is missing.');
    await this.db.runAsync("UPDATE memo_asset_jobs SET staging_path=?,stage='staged' WHERE operation_id=? AND stage='prepared'", stagingPath, operationId);
    const job = await this.db.getFirstAsync<MemoAssetJob>('SELECT * FROM memo_asset_jobs WHERE operation_id=?', operationId);
    if (!job || job.stage !== 'staged') throw new Error('Attachment was not staged. Retry the import.');
  }
  async promoteAsset(operationId: string, finalPath: string): Promise<void> {
    validateMemoId(operationId); if (!finalPath.trim()) throw new Error('Attachment destination is missing.');
    await this.db.runAsync("UPDATE memo_asset_jobs SET final_path=? WHERE operation_id=? AND stage='staged'", finalPath, operationId);
  }
  async commitAsset(operationId: string): Promise<MemoAttachmentItem> {
    validateMemoId(operationId);
    const existingReceipt = await this.db.getFirstAsync<Record<string, unknown>>('SELECT i.*,a.asset_id AS asset_asset_id,a.memo_id AS asset_memo_id,a.opaque_path AS asset_opaque_path,a.original_name AS asset_original_name,a.mime_type AS asset_mime_type,a.detected_type AS asset_detected_type,a.byte_size AS asset_byte_size,a.checksum AS asset_checksum,a.availability AS asset_availability,a.created_at AS asset_created_at,a.trashed_at AS asset_trashed_at FROM memo_items i JOIN memo_item_assets ia ON ia.item_id=i.item_id JOIN memo_assets a ON a.asset_id=ia.asset_id WHERE i.operation_id=?', operationId);
    if (existingReceipt) { await this.db.runAsync("DELETE FROM memo_asset_jobs WHERE operation_id=? AND stage='committed'", operationId); return this.timelineItem(existingReceipt) as MemoAttachmentItem; }
    await this.db.withTransactionAsync(async () => {
      const job = await this.db.getFirstAsync<MemoAssetJob>('SELECT * FROM memo_asset_jobs WHERE operation_id=?', operationId);
      if (!job || job.stage !== 'staged' || !job.final_path) throw new Error('Attachment is incomplete and was kept for retry.');
      const existing = await this.db.getFirstAsync<Record<string, unknown>>('SELECT * FROM memo_items WHERE operation_id=?', operationId);
      if (!existing) {
        await this.db.runAsync('INSERT INTO memo_items(item_id,memo_id,author_id,text,created_at,operation_id,kind,display_name) VALUES (?,?,?,?,?,?,?,?)', job.item_id, job.memo_id, this.accountId, '', job.created_at, operationId, 'attachment', job.original_name);
        await this.db.runAsync('INSERT INTO memo_assets(asset_id,memo_id,opaque_path,original_name,mime_type,detected_type,byte_size,checksum,created_at,availability) VALUES (?,?,?,?,?,?,?,?,?,?)', job.asset_id, job.memo_id, job.final_path, job.original_name, job.mime_type, job.detected_type, job.byte_size, job.checksum, job.created_at, 'verified');
        await this.db.runAsync('INSERT INTO memo_item_assets(item_id,asset_id) VALUES (?,?)', job.item_id, job.asset_id);
        await this.db.runAsync('UPDATE memos SET preview=?,updated_at=MAX(updated_at,?),revision=revision+1 WHERE memo_id=?', job.original_name, job.created_at, job.memo_id);
        await this.reindexItem(job.item_id);
        await this.queueSyncOperation(job.memo_id, operationId, job.item_id, 'asset', { asset_id: job.asset_id, item_id: job.item_id, original_name: job.original_name, mime_type: job.mime_type, byte_size: job.byte_size, checksum: job.checksum }, job.created_at);
      } else if (existing.item_id !== job.item_id || existing.memo_id !== job.memo_id) throw new Error('Attachment operation does not match its receipt.');
      await this.db.runAsync("UPDATE memo_asset_jobs SET stage='committed' WHERE operation_id=?", operationId);
    });
    const item = await this.db.getFirstAsync<Record<string, unknown>>('SELECT i.*,a.asset_id AS asset_asset_id,a.memo_id AS asset_memo_id,a.opaque_path AS asset_opaque_path,a.original_name AS asset_original_name,a.mime_type AS asset_mime_type,a.detected_type AS asset_detected_type,a.byte_size AS asset_byte_size,a.checksum AS asset_checksum,a.availability AS asset_availability,a.created_at AS asset_created_at,a.trashed_at AS asset_trashed_at FROM memo_items i JOIN memo_item_assets ia ON ia.item_id=i.item_id JOIN memo_assets a ON a.asset_id=ia.asset_id WHERE i.operation_id=?', operationId);
    await this.db.runAsync("DELETE FROM memo_asset_jobs WHERE operation_id=? AND stage='committed'", operationId);
    if (!item) throw new Error('Attachment was not acknowledged. Retry with the same operation.');
    await this.updateSearchCounts();
    return this.timelineItem(item) as MemoAttachmentItem;
  }
  async pendingAssets(memoId: string): Promise<MemoAssetJob[]> {
    await this.get(memoId);
    return this.db.getAllAsync<MemoAssetJob>('SELECT * FROM memo_asset_jobs WHERE memo_id=? AND stage<>\'committed\' ORDER BY created_at LIMIT 50', memoId);
  }
  async asset(assetId: string, includeTrash = false): Promise<MemoAsset> {
    validateMemoId(assetId);
    const asset = await this.db.getFirstAsync<MemoAsset>(`SELECT a.* FROM memo_assets a
      JOIN memos m ON m.memo_id=a.memo_id
      WHERE a.asset_id=? AND m.account_id=? ${includeTrash ? '' : 'AND m.deleted_at IS NULL AND a.trashed_at IS NULL'}`, assetId, this.accountId);
    if (!asset) throw new Error('This attachment is unavailable for this account.');
    return asset;
  }
  async assets(memoId: string, includeTrash = false): Promise<MemoAsset[]> {
    if (includeTrash) {
      const memo = await this.db.getFirstAsync<{ memo_id: string }>('SELECT memo_id FROM memos WHERE memo_id=? AND account_id=?', memoId, this.accountId);
      if (!memo) throw new Error('This memo is unavailable for this account.');
    } else {
      await this.get(memoId);
    }
    return this.db.getAllAsync<MemoAsset>(`SELECT * FROM memo_assets WHERE memo_id=? ${includeTrash ? '' : "AND trashed_at IS NULL"} ORDER BY created_at,asset_id`, memoId);
  }
  async accounting(): Promise<MemoStorageAccounting> {
    const row = await this.db.getFirstAsync<MemoStorageAccounting>(`SELECT
      COALESCE(SUM(CASE WHEN m.deleted_at IS NULL AND a.availability='verified' THEN a.byte_size ELSE 0 END),0) AS live_bytes,
      COALESCE(SUM(CASE WHEN m.deleted_at IS NOT NULL AND a.availability='verified' THEN a.byte_size ELSE 0 END),0) AS trash_bytes,
      COALESCE(SUM(CASE WHEN a.availability='staging' THEN a.byte_size ELSE 0 END),0) AS staging_bytes,
      COALESCE(SUM(CASE WHEN a.availability='repair' THEN a.byte_size ELSE 0 END),0) AS repair_bytes
      FROM memo_assets a JOIN memos m ON m.memo_id=a.memo_id WHERE m.account_id=?`, this.accountId);
    const accounting = row ?? { live_bytes: 0, trash_bytes: 0, staging_bytes: 0, repair_bytes: 0 };
    return { ...accounting, total_bytes: accounting.live_bytes + accounting.trash_bytes + accounting.staging_bytes + accounting.repair_bytes };
  }
  largestAssets(limit = 20): Promise<MemoLargestContent[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Largest-content limit is invalid.');
    return this.db.getAllAsync<MemoLargestContent>(`SELECT a.asset_id,a.memo_id,a.original_name,a.byte_size,a.detected_type,a.availability,m.title AS memo_title,m.deleted_at
      FROM memo_assets a JOIN memos m ON m.memo_id=a.memo_id WHERE m.account_id=? ORDER BY a.byte_size DESC,a.asset_id LIMIT ${limit}`, this.accountId);
  }
  async exportSnapshot(): Promise<{ memos: Memo[]; items: MemoTimelineItem[]; notes: MemoNote[]; noteRevisions: MemoNoteRevision[] }> {
    const memos = await this.db.getAllAsync<Memo>('SELECT * FROM memos WHERE account_id=? ORDER BY memo_id', this.accountId);
    const rows = await this.db.getAllAsync<Record<string, unknown>>(`SELECT i.*, a.asset_id AS asset_asset_id, a.memo_id AS asset_memo_id, a.opaque_path AS asset_opaque_path,
      a.original_name AS asset_original_name, a.mime_type AS asset_mime_type, a.detected_type AS asset_detected_type,
      a.byte_size AS asset_byte_size, a.checksum AS asset_checksum, a.availability AS asset_availability,
      a.created_at AS asset_created_at, a.trashed_at AS asset_trashed_at FROM memo_items i
      LEFT JOIN memo_item_assets ia ON ia.item_id=i.item_id LEFT JOIN memo_assets a ON a.asset_id=ia.asset_id
      JOIN memos m ON m.memo_id=i.memo_id WHERE m.account_id=? ORDER BY i.memo_id,i.created_at,i.item_id`, this.accountId);
    const notes = await this.db.getAllAsync<MemoNote>('SELECT memo_id,item_id,title,description,body,revision,updated_at FROM memo_notes WHERE memo_id IN (SELECT memo_id FROM memos WHERE account_id=?)', this.accountId);
    const noteRevisions = await this.db.getAllAsync<MemoNoteRevision>('SELECT revision_id,memo_id,revision,title,description,body,named,created_at FROM memo_note_revisions WHERE memo_id IN (SELECT memo_id FROM memos WHERE account_id=?)', this.accountId);
    return { memos, items: rows.filter((row) => row.kind !== 'attachment' || row.asset_asset_id).map((row) => this.timelineItem(row)), notes, noteRevisions };
  }
  async note(memoId: string): Promise<MemoNote | null> {
    await this.get(memoId);
    return this.db.getFirstAsync<MemoNote>('SELECT memo_id,item_id,title,description,body,revision,updated_at FROM memo_notes WHERE memo_id=?', memoId);
  }
  async noteDraft(memoId: string): Promise<MemoNoteDraft | null> {
    await this.get(memoId);
    return this.db.getFirstAsync<MemoNoteDraft>('SELECT memo_id,title,description,body,revision,updated_at FROM memo_note_drafts WHERE memo_id=?', memoId);
  }
  async saveNoteDraft(memoId: string, title: string, description: string, body: string, revision: number, now: number): Promise<void> {
    await this.get(memoId); validateMemoNote(title || 'Untitled note', description, body);
    if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Note draft revision is invalid.');
    await this.db.runAsync('INSERT INTO memo_note_drafts(memo_id,title,description,body,revision,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(memo_id) DO UPDATE SET title=excluded.title,description=excluded.description,body=excluded.body,revision=excluded.revision,updated_at=excluded.updated_at', memoId, title, description, body, revision, now);
  }
  async clearNoteDraft(memoId: string): Promise<void> {
    await this.get(memoId); await this.db.runAsync('DELETE FROM memo_note_drafts WHERE memo_id=?', memoId);
  }
  async saveNote(memoId: string, itemId: string, revisionId: string, title: string, description: string, body: string, named: string | null, now: number): Promise<MemoNote> {
    await this.get(memoId); validateMemoId(itemId); validateMemoId(revisionId); validateMemoNote(title, description, body);
    const current = await this.note(memoId);
    const history = await this.db.getFirstAsync<{ revision: number }>('SELECT MAX(revision) AS revision FROM memo_note_revisions WHERE memo_id=?', memoId);
    const revision = Math.max(current?.revision ?? 0, Number(history?.revision ?? 0));
    if (current && current.item_id !== itemId) throw new Error('The note identity changed. Retry from the current note.');
    await this.db.withTransactionAsync(async () => {
      title = await this.uniqueTitle(title, memoId);
      if (!current) {
        await this.db.runAsync('INSERT INTO memo_items(item_id,memo_id,author_id,text,created_at,revision,operation_id,kind,display_name) VALUES (?,?,?,?,?,?,?,?,?)', itemId, memoId, this.accountId, body, now, 1, itemId, 'text', '__memo_note__');
        await this.db.runAsync('INSERT INTO memo_notes(memo_id,item_id,title,description,body,revision,updated_at) VALUES (?,?,?,?,?,?,?)', memoId, itemId, title.trim(), description, body, 1, now);
      } else {
        await this.db.runAsync('UPDATE memo_notes SET title=?,description=?,body=?,revision=?,updated_at=? WHERE memo_id=?', title.trim(), description, body, revision + 1, now, memoId);
        await this.db.runAsync('UPDATE memo_items SET text=?,revision=? WHERE item_id=?', body, revision + 1, itemId);
      }
      const nextRevision = revision + 1;
      await this.db.runAsync('INSERT INTO memo_note_revisions(revision_id,memo_id,revision,title,description,body,named,created_at) VALUES (?,?,?,?,?,?,?,?)', revisionId, memoId, nextRevision, title.trim(), description, body, named, now);
      await this.db.runAsync('DELETE FROM memo_note_drafts WHERE memo_id=?', memoId);
      await this.db.runAsync('UPDATE memos SET title=?,description=?,preview=?,revision=revision+1,updated_at=? WHERE memo_id=?', title.trim(), description, [...body].slice(0, 200).join(''), now, memoId);
      await this.reindexItem(itemId);
      await this.queueSyncOperation(memoId, revisionId, itemId, 'note', { title: title.trim(), description, body, named, local_revision_id: revisionId }, now);
    });
    const saved = await this.db.getFirstAsync<MemoNote>('SELECT memo_id,item_id,title,description,body,revision,updated_at FROM memo_notes WHERE memo_id=?', memoId);
    if (!saved) throw new Error('Note save was not acknowledged. Retry.');
    return saved;
  }
  async noteRevisions(memoId: string): Promise<MemoNoteRevision[]> {
    await this.get(memoId);
    return this.db.getAllAsync<MemoNoteRevision>('SELECT revision_id,memo_id,revision,title,description,body,named,created_at FROM memo_note_revisions WHERE memo_id=? ORDER BY revision DESC LIMIT 100', memoId);
  }
  async restoreNoteRevision(memoId: string, revisionId: string, newRevisionId: string, now: number): Promise<MemoNote> {
    const revision = await this.db.getFirstAsync<MemoNoteRevision>('SELECT * FROM memo_note_revisions WHERE memo_id=? AND revision_id=?', memoId, validateMemoId(revisionId));
    if (!revision) throw new Error('This note version is no longer available.');
    const current = await this.note(memoId);
    if (!current) throw new Error('This note is unavailable.');
    return this.saveNote(memoId, current.item_id, newRevisionId, revision.title, revision.description, revision.body, null, now);
  }
  async recordNoteRevision(memoId: string, revisionId: string, revision: number, title: string, description: string, body: string, named: string | null, createdAt: number): Promise<void> {
    await this.get(memoId); validateMemoId(revisionId); validateMemoNote(title, description, body);
    if (!Number.isSafeInteger(revision) || revision < 1) throw new Error('Memo history revision is invalid.');
    const existing = await this.db.getFirstAsync<{ memo_id: string }>('SELECT memo_id FROM memo_note_revisions WHERE revision_id=?', revisionId);
    if (existing) { if (existing.memo_id !== memoId) throw new Error('Foreign memo history revision.'); return; }
    const collision = await this.db.getFirstAsync('SELECT revision_id FROM memo_note_revisions WHERE memo_id=? AND revision=?', memoId, revision);
    const maximum = collision ? await this.db.getFirstAsync<{ revision: number }>('SELECT MAX(revision) AS revision FROM memo_note_revisions WHERE memo_id=?', memoId) : null;
    await this.db.runAsync('INSERT INTO memo_note_revisions(revision_id,memo_id,revision,title,description,body,named,created_at) VALUES (?,?,?,?,?,?,?,?)', revisionId, memoId, maximum ? maximum.revision + 1 : revision, title, description, body, named, createdAt);
  }
  async pruneNoteHistory(memoId: string, now: number): Promise<number> {
    await this.get(memoId);
    const cutoff = now - 30 * 24 * 60 * 60 * 1000;
    const removable = await this.db.getAllAsync<{ revision_id: string }>(`SELECT revision_id FROM memo_note_revisions WHERE memo_id=? AND named IS NULL AND revision NOT IN (SELECT revision FROM memo_notes WHERE memo_id=?) AND (created_at<? OR revision NOT IN (SELECT revision FROM memo_note_revisions WHERE memo_id=? ORDER BY revision DESC LIMIT 100))`, memoId, memoId, cutoff, memoId);
    for (const row of removable) await this.db.runAsync('DELETE FROM memo_note_revisions WHERE revision_id=?', row.revision_id);
    return removable.length;
  }
  async prepareArchiveJob(operationId: string, kind: MemoArchiveJob['kind'], path: string, now: number): Promise<MemoArchiveJob> {
    validateMemoId(operationId); if (!path.trim()) throw new Error('Backup path is missing.');
    await this.db.runAsync("INSERT OR IGNORE INTO memo_archive_jobs(operation_id,kind,path,stage,created_at,updated_at) VALUES (?,?,?,'prepared',?,?)", operationId, kind, path, now, now);
    const job = await this.db.getFirstAsync<MemoArchiveJob>('SELECT * FROM memo_archive_jobs WHERE operation_id=?', operationId);
    if (!job || job.kind !== kind || job.path !== path) throw new Error('Backup job does not match its original envelope.');
    return job;
  }
  async updateArchiveJob(operationId: string, stage: MemoArchiveJob['stage'], bytes: number, error: string | null = null): Promise<void> {
    validateMemoId(operationId); if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Backup byte count is invalid.');
    await this.db.runAsync('UPDATE memo_archive_jobs SET stage=?,bytes=?,error=?,updated_at=? WHERE operation_id=?', stage, bytes, error, Date.now(), operationId);
  }
  archiveJobs(): Promise<MemoArchiveJob[]> { return this.db.getAllAsync<MemoArchiveJob>('SELECT * FROM memo_archive_jobs ORDER BY updated_at DESC LIMIT 20'); }
  private reminderScheduleValues(schedule: MemoReminderSchedule): [string, number | null, string, string, number | null, number | null, number | null, number | null] {
    validateMemoReminderSchedule(schedule);
    return schedule.kind === 'one_time'
      ? [schedule.kind, schedule.at, schedule.timezone, schedule.recurrence, null, null, null, null]
      : [schedule.kind, null, schedule.timezone, schedule.recurrence, schedule.hour, schedule.minute, 'weekday' in schedule ? schedule.weekday : null, 'day_of_month' in schedule ? schedule.day_of_month : null];
  }
  private reminderSchedule(reminder: MemoReminder): MemoReminderSchedule {
    if (reminder.schedule_kind === 'one_time') {
      if (reminder.trigger_at === null) throw new Error('Reminder schedule is incomplete.');
      return { kind: 'one_time', at: reminder.trigger_at, timezone: reminder.timezone, recurrence: 'none' };
    }
    if (reminder.hour === null || reminder.minute === null) throw new Error('Reminder schedule is incomplete.');
    if (reminder.recurrence === 'daily') return { kind: 'wall_clock', timezone: reminder.timezone, recurrence: 'daily', hour: reminder.hour, minute: reminder.minute };
    if (reminder.recurrence === 'weekly' && reminder.weekday !== null) return { kind: 'wall_clock', timezone: reminder.timezone, recurrence: 'weekly', hour: reminder.hour, minute: reminder.minute, weekday: reminder.weekday };
    if (reminder.recurrence === 'monthly' && reminder.day_of_month !== null) return { kind: 'wall_clock', timezone: reminder.timezone, recurrence: 'monthly', hour: reminder.hour, minute: reminder.minute, day_of_month: reminder.day_of_month };
    throw new Error('Reminder schedule is incomplete.');
  }
  private async queueReminderSync(reminderId: string, operationId: string, now: number): Promise<void> {
    const reminder = await this.reminder(reminderId);
    const targets = await this.reminderTargets(reminderId);
    await this.queueSyncOperation(reminder.memo_id, operationId, reminderId, 'reminder', {
      mode: reminder.mode, state: reminder.state, target_set_state: reminder.target_set_state,
      schedule: this.reminderSchedule(reminder), schedule_revision: reminder.schedule_revision,
      next_occurrence_at: reminder.next_occurrence_at, item_ids: targets.map((target) => target.item_id),
    }, now);
  }
  async createReminder(input: MemoReminderCreateInput): Promise<MemoReminder> {
    validateMemoId(input.reminder_id); validateMemoId(input.memo_id); validateMemoId(this.accountId);
    if (input.mode !== 'regular' && input.mode !== 'alarm') throw new Error('Reminder mode is invalid.');
    if (!Number.isSafeInteger(input.now) || input.now <= 0) throw new Error('Reminder timestamp is invalid.');
    const values = this.reminderScheduleValues(input.schedule);
    const itemIds = uniqueIds(input.item_ids);
    if (itemIds.length === 0) throw new Error('Select at least one live memo item for this reminder.');
    await this.get(input.memo_id);
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(`INSERT INTO memo_reminders(reminder_id,memo_id,owner_id,mode,state,target_set_state,schedule_kind,trigger_at,timezone,recurrence,hour,minute,weekday,day_of_month,schedule_revision,desired_schedule_status,actual_schedule_status,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,'pending','unknown',?,?)`, input.reminder_id, input.memo_id, this.accountId, input.mode, 'building', 'building', ...values, input.now, input.now);
      let live = 0;
      for (const itemId of itemIds) {
        validateMemoId(itemId);
        const item = await this.db.getFirstAsync<{ revision: number }>('SELECT revision FROM memo_items WHERE memo_id=? AND item_id=?', input.memo_id, itemId);
        if (item) {
          live++;
          await this.db.runAsync("INSERT INTO memo_reminder_targets(reminder_id,item_id,captured_revision,state,unavailable_reason) VALUES (?,?,?,'live',NULL)", input.reminder_id, itemId, item.revision);
        } else {
          await this.db.runAsync("INSERT INTO memo_reminder_targets(reminder_id,item_id,captured_revision,state,unavailable_reason) VALUES (?, ?, NULL, 'unavailable', 'missing')", input.reminder_id, itemId);
        }
      }
      if (live === 0) throw new Error('No selected memo items are still available.');
      const next = nextMemoReminderOccurrence(input.schedule, input.now);
      await this.db.runAsync("UPDATE memo_reminders SET target_set_state='ready',state='ready',selected_count=?,live_count=?,unavailable_count=?,next_occurrence_at=?,updated_at=? WHERE reminder_id=?", itemIds.length, live, itemIds.length - live, next, input.now, input.reminder_id);
      await this.queueReminderSync(input.reminder_id, input.reminder_id, input.now);
    });
    return this.reminder(input.reminder_id);
  }
  async reminder(reminderId: string): Promise<MemoReminder> {
    validateMemoId(reminderId);
    const row = await this.db.getFirstAsync<MemoReminder>(`SELECT r.* FROM memo_reminders r JOIN memos m ON m.memo_id=r.memo_id WHERE r.reminder_id=? AND m.account_id=?`, reminderId, this.accountId);
    if (!row) throw new Error('This reminder is unavailable for this account.');
    return row;
  }
  listReminders(memoId?: string, includeInactive = false): Promise<MemoReminder[]> {
    if (memoId) validateMemoId(memoId);
    const inactive = includeInactive ? '' : "AND r.state NOT IN ('cancelled','completed')";
    return this.db.getAllAsync<MemoReminder>(`SELECT r.* FROM memo_reminders r JOIN memos m ON m.memo_id=r.memo_id WHERE m.account_id=? ${memoId ? 'AND r.memo_id=?' : ''} ${inactive} ORDER BY r.next_occurrence_at IS NULL,r.next_occurrence_at,r.updated_at DESC`, ...(memoId ? [this.accountId, memoId] : [this.accountId]));
  }
  reminderTargets(reminderId: string): Promise<MemoReminderTarget[]> {
    validateMemoId(reminderId);
    return this.db.getAllAsync<MemoReminderTarget>('SELECT t.* FROM memo_reminder_targets t JOIN memo_reminders r ON r.reminder_id=t.reminder_id JOIN memos m ON m.memo_id=r.memo_id WHERE t.reminder_id=? AND m.account_id=? ORDER BY t.item_id', reminderId, this.accountId);
  }
  async prepareReminderOccurrence(reminderId: string, occurrenceAt: number, now = Date.now()): Promise<MemoReminderDelivery> {
    const reminder = await this.reminder(reminderId);
    if (reminder.state !== 'ready' || reminder.target_set_state !== 'ready' || reminder.live_count < 1) throw new Error('Reminder is not ready to schedule.');
    if (!Number.isSafeInteger(occurrenceAt) || occurrenceAt <= 0) throw new Error('Reminder occurrence is invalid.');
    const occurrenceId = memoReminderOccurrenceId(reminderId, reminder.schedule_revision, occurrenceAt);
    await this.db.runAsync("INSERT OR IGNORE INTO memo_reminder_deliveries(occurrence_id,reminder_id,occurrence_at,schedule_revision,status) VALUES (?,?,?,?, 'scheduled')", occurrenceId, reminderId, occurrenceAt, reminder.schedule_revision);
    await this.db.runAsync('UPDATE memo_reminders SET next_occurrence_at=?,updated_at=? WHERE reminder_id=?', occurrenceAt, now, reminderId);
    const delivery = await this.db.getFirstAsync<MemoReminderDelivery>('SELECT * FROM memo_reminder_deliveries WHERE occurrence_id=?', occurrenceId);
    if (!delivery) throw new Error('Reminder occurrence was not acknowledged.');
    return delivery;
  }
  async recordReminderSchedule(reminderId: string, desired: MemoReminder['desired_schedule_status'], actual: MemoReminder['actual_schedule_status'], osScheduleId: string | null, occurrenceId: string | null, now = Date.now()): Promise<void> {
    const reminder = await this.reminder(reminderId);
    if (desired === 'scheduled' && reminder.state !== 'ready') throw new Error('Only ready reminders can be scheduled.');
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('UPDATE memo_reminders SET desired_schedule_status=?,actual_schedule_status=?,os_schedule_id=?,updated_at=? WHERE reminder_id=?', desired, actual, osScheduleId, now, reminderId);
      if (occurrenceId) await this.db.runAsync('UPDATE memo_reminder_deliveries SET os_schedule_id=? WHERE occurrence_id=?', osScheduleId, occurrenceId);
    });
  }
  async recordReminderDelivery(reminderId: string, occurrenceId: string, status: MemoReminderDeliveryStatus, now = Date.now()): Promise<void> {
    await this.reminder(reminderId); validateMemoId(reminderId);
    if (!occurrenceId.startsWith(`${reminderId}:`)) throw new Error('Reminder occurrence does not belong to this reminder.');
    await this.db.runAsync('UPDATE memo_reminder_deliveries SET status=?,presented_at=CASE WHEN ?=\'presented\' THEN COALESCE(presented_at,?) ELSE presented_at END,completed_at=CASE WHEN ?=\'completed\' THEN ? ELSE completed_at END WHERE occurrence_id=?', status, status, now, status, now, occurrenceId);
    await this.db.runAsync('UPDATE memo_reminders SET last_delivery_status=?,updated_at=? WHERE reminder_id=?', status, now, reminderId);
  }
  async completeReminder(reminderId: string, occurrenceId: string, now = Date.now()): Promise<MemoReminder> {
    const reminder = await this.reminder(reminderId);
    await this.db.withTransactionAsync(async () => {
    await this.recordReminderDelivery(reminderId, occurrenceId, 'completed', now);
    const next = reminder.recurrence === 'none' ? null : nextMemoReminderOccurrence(this.reminderSchedule(reminder), now);
    await this.db.runAsync('UPDATE memo_reminders SET state=?,desired_schedule_status=?,actual_schedule_status=\'unknown\',os_schedule_id=NULL,next_occurrence_at=?,snooze_until=NULL,updated_at=? WHERE reminder_id=?', next ? 'ready' : 'completed', next ? 'pending' : 'cancelled', next, now, reminderId);
    await this.queueReminderSync(reminderId, this.syncOperationId(), now);
    });
    return this.reminder(reminderId);
  }
  async snoozeReminder(reminderId: string, occurrenceId: string, until: number, now = Date.now()): Promise<MemoReminder> {
    await this.reminder(reminderId);
    if (!Number.isSafeInteger(until) || until <= now) throw new Error('Snooze time is invalid.');
    await this.db.withTransactionAsync(async () => {
    await this.recordReminderDelivery(reminderId, occurrenceId, 'snoozed', now);
    await this.db.runAsync("UPDATE memo_reminders SET desired_schedule_status='pending',actual_schedule_status='unknown',os_schedule_id=NULL,next_occurrence_at=?,snooze_until=?,updated_at=? WHERE reminder_id=? AND state='ready'", until, until, now, reminderId);
    await this.queueReminderSync(reminderId, this.syncOperationId(), now);
    });
    return this.reminder(reminderId);
  }
  async markMissedReminders(now = Date.now()): Promise<MemoReminderDelivery[]> {
    const rows = await this.db.getAllAsync<MemoReminderDelivery>(`SELECT d.* FROM memo_reminder_deliveries d JOIN memo_reminders r ON r.reminder_id=d.reminder_id JOIN memos m ON m.memo_id=r.memo_id WHERE m.account_id=? AND r.state='ready' AND d.status='scheduled' AND d.occurrence_at<? ORDER BY d.occurrence_at LIMIT 100`, this.accountId, now);
    for (const row of rows) await this.recordReminderDelivery(row.reminder_id, row.occurrence_id, 'missed', now);
    return rows.map((row) => ({ ...row, status: 'missed' as const }));
  }
  async cancelReminder(reminderId: string, now = Date.now()): Promise<void> {
    await this.reminder(reminderId);
    await this.db.withTransactionAsync(async () => {
    await this.db.runAsync("UPDATE memo_reminders SET state='cancelled',target_set_state='cancelled',desired_schedule_status='cancelled',actual_schedule_status='cancelled',os_schedule_id=NULL,updated_at=? WHERE reminder_id=?", now, reminderId);
    await this.queueReminderSync(reminderId, this.syncOperationId(), now);
    });
    await this.db.runAsync("UPDATE memo_reminder_deliveries SET status='cancelled' WHERE reminder_id=? AND status IN ('scheduled','snoozed')", reminderId);
  }
  async reactivateMemoReminders(memoId: string, now = Date.now()): Promise<number> {
    await this.get(memoId);
    const result = await this.db.runAsync("UPDATE memo_reminders SET state='ready',target_set_state='ready',desired_schedule_status='pending',actual_schedule_status='unknown',updated_at=? WHERE memo_id=? AND state='suspended' AND live_count>0", now, memoId) as { changes?: number };
    return Number(result?.changes ?? 0);
  }
  async draft(memoId: string): Promise<string> {
    await this.get(memoId);
    return (await this.db.getFirstAsync<{ text: string }>('SELECT text FROM memo_drafts WHERE memo_id=?', memoId))?.text ?? '';
  }
  async draftRecord(memoId: string): Promise<{ text: string; revision: number }> {
    await this.get(memoId);
    return (await this.db.getFirstAsync<{ text: string; revision: number }>('SELECT text,revision FROM memo_drafts WHERE memo_id=?', memoId)) ?? { text: '', revision: 0 };
  }
  async saveDraft(memoId: string, text: string, revision: number): Promise<void> {
    await this.get(memoId);
    if ([...text].length > 500000) throw new Error('Draft is too large. Copy your text before leaving.');
    await this.db.runAsync('INSERT INTO memo_drafts(memo_id,text,revision) VALUES (?,?,?) ON CONFLICT(memo_id) DO UPDATE SET text=excluded.text,revision=excluded.revision WHERE excluded.revision>=memo_drafts.revision', memoId, text, revision);
  }
  /** Stable IDs bind replay to exactly one payload. Receipts are the retained item, not an outbox. */
  async saveText(memoId: string, operationId: string, itemId: string, text: string, now: number): Promise<MemoTextItem> {
    await this.get(memoId); validateMemoId(operationId); validateMemoId(itemId); validateMemoText(text);
    const receipt = await this.receipt(operationId);
    if (receipt) {
      this.checkReplay(receipt, memoId, itemId, text);
      await this.db.runAsync("DELETE FROM memo_jobs WHERE operation_id=? AND stage='committed'", operationId);
      return receipt;
    }
    const job = await this.db.getFirstAsync<{ memo_id: string; item_id: string; text: string }>('SELECT * FROM memo_jobs WHERE operation_id=?', operationId);
    if (job && (job.memo_id !== memoId || job.item_id !== itemId || job.text !== text)) throw new Error('Save operation does not match its original text.');
    await this.db.runAsync("INSERT OR IGNORE INTO memo_jobs(operation_id,memo_id,item_id,text,created_at,stage) VALUES (?,?,?,?,?,'prepared')", operationId, memoId, itemId, text, now);
    await this.db.runAsync("UPDATE memo_jobs SET stage='staged' WHERE operation_id=? AND stage='prepared'", operationId);
    await this.commit(operationId);
    const saved = await this.receipt(operationId);
    if (!saved) throw new Error('Save was not acknowledged. Retry with the same operation.');
    await this.db.runAsync('DELETE FROM memo_jobs WHERE operation_id=?', operationId);
    await this.updateSearchCounts();
    return saved;
  }
  async prepareShareJob(operationId: string, fingerprint: string, memoId: string, now: number): Promise<MemoShareJob> {
    validateMemoId(operationId); validateMemoId(memoId);
    if (!/^[a-f0-9]{64}$/i.test(fingerprint)) throw new Error('Share payload fingerprint is invalid.');
    await this.get(memoId);
    await this.db.runAsync("INSERT OR IGNORE INTO memo_share_jobs(operation_id,fingerprint,memo_id,stage,created_at,updated_at) VALUES (?,?,?,'prepared',?,?)", operationId, fingerprint, memoId, now, now);
    const job = await this.db.getFirstAsync<MemoShareJob>('SELECT * FROM memo_share_jobs WHERE fingerprint=?', fingerprint);
    if (!job || job.operation_id !== operationId || job.memo_id !== memoId) throw new Error('This share payload was already staged for another destination.');
    return job;
  }
  shareJob(fingerprint: string): Promise<MemoShareJob | null> {
    if (!/^[a-f0-9]{64}$/i.test(fingerprint)) throw new Error('Share payload fingerprint is invalid.');
    return this.db.getFirstAsync<MemoShareJob>('SELECT * FROM memo_share_jobs WHERE fingerprint=?', fingerprint);
  }
  async completeShareJob(operationId: string, now = Date.now()): Promise<void> {
    validateMemoId(operationId);
    await this.db.runAsync("UPDATE memo_share_jobs SET stage='committed',updated_at=? WHERE operation_id=?", now, operationId);
  }
  async failShareJob(operationId: string, now = Date.now()): Promise<void> {
    validateMemoId(operationId);
    await this.db.runAsync("UPDATE memo_share_jobs SET stage='failed',updated_at=? WHERE operation_id=?", now, operationId);
  }
  private async updateSearchCounts(): Promise<void> {
    const count = await this.db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM memo_items i JOIN memos m ON m.memo_id=i.memo_id WHERE m.account_id=? AND m.deleted_at IS NULL', this.accountId);
    await this.db.runAsync("UPDATE memo_search_state SET status='ready',indexed_items=?,total_items=?,last_error=NULL WHERE account_id=?", Number(count?.count ?? 0), Number(count?.count ?? 0), this.accountId);
  }
  private async reindexItem(itemId: string): Promise<void> {
    const row = await this.db.getFirstAsync<{ item_id: string; memo_id: string; revision: number; kind: string; text: string; display_name: string; title: string; description: string }>(
      `SELECT i.item_id,i.memo_id,i.revision,i.kind,i.text,i.display_name,m.title,m.description
       FROM memo_items i JOIN memos m ON m.memo_id=i.memo_id WHERE i.item_id=? AND m.account_id=? AND m.deleted_at IS NULL`, itemId, this.accountId);
    await this.db.runAsync('DELETE FROM memo_search_index WHERE item_id=?', itemId);
    if (!row) return;
    const tags = await this.db.getAllAsync<{ display_name: string }>('SELECT t.display_name FROM memo_item_tags it JOIN memo_tags t ON t.tag_id=it.tag_id WHERE it.item_id=? ORDER BY t.normalized_name', itemId);
    const tagText = tags.map((tag) => tag.display_name).join(' ');
    for (const chunk of searchChunks(row.text)) {
      await this.db.runAsync(`INSERT INTO memo_search_index(memo_id,item_id,revision,chunk_index,chunk_start,item_kind,title,description,body,display_name,tags)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`, row.memo_id, row.item_id, row.revision, chunk.index, chunk.start, row.kind, row.title, row.description, chunk.text, row.display_name, tagText);
    }
  }
  private async reindexTaggedItems(tagId: string): Promise<void> {
    const items = await this.db.getAllAsync<{ item_id: string }>('SELECT item_id FROM memo_item_tags WHERE tag_id=?', tagId);
    for (const item of items) await this.reindexItem(item.item_id);
  }
  private receipt(operationId: string): Promise<MemoTextItem | null> { return this.db.getFirstAsync<MemoTextItem>('SELECT * FROM memo_items WHERE operation_id=?', operationId); }
  private checkReplay(item: MemoTextItem, memoId: string, itemId: string, text: string): void {
    if (item.memo_id !== memoId || item.item_id !== itemId || item.text !== text) throw new Error('Save operation does not match its receipt.');
  }
  private async commit(operationId: string): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      const job = await this.db.getFirstAsync<{ memo_id: string; item_id: string; text: string; created_at: number }>('SELECT * FROM memo_jobs WHERE operation_id=?', operationId);
      if (!job) return;
      const receipt = await this.receipt(operationId);
      if (!receipt) {
        await this.db.runAsync('INSERT INTO memo_items(item_id,memo_id,author_id,text,created_at,operation_id) VALUES (?,?,?,?,?,?)', job.item_id, job.memo_id, this.accountId, job.text, job.created_at, operationId);
        await this.db.runAsync('UPDATE memos SET preview=?,updated_at=MAX(updated_at,?),revision=revision+1 WHERE memo_id=?', [...job.text].slice(0, 200).join(''), job.created_at, job.memo_id);
        await this.reindexItem(job.item_id);
        await this.queueSyncOperation(job.memo_id, operationId, job.item_id, 'item', { text: job.text, created_at: job.created_at }, job.created_at);
        // Clear only the draft we sent; a newer draft is never discarded by an old acknowledgment.
        await this.db.runAsync('DELETE FROM memo_drafts WHERE memo_id=? AND text=?', job.memo_id, job.text);
      } else this.checkReplay(receipt, job.memo_id, job.item_id, job.text);
      await this.db.runAsync("UPDATE memo_jobs SET stage='committed',text='' WHERE operation_id=?", operationId);
    });
  }
  private syncOperation(row: Record<string, unknown>): MemoSyncOperation {
    let payload: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(String(row.payload));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('payload');
      payload = parsed as Record<string, unknown>;
    } catch { throw new Error('Memo sync operation payload is corrupt.'); }
    return {
      operation_id: String(row.operation_id), memo_id: String(row.memo_id), account_id: String(row.account_id), generation: String(row.generation),
      entity_id: String(row.entity_id), entity_type: String(row.entity_type) as MemoSyncEntity, base_revision: Number(row.base_revision), predecessor_id: typeof row.predecessor_id === 'string' ? row.predecessor_id : null,
      payload, frozen_payload: String(row.frozen_payload), state: String(row.state) as MemoSyncOperation['state'], attempt: Number(row.attempt), next_attempt_at: Number(row.next_attempt_at), created_at: Number(row.created_at),
    };
  }
  private async queueSyncOperation(memoId: string, operationId: string, entityId: string, entityType: MemoSyncEntity, payload: Record<string, unknown>, now: number): Promise<void> {
    const state = await this.db.getFirstAsync<{ replication: MemoReplication; generation: string; remote_revision: number }>('SELECT replication,generation,remote_revision FROM memo_sync_state WHERE memo_id=? AND account_id=?', memoId, this.accountId);
    if (!state || state.replication !== 'synced') return;
    const frozen = JSON.stringify(payload);
    const predecessor = await this.db.getFirstAsync<{ operation_id: string; base_revision: number; remote_revision: number | null; entity_type: string }>(`SELECT operation_id,base_revision,remote_revision,entity_type FROM memo_sync_operations WHERE memo_id=? AND generation=? AND state<>'cancelled' ORDER BY rowid DESC LIMIT 1`, memoId, state.generation);
    const expectedRevision = predecessor ? predecessor.remote_revision ?? (predecessor.entity_type === 'bootstrap' ? 1 : predecessor.base_revision + 1) : state.remote_revision;
    await this.db.runAsync(`INSERT OR IGNORE INTO memo_sync_operations(operation_id,memo_id,account_id,generation,entity_id,entity_type,base_revision,predecessor_id,payload,frozen_payload,state,next_attempt_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?, ?,?)`, operationId, memoId, this.accountId, state.generation, entityId, entityType, expectedRevision, predecessor?.operation_id ?? null, frozen, frozen, 'pending', now, now);
    await this.db.runAsync("UPDATE memo_sync_state SET status='pending',complete=0,error=NULL,updated_at=? WHERE memo_id=?", now, memoId);
  }
  private async queueOrganizationSync(memoId: string, now = Date.now(), initial = false): Promise<void> {
    const state = await this.remoteState(memoId);
    if (state.replication !== 'synced') return;
    const memo = await this.get(memoId);
    const tags = await this.listTags(memoId);
    const associations = await this.db.getAllAsync<{ item_id: string; tag_id: string }>('SELECT it.item_id,it.tag_id FROM memo_item_tags it JOIN memo_items i ON i.item_id=it.item_id WHERE i.memo_id=? ORDER BY it.item_id,it.tag_id', memoId);
    const pins = await this.db.getAllAsync<MemoPin>('SELECT * FROM memo_pins WHERE memo_id=? AND user_id=? ORDER BY position,item_id', memoId, this.accountId);
    const folders = await this.db.getAllAsync<{ folder_id: string }>('SELECT folder_id FROM memo_folder_links WHERE memo_id=? ORDER BY folder_id', memoId);
    if (initial && tags.length === 0 && pins.length === 0 && folders.length === 0 && !memo.pinned && !memo.archived && !memo.ignored && !memo.unread && !memo.muted_until) return;
    await this.queueSyncOperation(memoId, this.syncOperationId(), memoId, 'preference', { kind: 'organization', tags, associations, pins, folders, pinned: memo.pinned, archived: memo.archived, ignored: memo.ignored, unread: memo.unread, muted_until: memo.muted_until }, now);
  }
  async recover(): Promise<void> {
    // One bounded page per startup; prepared/staged jobs retain user text and remain retryable.
    await this.db.runAsync("DELETE FROM memo_jobs WHERE stage='committed'");
    await this.db.runAsync("DELETE FROM memo_asset_jobs WHERE stage='committed'");
    await this.db.runAsync("UPDATE memo_archive_jobs SET stage='failed',error='Backup job was interrupted; retry it from the original path.',updated_at=? WHERE stage IN ('prepared','running')", Date.now());
    await this.db.runAsync("UPDATE memo_share_jobs SET stage='failed',updated_at=? WHERE stage='prepared'", Date.now());
    await this.db.runAsync("UPDATE memo_sync_operations SET state='pending',error='Sync worker was interrupted' WHERE state='uploading' AND account_id=?", this.accountId);
  }
  async pending(memoId: string): Promise<{ operation_id: string; item_id: string; text: string; created_at: number }[]> {
    await this.get(memoId);
    return this.db.getAllAsync('SELECT operation_id,item_id,text,created_at FROM memo_jobs WHERE memo_id=? ORDER BY created_at LIMIT 50', memoId);
  }
  async preference(memoId: string, key: MemoPreference, value: boolean): Promise<void> {
    await this.get(memoId);
    const columns: Record<MemoPreference, string> = { pinned: 'pinned', archived: 'archived', ignored: 'ignored', unread: 'unread' };
    await this.db.withTransactionAsync(async () => { await this.db.runAsync(`UPDATE memos SET ${columns[key]}=? WHERE memo_id=?`, Number(value), memoId); await this.queueOrganizationSync(memoId); });
  }
  async mute(memoId: string, until: string | null): Promise<void> {
    await this.get(memoId);
    if (until !== null && !Number.isFinite(Date.parse(until))) throw new Error('Invalid mute time');
    await this.db.withTransactionAsync(async () => { await this.db.runAsync('UPDATE memos SET muted_until=? WHERE memo_id=?', until, memoId); await this.queueOrganizationSync(memoId); });
  }
  async folder(memoId: string, folderId: string, included: boolean): Promise<void> {
    await this.get(memoId); validateMemoId(folderId);
    await this.db.withTransactionAsync(async () => {
    if (included) await this.db.runAsync('INSERT OR IGNORE INTO memo_folder_links(memo_id,folder_id) VALUES (?,?)', memoId, folderId);
    else await this.db.runAsync('DELETE FROM memo_folder_links WHERE memo_id=? AND folder_id=?', memoId, folderId);
    await this.queueOrganizationSync(memoId);
    });
  }
  folderLinks(): Promise<{ memo_id: string; folder_id: string }[]> { return this.db.getAllAsync('SELECT memo_id,folder_id FROM memo_folder_links'); }
  async removeFolder(folderId: string): Promise<void> {
    validateMemoId(folderId);
    await this.db.withTransactionAsync(async () => {
      const memos = await this.db.getAllAsync<{ memo_id: string }>('SELECT memo_id FROM memo_folder_links WHERE folder_id=?', folderId);
      await this.db.runAsync('DELETE FROM memo_folder_links WHERE folder_id=?', folderId);
      for (const memo of memos) await this.queueOrganizationSync(memo.memo_id);
    });
  }
  async trash(memoId: string, now: number, mode: MemoTrashMode = 'manual', retentionDays = 30): Promise<void> {
    const memo = await this.get(memoId);
    if (mode === 'retention' && (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650)) throw new Error('Trash retention must be between 1 and 3,650 days.');
    const purgeAfter = mode === 'retention' ? now + retentionDays * 24 * 60 * 60 * 1000 : null;
    const operationId = this.syncOperationId();
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('UPDATE memos SET deleted_at=?,purge_after=?,trash_mode=?,revision=revision+1,updated_at=? WHERE memo_id=? AND account_id=? AND deleted_at IS NULL', now, purgeAfter, mode, now, memo.memo_id, this.accountId);
      await this.db.runAsync('UPDATE memo_assets SET trashed_at=? WHERE memo_id=? AND availability=\'verified\'', now, memo.memo_id);
      await this.db.runAsync("UPDATE memo_reminders SET state='suspended',desired_schedule_status='cancelled',actual_schedule_status='cancelled',os_schedule_id=NULL,updated_at=? WHERE memo_id=? AND state IN ('building','ready')", now, memo.memo_id);
      await this.db.runAsync('INSERT INTO memo_events(event_id,memo_id,event_type,created_at) VALUES (?,?,?,?)', operationId, memo.memo_id, 'trashed', now);
      await this.queueSyncOperation(memoId, operationId, memoId, 'trash', { deleted: true, mode, purge_after: purgeAfter }, now);
    });
  }
  async restore(memoId: string, now: number): Promise<void> {
    const memo = await this.db.getFirstAsync<Memo>('SELECT * FROM memos WHERE memo_id=? AND account_id=? AND deleted_at IS NOT NULL', validateMemoId(memoId), this.accountId);
    if (!memo) throw new Error('This memo is not in trash.');
    const operationId = this.syncOperationId();
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('UPDATE memos SET deleted_at=NULL,purge_after=NULL,trash_mode=\'manual\',revision=revision+1,updated_at=? WHERE memo_id=? AND account_id=?', now, memoId, this.accountId);
      await this.db.runAsync('UPDATE memo_assets SET trashed_at=NULL WHERE memo_id=? AND availability=\'verified\'', memoId);
      await this.db.runAsync("UPDATE memo_reminders SET desired_schedule_status='cancelled',actual_schedule_status='cancelled',os_schedule_id=NULL,updated_at=? WHERE memo_id=? AND state='suspended'", now, memoId);
      await this.db.runAsync('INSERT INTO memo_events(event_id,memo_id,event_type,created_at) VALUES (?,?,?,?)', operationId, memoId, 'restored', now);
      await this.queueSyncOperation(memoId, operationId, memoId, 'trash', { deleted: false }, now);
    });
  }
  async purgeMemo(memoId: string, now: number, force = false): Promise<void> {
    const memo = await this.db.getFirstAsync<Memo>('SELECT * FROM memos WHERE memo_id=? AND account_id=? AND deleted_at IS NOT NULL', validateMemoId(memoId), this.accountId);
    if (!memo) throw new Error('This memo is not in trash.');
    if ((await this.remoteState(memoId)).replication === 'synced') throw new Error('Restore this memo and remove its cloud copy before permanently removing the local original.');
    if (!force && (memo.trash_mode !== 'retention' || !memo.purge_after || memo.purge_after > now)) throw new Error('Permanent removal requires an explicit confirmation or an eligible retention deadline.');
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('INSERT INTO memo_events(event_id,memo_id,event_type,created_at) VALUES (?,?,?,?)', this.eventId(), memoId, 'purged', now);
      await this.db.runAsync('DELETE FROM memo_item_assets WHERE item_id IN (SELECT item_id FROM memo_items WHERE memo_id=?)', memoId);
      await this.db.runAsync('DELETE FROM memo_assets WHERE memo_id=?', memoId);
      await this.db.runAsync('DELETE FROM memo_asset_jobs WHERE memo_id=?', memoId);
      await this.db.runAsync('DELETE FROM memo_jobs WHERE memo_id=?', memoId);
      await this.db.runAsync('DELETE FROM memo_drafts WHERE memo_id=?', memoId);
      await this.db.runAsync('DELETE FROM memo_bulk_selections WHERE memo_id=?', memoId);
      await this.db.runAsync('DELETE FROM memo_reminder_deliveries WHERE reminder_id IN (SELECT reminder_id FROM memo_reminders WHERE memo_id=?)', memoId);
      await this.db.runAsync('DELETE FROM memo_reminder_targets WHERE reminder_id IN (SELECT reminder_id FROM memo_reminders WHERE memo_id=?)', memoId);
      await this.db.runAsync('DELETE FROM memo_reminders WHERE memo_id=?', memoId);
      await this.db.runAsync('DELETE FROM memo_item_tags WHERE item_id IN (SELECT item_id FROM memo_items WHERE memo_id=?)', memoId);
      await this.db.runAsync('DELETE FROM memo_tags WHERE memo_id=?', memoId);
      await this.db.runAsync('DELETE FROM memo_pins WHERE memo_id=?', memoId);
      await this.db.runAsync('DELETE FROM memo_note_revisions WHERE memo_id=?', memoId);
      await this.db.runAsync('DELETE FROM memo_notes WHERE memo_id=?', memoId);
      await this.db.runAsync('DELETE FROM memo_search_index WHERE memo_id=?', memoId);
      await this.db.runAsync('DELETE FROM memo_sync_conflicts WHERE memo_id=?', memoId);
      await this.db.runAsync('DELETE FROM memo_sync_deletion_markers WHERE memo_id=?', memoId);
      await this.db.runAsync('DELETE FROM memo_sync_reminder_preferences WHERE memo_id=?', memoId);
      await this.db.runAsync('DELETE FROM memo_sync_operations WHERE memo_id=?', memoId);
      await this.db.runAsync('DELETE FROM memo_sync_state WHERE memo_id=?', memoId);
      await this.db.runAsync('DELETE FROM memo_protection_requirements WHERE memo_id=?', memoId);
      await this.db.runAsync('DELETE FROM memo_items WHERE memo_id=?', memoId);
      await this.db.runAsync('DELETE FROM memo_folder_links WHERE memo_id=?', memoId);
      await this.db.runAsync('DELETE FROM memos WHERE memo_id=? AND account_id=?', memoId, this.accountId);
    });
  }
  async purgeDue(now: number): Promise<string[]> {
    const due = await this.db.getAllAsync<{ memo_id: string }>('SELECT memo_id FROM memos WHERE account_id=? AND deleted_at IS NOT NULL AND trash_mode=\'retention\' AND purge_after IS NOT NULL AND purge_after<=? ORDER BY purge_after LIMIT 50', this.accountId, now);
    for (const row of due) await this.purgeMemo(row.memo_id, now);
    return due.map((row) => row.memo_id);
  }
  private eventId(): string {
    return `${this.accountId}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
  }
  private syncOperationId(): string {
    return this.randomUUID();
  }
}
