-- Phase 6: expiring call invitation notifications.
--
-- Call notifications are derived from the authoritative calls row. The outbox
-- is service-only, deduplicated by call/event/recipient, and survives a lost
-- database webhook until the bounded scheduler drain handles it.

alter table public.push_tokens
  add column if not exists call_notifications boolean not null default true,
  add column if not exists call_android_channel_id text;

create table if not exists public.call_device_preferences (
  push_token text not null references public.push_tokens(token) on delete cascade,
  chat_id uuid not null references public.chats(chat_id) on delete cascade,
  enabled boolean not null default true,
  sounds boolean not null default true,
  blocked boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (push_token, chat_id)
);

create index if not exists call_device_preferences_chat_idx
  on public.call_device_preferences (chat_id, push_token);

alter table public.call_device_preferences enable row level security;
revoke all on public.call_device_preferences from public, anon;
grant select, insert, update, delete on public.call_device_preferences to authenticated;
grant all on public.call_device_preferences to service_role;

create policy "Owners can read call device preferences"
  on public.call_device_preferences for select to authenticated
  using (
    exists (
      select 1 from public.push_tokens p
      where p.token = push_token and p.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.chat_members m
      where m.chat_id = call_device_preferences.chat_id and m.user_id = (select auth.uid())
    )
  );

create policy "Owners can register call device preferences"
  on public.call_device_preferences for insert to authenticated
  with check (
    exists (
      select 1 from public.push_tokens p
      where p.token = push_token and p.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.chat_members m
      where m.chat_id = call_device_preferences.chat_id and m.user_id = (select auth.uid())
    )
  );

create policy "Owners can update call device preferences"
  on public.call_device_preferences for update to authenticated
  using (
    exists (
      select 1 from public.push_tokens p
      where p.token = push_token and p.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.chat_members m
      where m.chat_id = call_device_preferences.chat_id and m.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.push_tokens p
      where p.token = push_token and p.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.chat_members m
      where m.chat_id = call_device_preferences.chat_id and m.user_id = (select auth.uid())
    )
  );

create policy "Owners can remove call device preferences"
  on public.call_device_preferences for delete to authenticated
  using (
    exists (
      select 1 from public.push_tokens p
      where p.token = push_token and p.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.chat_members m
      where m.chat_id = call_device_preferences.chat_id and m.user_id = (select auth.uid())
    )
  );

create or replace function private.clear_call_device_preferences_on_token_change()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if old.user_id is distinct from new.user_id then
    delete from public.call_device_preferences where push_token = new.token;
  end if;
  return new;
end;
$$;

drop trigger if exists push_tokens_clear_call_preferences on public.push_tokens;
create trigger push_tokens_clear_call_preferences
after update of user_id on public.push_tokens
for each row execute function private.clear_call_device_preferences_on_token_change();

do $$
begin
  alter table public.push_tokens
    add constraint push_tokens_call_android_channel_check check (
      call_android_channel_id is null or (
        platform = 'android' and call_android_channel_id ~ '^calls-v1-[01]{2}$'
      )
    );
exception when duplicate_object then null;
end;
$$;

create table if not exists public.call_notification_outbox (
  notification_id uuid primary key default extensions.gen_random_uuid(),
  call_id uuid not null references public.calls(call_id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'invitation', 'accepted', 'declined', 'cancelled', 'missed', 'ended', 'failed'
  )),
  call_revision bigint not null check (call_revision > 0),
  dedupe_key text not null unique,
  expires_at timestamptz not null,
  state text not null default 'pending' check (state in (
    'pending', 'sending', 'sent', 'skipped', 'expired', 'failed'
  )),
  attempts smallint not null default 0 check (attempts between 0 and 5),
  next_attempt_at timestamptz not null default now(),
  lease_id uuid,
  lease_expires_at timestamptz,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint call_notification_lease_pair check (
    (lease_id is null and lease_expires_at is null)
      or (lease_id is not null and lease_expires_at is not null)
  )
);

create index if not exists call_notification_outbox_due_idx
  on public.call_notification_outbox (next_attempt_at, state, notification_id)
  where state in ('pending', 'failed');

create index if not exists call_notification_outbox_call_idx
  on public.call_notification_outbox (call_id, state, created_at desc);

alter table public.call_notification_outbox enable row level security;
revoke all on public.call_notification_outbox from public, anon, authenticated;
grant all on public.call_notification_outbox to service_role;

create or replace function private.call_enqueue_notification(
  p_call_id uuid,
  p_recipient_id uuid,
  p_event_type text,
  p_call_revision bigint,
  p_expires_at timestamptz
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_call_id is null or p_recipient_id is null
     or p_event_type not in ('invitation', 'accepted', 'declined', 'cancelled', 'missed', 'ended', 'failed')
     or p_call_revision is null or p_call_revision <= 0
     or p_expires_at is null then
    return;
  end if;

  insert into public.call_notification_outbox(
    call_id, recipient_id, event_type, call_revision, dedupe_key, expires_at
  )
  values (
    p_call_id, p_recipient_id, p_event_type, p_call_revision,
    p_call_id::text || ':' || p_event_type || ':' || p_recipient_id::text,
    p_expires_at
  )
  on conflict (dedupe_key) do nothing;
end;
$$;

create or replace function private.call_notification_trigger()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  event_type text;
  expires_at timestamptz;
begin
  if (tg_op = 'INSERT' and new.status = 'ringing') then
    perform private.call_enqueue_notification(
      new.call_id, new.callee_id, 'invitation', new.revision, new.ring_expires_at
    );
    return new;
  end if;

  if tg_op <> 'UPDATE' or old.status is not distinct from new.status then
    return new;
  end if;

  event_type := case new.status
    when 'accepted' then 'accepted'
    when 'declined' then 'declined'
    when 'cancelled' then 'cancelled'
    when 'missed' then 'missed'
    when 'ended' then 'ended'
    when 'failed' then 'failed'
    else null
  end;
  if event_type is null then
    return new;
  end if;

  expires_at := case
    when new.status = 'missed' then coalesce(new.ended_at, clock_timestamp()) + interval '1 hour'
    else coalesce(new.ended_at, clock_timestamp()) + interval '1 hour'
  end;

  if event_type in ('accepted', 'declined') then
    perform private.call_enqueue_notification(
      new.call_id, new.caller_id, event_type, new.revision, expires_at
    );
  elsif event_type = 'cancelled' then
    perform private.call_enqueue_notification(
      new.call_id, new.callee_id, event_type, new.revision, expires_at
    );
  else
    perform private.call_enqueue_notification(
      new.call_id, new.caller_id, event_type, new.revision, expires_at
    );
    perform private.call_enqueue_notification(
      new.call_id, new.callee_id, event_type, new.revision, expires_at
    );
  end if;
  return new;
end;
$$;

drop trigger if exists calls_notification_outbox on public.calls;
create trigger calls_notification_outbox
after insert or update of status on public.calls
for each row execute function private.call_notification_trigger();

revoke all on function private.call_enqueue_notification(uuid, uuid, text, bigint, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.call_notification_trigger() from public, anon, authenticated, service_role;
revoke all on function private.clear_call_device_preferences_on_token_change() from public, anon, authenticated, service_role;

comment on table public.call_notification_outbox is
  'Service-only, deduplicated call notification attempts; payloads contain no secrets or peer identity.';
