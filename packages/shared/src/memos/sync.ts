import { validateMemoId } from './types';

export type MemoReplication = 'local' | 'synced';
export type MemoResidency = 'keep_all' | 'on_demand';
export type MemoRemoteStatus =
  | 'local_only'
  | 'pending'
  | 'bootstrapping'
  | 'uploading'
  | 'finalizing'
  | 'synced'
  | 'available_offline'
  | 'downloading'
  | 'online_required'
  | 'waiting_for_wifi'
  | 'quota_exceeded'
  | 'conflict'
  | 'access_removed'
  | 'sync_failed'
  | 'paused';

export type MemoSyncOperationState = 'pending' | 'uploading' | 'acknowledged' | 'conflict' | 'failed' | 'cancelled';
export type MemoSyncEntity = 'memo' | 'item' | 'note' | 'asset' | 'tag' | 'pin' | 'reminder' | 'preference' | 'folder' | 'trash' | 'bootstrap' | 'close_remote';

export type MemoSyncOperation = Readonly<{
  operation_id: string;
  memo_id: string;
  account_id: string;
  generation: string;
  entity_id: string;
  entity_type: MemoSyncEntity;
  base_revision: number;
  predecessor_id: string | null;
  payload: Readonly<Record<string, unknown>>;
  frozen_payload: string;
  state: MemoSyncOperationState;
  attempt: number;
  next_attempt_at: number;
  created_at: number;
}>;

export type MemoSyncAck = Readonly<{
  operation_id: string;
  memo_id: string;
  generation: string;
  remote_revision: number;
  change_position: number;
  receipt: Readonly<Record<string, unknown>>;
}>;

export type MemoSyncChange = Readonly<{
  change_position: number;
  operation_id: string;
  memo_id: string;
  generation: string;
  entity_id: string;
  entity_type: MemoSyncEntity;
  revision: number;
  payload: Readonly<Record<string, unknown>>;
  deleted: boolean;
}>;

export type MemoSyncConflict = Readonly<{
  conflict_id: string;
  memo_id: string;
  generation: string;
  entity_id: string;
  entity_type: MemoSyncEntity;
  local_operation_id: string;
  remote_revision: number;
  local_payload: Readonly<Record<string, unknown>>;
  remote_payload: Readonly<Record<string, unknown>>;
  created_at: number;
}>;

export type MemoSyncSnapshot = Readonly<{
  snapshot_id: string;
  memo_id: string;
  generation: string;
  watermark: number;
  expires_at: number;
  item_count: number;
  asset_count: number;
}>;

export type MemoRemoteState = Readonly<{
  memo_id: string;
  replication: MemoReplication;
  residency: MemoResidency;
  generation: string;
  remote_memo_id: string | null;
  cursor: number;
  remote_revision: number;
  status: MemoRemoteStatus;
  complete: boolean;
  error: string | null;
  updated_at: number;
}>;

export type MemoBootstrapInput = Readonly<{
  operation_id: string;
  memo_id: string;
  account_id: string;
  generation: string;
  base_revision: number;
  title: string;
  description: string;
  manifest_watermark: number;
  now: number;
}>;

export function freezeMemoSyncPayload(payload: Readonly<Record<string, unknown>>): string {
  return JSON.stringify(payload);
}

function validateGeneration(value: string): string {
  return validateMemoId(value);
}

function validateOperationIds(operationId: string, memoId: string, accountId: string, entityId: string): void {
  validateMemoId(operationId);
  validateMemoId(memoId);
  validateMemoId(accountId);
  validateMemoId(entityId);
}

function operation(input: Omit<MemoSyncOperation, 'frozen_payload' | 'state' | 'attempt' | 'next_attempt_at'>): MemoSyncOperation {
  validateOperationIds(input.operation_id, input.memo_id, input.account_id, input.entity_id);
  validateGeneration(input.generation);
  if (!Number.isSafeInteger(input.base_revision) || input.base_revision < 0) throw new Error('Memo sync base revision is invalid.');
  if (!Number.isSafeInteger(input.created_at) || input.created_at <= 0) throw new Error('Memo sync timestamp is invalid.');
  return Object.freeze({
    ...input,
    frozen_payload: freezeMemoSyncPayload(input.payload),
    state: 'pending',
    attempt: 0,
    next_attempt_at: input.created_at,
  });
}

