import { authenticate } from '../_shared/calling.ts';
import { CallHttpError, exactKeys, isObject, jsonResponse, readJsonBody, requireString, requireUuid, type JsonObject } from '../_shared/http.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { verifyMemoAssetStream } from './assetIntegrity.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { autoRefreshToken: false, persistSession: false } });

class MemoError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}

function operationId(value: unknown): string { return requireUuid(value); }
function memoText(value: unknown, limit: number): string {
  if (typeof value !== 'string' || !value.trim() || [...value].length > limit) throw new MemoError(400, 'MEMO_INVALID_REQUEST');
  return value;
}
function object(value: unknown): JsonObject {
  if (!isObject(value)) throw new MemoError(400, 'MEMO_INVALID_REQUEST');
  return value;
}
function knownError(error: unknown): MemoError {
  if (error instanceof CallHttpError) return new MemoError(error.status, error.status === 401 ? 'MEMO_UNAUTHENTICATED' : error.status === 403 ? 'MEMO_NOT_ALLOWED' : error.status >= 500 ? 'MEMO_SERVICE_UNAVAILABLE' : 'MEMO_INVALID_REQUEST');
  const message = error instanceof Error ? error.message : isObject(error) && typeof error.message === 'string' ? error.message : '';
  const code = ['MEMO_INVALID_REQUEST', 'MEMO_OPERATION_CONFLICT', 'MEMO_NOT_ALLOWED', 'MEMO_GENERATION_UNSUPPORTED', 'MEMO_REVISION_CONFLICT', 'MEMO_QUOTA_EXCEEDED', 'MEMO_ASSET_CHECKSUM_MISMATCH', 'MEMO_ASSET_UNAVAILABLE', 'MEMO_SNAPSHOT_EXPIRED'].find((candidate) => message.includes(candidate));
  if (code === 'MEMO_NOT_ALLOWED') return new MemoError(403, code);
  if (code === 'MEMO_REVISION_CONFLICT' || code === 'MEMO_OPERATION_CONFLICT') return new MemoError(409, code);
  if (code === 'MEMO_INVALID_REQUEST') return new MemoError(400, code);
  if (code === 'MEMO_GENERATION_UNSUPPORTED') return new MemoError(409, code);
  if (code === 'MEMO_QUOTA_EXCEEDED') return new MemoError(413, code);
  if (code === 'MEMO_ASSET_CHECKSUM_MISMATCH') return new MemoError(422, code);
  if (code === 'MEMO_ASSET_UNAVAILABLE') return new MemoError(422, code);
  if (code === 'MEMO_SNAPSHOT_EXPIRED') return new MemoError(409, code);
  return new MemoError(503, 'MEMO_SERVICE_UNAVAILABLE');
}
function response(body: unknown, status = 200): Response { return jsonResponse(body, status, { 'cache-control': 'no-store' }); }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.method !== 'POST') return response({ code: 'MEMO_INVALID_REQUEST' }, 405);
  try {
    const auth = await authenticate(request);
    const body = await readJsonBody(request, 256 * 1024);
    const action = requireString(body.action, 32);
    let data: unknown;
    if (action === 'list') {
      exactKeys(body, ['action', 'offset']);
      if (typeof body.offset !== 'number' || !Number.isSafeInteger(body.offset) || body.offset < 0 || body.offset > 100_000) throw new MemoError(400, 'MEMO_INVALID_REQUEST');
      const memos = await admin.from('memo_memos').select('memo_id,generation,title,description,protection_required').eq('owner_id', auth.actorId).is('closed_at', null).order('memo_id').range(body.offset, body.offset + 49);
      if (memos.error) throw memos.error;
      data = { memos: memos.data, has_more: memos.data.length === 50 };
    } else if (action === 'create') {
      exactKeys(body, ['action', 'memo_id', 'generation', 'operation_id', 'title'], ['description', 'residency', 'protection_required']);
      data = await admin.rpc('memo_create', {
        p_actor_id: auth.actorId, p_memo_id: requireUuid(body.memo_id), p_generation: requireUuid(body.generation), p_operation_id: operationId(body.operation_id),
        p_title: memoText(body.title, 128), p_description: typeof body.description === 'string' ? body.description : '', p_residency: body.residency === 'on_demand' ? 'on_demand' : 'keep_all',
        p_protection_required: body.protection_required === true,
      }).then((result) => { if (result.error) throw result.error; return result.data; });
    } else if (action === 'mutation') {
      exactKeys(body, ['action', 'memo_id', 'generation', 'operation_id', 'entity_id', 'entity_type', 'base_revision', 'payload'], ['predecessor_id', 'deleted']);
      const payload = object(body.payload);
      data = await admin.rpc('memo_apply_mutation', {
        p_actor_id: auth.actorId, p_memo_id: requireUuid(body.memo_id), p_generation: requireUuid(body.generation), p_operation_id: operationId(body.operation_id),
        p_entity_id: requireUuid(body.entity_id), p_entity_type: requireString(body.entity_type, 32), p_base_revision: typeof body.base_revision === 'number' ? body.base_revision : -1,
        p_predecessor_id: body.predecessor_id === null || body.predecessor_id === undefined ? null : requireUuid(body.predecessor_id), p_payload: payload, p_deleted: body.deleted === true,
      }).then((result) => { if (result.error) throw result.error; return result.data; });
    } else if (action === 'reminder_preferences') {
      exactKeys(body, ['action', 'memo_id', 'device_id', 'enabled', 'sounds', 'vibration', 'push_token']);
      if (typeof body.enabled !== 'boolean' || typeof body.sounds !== 'boolean' || typeof body.vibration !== 'boolean' || body.push_token !== null && typeof body.push_token !== 'string') throw new MemoError(400, 'MEMO_INVALID_REQUEST');
      data = await admin.rpc('memo_set_reminder_preferences', { p_actor_id: auth.actorId, p_memo_id: requireUuid(body.memo_id), p_device_id: requireUuid(body.device_id), p_enabled: body.enabled, p_sounds: body.sounds, p_vibration: body.vibration, p_push_token: body.push_token }).then((result) => { if (result.error) throw result.error; return result.data; });
    } else if (action === 'note_block') {
      exactKeys(body, ['action', 'memo_id', 'generation', 'operation_id', 'index', 'body']);
      if (typeof body.body !== 'string' || [...body.body].length > 16_384) throw new MemoError(400, 'MEMO_INVALID_REQUEST');
      data = await admin.rpc('memo_stage_note_block', { p_actor_id: auth.actorId, p_memo_id: requireUuid(body.memo_id), p_generation: requireUuid(body.generation), p_operation_id: requireUuid(body.operation_id), p_index: body.index, p_body: body.body }).then((result) => { if (result.error) throw result.error; return result.data; });
    } else if (action === 'note_commit') {
      exactKeys(body, ['action', 'memo_id', 'generation', 'operation_id', 'entity_id', 'base_revision', 'predecessor_id', 'payload', 'count', 'digest']);
      data = await admin.rpc('memo_commit_note', { p_actor_id: auth.actorId, p_memo_id: requireUuid(body.memo_id), p_generation: requireUuid(body.generation), p_operation_id: requireUuid(body.operation_id), p_entity_id: requireUuid(body.entity_id), p_base_revision: body.base_revision, p_predecessor_id: body.predecessor_id === null ? null : requireUuid(body.predecessor_id), p_payload: object(body.payload), p_count: body.count, p_digest: requireString(body.digest, 64) }).then((result) => { if (result.error) throw result.error; return result.data; });
    } else if (action === 'changes') {
      exactKeys(body, ['action', 'memo_id', 'generation', 'after'], ['limit']);
      data = await admin.rpc('memo_fetch_changes', {
        p_actor_id: auth.actorId, p_memo_id: requireUuid(body.memo_id), p_generation: requireUuid(body.generation), p_after: typeof body.after === 'number' ? body.after : -1, p_limit: typeof body.limit === 'number' ? body.limit : 100,
      }).then((result) => { if (result.error) throw result.error; return result.data; });
    } else if (action === 'note_history') {
      exactKeys(body, ['action', 'memo_id', 'generation', 'after', 'watermark']);
      data = await admin.rpc('memo_note_history', { p_actor_id: auth.actorId, p_memo_id: requireUuid(body.memo_id), p_generation: requireUuid(body.generation), p_after: body.after, p_watermark: body.watermark }).then((result) => { if (result.error) throw result.error; return result.data; });
    } else if (action === 'snapshot') {
      exactKeys(body, ['action', 'memo_id', 'generation', 'snapshot_id']);
      data = await admin.rpc('memo_create_snapshot', { p_actor_id: auth.actorId, p_memo_id: requireUuid(body.memo_id), p_generation: requireUuid(body.generation), p_snapshot_id: requireUuid(body.snapshot_id) }).then((result) => { if (result.error) throw result.error; return result.data; });
    } else if (action === 'snapshot_page') {
      exactKeys(body, ['action', 'memo_id', 'generation', 'snapshot_id', 'after']);
      data = await admin.rpc('memo_read_snapshot', { p_actor_id: auth.actorId, p_memo_id: requireUuid(body.memo_id), p_generation: requireUuid(body.generation), p_snapshot_id: requireUuid(body.snapshot_id), p_after: typeof body.after === 'number' ? body.after : -1, p_limit: 50 }).then((result) => { if (result.error) throw result.error; return result.data; });
    } else if (action === 'asset_download') {
      exactKeys(body, ['action', 'memo_id', 'generation', 'asset_id']);
      const memoId = requireUuid(body.memo_id); const generation = requireUuid(body.generation);
      const memo = await admin.from('memo_memos').select('owner_id').eq('memo_id', memoId).eq('generation', generation).is('closed_at', null).single();
      if (memo.error || memo.data.owner_id !== auth.actorId) throw new MemoError(403, 'MEMO_NOT_ALLOWED');
      const asset = await admin.from('memo_assets').select('storage_path,byte_size,checksum').eq('memo_id', memoId).eq('generation', generation).eq('asset_id', requireUuid(body.asset_id)).eq('state', 'verified').single();
      if (asset.error) throw asset.error;
      const signed = await admin.storage.from('memo-assets').createSignedUrl(asset.data.storage_path, 60);
      if (signed.error) throw signed.error;
      data = { url: signed.data.signedUrl, byte_size: asset.data.byte_size, checksum: asset.data.checksum };
    } else if (action === 'asset_reserve') {
      exactKeys(body, ['action', 'memo_id', 'generation', 'operation_id', 'asset_id', 'original_name', 'byte_size'], ['mime_type', 'checksum']);
      data = await admin.rpc('memo_reserve_asset', {
        p_actor_id: auth.actorId, p_memo_id: requireUuid(body.memo_id), p_generation: requireUuid(body.generation), p_operation_id: operationId(body.operation_id), p_asset_id: requireUuid(body.asset_id),
        p_original_name: requireString(body.original_name, 255), p_mime_type: typeof body.mime_type === 'string' ? body.mime_type : 'application/octet-stream', p_byte_size: typeof body.byte_size === 'number' ? body.byte_size : -1, p_checksum: typeof body.checksum === 'string' ? body.checksum : null,
      }).then((result) => { if (result.error) throw result.error; return result.data; });
    } else if (action === 'asset_finalize') {
      exactKeys(body, ['action', 'memo_id', 'generation', 'asset_id'], ['checksum']);
      const memoId = requireUuid(body.memo_id); const generation = requireUuid(body.generation); const assetId = requireUuid(body.asset_id);
      const memo = await admin.from('memo_memos').select('owner_id').eq('memo_id', memoId).eq('generation', generation).is('closed_at', null).single();
      if (memo.error || memo.data.owner_id !== auth.actorId) throw new MemoError(403, 'MEMO_NOT_ALLOWED');
      const asset = await admin.from('memo_assets').select('storage_path,byte_size,checksum').eq('memo_id', memoId).eq('generation', generation).eq('asset_id', assetId).single();
      if (asset.error) throw asset.error;
      const signed = await admin.storage.from('memo-assets').createSignedUrl(asset.data.storage_path, 60);
      if (signed.error) throw signed.error;
      const controller = new AbortController();
      const deadline = setTimeout(() => controller.abort(), 30_000);
      let digest: string;
      try {
        const original = await fetch(signed.data.signedUrl, { signal: controller.signal });
        if (!original.ok || !original.body) throw new MemoError(503, 'MEMO_SERVICE_UNAVAILABLE');
        digest = await verifyMemoAssetStream(original.body, Number(asset.data.byte_size), asset.data.checksum);
      } finally { clearTimeout(deadline); }
      data = await admin.rpc('memo_finalize_asset', { p_actor_id: auth.actorId, p_memo_id: memoId, p_generation: generation, p_asset_id: assetId, p_checksum: digest }).then((result) => { if (result.error) throw result.error; return result.data; });
    } else if (action === 'close_remote') {
      exactKeys(body, ['action', 'memo_id', 'generation', 'operation_id', 'expected_revision', 'complete_local_copy']);
      const prepared = await admin.rpc('memo_prepare_close', { p_actor_id: auth.actorId, p_memo_id: requireUuid(body.memo_id), p_generation: requireUuid(body.generation), p_operation_id: requireUuid(body.operation_id), p_expected_revision: body.expected_revision, p_complete: body.complete_local_copy });
      if (prepared.error) throw prepared.error;
      const assets = await admin.from('memo_assets').select('storage_path').eq('memo_id', requireUuid(body.memo_id)).eq('generation', requireUuid(body.generation)).neq('state', 'deleted').limit(100);
      if (assets.error) throw assets.error;
      if (assets.data.length > 0) {
        const removed = await admin.storage.from('memo-assets').remove(assets.data.map((asset) => asset.storage_path));
        if (removed.error) throw removed.error;
        const marked = await admin.from('memo_assets').update({ state: 'deleted' }).eq('memo_id', requireUuid(body.memo_id)).in('storage_path', assets.data.map((asset) => asset.storage_path));
        if (marked.error) throw marked.error;
      }
      data = await admin.rpc('memo_close_remote_copy', { p_actor_id: auth.actorId, p_memo_id: requireUuid(body.memo_id), p_generation: requireUuid(body.generation), p_operation_id: requireUuid(body.operation_id) }).then((result) => { if (result.error) throw result.error; return result.data; });
    } else {
      throw new MemoError(400, 'MEMO_INVALID_REQUEST');
    }
    return response(data);
  } catch (error) {
    const mapped = error instanceof MemoError ? error : knownError(error);
    return response({ code: mapped.code, retryable: mapped.status >= 500 }, mapped.status);
  }
});
