/** Sync module barrel (M2-05, 6.4, D-40, D-43, D-91). */
export { createSyncEngine } from './engine';
export type { SyncEngine, SyncEngineDeps } from './engine';
export type {
  ChangePayload,
  ChangeTable,
  SyncCacheStore,
  SyncDelivery,
  SyncDeliveryHandlers,
  SyncDeliveryStatus,
  SyncSource,
  SyncSummary,
} from './types';
