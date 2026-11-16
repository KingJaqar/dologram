import { installMemoDownload, withMemoAssetLease } from './assets';
import { uploadMobileAttachment } from '../queue/mediaUploader';
import { supabase } from '../lib/supabase';
import type { MemoScope } from './lifecycle';
import { withMemoStore } from './vault';

type ApiObject = Record<string, unknown>;

function object(value: unknown): ApiObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Memo asset service returned an invalid response.');
  return value as ApiObject;
}

async function invoke(action: string, body: ApiObject): Promise<ApiObject> {
  const result = await supabase.functions.invoke('memo-sync', { body: { action, ...body }, timeout: 40_000 });
  if (result.error) throw result.error;
  const response = object(result.data);
  if (typeof response.code === 'string') throw new Error(response.code);
  return response;
}

export async function uploadMemoAsset(scope: MemoScope, memoId: string, assetId: string, operationId: string): Promise<void> {
  const state = await withMemoStore(scope, (store) => store.remoteState(memoId));
  if (state.replication !== 'synced') throw new Error('Enable memo synchronization before uploading this attachment.');
  const asset = await withMemoStore(scope, (store) => store.asset(assetId));
  if (asset.memo_id !== memoId) throw new Error('This attachment belongs to another memo.');
  await withMemoStore(scope, (store) => store.setRemoteStatus(memoId, 'uploading', null, false), true);
  const reserved = await invoke('asset_reserve', {
    memo_id: memoId, generation: state.generation, operation_id: operationId, asset_id: asset.asset_id,
    original_name: asset.original_name, mime_type: asset.mime_type, byte_size: asset.byte_size, checksum: asset.checksum,
  });
  const storagePath = reserved.storage_path;
  if (typeof storagePath !== 'string' || storagePath !== `${memoId}/${state.generation}/${asset.asset_id}`) throw new Error('Memo asset service returned an invalid storage path.');
  await withMemoAssetLease(scope, asset.asset_id, async (lease) => {
    const uploaded = await uploadMobileAttachment({ uri: lease.uri, mime: asset.mime_type, sizeBytes: asset.byte_size, bucket: 'memo-assets', path: storagePath });
    if (uploaded.error) throw new Error(uploaded.error.kind === 'server' ? uploaded.error.code ?? 'Memo asset upload failed.' : `Memo asset upload ${uploaded.error.kind}.`);
  });
  await withMemoStore(scope, (store) => store.setRemoteStatus(memoId, 'finalizing', null, false), true);
  const finalized = await invoke('asset_finalize', { memo_id: memoId, generation: state.generation, asset_id: asset.asset_id, checksum: asset.checksum });
  if (finalized.state !== 'verified') throw new Error('Memo asset was not verified by the service.');
  // Only the mutation receipt and completed catch-up can acknowledge the memo.
}

async function download(scope: MemoScope, memoId: string, assetId: string): Promise<void> {
  if (scope.offline) throw new Error('Reconnect to download this memo attachment.');
  const state = await withMemoStore(scope, (store) => store.remoteState(memoId));
  const asset = await withMemoStore(scope, (store) => store.asset(assetId));
  if (asset.memo_id !== memoId) throw new Error('This attachment belongs to another memo.');
  const response = await invoke('asset_download', { memo_id: memoId, generation: state.generation, asset_id: assetId });
  if (typeof response.url !== 'string' || typeof response.checksum !== 'string' || !/^(md5:[a-f0-9]{32}|sha256:[a-f0-9]{64})$/.test(response.checksum) || response.byte_size !== asset.byte_size) throw new Error('Memo download metadata is invalid.');
  await installMemoDownload(scope, asset, response.url, response.checksum);
}

const downloads = new Map<string, Promise<void>>();
export function downloadMemoAsset(scope: MemoScope, memoId: string, assetId: string): Promise<void> {
  const key = `${scope.accountId}:${scope.generation}:${assetId}`;
  const active = downloads.get(key);
  if (active) return active;
  const task = download(scope, memoId, assetId).finally(() => { downloads.delete(key); });
  downloads.set(key, task);
  return task;
}
