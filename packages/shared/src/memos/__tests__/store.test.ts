import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MemoStore, memoSchemaVersion, type MemoDatabase } from '../store';
import { conversationIdentity, memoCapabilities, memoListKey, memoReminderOccurrenceId, nextMemoReminderOccurrence, validateMemoDetails, validateMemoText } from '../types';
import type { MemoSyncChange } from '../sync';

const account = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const memo = '10000000-0000-4000-8000-000000000001';
const second = '10000000-0000-4000-8000-000000000002';
const operation = '20000000-0000-4000-8000-000000000001';
const item = '30000000-0000-4000-8000-000000000001';
const folder = '40000000-0000-4000-8000-000000000001';
const cleanup: (() => void)[] = [];
afterEach(() => { cleanup.splice(0).reverse().forEach((close) => close()); });

class HostDatabase implements MemoDatabase {
  raw: DatabaseSync;
  fail: ((sql: string) => boolean) | null = null;
  failAfterCommit = false;
  constructor(readonly path: string) { this.raw = new DatabaseSync(path); this.raw.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL'); }
  async execAsync(sql: string): Promise<void> { if (this.fail?.(sql)) throw new Error('injected storage failure'); this.raw.exec(sql); }
  async runAsync(sql: string, ...params: (string | number | null)[]): Promise<unknown> { if (this.fail?.(sql)) throw new Error('injected storage failure'); return this.raw.prepare(sql).run(...params); }
  async getFirstAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T | null> { return (this.raw.prepare(sql).get(...params) as T | undefined) ?? null; }
  async getAllAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T[]> { return this.raw.prepare(sql).all(...params) as T[]; }
  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.raw.exec('BEGIN');
    try { await task(); this.raw.exec('COMMIT'); }
    catch (error) { this.raw.exec('ROLLBACK'); throw error; }
    if (this.failAfterCommit) throw new Error('lost acknowledgment');
  }
  reopen(): void { this.raw.close(); this.raw = new DatabaseSync(this.path); this.raw.exec('PRAGMA foreign_keys=ON'); }
}
async function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'dg-memo-contract-'));
  const db = new HostDatabase(join(dir, 'vault.db'));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }), () => db.raw.close());
  const store = new MemoStore(db, account);
  await store.initialize(false); await store.create(memo, 1, 'Memo');
  return { db, store };
}
describe('durable memo text repository (host SQLite, not native encryption)', () => {
  it('preserves local-only status and recovers states written by older sync workers', async () => {
    const { db, store } = await fixture();
    await db.runAsync("UPDATE memo_sync_state SET status='sync_failed',error='Function not found',complete=0 WHERE memo_id=?", memo);
    expect(await store.remoteState(memo)).toMatchObject({ replication: 'local', status: 'local_only', error: null, complete: true });
    await store.setRemoteStatus(memo, 'sync_failed', 'Function not found', false);
    expect(await db.getFirstAsync('SELECT status,error,complete FROM memo_sync_state WHERE memo_id=?', memo)).toEqual({ status: 'local_only', error: null, complete: 1 });
    await store.configureSync(memo, 'synced', 'keep_all', other, operation, 2);
    await store.setRemoteStatus(memo, 'sync_failed', 'Function not found', false);
    expect(await store.remoteState(memo)).toMatchObject({ replication: 'synced', status: 'sync_failed', error: 'Function not found', complete: false });
  });

  it('numbers duplicate names on creation and rename while preserving retry identity', async () => {
    const { store } = await fixture();
    expect((await store.create(second, 2, 'Memo')).title).toBe('Memo (2)');
    const third = '10000000-0000-4000-8000-000000000003';
    expect((await store.create(third, 3, 'Memo')).title).toBe('Memo (3)');
    expect((await store.create(third, 4, 'Memo')).title).toBe('Memo (3)');
    await store.details(second, 'Memo', '', 5);
    expect((await store.get(second)).title).toBe('Memo (2)');
    await store.details(third, 'memo (2)', '', 6);
    expect((await store.get(third)).title).toBe('memo (3)');
  });

  it('repairs existing duplicate names when the vault reopens', async () => {
    const { store, db } = await fixture();
    await store.create(second, 2, 'Other');
    await db.runAsync('UPDATE memos SET title=? WHERE memo_id=?', 'Memo', second);
    await store.initialize(true);
    expect((await store.get(memo)).title).toBe('Memo');
    expect((await store.get(second)).title).toBe('Memo (2)');
    await store.initialize(true);
    expect((await store.get(second)).title).toBe('Memo (2)');
  });

  it('keeps numbered Unicode titles within the limit and prevents note saves from duplicating names', async () => {
    const { store } = await fixture();
    const title = '😀'.repeat(128);
    await store.details(memo, title, '', 2);
    expect((await store.create(second, 3, title)).title).toBe('😀'.repeat(124) + ' (2)');
    await store.saveNote(second, item, operation, title, '', 'A note', null, 4);
    expect((await store.get(second)).title).toBe('😀'.repeat(124) + ' (2)');
    expect((await store.note(second))?.title).toBe((await store.get(second)).title);
  });
  it('creates once, saves Unicode/newlines, closes and reopens with local receipt and no backlog', async () => {
    const { db, store } = await fixture();
    await store.create(memo, 2, 'Duplicate');
    expect((await store.list())).toHaveLength(1);
    await store.saveDraft(memo, '😀\nretained text', 1);
    await store.saveText(memo, operation, item, '😀\nretained text', 3);
    db.reopen();
    const reopened = new MemoStore(db, account); await reopened.initialize(true);
    expect((await reopened.timeline(memo))[0].text).toBe('😀\nretained text');
    expect(await reopened.draft(memo)).toBe('');
    expect(await reopened.pending(memo)).toEqual([]);
    expect(await db.getAllAsync("SELECT name FROM sqlite_master WHERE name LIKE '%outbox%' OR name='memo_operations'")).toEqual([]);
    expect((await reopened.get(memo)).replication).toBe('local');
  });
  it.each(['INSERT OR IGNORE INTO memo_jobs', "UPDATE memo_jobs SET stage='staged'", 'INSERT INTO memo_items', 'UPDATE memos SET preview', "UPDATE memo_jobs SET stage='committed'", 'DELETE FROM memo_jobs WHERE operation_id'])('recovers interruption at %s without duplicate publication', async (boundary) => {
    const { db, store } = await fixture();
    await store.saveDraft(memo, 'retained', 1);
    db.fail = (sql) => sql.startsWith(boundary);
    await expect(store.saveText(memo, operation, item, 'retained', 3)).rejects.toThrow('injected');
    db.fail = null; db.reopen();
    const reopened = new MemoStore(db, account); await reopened.initialize(true);
    await reopened.saveText(memo, operation, item, 'retained', 999);
    await reopened.saveText(memo, operation, item, 'retained', 999);
    expect(await reopened.timeline(memo)).toHaveLength(1);
    expect(await reopened.pending(memo)).toEqual([]);
    expect(await reopened.draft(memo)).toBe('');
  });
  it('recovers serverless lost commit acknowledgment from the item receipt', async () => {
    const { db, store } = await fixture();
    db.failAfterCommit = true;
    await expect(store.saveText(memo, operation, item, 'kept', 3)).rejects.toThrow('lost acknowledgment');
    db.failAfterCommit = false; db.reopen(); await store.initialize(true);
    expect((await store.saveText(memo, operation, item, 'kept', 99)).created_at).toBe(3);
    expect(await store.timeline(memo)).toHaveLength(1);
  });
  it('reconciles interrupted archive jobs as retryable failures on reopen', async () => {
    const { db, store } = await fixture();
    await store.prepareArchiveJob(operation, 'export', 'file:///backup.dgmb', 3);
    await store.updateArchiveJob(operation, 'running', 42);
    db.reopen(); const reopened = new MemoStore(db, account); await reopened.initialize(true);
    expect(await reopened.archiveJobs()).toMatchObject([{ operation_id: operation, stage: 'failed', bytes: 42, error: 'Backup job was interrupted; retry it from the original path.' }]);
  });
  it('rejects changed replay envelopes and protects newer drafts', async () => {
    const { db, store } = await fixture();
    await store.saveDraft(memo, 'newer', 4); await store.saveDraft(memo, 'old', 3);
    await store.saveText(memo, operation, item, 'old', 3);
    expect(await store.draft(memo)).toBe('newer');
    await expect(store.saveText(memo, operation, item, 'changed', 4)).rejects.toThrow('receipt');
  });
  it('keeps a durable draft when publication fails; failed draft write cannot erase the last version', async () => {
    const { db, store } = await fixture();
    await store.saveDraft(memo, 'last acknowledged', 1);
    db.fail = (sql) => sql.startsWith('INSERT INTO memo_drafts') || sql.startsWith('INSERT INTO memo_items');
    await expect(store.saveDraft(memo, 'unacknowledged', 2)).rejects.toThrow();
    await expect(store.saveText(memo, operation, item, 'unacknowledged', 4)).rejects.toThrow();
    db.fail = null; db.reopen(); await store.initialize(true);
    expect(await store.draft(memo)).toBe('last acknowledged');
    expect((await store.pending(memo))[0].text).toBe('unacknowledged');
    expect(await store.timeline(memo)).toEqual([]);
  });
  it('refuses foreign accounts, invalid IDs and newer/uninitialized existing schemas without initialization', async () => {
    const { db, store } = await fixture();
    await expect(new MemoStore(db, other).initialize(true)).rejects.toThrow('another account');
    await expect(store.get('../other')).rejects.toThrow('identifier');
    db.raw.exec(`PRAGMA user_version=${memoSchemaVersion + 1}`);
    await expect(store.initialize(true)).rejects.toThrow('Update');
    expect(db.raw.prepare('SELECT count(*) AS n FROM memos').get()?.n).toBe(1);
    db.raw.exec('PRAGMA user_version=0');
    await expect(store.initialize(true)).rejects.toThrow('recovery');
  });
  it('rolls back failed schema creation and allows a clean, explicitly new initialization retry', async () => {
    const db = new HostDatabase(':memory:'); cleanup.push(() => db.raw.close());
    const store = new MemoStore(db, account);
    db.fail = (sql) => sql.startsWith('PRAGMA user_version=');
    await expect(store.initialize(false)).rejects.toThrow();
    expect(await db.getAllAsync("SELECT name FROM sqlite_master WHERE type='table'")).toEqual([]);
    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 0 });
    db.fail = null; await store.initialize(false);
  });
  it('uses stable tie-break pagination with 50 items per page', async () => {
    const { store } = await fixture();
    for (let i = 0; i < 101; i++) {
      const suffix = String(i).padStart(12, '0');
      await store.saveText(memo, `20000000-0000-4000-8000-${suffix}`, `30000000-0000-4000-8000-${suffix}`, `text ${i}`, 10);
    }
    const first = await store.timeline(memo); const next = await store.timeline(memo, first[49]); const last = await store.timeline(memo, next[49]);
    expect([first.length, next.length, last.length]).toEqual([50, 50, 1]);
    expect(new Set([...first, ...next, ...last].map((row) => row.item_id)).size).toBe(101);
  });
  it('persists details, all local organization, and separate folder associations', async () => {
    const { db, store } = await fixture();
    await store.details(memo, 'Renamed', 'Description', 4);
    for (const key of ['pinned', 'archived', 'ignored', 'unread'] as const) await store.preference(memo, key, true);
    await store.mute(memo, '2099-01-01T00:00:00Z'); await store.folder(memo, folder, true);
    db.reopen(); await store.initialize(true);
    expect(await store.get(memo)).toMatchObject({ title: 'Renamed', description: 'Description', pinned: 1, archived: 1, ignored: 1, unread: 1 });
    expect(await store.folderLinks()).toEqual([{ memo_id: memo, folder_id: folder }]);
    await store.removeFolder(folder); expect(await store.folderLinks()).toEqual([]); expect(await store.get(memo)).toBeDefined();
  });
  it('enforces asset ownership and foreign keys across memos', async () => {
    const { db, store } = await fixture();
    await store.create(second, 1, 'Second'); await store.saveText(memo, operation, item, 'entry', 1);
    await db.runAsync("INSERT INTO memo_assets(asset_id,memo_id,opaque_path,original_name,byte_size,availability) VALUES (?,?,?,?,?,'verified')", 'asset', second, 'opaque', 'synthetic.txt', 0);
    await expect(db.runAsync('INSERT INTO memo_item_assets VALUES (?,?)', item, 'asset')).rejects.toThrow('Foreign memo');
    await expect(db.runAsync("INSERT INTO memo_assets VALUES ('orphan','absent','other','name',0,'staging')")).rejects.toThrow();
  });
});
describe('Phase 1 boundary contracts', () => {
  it('validates short text and title by code points without truncation', () => {
    expect(validateMemoText('😀'.repeat(4096))).toHaveLength(8192);
    expect(() => validateMemoText('😀'.repeat(4097))).toThrow('kept');
    expect(() => validateMemoText(' \n ')).toThrow();
    expect(() => validateMemoDetails('😀'.repeat(128), '')).not.toThrow();
    expect(() => validateMemoDetails('a'.repeat(129), '')).toThrow();
    expect(() => validateMemoDetails('a', 'b'.repeat(501))).toThrow();
  });
  it('namespaces memo IDs and disables later-phase capabilities', () => {
    expect(conversationIdentity(memoListKey(memo))).toEqual({ kind: 'memo', memoId: memo });
    expect(conversationIdentity(memo)).toEqual({ kind: 'chat', chatId: memo });
    expect(Object.entries(memoCapabilities).filter(([, value]) => value).map(([key]) => key)).toEqual(['text', 'attachments', 'notes', 'search', 'sync', 'reminders', 'protection']);
  });
});

