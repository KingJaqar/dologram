import 'server-only';
import type { Sql } from 'postgres';
import { z } from 'zod';
import { asAdminDbError, getSql } from '../db.ts';
import { escapeLike } from '../like.ts';

const PAGE_SIZE = 50;
const pageSchema = z.coerce.number().int().min(1).max(100_000);
const searchSchema = z.string().trim().max(120);
const filterSchema = z.enum(['all', 'active', 'banned', 'mustChange']);

export type AccountFilter = z.infer<typeof filterSchema>;
/** ADM-03 status precedence: Banned, then Must change password, then Active. */
export type AccountStatus = 'active' | 'banned' | 'mustChangePassword';

export interface AccountListRow {
  userId: string;
  username: string | null;
  displayName: string | null;
  email: string | null;
  /** ISO timestamp; the browser formats it in its own time zone. */
  createdAt: string;
  /** ISO timestamp, or null when the account has never signed in. */
  lastSignInAt: string | null;
  status: AccountStatus;
  /** Database application role `admin`; rendered as the Admin pill. */
  admin: boolean;
  /** Reserved for Phase 19; the current schema has no premium flags. */
  premiumFlags: readonly string[];
}

export interface AccountQuery {
  q?: string;
  filter?: string;
  page?: string | number;
}

export interface AccountListPage {
  rows: AccountListRow[];
  total: number;
  page: number;
  pageSize: typeof PAGE_SIZE;
  filter: AccountFilter;
}

interface RawRow {
  user_id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
  created_at: Date | string;
  last_sign_in_at: Date | string | null;
  banned: boolean;
  must_change: boolean;
  is_admin: boolean;
}

const noPremiumFlags: readonly string[] = Object.freeze([]);

function pageNumber(value: string | number | undefined): number {
  const parsed = pageSchema.safeParse(value ?? 1);
  return parsed.success ? parsed.data : 1;
}

function accountFilter(value: string | undefined): AccountFilter {
  const parsed = filterSchema.safeParse(value ?? 'all');
  return parsed.success ? parsed.data : 'all';
}

function searchPattern(value: string | undefined): string | null {
  const parsed = searchSchema.safeParse(value ?? '');
  const text = parsed.success ? parsed.data : '';
  return text ? `%${escapeLike(text)}%` : null;
}

function timestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Account time is not a valid timestamp.');
  return date.toISOString();
}

function optionalTimestamp(value: Date | string | null): string | null {
  return value === null ? null : timestamp(value);
}

function mapRow(row: RawRow): AccountListRow {
  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    createdAt: timestamp(row.created_at),
    lastSignInAt: optionalTimestamp(row.last_sign_in_at),
    status: row.banned ? 'banned' : row.must_change ? 'mustChangePassword' : 'active',
    admin: row.is_admin === true,
    premiumFlags: noPremiumFlags,
  };
}

/**
 * Reads ADM-03 over the direct database connection. Only the allowlisted identity
 * fields are selected; chats, messages and file contents are never returned.
 */
export async function listAccounts(query: AccountQuery = {}, sql: Sql = getSql()): Promise<AccountListPage> {
  const page = pageNumber(query.page);
  const filter = accountFilter(query.filter);
  const pattern = searchPattern(query.q);
  const offset = (page - 1) * PAGE_SIZE;
  try {
    const rows = await sql<RawRow[]>`
      select u.id::text as user_id, p.username, p.display_name, u.email,
             u.created_at, u.last_sign_in_at,
             (u.banned_until is not null and u.banned_until > now()) as banned,
             (coalesce(u.raw_app_meta_data ->> 'must_change_password', 'false') = 'true') as must_change,
             (coalesce(p.roles, 'user') = 'admin') as is_admin
      from auth.users u
      left join public.profiles p on p.user_id = u.id
      where (
          ${pattern}::text is null
          or p.username ilike ${pattern} escape '\\'
          or u.email ilike ${pattern} escape '\\'
        )
        and (
          ${filter}::text = 'all'
          or (${filter}::text = 'banned'
            and u.banned_until is not null and u.banned_until > now())
          or (${filter}::text = 'mustChange'
            and (u.banned_until is null or u.banned_until <= now())
            and coalesce(u.raw_app_meta_data ->> 'must_change_password', 'false') = 'true')
          or (${filter}::text = 'active'
            and (u.banned_until is null or u.banned_until <= now())
            and coalesce(u.raw_app_meta_data ->> 'must_change_password', 'false') <> 'true')
        )
      order by u.created_at desc, u.id desc
      limit ${PAGE_SIZE} offset ${offset}`;
    const counted = await sql<{ total: number }[]>`
      select count(*)::int as total
      from auth.users u
      left join public.profiles p on p.user_id = u.id
      where (
          ${pattern}::text is null
          or p.username ilike ${pattern} escape '\\'
          or u.email ilike ${pattern} escape '\\'
        )
        and (
          ${filter}::text = 'all'
          or (${filter}::text = 'banned'
            and u.banned_until is not null and u.banned_until > now())
          or (${filter}::text = 'mustChange'
            and (u.banned_until is null or u.banned_until <= now())
            and coalesce(u.raw_app_meta_data ->> 'must_change_password', 'false') = 'true')
          or (${filter}::text = 'active'
            and (u.banned_until is null or u.banned_until <= now())
            and coalesce(u.raw_app_meta_data ->> 'must_change_password', 'false') <> 'true')
        )`;
    return {
      rows: rows.map(mapRow),
      total: Number(counted[0]?.total ?? 0),
      page,
      pageSize: PAGE_SIZE,
      filter,
    };
  } catch (error) {
    throw asAdminDbError(error);
  }
}

/** ADM-05 identity read for one account; an unknown or malformed id returns null. */
export async function getAccount(userId: string, sql?: Sql): Promise<AccountListRow | null> {
  const parsed = z.uuid().safeParse(userId);
  if (!parsed.success) return null;
  const db = sql ?? getSql();
  try {
    const rows = await db<RawRow[]>`
      select u.id::text as user_id, p.username, p.display_name, u.email,
             u.created_at, u.last_sign_in_at,
             (u.banned_until is not null and u.banned_until > now()) as banned,
             (coalesce(u.raw_app_meta_data ->> 'must_change_password', 'false') = 'true') as must_change,
             (coalesce(p.roles, 'user') = 'admin') as is_admin
      from auth.users u
      left join public.profiles p on p.user_id = u.id
      where u.id = ${parsed.data}::uuid`;
    const row = rows[0];
    return row === undefined ? null : mapRow(row);
  } catch (error) {
    throw asAdminDbError(error);
  }
}
