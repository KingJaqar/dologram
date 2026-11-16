import { describe, expect, it } from 'vitest';
import { AuditDetailError, auditActions, parseAuditDetail } from './actions.ts';

describe('audit action registry', () => {
  it('contains exactly the proposed D-172 names', () => {
    expect([...auditActions]).toEqual([
      'session.unlock',
      'session.lockout',
      'account.create',
      'account.import_csv',
      'account.reset_password',
      'account.ban',
      'account.unban',
      'account.delete',
      'premium.set',
      'project.restore',
      'usage.manual_entry',
      'settings.check',
      'job.export',
      'job.media_copy',
      'job.purge_preview',
      'job.purge',
      'drill.done',
    ]);
  });

  it('accepts only the declared detail fields for each action', () => {
    expect(parseAuditDetail('account.create', { username: 'newuser', source: 'admin' }))
      .toEqual({ username: 'newuser', source: 'admin' });
    expect(parseAuditDetail('job.media_copy', { copied: 4, skipped: 1, failed: 0 }))
      .toEqual({ copied: 4, skipped: 1, failed: 0 });
    expect(parseAuditDetail('session.unlock', {})).toEqual({});
  });

  it('refuses credentials, unknown fields, nested values and out-of-range counts', () => {
    const refused: [string, unknown][] = [
      ['account.create', { username: 'newuser', source: 'admin', password: 'sentinel-password' }],
      ['account.create', { username: 'newuser', source: 'admin', user: { password: 'sentinel-password' } }],
      ['account.create', { username: { password: 'sentinel-password' }, source: 'admin' }],
      ['account.create', { username: 'newuser', source: 'owner' }],
      ['account.import_csv', { created: 1, invalid: -1, total: 0 }],
      ['premium.set', { flag: 'Bad Flag', enabled: true }],
      ['usage.manual_entry', { metric: 'disk', used: 1 }],
      ['session.unlock', 'text'],
    ];
    for (const [action, detail] of refused) {
      expect(() => parseAuditDetail(action as Parameters<typeof parseAuditDetail>[0], detail)).toThrow(AuditDetailError);
    }
  });

  it('allows the declared safe push token count without allowing a token value', () => {
    expect(parseAuditDetail('account.delete', { pushTokens: 3 })).toEqual({ pushTokens: 3 });
    expect(() => parseAuditDetail('account.delete', { pushTokens: 'expo-token-value' })).toThrow(AuditDetailError);
  });

  it('keeps refusal messages free of submitted values', () => {
    try {
      parseAuditDetail('account.create', { username: 'newuser', source: 'admin', password: 'sentinel-password' });
      throw new Error('unreachable');
    } catch (error) {
      expect((error as Error).message).toBe('Audit detail is not allowed for this action.');
      expect((error as Error).message).not.toContain('sentinel-password');
    }
  });
});