describe('Phase 5 reminder contracts', () => {
  it('freezes a ready target set atomically and records unavailable targets', async () => {
    const { store } = await fixture();
    await store.saveText(memo, operation, item, 'target', 10);
    const reminderId = '50000000-0000-4000-8000-000000000001';
    const created = await store.createReminder({ reminder_id: reminderId, memo_id: memo, mode: 'regular', item_ids: [item, '30000000-0000-4000-8000-000000000099'], schedule: { kind: 'one_time', at: 1000, timezone: 'UTC', recurrence: 'none' }, now: 20 });
    expect(created).toMatchObject({ state: 'ready', target_set_state: 'ready', selected_count: 2, live_count: 1, unavailable_count: 1, desired_schedule_status: 'pending' });
    expect(await store.reminderTargets(reminderId)).toMatchObject([{ state: 'live' }, { state: 'unavailable', unavailable_reason: 'missing' }]);
    await expect(store.createReminder({ reminder_id: '50000000-0000-4000-8000-000000000002', memo_id: memo, mode: 'regular', item_ids: ['30000000-0000-4000-8000-000000000098'], schedule: { kind: 'one_time', at: 1000, timezone: 'UTC', recurrence: 'none' }, now: 20 })).rejects.toThrow('available');
  });
  it('uses stable occurrence IDs, supports missed/snoozed/completed delivery, and suspends trash until explicit reactivation', async () => {
    const { store } = await fixture();
    await store.saveText(memo, operation, item, 'target', 10);
    const reminderId = '50000000-0000-4000-8000-000000000003';
    await store.createReminder({ reminder_id: reminderId, memo_id: memo, mode: 'alarm', item_ids: [item], schedule: { kind: 'one_time', at: 100, timezone: 'UTC', recurrence: 'none' }, now: 20 });
    expect(nextMemoReminderOccurrence({ kind: 'one_time', at: 100, timezone: 'UTC', recurrence: 'none' }, 20)).toBe(100);
    const occurrence = await store.prepareReminderOccurrence(reminderId, 100, 20);
    expect(occurrence.occurrence_id).toBe(memoReminderOccurrenceId(reminderId, 1, 100));
    expect((await store.markMissedReminders(200))[0].status).toBe('missed');
    await store.snoozeReminder(reminderId, occurrence.occurrence_id, 500, 200);
    await store.trash(memo, 300);
    expect((await store.reminder(reminderId)).state).toBe('suspended');
    await store.restore(memo, 400);
    expect((await store.reminder(reminderId)).state).toBe('suspended');
    expect(await store.reactivateMemoReminders(memo, 500)).toBe(1);
    expect((await store.reminder(reminderId)).state).toBe('ready');
    await store.cancelReminder(reminderId, 600);
    expect((await store.reminder(reminderId)).state).toBe('cancelled');
  });
});

