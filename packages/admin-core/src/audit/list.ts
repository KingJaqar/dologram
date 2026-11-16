import 'server-only';
import type { Sql } from 'postgres';
import { z } from 'zod';
import { asAdminDbError, getSql } from '../db.ts';
import { escapeLike } from '../like.ts';
import { isAuditAction, type AuditAction } from './actions.ts';

const PAGE_SIZE = 50;
const pageSchema = z.coerce.number().int().min(1).max(100_000);
const targetSchema = z.string().trim().max(120);
const detailSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));

export interface AuditListRow {
  id: string;
  /** ISO timestamp; the browser formats it in its own time zone. */
  at: string;
  action: string;
  result: 'success' | 'failed';
  /** Safe redacted display text built from allowlisted detail values. */
  detail: string;
  targetUsername: string | null;
}

export interface AuditQuery {
  page?: string | number;
  action?: string;
  target?: string;
}

export interface AuditPage {
  rows: AuditListRow[];
  total: number;
  page: number;
  pageSize: typeof PAGE_SIZE;
}

interface RawRow {
  id: string;
  at: Date | string;
  action: string;
  result: string;
  detail: unknown;
  target_username: string | null;
}

function pageNumber(value: string | number | undefined): number {
  const parsed = pageSchema.safeParse(value ?? 1);
  return parsed.success ? parsed.data : 1;
}

function targetFilter(value: string | undefined): string {
  const parsed = targetSchema.safeParse(value ?? '');
  return parsed.success ? parsed.data : '';
}

function displayDetail(value: unknown): string {
  const parsed = detailSchema.safeParse(value);
  if (!parsed.success) return '—';
  const entries = Object.entries(parsed.data).sort(([left], [right]) => left.localeCompare(right));
  if (entries.length === 0) return '—';
  return entries.map(([key, item]) => `${key}=${String(item)}`).join(', ').slice(0, 500);
}

function timestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Audit time is not a valid timestamp.');
  return date.toISOString();
}

/**
 * Reads the audit log over the direct database connection. Only identity text is
 * returned; chats, messages and file contents are never selected.
 */
export async function listAudit(query: AuditQuery = {}, sql: Sql = getSql()): Promise<AuditPage> {
  const page = pageNumber(query.page);
  const action: AuditAction | null = typeof query.action === 'string' && isAuditAction(query.action)
    ? query.action : null;
  const target = targetFilter(query.target);
  const pattern = target ? `%${escapeLike(target)}%` : null;
  const exactId = z.uuid().safeParse(target).success ? target : null;
  const offset = (page - 1) * PAGE_SIZE;
  try {
    const rows = await sql<RawRow[]>`
      select a.id::text as id, a.at, a.action, a.result, a.detail,
             coalesce(p.username, a.target_user_id::text) as target_username
      from private.admin_audit a
      left join public.profiles p on p.user_id = a.target_user_id
      where (${action}::text is null or a.action = ${action})
        and (
          ${pattern}::text is null
          or p.username ilike ${pattern} escape '\\'
          or a.target_user_id::text = ${exactId}
        )
      order by a.at desc, a.id desc
      limit ${PAGE_SIZE} offset ${offset}`;
    const counted = await sql<{ total: number }[]>`
      select count(*)::int as total
      from private.admin_audit a
      left join public.profiles p on p.user_id = a.target_user_id
      where (${action}::text is null or a.action = ${action})
        and (
          ${pattern}::text is null
          or p.username ilike ${pattern} escape '\\'
          or a.target_user_id::text = ${exactId}
        )`;
    return {
      rows: rows.map(row => ({
        id: row.id,
        at: timestamp(row.at),
        action: row.action,
        result: row.result === 'failed' ? 'failed' : 'success',
        detail: displayDetail(row.detail),
        targetUsername: row.target_username,
      })),
      total: Number(counted[0]?.total ?? 0),
      page,
      pageSize: PAGE_SIZE,
    };
  } catch (error) {
    throw asAdminDbError(error);
  }
}
