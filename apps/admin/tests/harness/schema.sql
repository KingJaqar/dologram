create schema extensions;
create function extensions.gen_random_uuid() returns uuid language sql volatile as 'select pg_catalog.gen_random_uuid()';
grant usage on schema auth, private to authenticated;
grant execute on function auth.uid(), auth.role() to authenticated;
-- M1-01: Create profiles table
-- Run: supabase migration up

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  display_name text not null,
  must_change_password boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  created_at timestamp with time zone default timezone('utc'::text, now())
);
comment on table public.profiles is 'User profile extension with display name and password change flag';
comment on column public.profiles.id is 'Primary key, references auth.users';
comment on column public.profiles.display_name is 'User display name';
comment on column public.profiles.must_change_password is 'Flag: user must change password on next sign-in';
comment on column public.profiles.updated_at is 'Last update timestamp';
comment on column public.profiles.created_at is 'Account creation timestamp';

-- Keep the public profile projection synchronized with Supabase Auth users.
-- Auth sign-up writes raw_user_meta_data; this table stores the app-facing fields.

alter table public.profiles
  add column if not exists email text,
  add column if not exists username text;

comment on column public.profiles.email is 'Email address copied from auth.users';
comment on column public.profiles.username is 'Unique username copied from auth.users user metadata';

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email))
  where email is not null;

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null;

-- Backfill profiles that already exist, including accounts created before the trigger.
update public.profiles p
set
  email = u.email,
  username = nullif(u.raw_user_meta_data ->> 'username', ''),
  display_name = coalesce(nullif(u.raw_user_meta_data ->> 'display_name', ''), p.display_name),
  updated_at = timezone('utc'::text, now())
from auth.users u
where u.id = p.id;

create schema if not exists private;

create or replace function private.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, username, display_name, must_change_password)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'username', ''),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'User'
    ),
    false
  )
  on conflict (id) do update set
    email = excluded.email,
    username = excluded.username,
    display_name = excluded.display_name,
    updated_at = timezone('utc'::text, now());

  return new;
end;
$$;

revoke all on function private.handle_new_user_profile() from public;

drop trigger if exists on_auth_user_profile_sync on auth.users;

create trigger on_auth_user_profile_sync
  after insert or update of email, raw_user_meta_data on auth.users
  for each row
  execute function private.handle_new_user_profile();

create schema if not exists private;

-- Profiles keep the original id column for compatibility with the auth trigger, while
-- user_id is the public contract consumed by the clients.
alter table public.profiles add column if not exists user_id uuid;
update public.profiles set user_id = id where user_id is null;

create or replace function private.sync_profile_user_id()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.user_id := coalesce(new.user_id, new.id);
  return new;
end;
$$;

drop trigger if exists profiles_sync_user_id on public.profiles;
create trigger profiles_sync_user_id
before insert or update on public.profiles
for each row execute function private.sync_profile_user_id();

alter table public.profiles alter column user_id set not null;
create unique index if not exists profiles_user_id_unique_idx on public.profiles (user_id);


create table public.chats (
  chat_id uuid primary key, type text not null, title text,
  created_by uuid references public.profiles(id), direct_key text unique
);
create table public.chat_members (
  chat_id uuid references public.chats(chat_id),
  user_id uuid references public.profiles(id), role text not null,
  primary key (chat_id, user_id)
);

create or replace function private.can_read_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_user_id = (select auth.uid())
    or exists (
      select 1
      from public.chat_members mine
      join public.chat_members theirs on theirs.chat_id = mine.chat_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = p_user_id
    );
$$;


alter table public.profiles enable row level security;
create policy "Authenticated users can read visible profiles"
  on public.profiles for select to authenticated
  using (private.can_read_profile(user_id));
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);


grant select, update on public.profiles to authenticated;
-- Make Saved Messages discoverable through the same direct-chat key used by the mobile client,
-- and create it for every new auth user. This also makes searching for one's own username open
-- Saved Messages instead of attempting to add the same member twice.

create or replace function private.set_direct_key()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_chat uuid;
  member_count integer;
  member_key text;
  chat_type text;
