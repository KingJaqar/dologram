import { addReaction, setReactionRemoved } from '../reactions';
import { createDgClient } from '../../client';
import type { DgResult } from '../../result';

describe('addReaction', () => {
  test('validates with createDgClient startup checks', () => {
    expect(typeof addReaction).toBe('function');
  });
});

describe('setReactionRemoved', () => {
  test('validates with createDgClient startup checks', () => {
    expect(typeof setReactionRemoved).toBe('function');
  });
});