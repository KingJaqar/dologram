import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, expect, test } from 'vitest';
import { completePendingWipe, retainedWipeKey } from './signOut';

beforeEach(() => { sessionStorage.clear(); });

test('a pending blocked deletion is attempted once and cleared after the wipe completes', async () => {
  expect(await completePendingWipe(new IDBFactory())).toBe('none');
  sessionStorage.setItem(retainedWipeKey, 'retained');
  expect(await completePendingWipe(new IDBFactory())).toBe('cleared');
  expect(sessionStorage.getItem(retainedWipeKey)).toBeNull();
  expect(await completePendingWipe(new IDBFactory())).toBe('none');
});

test('an unavailable database leaves the retained record for the next start', async () => {
  sessionStorage.setItem(retainedWipeKey, 'retained');
  expect(await completePendingWipe(null)).toBe('none');
  expect(sessionStorage.getItem(retainedWipeKey)).toBe('retained');
});
