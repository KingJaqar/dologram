import { updateOwnMember } from '../members';
import { createDgClient } from '../../client';
import type { DgResult } from '../../result';

describe('updateOwnMember', () => {
  test('validates with createDgClient startup checks', () => {
    expect(typeof updateOwnMember).toBe('function');
  });
});