describe('Phase 6 memo sync contracts', () => {
  it('captures bootstrap and subsequent local commits in the generation-bound outbox', async () => {
    const { store } = await fixture();
    const generation = '60000000-0000-4000-8000-000000000001';
    const bootstrap = '60000000-0000-4000-8000-000000000002';
    await expect(store.configureSync(memo, 'synced', 'keep_all', generation, bootstrap, 10)).resolves.toMatchObject({ replication: 'synced', status: 'bootstrapping', complete: false });
    const bootstrapOperation = (await store.pendingSyncOperations(memo, 10))[0];
    expect(bootstrapOperation).toMatchObject({ operation_id: bootstrap, entity_type: 'bootstrap', generation });
    await store.acknowledgeSyncOperation(bootstrap, 1, 0, 11);
    await store.saveText(memo, '60000000-0000-4000-8000-000000000003', item, 'offline edit', 12);
    const pending = await store.pendingSyncOperations(memo, 12);
    expect(pending).toMatchObject([{ entity_id: item, entity_type: 'item', generation, base_revision: 1 }]);
  });

  it('preserves a remote edit as a conflict and records deletion markers without moving the cursor backward', async () => {
    const { db, store } = await fixture();
    const generation = '60000000-0000-4000-8000-000000000011';
    const bootstrap = '60000000-0000-4000-8000-000000000012';
    await store.configureSync(memo, 'synced', 'on_demand', generation, bootstrap, 10);
    await store.acknowledgeSyncOperation(bootstrap, 1, 0, 11);
    await store.saveText(memo, '60000000-0000-4000-8000-000000000013', item, 'local edit', 12);
    const change: MemoSyncChange = { change_position: 1, operation_id: '60000000-0000-4000-8000-000000000014', memo_id: memo, generation, entity_id: item, entity_type: 'item', revision: 2, payload: { text: 'remote edit' }, deleted: false };
    await store.applyRemoteSyncChange(change, 13);
    expect(await store.syncConflicts(memo)).toMatchObject([{ local_operation_id: '60000000-0000-4000-8000-000000000013', remote_revision: 2 }]);
    await store.applyRemoteSyncChange({ ...change, change_position: 2, operation_id: '60000000-0000-4000-8000-000000000015', deleted: true }, 14);
    expect(await store.remoteState(memo)).toMatchObject({ cursor: 2, status: 'conflict' });
    expect(await db.getAllAsync('SELECT entity_id FROM memo_sync_deletion_markers WHERE memo_id=?', memo)).toEqual([{ entity_id: item }]);
  });

  it('does not skip unseen remote changes when acknowledging a later upload', async () => {
    const { store } = await fixture();
    await store.configureSync(memo, 'synced', 'keep_all', other, operation, 10);
    await store.acknowledgeSyncOperation(operation, 1, 0, 11);
    await store.saveText(memo, folder, item, 'local', 12);
    await store.acknowledgeSyncOperation(folder, 9, 8, 13);
    expect((await store.remoteState(memo)).cursor).toBe(0);
    await store.applyRemoteSyncChange({ memo_id: memo, generation: other, operation_id: second, entity_id: second, entity_type: 'item', change_position: 1, revision: 2, payload: { text: 'previously unseen', created_at: 5 }, deleted: false });
    expect((await store.timeline(memo)).map((entry) => entry.text)).toContain('previously unseen');
  });

  it('converges two independent SQLite stores and indexes downloaded text without an echo outbox', async () => {
    const left = await fixture(); const right = await fixture();
    for (const side of [left, right]) {
      await side.store.configureSync(memo, 'synced', 'keep_all', other, operation, 10);
      await side.store.acknowledgeSyncOperation(operation, 1, 0, 11);
    }
    await left.store.saveText(memo, folder, item, 'converged searchable text', 12);
    const queued = (await left.store.pendingSyncOperations(memo, 12))[0];
    expect(queued).toBeDefined();
    const change: MemoSyncChange = { operation_id: folder, memo_id: memo, generation: other, entity_id: item, entity_type: 'item', revision: 2, change_position: 1, payload: { text: 'converged searchable text', created_at: 12 }, deleted: false };
    await left.store.acknowledgeSyncOperation(folder, 2, 1, 13);
    for (const side of [left, right]) { await side.store.applyRemoteSyncChange(change, 14); await side.store.applyRemoteSyncChange(change, 15); }
    const content = async (store: MemoStore) => (await store.timeline(memo)).map((entry) => ({ item_id: entry.item_id, text: entry.text, created_at: entry.created_at }));
    expect(await content(right.store)).toEqual(await content(left.store));
    expect((await right.store.search('searchable'))[0]?.item_id).toBe(item);
    expect(await right.store.pendingSyncOperations(memo, 20)).toEqual([]);
    expect((await right.store.remoteState(memo)).cursor).toBe(1);
  });

  it('rolls back malformed changes and refuses gaps before moving the cursor', async () => {
    const { store } = await fixture();
    await store.configureSync(memo, 'synced', 'keep_all', other, operation, 10);
    const change: MemoSyncChange = { operation_id: folder, memo_id: memo, generation: other, entity_id: item, entity_type: 'item', revision: 2, change_position: 1, payload: { text: 42 }, deleted: false };
    await expect(store.applyRemoteSyncChange(change)).rejects.toThrow('invalid');
    await expect(store.applyRemoteSyncChange({ ...change, change_position: 2 })).rejects.toThrow('gap');
    expect((await store.remoteState(memo)).cursor).toBe(0);
    expect(await store.timeline(memo)).toEqual([]);
  });

  it('chains different offline entities behind bootstrap using remote revisions', async () => {
    const { db, store } = await fixture();
    await store.saveText(memo, operation, item, 'retained', 3);
    await store.configureSync(memo, 'synced', 'keep_all', other, folder, 10);
    await store.saveText(memo, second, second, 'after opt-in', 11);
    const rows = await db.getAllAsync<{ operation_id: string; predecessor_id: string | null; base_revision: number }>('SELECT operation_id,predecessor_id,base_revision FROM memo_sync_operations ORDER BY rowid');
    expect(rows.map((row) => row.base_revision)).toEqual([0, 1, 2]);
    expect(rows[2]?.predecessor_id).toBe(rows[1]?.operation_id);
    await expect(store.configureSync(memo, 'synced', 'keep_all', item, second, 12)).rejects.toThrow('existing remote copy');
  });

  it('imports a new-device cloud identity without creating an echo bootstrap or overwriting local work', async () => {
    const { store } = await fixture();
    await store.importRemoteMemo(second, other, 'From cloud', '', 10);
    expect(await store.remoteState(second)).toMatchObject({ replication: 'synced', generation: other, status: 'downloading', cursor: 0 });
    expect(await store.pendingSyncOperations(second, 20)).toEqual([]);
    await store.importRemoteMemo(memo, other, 'Do not overwrite', '', 11);
    expect((await store.get(memo)).title).toBe('Memo');
    expect((await store.remoteState(memo)).replication).toBe('local');
  });

  it('carries protection requirements to a new store and withholds list/search previews', async () => {
    const { store } = await fixture();
    await store.saveText(memo, operation, item, 'private searchable content', 3);
    await store.setProtectionRequired(memo, true, 4);
    expect((await store.list())[0]?.preview).toBe('');
    expect(await store.search('searchable')).toEqual([]);
    await store.configureSync(memo, 'synced', 'keep_all', other, folder, 5);
    expect((await store.pendingSyncOperations(memo, 6))[0]?.payload.protection_required).toBe(true);
    await store.importRemoteMemo(second, other, 'Protected from cloud', '', 10, true);
    expect(await store.protectionRequired(second)).toBe(true);
  });

  it('materializes snapshot entries without advancing the cursor until its final watermark', async () => {
    const { store } = await fixture();
    await store.configureSync(memo, 'synced', 'keep_all', other, operation, 10);
    await store.applyRemoteSyncChange({ operation_id: folder, memo_id: memo, generation: other, entity_id: item, entity_type: 'item', revision: 8, change_position: 7, payload: { text: 'snapshot text', created_at: 12 }, deleted: false }, 20, true);
    expect((await store.remoteState(memo)).cursor).toBe(0);
    expect((await store.timeline(memo))[0]?.text).toBe('snapshot text');
    await store.finishSyncSnapshot(memo, other, 8, 21);
    expect((await store.remoteState(memo)).cursor).toBe(8);
    await expect(store.finishSyncSnapshot(memo, second, 10)).rejects.toThrow('stale');
  });

  it('preserves immutable envelopes while explicitly resolving a private text conflict', async () => {
    const { db, store } = await fixture();
    await store.configureSync(memo, 'synced', 'keep_all', other, operation, 10);
    await store.acknowledgeSyncOperation(operation, 1, 0, 11);
    await store.saveText(memo, folder, item, 'local choice', 12);
    await store.applyRemoteSyncChange({ operation_id: second, memo_id: memo, generation: other, entity_id: item, entity_type: 'item', revision: 2, change_position: 1, payload: { text: 'remote choice', created_at: 12 }, deleted: false }, 13);
    const conflict = (await store.syncConflicts(memo))[0];
    if (!conflict) throw new Error('Expected conflict');
    await store.resolveSyncConflict(memo, conflict.conflict_id, 'local', 14);
    const replacement = (await store.pendingSyncOperations(memo, 15))[0];
    expect(replacement).toMatchObject({ base_revision: 2, payload: { text: 'local choice' } });
    expect(replacement?.operation_id).not.toBe(folder);
    expect(await db.getFirstAsync('SELECT state,frozen_payload FROM memo_sync_operations WHERE operation_id=?', folder)).toMatchObject({ state: 'cancelled', frozen_payload: JSON.stringify({ text: 'local choice', created_at: 12 }) });
    expect(await store.syncConflicts(memo)).toEqual([]);
  });

  it('bootstraps private tags, pins and memo-folder links into a separate store', async () => {
    const left = await fixture(); const right = await fixture();
    await left.store.saveText(memo, operation, item, 'organized', 3);
    await left.store.createTag(memo, other, 'Work', 'owner', 4);
    await left.store.tagItems(memo, other, [item]);
    await left.store.setPin(memo, item, account, true);
    await left.store.folder(memo, folder, true);
    await left.store.configureSync(memo, 'synced', 'keep_all', second, folder, 10);
    await right.store.configureSync(memo, 'synced', 'keep_all', second, folder, 10);
    const rows = await left.db.getAllAsync<{ operation_id: string; entity_id: string; entity_type: MemoSyncChange['entity_type']; payload: string }>("SELECT operation_id,entity_id,entity_type,payload FROM memo_sync_operations WHERE entity_type<>'bootstrap' ORDER BY rowid");
    expect(rows.map((row) => row.entity_type)).toEqual(['item', 'preference']);
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      if (!row) throw new Error('Missing bootstrap row');
      await right.store.applyRemoteSyncChange({ memo_id: memo, generation: second, operation_id: row.operation_id, entity_id: row.entity_id, entity_type: row.entity_type, change_position: index + 1, revision: index + 2, payload: JSON.parse(row.payload) as Record<string, unknown>, deleted: false }, 11 + index);
    }
    expect((await right.store.listTags(memo))[0]?.display_name).toBe('Work');
    expect((await right.store.pins(memo, account))[0]?.item_id).toBe(item);
    expect(await right.store.folderLinks()).toEqual([{ memo_id: memo, folder_id: folder }]);
    expect((await right.store.search('work'))[0]?.item_id).toBe(item);
  });
});

