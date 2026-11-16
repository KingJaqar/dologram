// @vitest-environment node
import { expect, it } from 'vitest';
import * as shared from '@dologram/shared';
import { getSupabase } from './supabase';
import { ids } from './ids';

it('imports the full shared entry and lazy adapters during prerender without browser or native initialization', () => {
  expect(typeof window).toBe('undefined');
  expect(shared.sharedReady).toBe(true);
  expect(shared.createQueueCore).toBeTypeOf('function');
  expect(shared.createSyncEngine).toBeTypeOf('function');
  expect(shared.MemoStore).toBeTypeOf('function');
  expect(shared.listCallHistory).toBeTypeOf('function');
  expect(ids.messageId).toBeTypeOf('function');
  expect(() => getSupabase()).toThrow('Open DoloGram in a browser');
});
