-- Phase 6: private memo replication, ordered receipts, snapshots, reminder jobs and recovery challenges.
-- Client writes go through the memo Edge Function, which authenticates the caller before invoking
-- these service-role-only RPCs. RLS remains enabled on every exposed memo table as a second boundary.

create schema if not exists private;

create table if not exists public.memo_memos (
  memo_id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  generation uuid not null,
  title text not null check (char_length(title) between 1 and 128),
  description text not null default '' check (char_length(description) <= 500),
  replication text not null default 'synced' check (replication in ('local', 'synced')),
  residency text not null default 'keep_all' check (residency in ('keep_all', 'on_demand')),
  revision bigint not null default 1 check (revision > 0),
  change_position bigint not null default 0 check (change_position >= 0),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memo_members (
  memo_id uuid not null references public.memo_memos(memo_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'senior', 'junior', 'viewer')),
  server_revision bigint not null default 1 check (server_revision > 0),
  joined_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (memo_id, user_id)
);

create table if not exists public.memo_item_revisions (
  revision_id uuid primary key,
  memo_id uuid not null references public.memo_memos(memo_id) on delete cascade,
  generation uuid not null,
  entity_id uuid not null,
  entity_type text not null check (entity_type in ('memo', 'item', 'note', 'asset', 'tag', 'pin', 'reminder', 'preference', 'folder', 'trash')),
  revision bigint not null check (revision > 0),
  author_id uuid not null references auth.users(id) on delete restrict,
  payload jsonb not null,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  unique (memo_id, generation, entity_id, entity_type, revision)
);

create table if not exists public.memo_assets (
  asset_id uuid primary key,
  memo_id uuid not null references public.memo_memos(memo_id) on delete cascade,
  generation uuid not null,
  storage_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 255),
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  checksum text,
  state text not null default 'reserved' check (state in ('reserved', 'finalizing', 'verified', 'rejected', 'deleted')),
  upload_attempt_id uuid,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create table if not exists public.memo_changes (
  memo_id uuid not null references public.memo_memos(memo_id) on delete cascade,
  generation uuid not null,
  change_position bigint not null check (change_position > 0),
  operation_id uuid not null,
  entity_id uuid not null,
  entity_type text not null,
  revision bigint not null check (revision > 0),
  payload jsonb not null,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (memo_id, generation, change_position),
  unique (memo_id, generation, operation_id)
);
create index if not exists memo_changes_cursor_idx on public.memo_changes(memo_id, generation, change_position);

create table if not exists public.memo_operation_receipts (
  operation_id uuid primary key,
  memo_id uuid not null references public.memo_memos(memo_id) on delete cascade,
  generation uuid not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  predecessor_id uuid,
  payload_hash text not null,
  result jsonb not null,
  state text not null default 'accepted' check (state in ('accepted', 'conflict', 'purged')),
  created_at timestamptz not null default now()
);
create index if not exists memo_receipts_memo_idx on public.memo_operation_receipts(memo_id, generation, created_at);

create table if not exists public.memo_snapshots (
  snapshot_id uuid primary key,
  memo_id uuid not null references public.memo_memos(memo_id) on delete cascade,
  generation uuid not null,
  watermark bigint not null check (watermark >= 0),
  expires_at timestamptz not null,
  state text not null default 'ready' check (state in ('ready', 'expired', 'invalidated')),
  created_at timestamptz not null default now()
);
create table if not exists public.memo_snapshot_items (
  snapshot_id uuid not null references public.memo_snapshots(snapshot_id) on delete cascade,
  revision_id uuid not null references public.memo_item_revisions(revision_id) on delete restrict,
  primary key (snapshot_id, revision_id)
);