describe('Phase 3 indexed organization contracts', () => {
  it('indexes titles, text, tags and cross-chunk phrases with bounded result snippets', async () => {
    const { store } = await fixture();
    const longText = `${'x'.repeat(1900)} boundary phrase ${'y'.repeat(1900)}`;
    await store.saveText(memo, operation, item, longText, 3);
    await store.details(memo, 'Indexed title', 'Indexed description', 4);
    const tag = await store.createTag(memo, '60000000-0000-4000-8000-000000000001', '  Work  ');
    await store.tagItems(memo, tag.tag_id, [item]);
    expect((await store.search('boundary phrase'))[0]).toMatchObject({ item_id: item, memo_title: 'Indexed title' });
    expect((await store.search('work'))[0]?.tags).toEqual(['Work']);
    expect(await store.searchState()).toMatchObject({ status: 'ready', indexed_items: 1, total_items: 1 });
  });

  it('normalizes duplicate tags, rejects rename collisions atomically and persists frozen selections and private pins', async () => {
    const { store } = await fixture();
    const secondItem = '30000000-0000-4000-8000-000000000002';
    await store.saveText(memo, operation, item, 'first', 3);
    await store.saveText(memo, '20000000-0000-4000-8000-000000000002', secondItem, 'second', 4);
    const work = await store.createTag(memo, '60000000-0000-4000-8000-000000000001', 'Work', 'owner', 5);
    const duplicate = await store.createTag(memo, '60000000-0000-4000-8000-000000000002', ' Ｗｏｒｋ ', 'owner', 6);
    expect(duplicate.tag_id).toBe(work.tag_id);
    const home = await store.createTag(memo, '60000000-0000-4000-8000-000000000003', 'Home', 'owner', 7);
    await expect(store.renameTag(memo, work.tag_id, 'Home')).rejects.toThrow('already exists');
    expect(await store.listTags(memo)).toMatchObject([{ display_name: 'Home' }, { display_name: 'Work' }]);
    await store.tagItems(memo, work.tag_id, [item, secondItem]);
    const selection = await store.createBulkSelection(memo, '70000000-0000-4000-8000-000000000001', [secondItem, item], 8);
    expect(selection.item_ids).toEqual([secondItem, item]);
    expect(await store.bulkSelection(memo, selection.selection_id)).toMatchObject({ item_ids: [item, secondItem] });
    await store.setPin(memo, item, account, true, 'personal', 'viewer', 9);
    expect((await store.search('first', { userId: account }))[0]?.pinned).toBe(true);
    expect((await store.search('first', { userId: other }))[0]?.pinned).toBe(false);
    await expect(store.setPin(memo, item, other, true)).rejects.toThrow('belong to their user');
    expect(home.display_name).toBe('Home');
  });

  it('returns item counts for each type filter and keeps ordinary files separate from others', async () => {
    const { store } = await fixture();
    await store.saveText(memo, operation, item, 'https://example.test', 3);
    const assetOperation = '20000000-0000-4000-8000-000000000002';
    const assetItem = '30000000-0000-4000-8000-000000000002';
    const assetId = '50000000-0000-4000-8000-000000000001';
    await store.prepareAsset({ operation_id: assetOperation, memo_id: memo, item_id: assetItem, asset_id: assetId, original_name: 'guide.pdf', mime_type: 'application/pdf', detected_type: 'file', byte_size: 1, checksum: null, created_at: 4 });
    await store.stageAsset(assetOperation, 'stage'); await store.promoteAsset(assetOperation, 'final'); await store.commitAsset(assetOperation);
    const counts = await store.filterCounts();
    expect(counts.messages).toBe(1); expect(counts.links).toBe(1); expect(counts.files).toBe(1); expect(counts.others).toBe(0);
  });

  it('covers all nine overlapping filters and finds historical indexed items without timeline limits', async () => {
    const { store } = await fixture();
    await store.saveText(memo, operation, item, 'old message https://example.test', 1);
    const attachments = [
      ['20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', 'photo.jpg', 'image/jpeg', 'photo'],
      ['20000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000003', 'video.mp4', 'video/mp4', 'video'],
      ['20000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000004', 'voice.m4a', 'audio/mp4', 'voice'],
      ['20000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000005', 'guide.pdf', 'application/pdf', 'file'],
      ['20000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000006', '50000000-0000-4000-8000-000000000006', 'installer.bin', 'application/octet-stream', 'file'],
    ] as const;
    for (const [op, itemId, assetId, name, mime, type] of attachments) {
      await store.prepareAsset({ operation_id: op, memo_id: memo, item_id: itemId, asset_id: assetId, original_name: name, mime_type: mime, detected_type: type, byte_size: 1, checksum: null, created_at: 2 });
      await store.stageAsset(op, `stage:${assetId}`); await store.promoteAsset(op, `final:${assetId}`); await store.commitAsset(op);
    }
    const counts = await store.filterCounts();
    expect(counts).toMatchObject({ all: 6, messages: 1, photos: 1, videos: 1, photosVideos: 2, audios: 1, files: 1, links: 1, others: 1 });
    expect(await store.listFiltered('photosVideos')).toHaveLength(1);
    expect(await store.listFiltered('others')).toHaveLength(1);
    expect((await store.search('old message'))[0]).toMatchObject({ item_id: item, block_start: 0 });
  });

  it('reports rebuild progress and a recoverable error instead of hiding index failures', async () => {
    const { db, store } = await fixture();
    await store.saveText(memo, operation, item, 'rebuild me', 2);
    db.fail = (sql) => sql.startsWith('DELETE FROM memo_search_index');
    await expect(store.rebuildSearch()).rejects.toThrow('rebuild failed');
    expect(await store.searchState()).toMatchObject({ status: 'error', last_error: expect.any(String) });
    db.fail = null;
    await store.rebuildSearch();
    expect(await store.searchState()).toMatchObject({ status: 'ready', indexed_items: 1, total_items: 1 });
  });
});

