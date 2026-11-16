import { callRecoveryDelayMs } from '../recovery';

describe('call recovery bounds', () => {
  it('allows the configured bounded retries and then stops', () => {
    expect(callRecoveryDelayMs(0)).toBe(1000);
    expect(callRecoveryDelayMs(2)).toBe(5000);
    expect(callRecoveryDelayMs(3)).toBeNull();
  });
});
