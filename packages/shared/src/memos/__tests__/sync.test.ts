import { describe, expect, it } from 'vitest';
import {
  acknowledgeMemoSyncOperation,
  createMemoBootstrapOperation,
  createMemoMutationOperation,
  detectMemoSyncConflict,
  nextMemoSyncOperation,
  validateMemoRemoteState,
} from '../sync';

const id = (last: string) => `00000000-0000-4000-8000-00000000000${last}`;
const now = 1_700_000_000_000;

describe('memo cloud sync contracts', () => {
  it('freezes bootstrap before subsequent mutations and drains in predecessor order', () => {
    const bootstrap = createMemoBootstrapOperation({
      operation_id: id('1'), memo_id: id('2'), account_id: id('3'), generation: id('4'), base_revision: 1,
      title: 'Memo', description: '', manifest_watermark: 7, now,
    });
    const mutation = createMemoMutationOperation({
      operation_id: id('5'), memo_id: id('2'), account_id: id('3'), generation: id('4'), entity_id: id('6'),
      entity_type: 'item', base_revision: 1, predecessor_id: bootstrap.operation_id, payload: { text: 'offline' }, now: now + 1,
    });
    expect(nextMemoSyncOperation([mutation, bootstrap], now + 2)?.operation_id).toBe(bootstrap.operation_id);
    const acknowledged = acknowledgeMemoSyncOperation(bootstrap, {
      operation_id: bootstrap.operation_id, memo_id: bootstrap.memo_id, generation: bootstrap.generation,
      remote_revision: 1, change_position: 1, receipt: { remote_memo_id: id('7') },
    });
    expect(nextMemoSyncOperation([mutation, acknowledged], now + 2)?.operation_id).toBe(mutation.operation_id);
    expect(bootstrap.frozen_payload).toContain('manifest_watermark');
  });

  it('preserves a same-entity remote edit as a conflict', () => {
    const operation = createMemoMutationOperation({
      operation_id: id('1'), memo_id: id('2'), account_id: id('3'), generation: id('4'), entity_id: id('5'),
      entity_type: 'note', base_revision: 4, predecessor_id: null, payload: { body: 'local' }, now,
    });
    const conflict = detectMemoSyncConflict(operation, {
      change_position: 12, operation_id: id('6'), memo_id: id('2'), generation: id('4'), entity_id: id('5'),
      entity_type: 'note', revision: 5, payload: { body: 'remote' }, deleted: false,
    });
    expect(conflict?.local_payload).toEqual({ body: 'local' });
    expect(conflict?.remote_payload).toEqual({ body: 'remote' });
  });

  it('rejects a cursor that could skip an authoritative change', () => {
    expect(() => validateMemoRemoteState({
      memo_id: id('1'), replication: 'synced', residency: 'keep_all', generation: id('2'), remote_memo_id: null,
      cursor: -1, remote_revision: 0, status: 'pending', complete: false, error: null, updated_at: now,
    })).toThrow('cursor');
  });
});