export function createMemoBootstrapOperation(input: MemoBootstrapInput): MemoSyncOperation {
  const payload = { title: input.title, description: input.description, manifest_watermark: input.manifest_watermark };
  return operation({
    operation_id: input.operation_id,
    memo_id: input.memo_id,
    account_id: input.account_id,
    generation: input.generation,
    entity_id: input.memo_id,
    entity_type: 'bootstrap',
    base_revision: input.base_revision,
    predecessor_id: null,
    payload,
    created_at: input.now,
  });
}

export function createMemoMutationOperation(input: {
  operation_id: string;
  memo_id: string;
  account_id: string;
  generation: string;
  entity_id: string;
  entity_type: Exclude<MemoSyncEntity, 'bootstrap'>;
  base_revision: number;
  predecessor_id: string | null;
  payload: Readonly<Record<string, unknown>>;
  now: number;
}): MemoSyncOperation {
  if (input.predecessor_id !== null) validateMemoId(input.predecessor_id);
  return operation({ ...input, created_at: input.now });
}

export function nextMemoSyncOperation(operations: readonly MemoSyncOperation[], now: number): MemoSyncOperation | null {
  const pending = new Map(operations.map((item) => [item.operation_id, item]));
  return [...operations]
    .filter((item) => item.state === 'pending' && item.next_attempt_at <= now)
    .filter((item) => item.predecessor_id === null || operations.some((previous) => previous.operation_id === item.predecessor_id && previous.state === 'acknowledged'))
    .sort((left, right) => left.created_at - right.created_at || left.operation_id.localeCompare(right.operation_id))
    .find((item) => item.predecessor_id === null || !pending.has(item.predecessor_id) || pending.get(item.predecessor_id)?.state === 'acknowledged') ?? null;
}

export function acknowledgeMemoSyncOperation(operationValue: MemoSyncOperation, ack: MemoSyncAck): MemoSyncOperation {
  if (ack.operation_id !== operationValue.operation_id || ack.memo_id !== operationValue.memo_id || ack.generation !== operationValue.generation) {
    throw new Error('Memo sync acknowledgment does not match its operation.');
  }
  const minimumPosition = operationValue.entity_type === 'bootstrap' ? 0 : 1;
  if (!Number.isSafeInteger(ack.remote_revision) || ack.remote_revision < 1 || !Number.isSafeInteger(ack.change_position) || ack.change_position < minimumPosition) {
    throw new Error('Memo sync acknowledgment is invalid.');
  }
  return Object.freeze({ ...operationValue, state: 'acknowledged', next_attempt_at: Number.MAX_SAFE_INTEGER });
}

export function detectMemoSyncConflict(operationValue: MemoSyncOperation, change: MemoSyncChange): MemoSyncConflict | null {
  if (change.memo_id !== operationValue.memo_id || change.generation !== operationValue.generation || change.entity_id !== operationValue.entity_id || change.entity_type !== operationValue.entity_type) return null;
  if (change.operation_id === operationValue.operation_id || change.revision <= operationValue.base_revision) return null;
  return Object.freeze({
    conflict_id: `${operationValue.operation_id}:${change.change_position}`,
    memo_id: operationValue.memo_id,
    generation: operationValue.generation,
    entity_id: operationValue.entity_id,
    entity_type: operationValue.entity_type,
    local_operation_id: operationValue.operation_id,
    remote_revision: change.revision,
    local_payload: operationValue.payload,
    remote_payload: change.payload,
    created_at: Date.now(),
  });
}

export function validateMemoRemoteState(state: MemoRemoteState): MemoRemoteState {
  validateMemoId(state.memo_id);
  validateGeneration(state.generation);
  if (state.remote_memo_id !== null) validateMemoId(state.remote_memo_id);
  if (!Number.isSafeInteger(state.cursor) || state.cursor < 0 || !Number.isSafeInteger(state.remote_revision) || state.remote_revision < 0) throw new Error('Memo sync cursor is invalid.');
  if (!Number.isSafeInteger(state.updated_at) || state.updated_at <= 0) throw new Error('Memo sync state timestamp is invalid.');
  return state;
}

