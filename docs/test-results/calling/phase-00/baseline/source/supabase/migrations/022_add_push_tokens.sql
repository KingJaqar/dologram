-- V2 push notifications (D-25, D-96).
-- One row represents one Expo push token on one signed-in device. Tokens are never public.

create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  last_seen_at timestamptz not null default timezone('utc'::text, now()),
  message_previews boolean not null default true,
  sounds boolean not null default true,
  vibration boolean not null default true,
  badges boolean not null default true,
  platform text not null default 'android',
  constraint push_tokens_platform_check check (platform in ('android', 'ios'))
);

create index if not exists push_tokens_user_id_idx on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

drop policy if exists "Users can read their own push tokens" on public.push_tokens;
drop policy if exists "Users can register their own push tokens" on public.push_tokens;
drop policy if exists "Users can update their own push tokens" on public.push_tokens;
drop policy if exists "Users can remove their own push tokens" on public.push_tokens;

create policy "Users can read their own push tokens"
  on public.push_tokens for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can register their own push tokens"
  on public.push_tokens for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own push tokens"
  on public.push_tokens for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can remove their own push tokens"
  on public.push_tokens for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.push_tokens from anon;
grant select, insert, update, delete on public.push_tokens to authenticated;

comment on table public.push_tokens is 'Per-device Expo push tokens and notification presentation preferences.';
