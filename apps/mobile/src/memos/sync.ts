import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { acknowledgeMemoSyncOperation, type MemoRemoteStatus, type MemoSyncChange, type MemoSyncOperation } from '@dologram/shared';
import { supabase } from '../lib/supabase';
import { subscribeNetState } from '../net/netState';
import { isMemoScopeCurrent, type MemoScope } from './lifecycle';
import { subscribeMemos, withMemoStore } from './vault';
import { downloadMemoAsset, uploadMemoAsset } from './remoteAssets';
import { memoReminderPushToken } from '../notifications/pushNotifications';
import { loadMemoReminderPreferences } from '../notifications/memoPreferences';
import { isMemoProtected } from './protection';

type ApiObject = Record<string, unknown>;
type SyncAck = { operation_id: string; memo_id: string; generation: string; remote_revision: number; change_position: number; receipt: Record<string, unknown>; remote_memo_id?: string };
type ChangeResponse = { changes: MemoSyncChange[]; minimum_position: number; has_more: boolean };

function object(value: unknown): ApiObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Memo sync returned an invalid response.');
  return value as ApiObject;
}
function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) throw new Error('Memo sync returned an invalid identifier.');
  return value;
}
function ack(value: unknown): SyncAck {
  const row = object(value);
  if (typeof row.operation_id !== 'string' || typeof row.memo_id !== 'string' || typeof row.generation !== 'string' || typeof row.remote_revision !== 'number' || typeof row.change_position !== 'number') throw new Error('Memo sync returned an incomplete acknowledgment.');
  return { operation_id: uuid(row.operation_id), memo_id: uuid(row.memo_id), generation: uuid(row.generation), remote_revision: row.remote_revision, change_position: row.change_position, receipt: row.receipt && typeof row.receipt === 'object' && !Array.isArray(row.receipt) ? row.receipt as Record<string, unknown> : {}, remote_memo_id: typeof row.remote_memo_id === 'string' ? row.remote_memo_id : undefined };
}
function changes(value: unknown): ChangeResponse {
  const row = object(value);
  if (!Array.isArray(row.changes) || typeof row.minimum_position !== 'number' || typeof row.has_more !== 'boolean') throw new Error('Memo sync returned an incomplete change page.');
  return { changes: row.changes as MemoSyncChange[], minimum_position: row.minimum_position, has_more: row.has_more };
}
async function call(action: string, body: ApiObject): Promise<unknown> {
  const result = await supabase.functions.invoke('memo-sync', { body: { action, ...body }, timeout: 30_000 });
  if (result.error instanceof FunctionsHttpError) {
    if (result.error.context.status === 404) throw new Error('Memo cloud sync is unavailable: the memo-sync service has not been deployed. Your memo is saved on this device.');
    const failure: unknown = await result.error.context.json();
    const code = object(failure).code;
    if (typeof code === 'string' && /^MEMO_[A-Z_]+$/.test(code)) throw new Error(code);
  }
  if (result.error) throw result.error;
  const response = object(result.data);
  if (typeof response.code === 'string') throw new Error(response.code);
  return result.data;
}
function remoteStatus(error: unknown): MemoRemoteStatus {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('QUOTA')) return 'quota_exceeded';
  if (message.includes('CONFLICT')) return 'conflict';
  if (message.includes('NOT_ALLOWED')) return 'access_removed';
  return 'sync_failed';
}

