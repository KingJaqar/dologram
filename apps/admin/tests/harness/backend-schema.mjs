// Source-matched disposable schema, never a hosted migration runner.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
const migrations = resolve('supabase/migrations');
process.stdout.write(`
create schema extensions;
create extension pgcrypto with schema extensions;
create schema storage;
alter default privileges for role postgres in schema public grant all on tables to service_role;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid, owner_id text, metadata jsonb);
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1]; $$;
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
create schema realtime;
create table realtime.messages (id bigint generated always as identity, topic text, extension text, payload jsonb);
alter table realtime.messages enable row level security;
grant usage on schema realtime to authenticated;
grant select, insert on realtime.messages to authenticated;
create policy fixture_realtime_access on realtime.messages for all to authenticated using (true) with check (true);
`);
for (const file of readdirSync(migrations).filter(name => /^\d{3}_.*\.sql$/u.test(name)).sort()) {
  // Legacy real-account seeds are never fixtures. Cron registration is outside
  // this harness's plain PostgreSQL image; all 038 schema/RPC bodies are exact.
  if (file.startsWith('011_')) continue;
  const source = readFileSync(resolve(migrations, file), 'utf8');
  if (file.startsWith('010_')) {
    const helper = source.match(/create or replace function public\.set_user_metadata\b[\s\S]*?\$\$;/u)?.[0];
    if (!helper) throw Error('Legacy helper source not found');
    process.stdout.write(helper + '\n');
    continue;
  }
  const sql = file.startsWith('038_') ? source.slice(0, source.indexOf('create extension if not exists pg_cron')) : source;
  if (!sql.trim()) throw Error('Empty source migration');
  process.stdout.write(`\n-- Source: ${file}\n${sql}\n`);
}
