import * as Crypto from 'expo-crypto';
import { fetch } from 'expo/fetch';
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import type { MemoAsset, MemoAssetType, MemoAttachmentItem } from '@dologram/shared';
import { memoEncryptionKey, withMemoStore } from './vault';
import type { MemoScope } from './lifecycle';
import type { DraftAttachment } from '../media/model';
import { MemoDownloadValidationError, receiveMemoDownload } from './download';

const CHUNK_BYTES = 1024 * 1024;
export const MEMO_STORAGE_RESERVE_BYTES = 32 * 1024 * 1024;
const FILE_MAGIC = new TextEncoder().encode('DGAF2');
const leases = new Map<string, number>();

export type MemoAssetLease = { asset: MemoAsset; uri: string; release: () => void };
export type StorageAdmission = { accepted: true } | { accepted: false; reason: 'lowSpace'; availableBytes: number; requiredBytes: number };

export function formatMemoBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function checkMemoStorageAdmission(requiredBytes: number, availableBytes = Paths.availableDiskSpace): StorageAdmission {
  if (!Number.isSafeInteger(requiredBytes) || requiredBytes < 0) throw new Error('Attachment size is invalid.');
  const required = requiredBytes + MEMO_STORAGE_RESERVE_BYTES;
  if (!Number.isSafeInteger(required)) throw new Error('Attachment is too large to import safely.');
  return availableBytes >= required ? { accepted: true } : { accepted: false, reason: 'lowSpace', availableBytes, requiredBytes: required };
}

export function sanitizeMemoFilename(name: string, fallback = 'attachment'): string {
  const cleaned = name.replace(/[\\/\u0000-\u001f\u007f]/g, '_').trim().replace(/^\.+$/, '');
  return (cleaned || fallback).slice(0, 255);
}

function keyBytes(hex: string): Uint8Array<ArrayBuffer> {
  if (!/^[a-f0-9]{64}$/i.test(hex)) throw new Error('Memo encryption key is unavailable.');
  const bytes = new Uint8Array(32);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function subtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Encrypted memo assets are unavailable in this app build. Update DoloGram and retry.');
  return subtle;
}

function nonce(prefix: Uint8Array<ArrayBuffer>, index: number): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(12);
  result.set(prefix);
  new DataView(result.buffer).setUint32(8, index, false);
  return result;
}

function frameLength(bytes: Uint8Array<ArrayBuffer>): void {
  if (bytes.length > 0xffffffff) throw new Error('Encrypted attachment frame is too large.');
}