describe('Phase 2 attachment and trash contracts', () => {
  it('commits an attachment through a replay-safe staged job and exposes it in the timeline', async () => {
    const { store } = await fixture();
    const saved = await store.prepareAsset({ operation_id: operation, memo_id: memo, item_id: item, asset_id: '50000000-0000-4000-8000-000000000001', original_name: 'photo.jpg', mime_type: 'image/jpeg', detected_type: 'photo', byte_size: 12, checksum: 'md5:abc', created_at: 4 });
    expect(saved.stage).toBe('prepared');
    await store.stageAsset(operation, 'file:///private/staging/photo');
    await store.promoteAsset(operation, 'file:///private/assets/photo');
    const attachment = await store.commitAsset(operation);
    expect(attachment.asset).toMatchObject({ original_name: 'photo.jpg', detected_type: 'photo', byte_size: 12, availability: 'verified' });
    expect(await store.pendingAssets(memo)).toEqual([]);
    expect(await store.timeline(memo)).toMatchObject([{ kind: 'attachment', display_name: 'photo.jpg', asset: { asset_id: attachment.asset.asset_id } }]);
    await expect(store.commitAsset(operation)).resolves.toMatchObject({ asset: { asset_id: attachment.asset.asset_id } });
  });
  it('supports manual trash, restore, retention eligibility and explicit permanent removal', async () => {
    const { store } = await fixture();
    await store.trash(memo, 100, 'manual');
    expect(await store.list()).toEqual([]);
    expect((await store.listTrash())[0]).toMatchObject({ deleted_at: 100, trash_mode: 'manual', purge_after: null });
    await expect(store.purgeMemo(memo, 101)).rejects.toThrow('explicit confirmation');
    await store.restore(memo, 102);
    expect(await store.list()).toHaveLength(1);
    await store.trash(memo, 103, 'retention', 1);
    await expect(store.purgeDue(103)).resolves.toEqual([]);
    await expect(store.purgeDue(103 + 24 * 60 * 60 * 1000)).resolves.toEqual([memo]);
    expect(await store.listTrash()).toEqual([]);
  });
  it('accounts live and trashed bytes without counting a repair twice', async () => {
    const { store } = await fixture();
    await store.prepareAsset({ operation_id: operation, memo_id: memo, item_id: item, asset_id: '50000000-0000-4000-8000-000000000001', original_name: 'a.bin', mime_type: 'application/octet-stream', detected_type: 'file', byte_size: 7, checksum: null, created_at: 4 });
    await store.stageAsset(operation, 'stage'); await store.promoteAsset(operation, 'final'); await store.commitAsset(operation);
    expect(await store.accounting()).toMatchObject({ live_bytes: 7, trash_bytes: 0, total_bytes: 7 });
    await store.trash(memo, 10); expect(await store.accounting()).toMatchObject({ live_bytes: 0, trash_bytes: 7, total_bytes: 7 });
  });
});

