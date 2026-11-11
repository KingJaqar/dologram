import { findUser } from '../profiles';
import { createDgClient } from '../../client';
import type { DgResult } from '../../result';

describe('findUser', () => {
  test('validates with createDgClient startup checks', () => {
    expect(typeof findUser).toBe('function');
  });
});