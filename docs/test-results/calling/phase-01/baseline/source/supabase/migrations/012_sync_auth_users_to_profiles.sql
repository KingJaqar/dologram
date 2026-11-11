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
