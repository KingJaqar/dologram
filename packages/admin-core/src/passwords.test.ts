import { describe, expect, it } from 'vitest';
import {
  consumePasswordDraft,
  generatePassword,
  isGeneratedPassword,
  mintPasswordDraft,
  PASSWORD_ALPHABET,
  PASSWORD_DRAFT_TTL_MS,
  PASSWORD_LENGTH,
} from './passwords.ts';

describe('generatePassword', () => {
  it('uses the 56-character D-105 alphabet without look-alike characters', () => {
    expect(PASSWORD_ALPHABET).toHaveLength(56);
    expect(new Set(PASSWORD_ALPHABET).size).toBe(56);
    for (const character of 'IOlo01') expect(PASSWORD_ALPHABET).not.toContain(character);
  });

  it('draws 16 alphabet characters and varies every value', () => {
    const samples = new Set(Array.from({ length: 32 }, () => generatePassword()));
    expect(samples.size).toBe(32);
    for (const password of samples) {
      expect(password).toHaveLength(PASSWORD_LENGTH);
      expect(isGeneratedPassword(password)).toBe(true);
    }
  });

  it('maps the random-index boundaries without wrapping or accepting an out-of-range index', () => {
    expect(generatePassword(() => 0)).toBe('A'.repeat(PASSWORD_LENGTH));
    expect(generatePassword(max => max - 1)).toBe('9'.repeat(PASSWORD_LENGTH));
    expect(() => generatePassword(max => max)).toThrow('Random index is outside the password alphabet.');
    expect(() => generatePassword(() => -1)).toThrow('Random index is outside the password alphabet.');
  });

  it('checks length and alphabet only, so provenance is never inferred from the value', () => {
    expect(isGeneratedPassword('A'.repeat(PASSWORD_LENGTH - 1))).toBe(false);
    expect(isGeneratedPassword('A'.repeat(PASSWORD_LENGTH))).toBe(true);
    expect(isGeneratedPassword(`${'A'.repeat(PASSWORD_LENGTH - 1)}O`)).toBe(false);
  });
});

describe('password drafts', () => {
  it('mints a session-bound draft that is consumed exactly once', () => {
    const draft = mintPasswordDraft({ sessionId: 'session-consume' });
    expect(draft.passwordDraftId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u);
    expect(isGeneratedPassword(draft.password)).toBe(true);
    expect(draft.expiresAt).toBeGreaterThan(Date.now());
    expect(consumePasswordDraft({ passwordDraftId: draft.passwordDraftId, sessionId: 'session-consume' }))
      .toEqual({ ok: true, password: draft.password });
    expect(consumePasswordDraft({ passwordDraftId: draft.passwordDraftId, sessionId: 'session-consume' }))
      .toEqual({ ok: false, reason: 'unknown' });
  });

  it('refuses a foreign session without destroying the owner draft and rejects unknown ids', () => {
    const draft = mintPasswordDraft({ sessionId: 'session-owner' });
    expect(consumePasswordDraft({ passwordDraftId: draft.passwordDraftId, sessionId: 'session-foreign' }))
      .toEqual({ ok: false, reason: 'foreign' });
    expect(consumePasswordDraft({ passwordDraftId: draft.passwordDraftId, sessionId: 'session-owner' }))
      .toEqual({ ok: true, password: draft.password });
    expect(consumePasswordDraft({ passwordDraftId: '00000000-0000-4000-8000-000000000000', sessionId: 'session-owner' }))
      .toEqual({ ok: false, reason: 'unknown' });
  });

  it('expires after the bounded lifetime and invalidates a regenerated draft', () => {
    const start = 1_000;
    const draft = mintPasswordDraft({ sessionId: 'session-expiry', now: start });
    expect(consumePasswordDraft({
      passwordDraftId: draft.passwordDraftId, sessionId: 'session-expiry', now: start + PASSWORD_DRAFT_TTL_MS,
    })).toEqual({ ok: false, reason: 'expired' });

    const first = mintPasswordDraft({ sessionId: 'session-regenerate' });
    const second = mintPasswordDraft({ sessionId: 'session-regenerate' });
    expect(second.passwordDraftId).not.toBe(first.passwordDraftId);
    expect(consumePasswordDraft({ passwordDraftId: first.passwordDraftId, sessionId: 'session-regenerate' }))
      .toEqual({ ok: false, reason: 'unknown' });
    expect(consumePasswordDraft({ passwordDraftId: second.passwordDraftId, sessionId: 'session-regenerate' }).ok).toBe(true);
  });
});