async function importKey(hex: string): Promise<CryptoKey> {
  return subtleCrypto().importKey('raw', keyBytes(hex), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function writeHeader(handle: ReturnType<File['open']>, chunkBytes: number, size: number, prefix: Uint8Array<ArrayBuffer>): void {
  const header = new Uint8Array(25);
  header.set(FILE_MAGIC, 0);
  const view = new DataView(header.buffer);
  view.setUint32(5, chunkBytes, false);
  view.setFloat64(9, size, false);
  header.set(prefix, 17);
  handle.writeBytes(header);
}

function readExact(handle: ReturnType<File['open']>, length: number): Uint8Array<ArrayBuffer> {
  const bytes = handle.readBytes(length);
  if (bytes.length !== length) throw new Error('Encrypted attachment is incomplete.');
  return bytes;
}

export async function encryptMemoFile(source: File, destination: File, keyHex: string, signal?: AbortSignal): Promise<void> {
  if (!source.exists) throw new Error('The selected attachment is no longer available.');
  const size = source.size;
  const key = await importKey(keyHex);
  const prefix = new Uint8Array(await Crypto.getRandomBytesAsync(8));
  const sourceHandle = source.open(FileMode.ReadOnly);
  if (destination.exists) destination.delete();
  destination.parentDirectory.create({ intermediates: true, idempotent: true });
  destination.create({ intermediates: true, overwrite: true });
  const destinationHandle = destination.open(FileMode.WriteOnly);
  try {
    writeHeader(destinationHandle, CHUNK_BYTES, size, prefix);
    let offset = 0;
    let index = 0;
    while (offset < size) {
      if (signal?.aborted) throw new Error('Attachment import was cancelled.');
      const plain = sourceHandle.readBytes(Math.min(CHUNK_BYTES, size - offset));
      if (plain.length === 0) throw new Error('The selected attachment could not be read completely.');
      const encrypted = new Uint8Array(await subtleCrypto().encrypt({ name: 'AES-GCM', iv: nonce(prefix, index), additionalData: new TextEncoder().encode(String(index)) }, key, plain));
      frameLength(encrypted);
      const frame = new Uint8Array(4 + encrypted.length);
      new DataView(frame.buffer).setUint32(0, encrypted.length, false);
      frame.set(encrypted, 4);
      destinationHandle.writeBytes(frame);
      offset += plain.length;
      index++;
    }
  } finally {
    sourceHandle.close();
    destinationHandle.close();
  }
}

export async function decryptMemoFile(source: File, destination: File, keyHex: string, signal?: AbortSignal): Promise<void> {
  if (!source.exists) throw new Error('This attachment needs repair. The encrypted source is missing.');
  const key = await importKey(keyHex);
  const sourceHandle = source.open(FileMode.ReadOnly);
  if (destination.exists) destination.delete();
  destination.parentDirectory.create({ intermediates: true, idempotent: true });
  destination.create({ intermediates: true, overwrite: true });
  const destinationHandle = destination.open(FileMode.WriteOnly);
  try {
    const header = readExact(sourceHandle, 25);
    if (!header.slice(0, FILE_MAGIC.length).every((value, index) => value === FILE_MAGIC[index])) throw new Error('Unsupported memo asset format.');
    const view = new DataView(header.buffer);
    const chunkBytes = view.getUint32(5, false);
    const expectedSize = view.getFloat64(9, false);
    if (!Number.isSafeInteger(chunkBytes) || chunkBytes <= 0 || chunkBytes > CHUNK_BYTES || !Number.isSafeInteger(expectedSize) || expectedSize < 0) throw new Error('Encrypted attachment metadata is invalid.');
    const prefix = header.slice(17, 25);
    let total = 0;
    let index = 0;
    while ((sourceHandle.offset ?? 0) < (sourceHandle.size ?? 0)) {
      if (signal?.aborted) throw new Error('Attachment open was cancelled.');
      const lengthBytes = readExact(sourceHandle, 4);
      const length = new DataView(lengthBytes.buffer).getUint32(0, false);
      if (length < 17 || length > chunkBytes + 16) throw new Error('Encrypted attachment frame is invalid.');
      const encrypted = readExact(sourceHandle, length);
      const plain = new Uint8Array(await subtleCrypto().decrypt({ name: 'AES-GCM', iv: nonce(prefix, index), additionalData: new TextEncoder().encode(String(index)) }, key, encrypted));
      if (plain.length > chunkBytes || total + plain.length > expectedSize) throw new Error('Encrypted attachment size is invalid.');
      destinationHandle.writeBytes(plain);
      total += plain.length;
      index++;
    }
    if (total !== expectedSize) throw new Error('Encrypted attachment is incomplete.');
  } finally {
    sourceHandle.close();
    destinationHandle.close();
  }
}

async function accountDirectory(scope: MemoScope): Promise<Directory> {
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, scope.accountId);
  const directory = new Directory(Paths.document, 'memo-assets', hash);
  directory.create({ intermediates: true, idempotent: true });
  return directory;
}

function mediaType(attachment: DraftAttachment): MemoAssetType { return attachment.mediaType; }

export async function saveMemoAttachment(scope: MemoScope, memoId: string, attachment: DraftAttachment, signal?: AbortSignal, operationId?: string): Promise<MemoAttachmentItem> {
  const source = new File(attachment.uri);
  if (!source.exists) throw new Error('The selected attachment is no longer available.');
  const size = source.size;
  if (size === 0 && attachment.mediaType !== 'file') throw new Error('This media capture is empty and cannot be saved. Choose it again.');
  // The encrypted import keeps a staged and a verified copy until the database commit is durable.
  const admission = checkMemoStorageAdmission(size * 2);
  if (!admission.accepted) throw new Error(`Not enough device storage. Free at least ${Math.ceil(admission.requiredBytes / (1024 * 1024))} MB and retry.`);
  const stableOperationId = operationId ?? await Crypto.randomUUID();
  const assetId = operationId ?? await Crypto.randomUUID();
  const itemId = operationId ?? await Crypto.randomUUID();
  const name = sanitizeMemoFilename(attachment.name, assetId);
  const mime = attachment.mime || source.type || 'application/octet-stream';
  const directory = await accountDirectory(scope);
  const stagingDirectory = new Directory(directory, 'staging');
  const finalDirectory = new Directory(directory, 'verified');
  stagingDirectory.create({ intermediates: true, idempotent: true });
  finalDirectory.create({ intermediates: true, idempotent: true });
  const staging = new File(stagingDirectory, `${assetId}.dgaf`);
  const final = new File(finalDirectory, `${assetId}.dgaf`);
  const checksum = source.md5 ? `md5:${source.md5}` : null;
  const keyHex = await memoEncryptionKey(scope);
  return withMemoStore(scope, async (store) => {
    await store.prepareAsset({ operation_id: stableOperationId, memo_id: memoId, item_id: itemId, asset_id: assetId, original_name: name, mime_type: mime, detected_type: mediaType(attachment), byte_size: size, checksum, created_at: Date.now() });
    try {
      await encryptMemoFile(source, staging, keyHex, signal);
      await store.stageAsset(stableOperationId, staging.uri);
      await staging.copy(final);
      await store.promoteAsset(stableOperationId, final.uri);
      const result = await store.commitAsset(stableOperationId);
      if (staging.exists) staging.delete();
      if (source.uri.startsWith(Paths.cache.uri) && source.exists) source.delete();
      return result;
    } catch (error) {
      if (!staging.exists && final.exists) final.delete();
      throw error;
    }
  }, true);
}

export async function acquireMemoAssetLease(scope: MemoScope, assetId: string, signal?: AbortSignal): Promise<MemoAssetLease> {
  if (signal?.aborted) throw new Error('Attachment open was cancelled.');
  let asset = await withMemoStore(scope, (store) => store.asset(assetId));
  if (asset.availability === 'repair' && asset.opaque_path.startsWith('remote:')) {
    const { downloadMemoAsset } = await import('./remoteAssets');
    await downloadMemoAsset(scope, asset.memo_id, assetId);
    asset = await withMemoStore(scope, (store) => store.asset(assetId));
  }
  const source = new File(asset.opaque_path);
  const leaseId = `${assetId}:${Date.now()}:${Math.random()}`;
  const outputDirectory = new Directory(Paths.cache, 'memo-open', leaseId);
  outputDirectory.create({ intermediates: true, idempotent: true });
  const output = new File(outputDirectory, sanitizeMemoFilename(asset.original_name, asset.asset_id));
  await decryptMemoFile(source, output, await memoEncryptionKey(scope), signal);
  leases.set(asset.asset_id, (leases.get(asset.asset_id) ?? 0) + 1);
  let released = false;
  return { asset, uri: output.uri, release: () => {
    if (released) return;
    released = true;
    const next = (leases.get(asset.asset_id) ?? 1) - 1;
    if (next <= 0) leases.delete(asset.asset_id); else leases.set(asset.asset_id, next);
    if (output.exists) output.delete();
    if (outputDirectory.exists) outputDirectory.delete();
  } };
}

export async function installMemoDownload(scope: MemoScope, asset: MemoAsset, url: string, checksum: string): Promise<void> {
  if (!/^https?:\/\//.test(url) || asset.byte_size > 50 * 1024 * 1024) throw new Error('Memo download is invalid.');
  const admission = checkMemoStorageAdmission(asset.byte_size * 3);
  if (!admission.accepted) throw new Error('Free device storage before downloading this attachment.');
  const directory = await accountDirectory(scope);
  const accountHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, scope.accountId);
  const downloadCache = new Directory(Paths.cache, 'memo-downloads', accountHash);
  downloadCache.create({ intermediates: true, idempotent: true });
  for (const entry of downloadCache.list()) {
    if (entry instanceof File && entry.modificationTime !== null && Date.now() - entry.modificationTime > 30 * 60 * 1000) entry.delete();
  }
  const plain = new File(downloadCache, `${asset.asset_id}.download`);
  const encrypted = new File(directory, 'staging', `${asset.asset_id}.download.dgaf`);
  const final = new File(directory, 'verified', `${asset.asset_id}.dgaf`);
  plain.parentDirectory.create({ intermediates: true, idempotent: true });
  if (plain.exists && plain.size > asset.byte_size) plain.delete();
  if (!plain.exists) plain.create();
  let handle = plain.open(FileMode.Append);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const offset = plain.size;
    if (offset < asset.byte_size || asset.byte_size === 0) {
      const response = await fetch(url, { signal: controller.signal, headers: offset > 0 ? { Range: `bytes=${offset}-` } : undefined });
      await receiveMemoDownload(response, offset, asset.byte_size, () => {
        handle.close(); handle = plain.open(FileMode.Truncate);
      }, (bytes) => handle.writeBytes(bytes));
    }
    handle.close();
    const digest = checksum.startsWith('md5:') ? `md5:${plain.md5}` : `sha256:${Array.from(new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, await plain.bytes())), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
    if (digest !== checksum) throw new MemoDownloadValidationError('Memo attachment checksum does not match.');
    await encryptMemoFile(plain, encrypted, await memoEncryptionKey(scope), controller.signal);
    final.parentDirectory.create({ intermediates: true, idempotent: true });
    if (final.exists) final.delete();
    await encrypted.move(final);
    await withMemoStore(scope, (store) => store.recordDownloadedAsset(asset.asset_id, final.uri), true);
    if (plain.exists) plain.delete();
  } catch (error) {
    if (error instanceof MemoDownloadValidationError) {
      try { handle.close(); } catch { /* already closed before digest verification */ }
      if (plain.exists) plain.delete();
    }
    throw error;
  } finally {
    clearTimeout(timer);
    try { handle.close(); } catch { /* already closed after verified transfer */ }
    if (encrypted.exists) encrypted.delete();
  }
}

export async function withMemoAssetLease<T>(scope: MemoScope, assetId: string, work: (lease: MemoAssetLease) => Promise<T>, signal?: AbortSignal): Promise<T> {
  const lease = await acquireMemoAssetLease(scope, assetId, signal);
  try { return await work(lease); } finally { lease.release(); }
}

export function activeMemoAssetLeases(assetId: string): number { return leases.get(assetId) ?? 0; }

export async function permanentlyRemoveMemo(scope: MemoScope, memoId: string): Promise<void> {
  const paths = await withMemoStore(scope, (store) => store.assets(memoId, true));
  if (paths.some((asset) => activeMemoAssetLeases(asset.asset_id) > 0)) throw new Error('Close the attachment before permanently removing this memo.');
  await withMemoStore(scope, (store) => store.purgeMemo(memoId, Date.now(), true), true);
  for (const asset of paths) {
    const file = new File(asset.opaque_path);
    if (file.exists) file.delete();
  }
}
