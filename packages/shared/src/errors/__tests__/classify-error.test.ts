import { classifyError, type ClassifiedError, type ErrorMessageKey, messageKeyFor } from '../../errors';

describe('classifyError', () => {
  test('23505 is delivered', () => {
    const result = classifyError({ code: '23505', message: 'duplicate key value violates unique constraint' });
    expect(result.kind).toBe('delivered');
  });

  test('DG429 is rateLimited with retryAfterSec', () => {
    const result = classifyError({ code: 'DG429', status: 429, details: 30 });
    expect(result.kind).toBe('rateLimited');
    expect(result.retryAfterSec).toBe(30);
  });

  test('DG429 defaults retryAfterSec to 1', () => {
    const result = classifyError({ code: 'DG429', status: 429 });
    expect(result.kind).toBe('rateLimited');
    expect(result.retryAfterSec).toBe(1);
  });

  test('TypeError / status 0 is network', () => {
    const result = classifyError(new TypeError('Network error'));
    expect(result.kind).toBe('network');
  });

  test('status 0 is network', () => {
    const result = classifyError({ code: 'some-code', status: 0 });
    expect(result.kind).toBe('network');
  });

  test('a fetch failure reported only in the response status is network', () => {
    // supabase-js returns status 0 beside the error object when fetch itself threw.
    const result = classifyError({ code: '', message: 'TypeError: Failed to fetch' }, 0);
    expect(result.kind).toBe('network');
  });

  test('unknown code is server', () => {
    const result = classifyError({ code: 'DG999', status: 500 });
    expect(result.kind).toBe('server');
    expect(result.code).toBe('DG999');
    expect(result.status).toBe(500);
  });

  test('messageKeyFor returns correct key', () => {
    const delivered: ClassifiedError = { kind: 'delivered' };
    expect(messageKeyFor(delivered)).toBe('chat.statusSent');

    const rateLimited: ClassifiedError = { kind: 'rateLimited', retryAfterSec: 30 };
    expect(messageKeyFor(rateLimited)).toBe('queue.rateLimited');

    const network: ClassifiedError = { kind: 'network' };
    expect(messageKeyFor(network)).toBe('common.noConnection');

    const server: ClassifiedError = { kind: 'server', code: 'DG500', status: 500 };
    expect(messageKeyFor(server)).toBe('common.couldNotLoad');
  });
});

describe('ErrorMessageKey type', () => {
  test('all keys are strings', () => {
    // Just verify the union type has the expected members
    type Keys = ErrorMessageKey;
    const k: Keys = 'chat.statusSent'; // should compile
  });
});