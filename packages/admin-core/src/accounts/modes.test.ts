import { describe, expect, it } from 'vitest';
import { getAccountCapability, getPasswordFlagMode } from './modes.ts';

describe('account capability contract', () => {
  it('keeps create/reset/ban disabled without a verified forced-password and ban contract', () => {
    const capability = getAccountCapability();
    expect(capability.passwordFlag).toBe('unsupported');
    expect(capability.banFallback).toBe('none');
    expect(capability.mutations).toBe('disabled');
    expect(capability.prerequisite).toMatch(/AB-02/u);
    expect(getPasswordFlagMode()).toBe(capability.passwordFlag);
  });
});