begin
  if tg_op = 'DELETE' then
    target_chat := old.chat_id;
  else
    target_chat := new.chat_id;
  end if;

  select c.type into chat_type from public.chats c where c.chat_id = target_chat;
  if chat_type <> 'direct' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select count(*)::integer, string_agg(cm.user_id::text, ':' order by cm.user_id::text)
    into member_count, member_key
    from public.chat_members cm
   where cm.chat_id = target_chat;

  if member_count > 2 then
    raise exception 'direct_chat_member_limit';
  elsif member_count = 2 then
    update public.chats set direct_key = member_key where chat_id = target_chat;
  elsif member_count = 1 then
    -- The one-member direct chat is Saved Messages. Its stable key is the caller's id.
    update public.chats set direct_key = member_key where chat_id = target_chat;
  else
    update public.chats set direct_key = null where chat_id = target_chat;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Repair one-member direct chats created before this migration. Keep the update guarded so a
-- malformed database containing duplicate Saved Messages does not make the migration fail.
update public.chats c
set direct_key = member.user_id::text
from (
  select cm.chat_id, min(cm.user_id::text)::uuid as user_id
  from public.chat_members cm
  group by cm.chat_id
  having count(*) = 1
) member
where c.chat_id = member.chat_id
  and c.type = 'direct'
  and c.direct_key is null
  and not exists (
    select 1 from public.chats existing
    where existing.direct_key = member.user_id::text
  );

create or replace function private.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  saved_chat_id uuid;
begin
  insert into public.profiles (id, email, username, display_name, must_change_password)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'username', ''),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'User'
    ),
    false
  )
  on conflict (id) do update set
    email = excluded.email,
    username = excluded.username,
    display_name = excluded.display_name,
    updated_at = timezone('utc'::text, now());

  -- The trigger also runs when auth metadata changes, so make this idempotent.
  if not exists (
    select 1 from public.chats c
    where c.type = 'direct' and c.direct_key = new.id::text
  ) then
    saved_chat_id := extensions.gen_random_uuid();
    insert into public.chats (chat_id, type, title, created_by)
    values (saved_chat_id, 'direct', null, new.id);

    insert into public.chat_members (chat_id, user_id, role)
    values (saved_chat_id, new.id, 'owner');
  end if;

  return new;
end;
$$;

-- Application authorization is separate from Supabase's auth.users.role and
-- chat/memo membership roles. Promotion retains the same normal user account.
set lock_timeout = '5s';
set statement_timeout = '15s';

alter table public.profiles
  add column roles text not null default 'user',
  add constraint profiles_roles_check check (roles in ('user', 'admin'));

comment on column public.profiles.roles is
  'Application role: user or admin. Admin retains normal account access. Only trusted database roles may change this value.';

-- Existing authenticated clients can update their own profile. Keep that path,
-- but prevent them (including an application admin) from changing authorization.
-- SECURITY INVOKER is intentional: current_user must be the actual SQL role,
-- not the function owner or a caller-controlled JWT/metadata value.
create function private.guard_profile_roles()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if current_user not in ('postgres', 'supabase_admin', 'service_role') then
    if tg_op = 'INSERT' then
      if new.roles is distinct from 'user' then
        raise exception using errcode = '42501', message = 'PROFILE_ROLE_CHANGE_NOT_ALLOWED';
      end if;
    elsif new.roles is distinct from old.roles then
      raise exception using errcode = '42501', message = 'PROFILE_ROLE_CHANGE_NOT_ALLOWED';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.guard_profile_roles() from public, anon, authenticated, service_role;

create trigger profiles_guard_roles
before insert or update on public.profiles
for each row execute function private.guard_profile_roles();

-- Refresh the Data API column cache after the transaction commits.
notify pgrst, 'reload schema';

reset lock_timeout;
reset statement_timeout;

-- Migration 016's member trigger is required by migration 018's Saved Messages projection.
create trigger chat_members_set_direct_key
after insert or update or delete on public.chat_members
for each row execute function private.set_direct_key();

-- Migration 042's admin audit projection (M4-08, Phase 6).
create table private.admin_audit (
  id bigint generated always as identity primary key,
  event_id uuid not null default gen_random_uuid(),
  at timestamptz not null default now(),
  actor_user_id uuid,
  action text not null,
  target_user_id uuid,
  result text not null check (result in ('success', 'failed')),
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object')
);
alter table private.admin_audit enable row level security;
revoke all on private.admin_audit from public, anon, authenticated;
revoke all on sequence private.admin_audit_id_seq from public, anon, authenticated;
create unique index admin_audit_event_idx on private.admin_audit (event_id);
create index admin_audit_at_idx on private.admin_audit (at desc, id desc);
create index admin_audit_target_idx on private.admin_audit (target_user_id);