create table if not exists public.memo_reminder_preferences (
  memo_id uuid not null references public.memo_memos(memo_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  enabled boolean not null default true,
  sounds boolean not null default true,
  vibration boolean not null default true,
  timezone text,
  updated_at timestamptz not null default now(),
  primary key (memo_id, user_id, device_id)
);

create table if not exists public.memo_reminder_occurrences (
  occurrence_id text primary key,
  memo_id uuid not null references public.memo_memos(memo_id) on delete cascade,
  generation uuid not null,
  reminder_id uuid not null,
  occurrence_at timestamptz not null,
  state text not null default 'pending' check (state in ('pending', 'claimed', 'accepted', 'failed', 'completed', 'cancelled')),
  claimed_by uuid,
  lease_expires_at timestamptz,
  attempt smallint not null default 0 check (attempt >= 0 and attempt <= 5),
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists memo_reminder_due_idx on public.memo_reminder_occurrences(state, next_attempt_at, occurrence_at);

create table if not exists private.memo_jobs (
  job_id uuid primary key default extensions.gen_random_uuid(),
  memo_id uuid references public.memo_memos(memo_id) on delete cascade,
  kind text not null check (kind in ('asset_finalize', 'asset_cleanup', 'snapshot_expire', 'retention', 'reminder_dispatch')),
  dedupe_key text not null unique,
  state text not null default 'pending' check (state in ('pending', 'claimed', 'complete', 'failed')),
  attempts smallint not null default 0 check (attempts >= 0 and attempts <= 5),
  next_attempt_at timestamptz not null default now(),
  lease_id uuid,
  lease_expires_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists private.memo_pin_reset_challenges (
  challenge_id uuid primary key,
  account_id uuid not null references auth.users(id) on delete cascade,
  device_nonce text not null check (char_length(device_nonce) between 16 and 128),
  code_hash text not null,
  attempts smallint not null default 0 check (attempts >= 0 and attempts <= 5),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists memo_pin_reset_account_idx on private.memo_pin_reset_challenges(account_id, created_at desc);

create or replace function private.memo_member_role(p_memo_id uuid, p_user_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select role from public.memo_members where memo_id = p_memo_id and user_id = p_user_id and revoked_at is null;
$$;

alter table public.memo_memos enable row level security;
alter table public.memo_members enable row level security;
alter table public.memo_item_revisions enable row level security;
alter table public.memo_assets enable row level security;
alter table public.memo_changes enable row level security;
alter table public.memo_operation_receipts enable row level security;
alter table public.memo_snapshots enable row level security;
alter table public.memo_snapshot_items enable row level security;
alter table public.memo_reminder_preferences enable row level security;
alter table public.memo_reminder_occurrences enable row level security;

drop policy if exists memo_memos_member_read on public.memo_memos;
create policy memo_memos_member_read on public.memo_memos for select to authenticated
  using (private.memo_member_role(memo_id, (select auth.uid())) is not null);
drop policy if exists memo_members_member_read on public.memo_members;
create policy memo_members_member_read on public.memo_members for select to authenticated
  using (private.memo_member_role(memo_id, (select auth.uid())) is not null);
drop policy if exists memo_revisions_member_read on public.memo_item_revisions;
create policy memo_revisions_member_read on public.memo_item_revisions for select to authenticated
  using (private.memo_member_role(memo_id, (select auth.uid())) is not null);
drop policy if exists memo_assets_member_read on public.memo_assets;
create policy memo_assets_member_read on public.memo_assets for select to authenticated
  using (private.memo_member_role(memo_id, (select auth.uid())) is not null);
drop policy if exists memo_changes_member_read on public.memo_changes;
create policy memo_changes_member_read on public.memo_changes for select to authenticated
  using (private.memo_member_role(memo_id, (select auth.uid())) is not null);
drop policy if exists memo_snapshots_member_read on public.memo_snapshots;
create policy memo_snapshots_member_read on public.memo_snapshots for select to authenticated
  using (private.memo_member_role(memo_id, (select auth.uid())) is not null);
drop policy if exists memo_snapshot_items_member_read on public.memo_snapshot_items;
create policy memo_snapshot_items_member_read on public.memo_snapshot_items for select to authenticated
  using (exists (select 1 from public.memo_snapshots s where s.snapshot_id = public.memo_snapshot_items.snapshot_id and private.memo_member_role(s.memo_id, (select auth.uid())) is not null));
drop policy if exists memo_reminder_prefs_owner on public.memo_reminder_preferences;
create policy memo_reminder_prefs_owner on public.memo_reminder_preferences for all to authenticated
  using (user_id = (select auth.uid()) and private.memo_member_role(memo_id, (select auth.uid())) is not null)
  with check (user_id = (select auth.uid()) and private.memo_member_role(memo_id, (select auth.uid())) is not null);
drop policy if exists memo_reminder_occurrences_member_read on public.memo_reminder_occurrences;
create policy memo_reminder_occurrences_member_read on public.memo_reminder_occurrences for select to authenticated
  using (private.memo_member_role(memo_id, (select auth.uid())) is not null);

revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to service_role;
grant select on public.memo_memos, public.memo_members, public.memo_item_revisions, public.memo_assets, public.memo_changes, public.memo_snapshots, public.memo_snapshot_items, public.memo_reminder_preferences, public.memo_reminder_occurrences to authenticated;
grant select, insert, update, delete on public.memo_memos, public.memo_members, public.memo_item_revisions, public.memo_assets, public.memo_changes, public.memo_operation_receipts, public.memo_snapshots, public.memo_snapshot_items, public.memo_reminder_preferences, public.memo_reminder_occurrences to service_role;

insert into storage.buckets (id, name, public)
values ('memo-assets', 'memo-assets', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists memo_asset_read on storage.objects;
create policy memo_asset_read on storage.objects for select to authenticated
  using (bucket_id = 'memo-assets' and exists (select 1 from public.memo_assets a where a.storage_path = name and private.memo_member_role(a.memo_id, (select auth.uid())) is not null));
drop policy if exists memo_asset_insert on storage.objects;
create policy memo_asset_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'memo-assets' and exists (select 1 from public.memo_assets a where a.storage_path = name and private.memo_member_role(a.memo_id, (select auth.uid())) in ('owner', 'admin', 'senior', 'junior')));
drop policy if exists memo_asset_delete on storage.objects;
create policy memo_asset_delete on storage.objects for delete to authenticated
  using (bucket_id = 'memo-assets' and exists (select 1 from public.memo_assets a where a.storage_path = name and private.memo_member_role(a.memo_id, (select auth.uid())) in ('owner', 'admin')));

create or replace function public.memo_create(
  p_actor_id uuid, p_memo_id uuid, p_generation uuid, p_operation_id uuid, p_title text, p_description text,
  p_residency text default 'keep_all'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; existing public.memo_operation_receipts;
begin
  if p_actor_id is null or p_memo_id is null or p_generation is null or p_operation_id is null or p_title is null or char_length(p_title) not between 1 and 128 or char_length(coalesce(p_description, '')) > 500 or p_residency not in ('keep_all', 'on_demand') then raise exception 'MEMO_INVALID_REQUEST'; end if;
  select * into existing from public.memo_operation_receipts where operation_id = p_operation_id;
  if existing.operation_id is not null then return existing.result; end if;
  insert into public.memo_memos(memo_id, owner_id, generation, title, description, residency) values (p_memo_id, p_actor_id, p_generation, p_title, coalesce(p_description, ''), p_residency);
  insert into public.memo_members(memo_id, user_id, role) values (p_memo_id, p_actor_id, 'owner');
  result := jsonb_build_object('memo_id', p_memo_id, 'generation', p_generation, 'revision', 1, 'change_position', 0);
  insert into public.memo_operation_receipts(operation_id, memo_id, generation, actor_id, payload_hash, result) values (p_operation_id, p_memo_id, p_generation, p_actor_id, md5(result::text), result);
  return result;
exception when unique_violation then
  if exists (select 1 from public.memo_memos where memo_id = p_memo_id and owner_id = p_actor_id) then
    select result into result from public.memo_operation_receipts where operation_id = p_operation_id;
    if result is not null then return result; end if;
  end if;
  raise exception 'MEMO_OPERATION_CONFLICT';
end;
$$;

create or replace function public.memo_apply_mutation(
  p_actor_id uuid, p_memo_id uuid, p_generation uuid, p_operation_id uuid, p_entity_id uuid, p_entity_type text,
  p_base_revision bigint, p_predecessor_id uuid, p_payload jsonb, p_deleted boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare memo_row public.memo_memos; member_role text; prior jsonb; next_revision bigint; next_position bigint; result jsonb;
begin
  if p_actor_id is null or p_memo_id is null or p_generation is null or p_operation_id is null or p_entity_id is null or p_entity_type is null or p_payload is null or p_base_revision < 0 then raise exception 'MEMO_INVALID_REQUEST'; end if;
  if p_entity_type not in ('memo', 'item', 'note', 'asset', 'tag', 'pin', 'reminder', 'preference', 'folder', 'trash') then raise exception 'MEMO_INVALID_REQUEST'; end if;
  select result into prior from public.memo_operation_receipts where operation_id = p_operation_id;
  if prior is not null then return prior; end if;
  select * into memo_row from public.memo_memos where memo_id = p_memo_id for update;
  if memo_row.memo_id is null or memo_row.closed_at is not null or memo_row.generation <> p_generation then raise exception 'MEMO_GENERATION_UNSUPPORTED'; end if;
  select role into member_role from public.memo_members where memo_id = p_memo_id and user_id = p_actor_id and revoked_at is null;
  if member_role is null or member_role = 'viewer' or (member_role = 'junior' and p_entity_type not in ('item', 'note', 'preference')) then raise exception 'MEMO_NOT_ALLOWED'; end if;
  if memo_row.revision <> p_base_revision and p_entity_type not in ('preference', 'pin') then raise exception 'MEMO_REVISION_CONFLICT'; end if;
  next_revision := memo_row.revision + 1;
  next_position := memo_row.change_position + 1;
  update public.memo_memos set revision = next_revision, change_position = next_position, updated_at = now() where memo_id = p_memo_id;
  insert into public.memo_item_revisions(revision_id, memo_id, generation, entity_id, entity_type, revision, author_id, payload, deleted) values (extensions.gen_random_uuid(), p_memo_id, p_generation, p_entity_id, p_entity_type, next_revision, p_actor_id, p_payload, p_deleted);
  insert into public.memo_changes(memo_id, generation, change_position, operation_id, entity_id, entity_type, revision, payload, deleted) values (p_memo_id, p_generation, next_position, p_operation_id, p_entity_id, p_entity_type, next_revision, p_payload, p_deleted);
  result := jsonb_build_object('operation_id', p_operation_id, 'memo_id', p_memo_id, 'generation', p_generation, 'remote_revision', next_revision, 'change_position', next_position);
  insert into public.memo_operation_receipts(operation_id, memo_id, generation, actor_id, predecessor_id, payload_hash, result) values (p_operation_id, p_memo_id, p_generation, p_actor_id, p_predecessor_id, md5(p_payload::text), result);
  return result;
end;
$$;

create or replace function public.memo_fetch_changes(p_actor_id uuid, p_memo_id uuid, p_generation uuid, p_after bigint, p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare member_role text; minimum_position bigint; changes jsonb;
begin
  select role into member_role from public.memo_members where memo_id = p_memo_id and user_id = p_actor_id and revoked_at is null;
  if member_role is null then raise exception 'MEMO_NOT_ALLOWED'; end if;
  if p_limit < 1 or p_limit > 500 then raise exception 'MEMO_INVALID_REQUEST'; end if;
  select coalesce(min(change_position), 0) into minimum_position from public.memo_changes where memo_id = p_memo_id and generation = p_generation;
  select coalesce(jsonb_agg(to_jsonb(c) order by c.change_position), '[]'::jsonb) into changes from (select * from public.memo_changes where memo_id = p_memo_id and generation = p_generation and change_position > p_after order by change_position limit p_limit) c;
  return jsonb_build_object('changes', changes, 'minimum_position', minimum_position, 'has_more', jsonb_array_length(changes) = p_limit);
end;
$$;

create or replace function public.memo_create_snapshot(p_actor_id uuid, p_memo_id uuid, p_generation uuid, p_snapshot_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare member_role text; watermark bigint; snapshot public.memo_snapshots;
begin
  select role into member_role from public.memo_members where memo_id = p_memo_id and user_id = p_actor_id and revoked_at is null;
  if member_role is null then raise exception 'MEMO_NOT_ALLOWED'; end if;
  select change_position into watermark from public.memo_memos where memo_id = p_memo_id and generation = p_generation;
  if watermark is null then raise exception 'MEMO_GENERATION_UNSUPPORTED'; end if;
  insert into public.memo_snapshots(snapshot_id, memo_id, generation, watermark, expires_at) values (p_snapshot_id, p_memo_id, p_generation, watermark, now() + interval '15 minutes') on conflict (snapshot_id) do update set expires_at = excluded.expires_at returning * into snapshot;
  insert into public.memo_snapshot_items(snapshot_id, revision_id)
    select snapshot.snapshot_id, r.revision_id from public.memo_item_revisions r where r.memo_id = p_memo_id and r.generation = p_generation and r.revision <= (select revision from public.memo_memos where memo_id = p_memo_id) on conflict do nothing;
  return jsonb_build_object('snapshot_id', snapshot.snapshot_id, 'memo_id', snapshot.memo_id, 'generation', snapshot.generation, 'watermark', snapshot.watermark, 'expires_at', extract(epoch from snapshot.expires_at) * 1000, 'item_count', (select count(*) from public.memo_snapshot_items where snapshot_id = snapshot.snapshot_id), 'asset_count', (select count(*) from public.memo_assets where memo_id = p_memo_id and generation = p_generation));
end;
$$;

create or replace function public.memo_close_remote_copy(p_actor_id uuid, p_memo_id uuid, p_generation uuid, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare member_role text; result jsonb;
begin
  select role into member_role from public.memo_members where memo_id = p_memo_id and user_id = p_actor_id and role = 'owner' and revoked_at is null;
  if member_role is null then raise exception 'MEMO_NOT_ALLOWED'; end if;
  update public.memo_memos set closed_at = now(), updated_at = now() where memo_id = p_memo_id and generation = p_generation;
  result := jsonb_build_object('operation_id', p_operation_id, 'memo_id', p_memo_id, 'generation', p_generation, 'closed', true);
  insert into public.memo_operation_receipts(operation_id, memo_id, generation, actor_id, payload_hash, result) values (p_operation_id, p_memo_id, p_generation, p_actor_id, md5(result::text), result) on conflict (operation_id) do nothing;
  return result;
end;
$$;

create or replace function public.memo_reserve_asset(
  p_actor_id uuid, p_memo_id uuid, p_generation uuid, p_operation_id uuid, p_asset_id uuid,
  p_original_name text, p_mime_type text, p_byte_size bigint, p_checksum text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare member_role text; result jsonb; path text;
begin
  select role into member_role from public.memo_members where memo_id = p_memo_id and user_id = p_actor_id and revoked_at is null;
  if member_role is null or member_role = 'viewer' or p_original_name is null or char_length(p_original_name) not between 1 and 255 or p_byte_size < 0 then raise exception 'MEMO_NOT_ALLOWED'; end if;
  if (lower(coalesce(p_mime_type, '')) like 'image/%' or lower(coalesce(p_mime_type, '')) like 'audio/%') and p_byte_size > 10 * 1024 * 1024 then raise exception 'MEMO_QUOTA_EXCEEDED'; end if;
  if not (lower(coalesce(p_mime_type, '')) like 'image/%' or lower(coalesce(p_mime_type, '')) like 'audio/%') and p_byte_size > 50 * 1024 * 1024 then raise exception 'MEMO_QUOTA_EXCEEDED'; end if;
  if not exists (select 1 from public.memo_memos where memo_id = p_memo_id and generation = p_generation and closed_at is null) then raise exception 'MEMO_GENERATION_UNSUPPORTED'; end if;
  path := p_memo_id::text || '/' || p_asset_id::text;
  insert into public.memo_assets(asset_id, memo_id, generation, storage_path, original_name, mime_type, byte_size, checksum)
    values (p_asset_id, p_memo_id, p_generation, path, p_original_name, coalesce(nullif(p_mime_type, ''), 'application/octet-stream'), p_byte_size, p_checksum)
    on conflict (asset_id) do update set original_name = excluded.original_name, mime_type = excluded.mime_type, byte_size = excluded.byte_size, checksum = excluded.checksum;
  result := jsonb_build_object('asset_id', p_asset_id, 'memo_id', p_memo_id, 'generation', p_generation, 'storage_path', path, 'state', 'reserved');
  insert into public.memo_operation_receipts(operation_id, memo_id, generation, actor_id, payload_hash, result) values (p_operation_id, p_memo_id, p_generation, p_actor_id, md5(result::text), result) on conflict (operation_id) do nothing;
  return coalesce((select r.result from public.memo_operation_receipts r where r.operation_id = p_operation_id), result);
end;
$$;

create or replace function public.memo_finalize_asset(p_actor_id uuid, p_memo_id uuid, p_generation uuid, p_asset_id uuid, p_checksum text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare member_role text; asset_row public.memo_assets; result jsonb;
begin
  select role into member_role from public.memo_members where memo_id = p_memo_id and user_id = p_actor_id and revoked_at is null;
  if member_role is null or member_role = 'viewer' then raise exception 'MEMO_NOT_ALLOWED'; end if;
  select * into asset_row from public.memo_assets where asset_id = p_asset_id and memo_id = p_memo_id and generation = p_generation for update;
  if asset_row.asset_id is null then raise exception 'MEMO_INVALID_REQUEST'; end if;
  if p_checksum is not null and asset_row.checksum is not null and p_checksum <> asset_row.checksum then update public.memo_assets set state = 'rejected' where asset_id = p_asset_id; raise exception 'MEMO_ASSET_CHECKSUM_MISMATCH'; end if;
  update public.memo_assets set state = 'verified', verified_at = now(), checksum = coalesce(p_checksum, checksum) where asset_id = p_asset_id;
  result := jsonb_build_object('asset_id', p_asset_id, 'memo_id', p_memo_id, 'generation', p_generation, 'state', 'verified');
  return result;
end;
$$;

create or replace function private.memo_claim_jobs(p_limit integer default 50)
returns setof private.memo_jobs language plpgsql security definer set search_path = '' as $$
declare job private.memo_jobs;
begin
  if p_limit < 1 or p_limit > 100 then raise exception 'MEMO_INVALID_REQUEST'; end if;
  for job in select * from private.memo_jobs where state = 'pending' and next_attempt_at <= now() order by next_attempt_at, created_at limit p_limit for update skip locked loop
    update private.memo_jobs set state = 'claimed', attempts = attempts + 1, lease_id = extensions.gen_random_uuid(), lease_expires_at = now() + interval '60 seconds' where job_id = job.job_id returning * into job;
    return next job;
  end loop;
end;
$$;

create or replace function private.memo_claim_reminder_occurrences(p_limit integer default 100)
returns setof public.memo_reminder_occurrences language plpgsql security definer set search_path = '' as $$
declare occurrence public.memo_reminder_occurrences;
begin
  for occurrence in select * from public.memo_reminder_occurrences where state = 'pending' and next_attempt_at <= now() and occurrence_at <= now() order by occurrence_at limit least(p_limit, 100) for update skip locked loop
    update public.memo_reminder_occurrences set state = 'claimed', attempt = attempt + 1, claimed_by = extensions.gen_random_uuid(), lease_expires_at = now() + interval '60 seconds' where occurrence_id = occurrence.occurrence_id returning * into occurrence;
    return next occurrence;
  end loop;
end;
$$;

create or replace function public.memo_claim_reminder_occurrences(p_limit integer default 100)
returns setof public.memo_reminder_occurrences language plpgsql security definer set search_path = '' as $$
begin
  return query select * from private.memo_claim_reminder_occurrences(p_limit);
end;
$$;

create or replace function public.memo_pin_reset_create(p_challenge_id uuid, p_account_id uuid, p_device_nonce text, p_code_hash text, p_expires_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_challenge_id is null or p_account_id is null or p_device_nonce is null or char_length(p_device_nonce) not between 16 and 128 or p_code_hash is null or char_length(p_code_hash) <> 64 or p_expires_at <= now() or p_expires_at > now() + interval '10 minutes' then raise exception 'MEMO_INVALID_REQUEST'; end if;
  insert into private.memo_pin_reset_challenges(challenge_id, account_id, device_nonce, code_hash, expires_at) values (p_challenge_id, p_account_id, p_device_nonce, lower(p_code_hash), p_expires_at);
end;
$$;

create or replace function public.memo_pin_reset_consume(p_challenge_id uuid, p_account_id uuid, p_device_nonce text, p_code_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare challenge private.memo_pin_reset_challenges;
begin
  select * into challenge from private.memo_pin_reset_challenges where challenge_id = p_challenge_id and account_id = p_account_id for update;
  if challenge.challenge_id is null or challenge.device_nonce <> p_device_nonce or challenge.consumed_at is not null or challenge.expires_at <= now() or challenge.attempts >= 5 then return jsonb_build_object('authorized', false); end if;
  if challenge.code_hash <> lower(p_code_hash) then
    update private.memo_pin_reset_challenges set attempts = attempts + 1 where challenge_id = p_challenge_id;
    return jsonb_build_object('authorized', false);
  end if;
  update private.memo_pin_reset_challenges set consumed_at = now() where challenge_id = p_challenge_id;
  return jsonb_build_object('authorized', true, 'account_id', p_account_id, 'device_nonce', p_device_nonce);
end;
$$;

revoke all on function public.memo_create(uuid, uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.memo_apply_mutation(uuid, uuid, uuid, uuid, uuid, text, bigint, uuid, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.memo_fetch_changes(uuid, uuid, uuid, bigint, integer) from public, anon, authenticated;
revoke all on function public.memo_create_snapshot(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.memo_close_remote_copy(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.memo_reserve_asset(uuid, uuid, uuid, uuid, uuid, text, text, bigint, text), public.memo_finalize_asset(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.memo_create(uuid, uuid, uuid, uuid, text, text, text) to service_role;
grant execute on function public.memo_apply_mutation(uuid, uuid, uuid, uuid, uuid, text, bigint, uuid, jsonb, boolean) to service_role;
grant execute on function public.memo_fetch_changes(uuid, uuid, uuid, bigint, integer) to service_role;
grant execute on function public.memo_create_snapshot(uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.memo_close_remote_copy(uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.memo_reserve_asset(uuid, uuid, uuid, uuid, uuid, text, text, bigint, text), public.memo_finalize_asset(uuid, uuid, uuid, uuid, text) to service_role;
grant execute on function private.memo_claim_jobs(integer), private.memo_claim_reminder_occurrences(integer) to service_role;
grant execute on function public.memo_claim_reminder_occurrences(integer) to service_role;
revoke all on function public.memo_pin_reset_create(uuid, uuid, text, text, timestamptz), public.memo_pin_reset_consume(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.memo_pin_reset_create(uuid, uuid, text, text, timestamptz), public.memo_pin_reset_consume(uuid, uuid, text, text) to service_role;

comment on table public.memo_operation_receipts is 'Idempotency receipts retained for the remote memo lifetime; replay returns the original result.';
comment on table public.memo_changes is 'Per-memo commit-ordered change log; cursor advancement is authoritative and not timestamp based.';