async function sendOperation(scope: MemoScope, operation: MemoSyncOperation): Promise<void> {
  const uploading = await withMemoStore(scope, (store) => store.markSyncOperationUploading(operation.operation_id));
  let result: unknown;
  if (uploading.entity_type === 'bootstrap') {
    result = await call('create', { memo_id: uploading.memo_id, generation: uploading.generation, operation_id: uploading.operation_id, title: uploading.payload.title, description: uploading.payload.description, protection_required: uploading.payload.protection_required === true, residency: (uploading.payload.residency === 'on_demand' ? 'on_demand' : 'keep_all') });
  } else if (uploading.entity_type === 'close_remote') {
    result = await call('close_remote', { memo_id: uploading.memo_id, generation: uploading.generation, operation_id: uploading.operation_id, expected_revision: uploading.payload.expected_revision, complete_local_copy: uploading.payload.complete_local_copy });
    if (object(result).closed !== true) throw new Error('MEMO_CLEANUP_PENDING');
  } else {
    if (uploading.entity_type === 'asset') {
      const assetId = uploading.payload.asset_id;
      if (typeof assetId !== 'string') throw new Error('Memo asset operation has no attachment identity.');
      // Reservation and publication have separate persisted identities. A reserve
      // receipt must never be mistaken for the mutation acknowledgment.
      const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${uploading.generation}:${uploading.operation_id}:asset-reservation`);
      const hex = digest.slice(0, 32);
      const reservationId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      await uploadMemoAsset(scope, uploading.memo_id, assetId, reservationId);
    }
    if (uploading.entity_type === 'note') {
      const body = uploading.payload.body;
      if (typeof body !== 'string') throw new Error('Memo note operation is invalid.');
      const points = [...body];
      const count = Math.max(1, Math.ceil(points.length / 16_384));
      for (let index = 0; index < count; index++) {
        if (!isMemoScopeCurrent(scope)) throw new Error('Memo account changed.');
        await call('note_block', { memo_id: uploading.memo_id, generation: uploading.generation, operation_id: uploading.operation_id, index, body: points.slice(index * 16_384, (index + 1) * 16_384).join('') });
      }
      const { body: _body, ...metadata } = uploading.payload;
      result = await call('note_commit', { memo_id: uploading.memo_id, generation: uploading.generation, operation_id: uploading.operation_id, entity_id: uploading.entity_id, base_revision: uploading.base_revision, predecessor_id: uploading.predecessor_id, payload: metadata, count, digest: await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, body) });
    } else {
      result = await call('mutation', { memo_id: uploading.memo_id, generation: uploading.generation, operation_id: uploading.operation_id, entity_id: uploading.entity_id, entity_type: uploading.entity_type, base_revision: uploading.base_revision, predecessor_id: uploading.predecessor_id, payload: uploading.payload });
    }
  }
  const acknowledged = ack(result);
  const contractAck = acknowledgeMemoSyncOperation(uploading, acknowledged);
  await withMemoStore(scope, async (store) => {
    if (contractAck.generation !== uploading.generation) throw new Error('Memo sync generation changed during upload.');
    await store.acknowledgeSyncOperation(uploading.operation_id, acknowledged.remote_revision, acknowledged.change_position);
    if (uploading.entity_type === 'bootstrap') await store.setRemoteMemoId(uploading.memo_id, acknowledged.remote_memo_id ?? uploading.memo_id);
    if (uploading.entity_type === 'close_remote') {
      const generation = uploading.payload.new_generation;
      if (typeof generation !== 'string') throw new Error('Memo removal generation is invalid.');
      await store.closeRemoteCopy(uploading.memo_id, generation, uploading.operation_id);
    }
  }, true);
}

async function catchUp(scope: MemoScope): Promise<void> {
  const memos = await withMemoStore(scope, async (store) => [...await store.list(), ...await store.listTrash()]);
  for (const memo of memos) {
    if (!isMemoScopeCurrent(scope)) return;
    const state = await withMemoStore(scope, (store) => store.remoteState(memo.memo_id));
    if (state.replication !== 'synced' || state.status === 'access_removed') continue;
    let cursor = state.cursor;
    for (let pageNumber = 0; pageNumber < 10 && isMemoScopeCurrent(scope); pageNumber++) {
      const page = changes(await call('changes', { memo_id: memo.memo_id, generation: state.generation, after: cursor, limit: 100 }));
      if (page.minimum_position > cursor + 1) {
        cursor = await restoreSnapshot(scope, memo.memo_id, state.generation);
        continue;
      }
      for (const change of page.changes) await withMemoStore(scope, (store) => store.applyRemoteSyncChange(change), true);
      const nextCursor = (await withMemoStore(scope, (store) => store.remoteState(memo.memo_id))).cursor;
      if (!page.has_more) break;
      if (nextCursor <= cursor) throw new Error('Memo sync returned a page without progress.');
      cursor = nextCursor;
    }
    if ((await withMemoStore(scope, (store) => store.get(memo.memo_id, true))).deleted_at) continue;
    const historyWatermark = (await withMemoStore(scope, (store) => store.remoteState(memo.memo_id))).cursor;
    let historyAfter = 0;
    for (let historyPage = 0; historyPage < 200; historyPage++) {
      if (!isMemoScopeCurrent(scope)) return;
      const history = object(await call('note_history', { memo_id: memo.memo_id, generation: state.generation, after: historyAfter, watermark: historyWatermark }));
      if (!Array.isArray(history.revisions)) throw new Error('Memo note history is invalid.');
      if (history.revisions.length === 0) break;
      const revision = object(history.revisions[0]); const payload = object(revision.payload);
      if (typeof revision.revision !== 'number' || !Number.isSafeInteger(revision.revision) || revision.revision <= historyAfter || typeof revision.created_at !== 'number' || typeof payload.title !== 'string' || typeof payload.description !== 'string' || typeof payload.body !== 'string' || payload.named !== null && payload.named !== undefined && typeof payload.named !== 'string') throw new Error('Memo note history revision is invalid.');
      const revisionId = uuid(payload.local_revision_id ?? revision.revision_id);
      const version = revision.revision; const title = payload.title; const description = payload.description; const body = payload.body; const named = typeof payload.named === 'string' ? payload.named : null; const createdAt = revision.created_at;
      await withMemoStore(scope, (store) => store.recordNoteRevision(memo.memo_id, revisionId, version, title, description, body, named, createdAt));
      historyAfter = version;
      if (historyPage === 199) throw new Error('Memo history exceeds this session’s transfer limit. Cloud removal is unavailable until all retained revisions are downloaded.');
    }
    const assets = await withMemoStore(scope, (store) => store.assets(memo.memo_id));
    if (state.residency === 'keep_all') {
      for (const asset of assets.filter((value) => value.availability === 'repair' && value.opaque_path.startsWith('remote:')).slice(0, 20)) {
        if (!isMemoScopeCurrent(scope)) return;
        await downloadMemoAsset(scope, memo.memo_id, asset.asset_id);
      }
    }
    const latest = await withMemoStore(scope, (store) => store.remoteState(memo.memo_id));
    const remaining = await withMemoStore(scope, (store) => store.pendingSyncOperations(memo.memo_id, Number.MAX_SAFE_INTEGER));
    const localAssets = await withMemoStore(scope, (store) => store.assets(memo.memo_id));
    if (remaining.length === 0 && latest.status !== 'conflict' && latest.status !== 'sync_failed') {
      const allOffline = localAssets.every((asset) => asset.availability === 'verified');
      await withMemoStore(scope, (store) => store.setRemoteStatus(memo.memo_id, allOffline ? 'available_offline' : 'online_required', null, allOffline), true);
    }
  }
}

async function restoreSnapshot(scope: MemoScope, memoId: string, generation: string): Promise<number> {
  const snapshotId = Crypto.randomUUID();
  const snapshot = object(await call('snapshot', { memo_id: memoId, generation, snapshot_id: snapshotId }));
  const watermark = snapshot.watermark;
  if (typeof watermark !== 'number' || !Number.isSafeInteger(watermark) || watermark < 0) throw new Error('Memo snapshot watermark is invalid.');
  let offset = 0;
  for (let pageNumber = 0; pageNumber < 200 && isMemoScopeCurrent(scope); pageNumber++) {
    const page = object(await call('snapshot_page', { memo_id: memoId, generation, snapshot_id: snapshotId, after: offset }));
    if (!Array.isArray(page.changes) || page.watermark !== watermark || typeof page.has_more !== 'boolean' || typeof page.next_offset !== 'number') throw new Error('Memo snapshot page is invalid.');
    for (const change of page.changes as MemoSyncChange[]) {
      if (change.memo_id !== memoId || change.generation !== generation || change.change_position > watermark) throw new Error('Memo snapshot page belongs to another revision.');
      await withMemoStore(scope, (store) => store.applyRemoteSyncChange(change, Date.now(), true), true);
    }
    if (!page.has_more) {
      await withMemoStore(scope, (store) => store.finishSyncSnapshot(memoId, generation, watermark), true);
      return watermark;
    }
    if (!Number.isSafeInteger(page.next_offset) || page.next_offset <= offset) throw new Error('Memo snapshot returned a page without progress.');
    offset = page.next_offset;
  }
  throw new Error('Memo snapshot exceeded this session’s transfer limit. Reconnect to resume.');
}

async function runOnce(scope: MemoScope): Promise<void> {
  if (scope.offline || !isMemoScopeCurrent(scope)) return;
  for (let page = 0; page < 20 && isMemoScopeCurrent(scope); page++) {
    const listing = object(await call('list', { offset: page * 50 }));
    if (!Array.isArray(listing.memos) || typeof listing.has_more !== 'boolean') throw new Error('Memo cloud listing is invalid.');
    for (const entry of listing.memos) {
      const memo = object(entry);
      if (typeof memo.title !== 'string' || typeof memo.description !== 'string') throw new Error('Memo cloud metadata is invalid.');
      const memoId = uuid(memo.memo_id); const generation = uuid(memo.generation);
      const title = memo.title; const description = memo.description;
      const protectionRequired = memo.protection_required === true;
      await withMemoStore(scope, (store) => store.importRemoteMemo(memoId, generation, title, description, Date.now(), protectionRequired), true);
    }
    if (!listing.has_more) break;
  }
  const memos = await withMemoStore(scope, async (store) => [...await store.list(), ...await store.listTrash()]);
  for (const memo of memos) {
    if (!isMemoScopeCurrent(scope)) return;
    const state = await withMemoStore(scope, (store) => store.remoteState(memo.memo_id));
    if (state.replication !== 'synced') continue;
    for (let sent = 0; sent < 100 && isMemoScopeCurrent(scope); sent++) {
      const operation = (await withMemoStore(scope, (store) => store.pendingSyncOperations(memo.memo_id, Date.now(), 1)))[0];
      if (!operation) break;
      try { await sendOperation(scope, operation); }
      catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Memo sync failed.';
        const status = remoteStatus(error);
        const terminal = status === 'quota_exceeded' || status === 'conflict' || status === 'access_removed' || operation.attempt >= 4;
        const nextAttemptAt = terminal ? null : Date.now() + Math.round(Math.min(5 * 60 * 1000, 2 ** operation.attempt * 1000) * (0.75 + Math.random() * 0.5));
        await withMemoStore(scope, (store) => store.failSyncOperation(operation.operation_id, message, nextAttemptAt, terminal));
      }
    }
    const remote = await withMemoStore(scope, (store) => store.remoteState(memo.memo_id));
    if (remote.remote_memo_id) {
      const key = `dg.memo.sync-device:${scope.accountId}`;
      let deviceId = await AsyncStorage.getItem(key);
      if (!deviceId) { deviceId = Crypto.randomUUID(); await AsyncStorage.setItem(key, deviceId); }
      const prefs = await loadMemoReminderPreferences(scope.accountId);
      await call('reminder_preferences', { memo_id: memo.memo_id, device_id: deviceId, ...prefs, push_token: memoReminderPushToken(scope.accountId) });
    }
  }
  await catchUp(scope);
}

const activeRuns = new Map<string, Promise<void>>();
function run(scope: MemoScope): Promise<void> {
  const key = `${scope.accountId}:${scope.generation}`;
  const current = activeRuns.get(key);
  if (current) return current;
  const task = runOnce(scope).finally(() => { activeRuns.delete(key); });
  activeRuns.set(key, task);
  return task;
}

export async function retryMemoSynchronization(scope: MemoScope, memoId: string): Promise<void> {
  await withMemoStore(scope, (store) => store.retrySync(memoId));
  await run(scope);
}

export async function changeMemoResidency(scope: MemoScope, memoId: string, residency: 'keep_all' | 'on_demand'): Promise<void> {
  await withMemoStore(scope, (store) => store.setSyncResidency(memoId, residency), true);
  await run(scope);
}

export async function removeMemoRemoteCopy(scope: MemoScope, memoId: string): Promise<void> {
  if (scope.offline) throw new Error('Reconnect to remove the remote memo copy.');
  await run(scope);
  const assets = await withMemoStore(scope, (store) => store.assets(memoId, true));
  // File existence is checked by opening each original through the encrypted lease.
  // No only-copy eviction happens while this verification is running.
  for (const asset of assets) {
    const { withMemoAssetLease } = await import('./assets');
    await withMemoAssetLease(scope, asset.asset_id, async () => undefined);
  }
  await withMemoStore(scope, (store) => store.requestRemoteRemoval(memoId, Crypto.randomUUID(), Crypto.randomUUID()), true);
  await run(scope);
}

export async function enableMemoSync(scope: MemoScope, memoId: string, residency: 'keep_all' | 'on_demand' = 'keep_all'): Promise<void> {
  if (scope.offline) throw new Error('Reconnect before enabling memo synchronization.');
  const generation = await Crypto.randomUUID();
  const operationId = await Crypto.randomUUID();
  if (await isMemoProtected(scope.accountId, memoId)) await withMemoStore(scope, (store) => store.setProtectionRequired(memoId, true));
  await withMemoStore(scope, (store) => store.configureSync(memoId, 'synced', residency, generation, operationId), true);
  await run(scope);
}

export function startMemoSync(scope: MemoScope): () => void {
  let stopped = false;
  let running: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let hinted = false;
  const runIfReady = (): void => {
    if (stopped || scope.offline || AppState.currentState !== 'active' || !isMemoScopeCurrent(scope) || running) return;
    running = run(scope).catch(async (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Memo synchronization failed.';
      const memos = await withMemoStore(scope, (store) => store.list()).catch(() => []);
      await Promise.all(memos.map((memo) => withMemoStore(scope, async (store) => {
        const state = await store.remoteState(memo.memo_id);
        if (state.replication === 'synced') await store.setRemoteStatus(memo.memo_id, remoteStatus(error), message, false);
      }).catch(() => undefined)));
    }).finally(async () => {
      running = null;
      if (stopped || timer || AppState.currentState !== 'active' || !isMemoScopeCurrent(scope)) return;
      const next = await withMemoStore(scope, (store) => store.nextSyncAttempt()).catch(() => null);
      const followUp = hinted;
      hinted = false;
      if (!stopped && (next !== null || followUp) && !timer && isMemoScopeCurrent(scope)) timer = setTimeout(() => { timer = null; runIfReady(); }, followUp ? 300 : Math.max(1000, Math.min((next ?? Date.now()) - Date.now(), 5 * 60 * 1000)));
    });
  };
  const network = subscribeNetState((state) => { if (state.isConnected) runIfReady(); });
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') runIfReady();
    else if (timer) { clearTimeout(timer); timer = null; }
  });
  const changes = subscribeMemos(() => {
    // Worker notifications arrive while running. Do not subscribe the worker to
    // its own status writes, which would produce an endless catch-up cycle.
    if (running || stopped || timer) return;
    timer = setTimeout(() => { timer = null; runIfReady(); }, 300);
  });
  const channel = supabase.channel(`memo-changes:${scope.accountId}:${scope.generation}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'memo_changes' }, () => {
      if (stopped || !isMemoScopeCurrent(scope)) return;
      // Realtime is only a wake-up hint. The durable API cursor remains authoritative.
      if (running) hinted = true;
      else runIfReady();
    }).subscribe();
  runIfReady();
  return () => { stopped = true; if (timer) clearTimeout(timer); changes(); network(); appState.remove(); void supabase.removeChannel(channel); };
}
