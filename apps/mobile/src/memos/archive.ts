import * as Crypto from 'expo-crypto';
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import type { Memo, MemoAsset, MemoNote, MemoNoteRevision, MemoTimelineItem } from '@dologram/shared';
import { encryptMemoFile } from './assets';
import { memoEncryptionKey, withMemoStore } from './vault';
import type { MemoScope } from './lifecycle';

const MAGIC = new TextEncoder().encode('DGMB2');
const SALT_BYTES = 16;
const PREFIX_BYTES = 8;
const CHUNK_BYTES = 1024 * 1024;
const KDF_ITERATIONS = 210_000;
type ArchiveRecord = 1 | 2 | 3 | 4;
type ArchiveManifest = {
  format_version: 2;
  created_at: number;
  memos: Pick<Memo, 'memo_id' | 'title' | 'description' | 'revision' | 'created_at' | 'updated_at' | 'pinned' | 'archived' | 'ignored' | 'unread' | 'muted_until' | 'deleted_at' | 'purge_after' | 'trash_mode'>[];
  items: { item_id: string; memo_id: string; kind: 'text' | 'attachment'; text: string; display_name: string; created_at: number; revision: number; asset_id: string | null }[];
  assets: Pick<MemoAsset, 'asset_id' | 'original_name' | 'mime_type' | 'detected_type' | 'byte_size' | 'checksum'>[];
  notes: MemoNote[];
  note_revisions: MemoNoteRevision[];
};