describe('Phase 4 note contracts', () => {
  it('keeps an encrypted-vault recovery draft separate until note publication', async () => {
    const { store } = await fixture();
    await store.saveNoteDraft(memo, 'Draft title', 'Draft description', 'unsaved body', 0, 10);
    expect(await store.noteDraft(memo)).toMatchObject({ title: 'Draft title', body: 'unsaved body', revision: 0 });
    const saved = await store.saveNote(memo, '30000000-0000-4000-8000-000000000019', '20000000-0000-4000-8000-000000000019', 'Draft title', 'Draft description', 'published body', null, 11);
    expect(saved.body).toBe('published body');
    expect(await store.noteDraft(memo)).toBeNull();
  });

  it('persists a 500,000-code-point note, indexes its body, and restores a prior revision', async () => {
    const { store } = await fixture();
    const body = `${'a'.repeat(499999)}😀`;
    const saved = await store.saveNote(memo, '30000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000009', 'Long note', 'Description', body, 'baseline', 10);
    expect(saved.revision).toBe(1); expect([...saved.body]).toHaveLength(500000);
    await expect(store.saveNote(memo, saved.item_id, '20000000-0000-4000-8000-000000000010', 'Long note', '', `${body}x`, null, 11)).rejects.toThrow('500,000');
    await store.saveNote(memo, saved.item_id, '20000000-0000-4000-8000-000000000011', 'Long note', '', 'short searchable note', 'short', 12);
    expect((await store.search('searchable'))[0]).toMatchObject({ item_id: saved.item_id, block_start: 0 });
    const revisions = await store.noteRevisions(memo); expect(revisions).toHaveLength(2); expect(revisions[1]?.named).toBe('baseline');
    const restored = await store.restoreNoteRevision(memo, revisions[1]!.revision_id, '20000000-0000-4000-8000-000000000012', 13);
    expect(restored.body).toBe(body); expect(restored.revision).toBe(3);
  });
});
