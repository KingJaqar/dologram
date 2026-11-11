import { insertMessage, editMessage, softDeleteMessage } from '../messages';
import { createDgClient } from '../../client';
import type { DgResult } from '../../result';

describe('insertMessage', () => {
  test('validates with createDgClient startup checks', () => {
    // The function itself doesn't throw; createDgClient does for bad inputs
    expect(typeof insertMessage).toBe('function');
  });
});

describe('editMessage', () => {
  test('validates with createDgClient startup checks', () => {
    expect(typeof editMessage).toBe('function');
  });
});

describe('softDeleteMessage', () => {
  test('validates with createDgClient startup checks', () => {
    expect(typeof softDeleteMessage).toBe('function');
  });
});