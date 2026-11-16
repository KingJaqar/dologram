import 'server-only';
import { z } from 'zod';
import type { Sql } from 'postgres';
import { validateDisplayName, validateEmail, validateUsername } from '@dologram/shared/src/validation/account';
import { dgTrim } from '@dologram/shared/src/validation/text';
import { getSql } from '../db.ts';

export const CSV_HEADER_ERROR = 'The CSV needs the columns email, username and display_name.';
export const CSV_LIMIT_ERROR = 'A CSV can have at most 100 rows.';
export const csvInputSchema = z.strictObject({
  headers: z.array(z.string().max(80)).max(10),
  rows: z.array(z.strictObject({
    email: z.string().max(254), username: z.string().max(64), display_name: z.string().max(200),
  })).max(101),
});
export type CsvInput = z.infer<typeof csvInputSchema>;
export type CsvRow = CsvInput['rows'][number];
export type CsvValidation = { ok: true; rows: { row: number; problem?: string }[] }
  | { ok: false; message: string };

export function normalizeCsvRow(row: CsvRow): CsvRow {
  return { email: dgTrim(row.email).toLowerCase(), username: dgTrim(row.username).toLowerCase(), display_name: dgTrim(row.display_name) };
}

/** Strict boundary validation precedes SQL. Only account identities are queried. */
export async function validateRows(input: unknown, database?: Sql): Promise<CsvValidation> {
  const parsed = csvInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'The CSV contains invalid or oversized fields.' };
  const { headers } = parsed.data;
  if (headers.join(',') !== 'email,username,display_name' || headers.length !== 3) return { ok: false, message: CSV_HEADER_ERROR };
  if (parsed.data.rows.length > 100) return { ok: false, message: CSV_LIMIT_ERROR };
  if (parsed.data.rows.length === 0) return { ok: false, message: 'The CSV has no account rows.' };
  const rows = parsed.data.rows.map(normalizeCsvRow);
  const emails = rows.map(row => row.email);
  const usernames = rows.map(row => row.username);
  const sql = database ?? getSql();
  const taken = await sql<{ email: string | null; username: string | null }[]>`
    select lower(email) as email, null::text as username from auth.users where lower(email) = any(${emails}::text[])
    union all
    select null::text as email, lower(username) as username from public.profiles where lower(username) = any(${usernames}::text[])`;
  const takenEmails = new Set(taken.map(row => row.email));
  const takenUsernames = new Set(taken.map(row => row.username));
  return { ok: true, rows: rows.map((row, index) => {
    let problem: string | undefined;
    if (!validateEmail(row.email)) problem = 'Enter a valid email address.';
    else if (!validateUsername(row.username)) problem = 'Username must be 5 to 32 characters: a lowercase letter, then lowercase letters, digits or underscores.';
    else if (!validateDisplayName(row.display_name)) problem = 'Display name must be 1 to 64 characters.';
    else if (emails.indexOf(row.email) !== emails.lastIndexOf(row.email)) problem = 'Duplicate email in this CSV.';
    else if (usernames.indexOf(row.username) !== usernames.lastIndexOf(row.username)) problem = 'Duplicate username in this CSV.';
    else if (takenEmails.has(row.email)) problem = 'An account with this email already exists.';
    else if (takenUsernames.has(row.username)) problem = 'This username is taken.';
    return { row: index + 1, ...(problem ? { problem } : {}) };
  }) };
}
