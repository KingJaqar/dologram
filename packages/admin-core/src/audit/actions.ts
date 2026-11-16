import 'server-only';
import { z } from 'zod';

const text = z.string().trim().min(1).max(120).refine(value => !/[\u0000-\u001f\u007f]/u.test(value));
const count = z.number().int().min(0).max(1_000_000_000);
const flag = z.string().trim().min(1).max(40).regex(/^[a-z][a-z0-9_]*$/u);
const metric = z.enum(['database', 'storage', 'egress', 'realtime_peak', 'realtime_messages', 'monthly_active_users']);

/**
 * Proposed D-172 action names. Each name has one strict detail allowlist: unknown,
 * nested or credential-shaped fields are refused instead of being redacted later.
 */
const details = {
  'session.unlock': z.strictObject({}),
  'session.lockout': z.strictObject({}),
  'account.create': z.strictObject({ username: text, source: z.enum(['admin', 'script']) }),
  'account.import_csv': z.strictObject({ created: count, invalid: count, total: count }),
  'account.reset_password': z.strictObject({}),
  'account.ban': z.strictObject({}),
  'account.unban': z.strictObject({}),
  'account.delete': z.strictObject({ pushTokens: count.optional() }),
  'premium.set': z.strictObject({ flag, enabled: z.boolean() }),
  'project.restore': z.strictObject({}),
  'usage.manual_entry': z.strictObject({ metric, used: count }),
  'settings.check': z.strictObject({}),
  'job.export': z.strictObject({ files: count }),
  'job.media_copy': z.strictObject({ copied: count, skipped: count, failed: count }),
  'job.purge_preview': z.strictObject({ files: count, bytes: count }),
  'job.purge': z.strictObject({ files: count, bytes: count }),
  'drill.done': z.strictObject({}),
} as const;

export type AuditDetailMap = { [K in keyof typeof details]: z.infer<(typeof details)[K]> };
export type AuditAction = keyof AuditDetailMap;

export const auditActions: readonly AuditAction[] = Object.freeze(Object.keys(details) as AuditAction[]);

/** A rejected detail carries no input values, keys or provider diagnostics. */
export class AuditDetailError extends Error {
  constructor() {
    super('Audit detail is not allowed for this action.');
    this.name = 'AuditDetailError';
  }
}

export function isAuditAction(value: string): value is AuditAction {
  return Object.hasOwn(details, value);
}

export function parseAuditDetail<A extends AuditAction>(action: A, detail: unknown): AuditDetailMap[A] {
  if (!isAuditAction(action)) throw new AuditDetailError();
  const schema: z.ZodType = details[action];
  const parsed = schema.safeParse(detail);
  if (!parsed.success) throw new AuditDetailError();
  return parsed.data as AuditDetailMap[A];
}
