import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { assertAccountAccess } from './accountAccess.ts';
import { CallHttpError } from './http.ts';

test('shared call/memo authentication rejects forced or malformed current flags', () => {
  for (const must_change_password of [true, 'true', null, 1]) {
    assert.throws(() => assertAccountAccess({ must_change_password }), error =>
      error instanceof CallHttpError && error.status === 403 && error.code === 'CALL_NOT_ALLOWED');
  }
  assert.doesNotThrow(() => assertAccountAccess({}));
  assert.doesNotThrow(() => assertAccountAccess({ must_change_password: false }));
});