function subtleCrypto(): SubtleCrypto {
  if (!globalThis.crypto?.subtle) throw new Error('Encrypted backup is unavailable in this app build. Update DoloGram and retry.');
  return globalThis.crypto.subtle;
}
function validatePassphrase(passphrase: string): void {
  if ([...passphrase].length < 12 || /^\d{6}$/.test(passphrase)) throw new Error('Use a backup passphrase of at least 12 characters. A six-digit PIN is not sufficient.');
}
async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  validatePassphrase(passphrase);
  const base = await subtleCrypto().importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return subtleCrypto().deriveKey({ name: 'PBKDF2', salt, iterations: KDF_ITERATIONS, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
function nonce(prefix: Uint8Array<ArrayBuffer>, index: number): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(12); result.set(prefix); new DataView(result.buffer).setUint32(8, index, false); return result;
}
function frameBytes(length: number): Uint8Array<ArrayBuffer> { const result = new Uint8Array(4); new DataView(result.buffer).setUint32(0, length, false); return result; }
function readExact(handle: ReturnType<File['open']>, length: number): Uint8Array<ArrayBuffer> { const value = handle.readBytes(length); if (value.length !== length) throw new Error('Backup archive is incomplete.'); return value; }
function safeId(value: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }
function safeBytes(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }

async function writeRecord(handle: ReturnType<File['open']>, key: CryptoKey, prefix: Uint8Array<ArrayBuffer>, index: number, type: ArchiveRecord, payload: Uint8Array<ArrayBuffer>): Promise<number> {
  const clear = new Uint8Array(1 + payload.length); clear[0] = type; clear.set(payload, 1);
  const encrypted = new Uint8Array(await subtleCrypto().encrypt({ name: 'AES-GCM', iv: nonce(prefix, index), additionalData: new TextEncoder().encode(String(index)) }, key, clear));
  handle.writeBytes(frameBytes(encrypted.length)); handle.writeBytes(encrypted); return index + 1;
}
function manifestFrom(snapshot: { memos: Memo[]; items: MemoTimelineItem[]; notes: MemoNote[]; noteRevisions: MemoNoteRevision[] }, selected: Set<string>): { manifest: ArchiveManifest; assets: MemoAsset[] } {
  const memos = snapshot.memos.filter((memo) => selected.has(memo.memo_id));
  const items = snapshot.items.filter((item) => selected.has(item.memo_id));
  const assetMap = new Map<string, MemoAsset>();
  const manifestItems = items.map((item) => {
    if (item.kind === 'attachment') assetMap.set(item.asset.asset_id, item.asset);
    return { item_id: item.item_id, memo_id: item.memo_id, kind: item.kind === 'attachment' ? 'attachment' as const : 'text' as const, text: item.text, display_name: item.display_name ?? '', created_at: item.created_at, revision: item.revision, asset_id: item.kind === 'attachment' ? item.asset.asset_id : null };
  });
  return { manifest: { format_version: 2, created_at: Date.now(), memos: memos.map(({ account_id: _accountId, replication: _replication, residency: _residency, preview: _preview, ...memo }) => memo), items: manifestItems, assets: [...assetMap.values()].map(({ memo_id: _memoId, opaque_path: _path, availability: _availability, created_at: _createdAt, trashed_at: _trashedAt, ...asset }) => asset), notes: snapshot.notes.filter((note) => selected.has(note.memo_id)), note_revisions: snapshot.noteRevisions.filter((revision) => selected.has(revision.memo_id)) }, assets: [...assetMap.values()] };
}

export async function exportMemoArchive(scope: MemoScope, destinationUri: string, passphrase: string, memoIds?: readonly string[]): Promise<{ bytes: number; assets: number }> {
  const operationId = await Crypto.randomUUID();
  await withMemoStore(scope, (store) => store.prepareArchiveJob(operationId, 'export', destinationUri, Date.now()));
  await withMemoStore(scope, (store) => store.updateArchiveJob(operationId, 'running', 0));
  const snapshot = await withMemoStore(scope, (store) => store.exportSnapshot());
  const selected = new Set(memoIds ?? snapshot.memos.map((memo) => memo.memo_id));
  const { manifest, assets } = manifestFrom(snapshot, selected);
  const destination = new File(destinationUri);
  if (destination.exists) destination.delete();
  destination.parentDirectory.create({ intermediates: true, idempotent: true }); destination.create({ intermediates: true, overwrite: true });
  const salt = new Uint8Array(await Crypto.getRandomBytesAsync(SALT_BYTES));
  const prefix = new Uint8Array(await Crypto.getRandomBytesAsync(PREFIX_BYTES));
  const key = await deriveKey(passphrase, salt);
  const handle = destination.open(FileMode.WriteOnly);
  try {
    const header = new Uint8Array(30); header.set(MAGIC); header[5] = 2; header.set(salt, 6); header.set(prefix, 22); handle.writeBytes(header);
    let recordIndex = 0;
    const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
    if (manifestBytes.length > CHUNK_BYTES) throw new Error('Backup manifest is too large. Select fewer memos and retry.');
    recordIndex = await writeRecord(handle, key, prefix, recordIndex, 1, manifestBytes);
    for (const asset of assets) {
      await withMemoAssetLeaseForExport(scope, asset.asset_id, async (source) => {
        recordIndex = await writeRecord(handle, key, prefix, recordIndex, 2, new TextEncoder().encode(JSON.stringify({ asset_id: asset.asset_id, name: asset.original_name, mime_type: asset.mime_type, byte_size: asset.byte_size, checksum: asset.checksum })));
        const sourceHandle = source.open(FileMode.ReadOnly); let offset = 0;
        try { while (offset < source.size) { const chunk = sourceHandle.readBytes(Math.min(CHUNK_BYTES, source.size - offset)); if (chunk.length === 0) throw new Error('Backup source ended early.'); recordIndex = await writeRecord(handle, key, prefix, recordIndex, 3, chunk); offset += chunk.length; } }
        finally { sourceHandle.close(); }
        recordIndex = await writeRecord(handle, key, prefix, recordIndex, 4, new Uint8Array(0));
      });
    }
  } catch (error) { handle.close(); if (destination.exists) destination.delete(); await withMemoStore(scope, (store) => store.updateArchiveJob(operationId, 'failed', 0, error instanceof Error ? error.message : 'Backup export failed.')).catch(() => {}); throw error; }
  handle.close();
  await withMemoStore(scope, (store) => store.updateArchiveJob(operationId, 'complete', destination.size));
  return { bytes: destination.size, assets: assets.length };
}

async function withMemoAssetLeaseForExport(scope: MemoScope, assetId: string, work: (source: File) => Promise<void>): Promise<void> {
  const { acquireMemoAssetLease } = await import('./assets');
  const lease = await acquireMemoAssetLease(scope, assetId);
  try { await work(new File(lease.uri)); } finally { lease.release(); }
}

export async function importMemoArchive(scope: MemoScope, archiveUri: string, passphrase: string): Promise<{ memoIds: string[]; assets: number }> {
  const operationId = await Crypto.randomUUID();
  await withMemoStore(scope, (store) => store.prepareArchiveJob(operationId, 'import', archiveUri, Date.now()));
  await withMemoStore(scope, (store) => store.updateArchiveJob(operationId, 'running', 0));
  const archive = new File(archiveUri); if (!archive.exists) throw new Error('Backup archive was not found.');
  const handle = archive.open(FileMode.ReadOnly);
  const importId = await Crypto.randomUUID(); const temp = new Directory(Paths.cache, 'memo-import', importId); temp.create({ intermediates: true, idempotent: true });
  const tempAssets = new Map<string, { file: File; size: number }>();
  let manifest: ArchiveManifest | null = null; let current: { id: string; file: File; handle: ReturnType<File['open']>; size: number; expected: number } | null = null;
  try {
    const header = readExact(handle, 30);
    if (!header.slice(0, MAGIC.length).every((value, index) => value === MAGIC[index]) || header[5] !== 2) throw new Error('Unsupported backup archive version.');
    const key = await deriveKey(passphrase, header.slice(6, 22)); const prefix = header.slice(22, 30); let index = 0;
    while ((handle.offset ?? 0) < (handle.size ?? 0)) {
      const length = new DataView(readExact(handle, 4).buffer).getUint32(0, false); if (length < 18 || length > CHUNK_BYTES + 1024) throw new Error('Backup archive frame is invalid.');
      const clear = new Uint8Array(await subtleCrypto().decrypt({ name: 'AES-GCM', iv: nonce(prefix, index), additionalData: new TextEncoder().encode(String(index)) }, key, readExact(handle, length))); index++;
      const type = clear[0] as ArchiveRecord; const payload = clear.slice(1);
      if (type === 1) { if (manifest) throw new Error('Backup archive contains duplicate manifests.'); manifest = JSON.parse(new TextDecoder().decode(payload)) as ArchiveManifest; }
      else if (type === 2) { if (current) throw new Error('Backup asset was not closed.'); const meta = JSON.parse(new TextDecoder().decode(payload)) as { asset_id?: string; byte_size?: number }; const assetId = meta.asset_id; const expected = meta.byte_size; if (!assetId || !safeId(assetId) || !safeBytes(expected)) throw new Error('Backup asset metadata is invalid.'); const file = new File(temp, `${assetId}.plain`); file.create({ intermediates: true, overwrite: true }); current = { id: assetId, file, handle: file.open(FileMode.WriteOnly), size: 0, expected }; }
      else if (type === 3) { if (!current || current.size + payload.length > current.expected) throw new Error('Backup asset size exceeds its manifest.'); current.handle.writeBytes(payload); current.size += payload.length; }
      else if (type === 4) { if (!current || current.size !== current.expected) throw new Error('Backup asset is incomplete.'); current.handle.close(); tempAssets.set(current.id, { file: current.file, size: current.size }); current = null; }
      else throw new Error('Backup archive contains an unknown record.');
    }
    if (current) throw new Error('Backup asset is incomplete.');
    if (!manifest || manifest.format_version !== 2) throw new Error('Backup manifest is missing or unsupported.');
    validateManifest(manifest, tempAssets);
    const verifiedManifest = manifest;
    const keyHex = await memoEncryptionKey(scope);
    const imported = await withMemoStore(scope, async (store) => {
      const memoMap = new Map<string, string>();
      for (const sourceMemo of verifiedManifest.memos) { const id = await Crypto.randomUUID(); memoMap.set(sourceMemo.memo_id, id); await store.create(id, Date.now(), sourceMemo.title); await store.details(id, sourceMemo.title, sourceMemo.description, Date.now()); }
      for (const item of verifiedManifest.items) {
        const memoId = memoMap.get(item.memo_id); if (!memoId) throw new Error('Backup reference graph is invalid.');
        if (item.kind === 'text') await store.saveText(memoId, await Crypto.randomUUID(), await Crypto.randomUUID(), item.text, item.created_at);
        else {
          const asset = verifiedManifest.assets.find((candidate) => candidate.asset_id === item.asset_id); const tempAsset = item.asset_id ? tempAssets.get(item.asset_id) : undefined;
          if (!asset || !tempAsset) throw new Error('Backup attachment is missing.');
          const newAsset = await Crypto.randomUUID(); const newItem = await Crypto.randomUUID(); const operation = await Crypto.randomUUID();
          const directory = new Directory(Paths.document, 'memo-import-assets', importId); directory.create({ intermediates: true, idempotent: true }); const staging = new File(directory, `${newAsset}.staging`); const final = new File(directory, `${newAsset}.dgaf`);
          await store.prepareAsset({ operation_id: operation, memo_id: memoId, item_id: newItem, asset_id: newAsset, original_name: asset.original_name, mime_type: asset.mime_type, detected_type: asset.detected_type, byte_size: asset.byte_size, checksum: asset.checksum, created_at: item.created_at });
          await encryptMemoFile(tempAsset.file, staging, keyHex); await store.stageAsset(operation, staging.uri); await staging.copy(final); await store.promoteAsset(operation, final.uri); await store.commitAsset(operation); if (staging.exists) staging.delete();
        }
      }
      for (const sourceMemo of verifiedManifest.memos) {
        const memoId = memoMap.get(sourceMemo.memo_id); if (!memoId) throw new Error('Backup memo reference graph is invalid.');
        for (const preference of ['pinned', 'archived', 'ignored', 'unread'] as const) if (sourceMemo[preference]) await store.preference(memoId, preference, true);
        if (sourceMemo.muted_until) await store.mute(memoId, sourceMemo.muted_until);
        if (sourceMemo.deleted_at !== null && sourceMemo.deleted_at !== undefined) {
          const retentionDays = sourceMemo.trash_mode === 'retention' && sourceMemo.purge_after ? Math.max(1, Math.ceil((sourceMemo.purge_after - sourceMemo.deleted_at) / (24 * 60 * 60 * 1000))) : 30;
          await store.trash(memoId, sourceMemo.deleted_at, sourceMemo.trash_mode, retentionDays);
        }
      }
      for (const sourceNote of verifiedManifest.notes) {
        const memoId = memoMap.get(sourceNote.memo_id); if (!memoId) throw new Error('Backup note reference graph is invalid.');
        const itemId = await Crypto.randomUUID(); await store.saveNote(memoId, itemId, await Crypto.randomUUID(), sourceNote.title, sourceNote.description, sourceNote.body, null, sourceNote.updated_at);
        for (const revision of verifiedManifest.note_revisions.filter((candidate) => candidate.memo_id === sourceNote.memo_id)) await store.recordNoteRevision(memoId, await Crypto.randomUUID(), revision.revision, revision.title, revision.description, revision.body, revision.named, revision.created_at);
      }
      return [...memoMap.values()];
    });
    await withMemoStore(scope, (store) => store.updateArchiveJob(operationId, 'complete', archive.size));
    return { memoIds: imported, assets: verifiedManifest.assets.length };
  } catch (error) {
    await withMemoStore(scope, (store) => store.updateArchiveJob(operationId, 'failed', 0, error instanceof Error ? error.message : 'Backup import failed.')).catch(() => {});
    throw error;
  } finally {
    if (current) current.handle.close(); handle.close(); if (temp.exists) temp.delete();
  }
}

function validateManifest(manifest: ArchiveManifest, assets: Map<string, { file: File; size: number }>): void {
  if (!Array.isArray(manifest.memos) || !Array.isArray(manifest.items) || !Array.isArray(manifest.assets) || !Array.isArray(manifest.notes) || !Array.isArray(manifest.note_revisions)) throw new Error('Backup manifest is invalid.');
  const ids = new Set(manifest.memos.map((memo) => memo.memo_id)); if (ids.size !== manifest.memos.length || [...ids].some((id) => !safeId(id))) throw new Error('Backup memo identifier is invalid.');
  const assetIds = new Set(manifest.assets.map((asset) => asset.asset_id)); if (assetIds.size !== manifest.assets.length || [...assetIds].some((id) => !safeId(id) || !safeBytes(manifest.assets.find((candidate) => candidate.asset_id === id)?.byte_size) || !assets.has(id))) throw new Error('Backup asset manifest is invalid.');
  for (const item of manifest.items) { if (!ids.has(item.memo_id) || (item.kind !== 'text' && item.kind !== 'attachment') || (item.kind === 'attachment' && (!item.asset_id || !assetIds.has(item.asset_id))) || item.kind === 'text' && !item.text.trim()) throw new Error('Backup item reference graph is invalid.'); }
  for (const [id, value] of assets) { const expected = manifest.assets.find((asset) => asset.asset_id === id)?.byte_size; if (expected !== value.size) throw new Error('Backup asset size does not match the manifest.'); }
}
