-- Phase 1: calling state, authorization, idempotency and durable worker leases.
--
-- This migration is intentionally database-only. LiveKit provisioning, token signing,
-- webhook verification and provider cleanup remain Phase 2 responsibilities. The public
-- RPCs below are service_role-only because the Edge layer must verify the caller JWT and
-- forward that verified actor to SQL; an arbitrary client must never be able to choose its
-- actor by calling Postgres directly.

create schema if not exists private;

do $$
begin
  create type private.call_readiness as enum ('unprovisioned', 'provisioning', 'ready');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type private.call_job_state as enum ('pending', 'claimed', 'confirmed', 'failed');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type private.call_job_kind as enum ('reconcile', 'cleanup');
exception when duplicate_object then null;
end;
$$;

do $$
begin
  create type private.call_webhook_state as enum ('pending', 'processed', 'failed');
exception when duplicate_object then null;
end;
$$;

create table public.calls (
  call_id uuid primary key default extensions.gen_random_uuid(),
  chat_id uuid not null references public.chats(chat_id) on delete cascade,
  caller_id uuid not null references auth.users(id) on delete cascade,
  callee_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null check (media_type in ('voice', 'video')),
  status text not null check (status in (
    'ringing', 'accepted', 'in_progress', 'declined', 'cancelled', 'missed', 'ended', 'failed'
  )),
  created_at timestamptz not null default now(),
  ring_expires_at timestamptz not null,
  accepted_at timestamptz,
  connect_expires_at timestamptz,
  connected_at timestamptz,
  ended_at timestamptz,
  ended_by uuid references auth.users(id) on delete set null,
  end_reason text check (end_reason is null or end_reason in (
    'declined', 'cancelled', 'no_answer', 'busy', 'hangup', 'connection_timeout',
    'media_disconnected', 'permission_denied', 'provider_error', 'access_lost',
    'account_restricted', 'max_duration', 'feature_disabled'
  )),
  revision bigint not null default 1 check (revision > 0),
  request_id uuid not null,
  constraint calls_distinct_participants check (caller_id <> callee_id),
  constraint calls_request_unique unique (caller_id, request_id),
  constraint calls_terminal_timestamps check (
    (status in ('declined', 'cancelled', 'missed', 'ended', 'failed'))
      = (ended_at is not null and end_reason is not null)
    and (status in ('ringing', 'accepted', 'in_progress'))
      = (ended_at is null and end_reason is null)
  ),
  constraint calls_acceptance_deadline_pair check (
    (accepted_at is null and connect_expires_at is null)
      or (accepted_at is not null and connect_expires_at is not null)
  ),
  constraint calls_time_order check (
    (accepted_at is null or accepted_at >= created_at)
    and (connect_expires_at is null or accepted_at is not null and connect_expires_at >= accepted_at)
    and (connected_at is null or accepted_at is not null and connected_at >= accepted_at)
    and (ended_at is null or ended_at >= created_at)
    and (ended_at is null or accepted_at is null or ended_at >= accepted_at)
    and (ended_at is null or connected_at is null or ended_at >= connected_at)
    and ring_expires_at > created_at
  ),
  constraint calls_ended_by_participant check (
    ended_by is null or (ended_at is not null and ended_by in (caller_id, callee_id))
  )
);

create table public.call_participants (
  call_id uuid not null references public.calls(call_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('caller', 'callee')),
  connected boolean not null default false,
  connection_generation bigint not null default 0 check (connection_generation >= 0),
  joined_at timestamptz,
  left_at timestamptz,
  revision bigint not null default 1 check (revision > 0),
  primary key (call_id, user_id),
  unique (call_id, role),
  constraint call_participants_time_order check (
    left_at is null or (joined_at is not null and left_at >= joined_at)
  )
);

create table private.call_user_reservations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  call_id uuid not null references public.calls(call_id) on delete cascade,
  due_at timestamptz not null
);

create table private.call_rooms (
  call_id uuid primary key references public.calls(call_id) on delete cascade,
  room_name text not null unique,
  room_sid text,
  epoch bigint not null default 1 check (epoch > 0),
  room_generation bigint not null default 1 check (room_generation > 0),
  caller_session_id uuid not null,
  callee_session_id uuid,
  caller_identity text not null unique,
  callee_identity text not null unique,
  readiness private.call_readiness not null default 'unprovisioned',
  operation_id uuid,
  operation_lease_expires_at timestamptz,
  caller_finalized_nbf bigint,
  caller_finalized_exp bigint,
  callee_finalized_nbf bigint,
  callee_finalized_exp bigint,
  caller_participant_sid text,
  callee_participant_sid text,
  next_reconcile_at timestamptz,
  disconnect_deadline timestamptz,
  constraint call_rooms_operation_pair check (
    (operation_id is null and operation_lease_expires_at is null)
      or (operation_id is not null and operation_lease_expires_at is not null)
  )
);

create table private.call_admissions (
  admission_id uuid primary key default extensions.gen_random_uuid(),
  call_id uuid not null references public.calls(call_id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  client_session_id uuid not null,
  epoch bigint not null check (epoch > 0),
  issued_at timestamptz not null default now(),
  lease_expires_at timestamptz not null,
  finalized_nbf bigint,
  finalized_exp bigint
);

create table private.call_action_requests (
  actor_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  action text not null check (action in ('create', 'accept', 'decline', 'cancel', 'end')),
  call_id uuid references public.calls(call_id) on delete cascade,
  chat_id uuid,
  media_type text check (media_type is null or media_type in ('voice', 'video')),
  client_session_id uuid not null,
  result_call_id uuid references public.calls(call_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (actor_id, request_id)
);

create table private.call_jobs (
  job_id uuid primary key default extensions.gen_random_uuid(),
  dedupe_key text not null unique,
  diagnostic_call_id uuid,
  kind private.call_job_kind not null,
  room_name text,
  caller_identity text,
  callee_identity text,
  room_sid text,
  room_generation bigint not null default 0 check (room_generation >= 0),
  termination_epoch bigint not null default 0 check (termination_epoch >= 0),
  max_finalized_nbf bigint not null default 0,
  max_finalized_exp bigint not null default 0,
  outstanding_operation_id uuid,
  outstanding_operation_until timestamptz,
  attempts smallint not null default 0 check (attempts >= 0 and attempts <= 5),
  next_attempt_at timestamptz not null default now(),
  lease_id uuid,
  lease_expires_at timestamptz,
  state private.call_job_state not null default 'pending',
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint call_jobs_lease_pair check (
    (lease_id is null and lease_expires_at is null)
      or (lease_id is not null and lease_expires_at is not null)
  )
);

create table private.call_webhook_events (
  provider_event_id text primary key,
  event_time timestamptz not null,
  call_id uuid,
  room_sid text,
  room_generation bigint not null default 0,
  state private.call_webhook_state not null default 'pending',
  error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table private.call_settings (
  singleton boolean primary key default true check (singleton),
  calling_enabled boolean not null default false,
  call_push_enabled boolean not null default false,
  native_background_enabled boolean not null default false,
  pilot_user_ids uuid[] not null default '{}'::uuid[],
  ring_seconds integer not null default 30 check (ring_seconds between 5 and 120),
  connect_seconds integer not null default 30 check (connect_seconds between 5 and 120),
  disconnect_grace_seconds integer not null default 20 check (disconnect_grace_seconds between 5 and 120),
  maximum_duration_seconds integer not null default 1800 check (maximum_duration_seconds between 60 and 7200),
  reconcile_seconds integer not null default 10 check (reconcile_seconds between 5 and 60),
  create_limit integer not null default 5 check (create_limit between 1 and 100),
  create_window_seconds integer not null default 60 check (create_window_seconds between 10 and 3600),
  token_limit integer not null default 10 check (token_limit between 1 and 100),
  token_window_seconds integer not null default 60 check (token_window_seconds between 10 and 3600),
  missed_streak_limit integer not null default 3 check (missed_streak_limit between 1 and 20),
  missed_window_seconds integer not null default 600 check (missed_window_seconds between 60 and 86400),
  missed_cooldown_seconds integer not null default 60 check (missed_cooldown_seconds between 10 and 3600),
  updated_at timestamptz not null default now()
);

insert into private.call_settings(singleton)
values (true)
on conflict (singleton) do nothing;

create table private.call_rate_limits (
  subject_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('create', 'token', 'missed', 'missed_pair')),
  event_id uuid not null,
  peer_id uuid references auth.users(id) on delete cascade,
  request_id uuid not null,
  occurred_at timestamptz not null default now(),
  missed_streak smallint not null default 0 check (missed_streak >= 0),
  cooldown_until timestamptz,
  primary key (subject_id, scope, event_id),
  unique (subject_id, scope, request_id)
);

create index call_participants_user_call_idx on public.call_participants (user_id, call_id);
create index calls_chat_created_idx on public.calls (chat_id, created_at desc, call_id desc);
create index calls_pair_outcomes_idx on public.calls (caller_id, callee_id, ended_at desc, call_id desc)
  where ended_at is not null and end_reason <> 'busy';
create index calls_callee_idx on public.calls (callee_id);
create index calls_ended_by_idx on public.calls (ended_by) where ended_by is not null;
create index call_reservations_due_idx on private.call_user_reservations (due_at, user_id);
create index call_rooms_reconcile_idx on private.call_rooms (next_reconcile_at, call_id)
  where readiness in ('provisioning', 'ready');
create index call_jobs_runnable_idx on private.call_jobs (next_attempt_at, state, job_id)
  where state in ('pending', 'claimed');
create index call_rate_limits_subject_time_idx
  on private.call_rate_limits (subject_id, scope, occurred_at desc);
create index call_admissions_call_idx on private.call_admissions (call_id);
create index call_admissions_expiry_idx on private.call_admissions (lease_expires_at);
create index call_jobs_call_kind_idx on private.call_jobs (diagnostic_call_id, kind, created_at desc);
create index call_jobs_expired_lease_idx on private.call_jobs (lease_expires_at) where state = 'claimed';
create unique index call_jobs_one_reconcile_idx on private.call_jobs (diagnostic_call_id)
  where kind = 'reconcile' and state in ('pending', 'claimed');
create unique index call_jobs_lease_id_idx on private.call_jobs (lease_id) where lease_id is not null;
create index calls_live_idx on public.calls (created_at, call_id)
  where status in ('ringing', 'accepted', 'in_progress');
create index call_rate_limits_expiry_idx on private.call_rate_limits (occurred_at);

alter table public.calls enable row level security;
alter table public.call_participants enable row level security;

revoke all on public.calls, public.call_participants from public, anon, authenticated;
grant select on public.calls, public.call_participants to authenticated;
grant all on public.calls, public.call_participants to service_role;
revoke all on private.call_user_reservations, private.call_rooms, private.call_admissions,
  private.call_action_requests, private.call_jobs, private.call_webhook_events,
  private.call_settings, private.call_rate_limits from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = 'calls'
    ) then
      alter publication supabase_realtime add table public.calls;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = 'call_participants'
    ) then
      alter publication supabase_realtime add table public.call_participants;
    end if;
  end if;
end;
$$;

create or replace function private.call_is_service_role()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select current_setting('role', true) = 'service_role';
$$;

create or replace function private.call_require_service_role()
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if private.call_is_service_role() is distinct from true then
    raise exception 'CALL_NOT_ALLOWED' using errcode = '42501';
  end if;
end;
$$;

create or replace function private.call_is_current_participant(p_call_id uuid, p_actor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.calls c
    join public.chat_members cm on cm.chat_id = c.chat_id and cm.user_id = p_actor_id
    where c.call_id = p_call_id
      and p_actor_id = (select auth.uid())
      and (c.caller_id = p_actor_id or c.callee_id = p_actor_id)
  );
$$;

create policy "Call participants can read accessible calls"
  on public.calls for select to authenticated
  using (
    (select auth.uid()) is not null
    and (select private.call_is_current_participant(call_id, (select auth.uid())))
  );

create policy "Call participants can read their participant rows"
  on public.call_participants for select to authenticated
  using (
    (select auth.uid()) is not null
    and (select private.call_is_current_participant(call_id, (select auth.uid())))
  );

create or replace function private.call_pair_member(p_chat_id uuid, p_actor_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  chat_type text;
  member_count integer;
  other_id uuid;
begin
  select c.type into chat_type from public.chats c where c.chat_id = p_chat_id;
  if chat_type is distinct from 'direct' then
    raise exception 'CALL_NOT_ALLOWED' using errcode = 'P0001';
  end if;

  select count(*)::integer into member_count
  from public.chat_members cm where cm.chat_id = p_chat_id;
  if member_count <> 2 then
    raise exception 'CALL_NOT_ALLOWED' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.chat_members cm
    where cm.chat_id = p_chat_id and cm.user_id = p_actor_id
  ) then
    raise exception 'CALL_NOT_ALLOWED' using errcode = 'P0001';
  end if;

  select cm.user_id into other_id
  from public.chat_members cm
  where cm.chat_id = p_chat_id and cm.user_id <> p_actor_id;
  if other_id is null or other_id = p_actor_id then
    raise exception 'CALL_NOT_ALLOWED' using errcode = 'P0001';
  end if;
  return other_id;
end;
$$;

create or replace function private.call_check_actor_exists(p_actor_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_actor_id is null or not exists (select 1 from auth.users u where u.id = p_actor_id) then
    raise exception 'CALL_NOT_ALLOWED' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function private.call_user_is_call_eligible(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = p_user_id
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
      and coalesce(u.raw_app_meta_data ->> 'must_change_password', 'false') <> 'true'
  );
$$;

create or replace function private.call_require_users_eligible(p_first_id uuid, p_second_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.call_user_is_call_eligible(p_first_id)
     or not private.call_user_is_call_eligible(p_second_id) then
    raise exception 'CALL_NOT_ALLOWED' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function private.call_check_enabled(p_actor_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  enabled boolean;
  pilots uuid[];
begin
  select s.calling_enabled, s.pilot_user_ids into enabled, pilots
  from private.call_settings s where s.singleton;
  if not coalesce(enabled, false)
     or (cardinality(pilots) > 0 and (p_actor_id = any(pilots)) is distinct from true) then
    raise exception 'CALL_FEATURE_DISABLED' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function private.call_rate_limit_event(
  p_subject_id uuid,
  p_scope text,
  p_event_id uuid,
  p_request_id uuid,
  p_limit integer,
  p_window_seconds integer,
  p_peer_id uuid default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  used_count integer;
begin
  select count(*)::integer into used_count
  from private.call_rate_limits r
  where r.subject_id = p_subject_id
    and r.scope = p_scope
    and r.occurred_at >= clock_timestamp() - make_interval(secs => p_window_seconds);
  if used_count >= p_limit then
    raise exception 'CALL_RATE_LIMITED' using errcode = 'P0001';
  end if;

  insert into private.call_rate_limits(subject_id, scope, event_id, peer_id, request_id, occurred_at)
  values (p_subject_id, p_scope, p_event_id, p_peer_id, p_request_id, clock_timestamp())
  on conflict (subject_id, scope, event_id) do nothing;
end;
$$;

create or replace function private.call_state_json(p_call public.calls)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'callId', p_call.call_id::text,
    'chatId', p_call.chat_id::text,
    'callerId', p_call.caller_id::text,
    'calleeId', p_call.callee_id::text,
    'mediaType', p_call.media_type,
    'status', p_call.status,
    'createdAt', to_char(p_call.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'ringExpiresAt', to_char(p_call.ring_expires_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'acceptedAt', case when p_call.accepted_at is null then null else to_char(p_call.accepted_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
    'connectExpiresAt', case when p_call.connect_expires_at is null then null else to_char(p_call.connect_expires_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
    'connectedAt', case when p_call.connected_at is null then null else to_char(p_call.connected_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
    'endedAt', case when p_call.ended_at is null then null else to_char(p_call.ended_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
    'endedBy', case when p_call.ended_by is null then null else p_call.ended_by::text end,
    'endReason', p_call.end_reason,
    'revision', p_call.revision::text
  );
$$;

create or replace function private.call_cleanup_state(p_call_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select case when j.state = 'failed' then 'failed' when j.state = 'confirmed' then 'confirmed' else 'pending' end
      from private.call_jobs j
      where j.diagnostic_call_id = p_call_id and j.kind = 'cleanup'
      order by j.created_at desc
      limit 1
    ),
    'not_required'
  );
$$;

create or replace function private.call_snapshot_json(
  p_actor_id uuid,
  p_client_session_id uuid,
  p_call_id uuid default null,
  p_allow_bound_terminal boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target public.calls;
  has_membership boolean;
  belongs boolean := false;
  can_answer boolean := false;
  can_cancel boolean := false;
  can_join boolean := false;
  can_end boolean := false;
  cleanup_state text := 'not_required';
  participants jsonb;
  available boolean;
  pilots uuid[];
begin
  select s.calling_enabled, s.pilot_user_ids into available, pilots
  from private.call_settings s where s.singleton;
  available := coalesce(available, false)
    and (cardinality(pilots) = 0 or (p_actor_id = any(pilots)) is true);

  if p_call_id is null then
    select c.* into target
    from public.calls c
    where c.status in ('ringing', 'accepted', 'in_progress')
      and (c.caller_id = p_actor_id or c.callee_id = p_actor_id)
      and exists (
        select 1 from public.chat_members cm
        where cm.chat_id = c.chat_id and cm.user_id = p_actor_id
      )
    order by c.created_at desc, c.call_id desc
    limit 1;
    if target.call_id is null then
      return jsonb_build_object(
        'call', null,
        'participants', '[]'::jsonb,
        'capabilities', jsonb_build_object(
          'canAnswer', false, 'canCancel', false, 'canJoin', false,
          'canEnd', false, 'belongsToThisSession', false
        ),
        'availability', jsonb_build_object('callingEnabled', available),
        'serverTime', to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'cleanupState', 'not_required'
      );
    end if;
  else
    select c.* into target from public.calls c where c.call_id = p_call_id;
    has_membership := target.call_id is not null and exists (
      select 1 from public.chat_members cm
      where cm.chat_id = target.chat_id and cm.user_id = p_actor_id
    );
    belongs := target.call_id is not null and (target.caller_id = p_actor_id or target.callee_id = p_actor_id);
    if target.call_id is null or not belongs or (not has_membership and not p_allow_bound_terminal) then
      raise exception 'CALL_NOT_FOUND' using errcode = 'P0001';
    end if;
  end if;

  has_membership := exists (
    select 1 from public.chat_members cm
    where cm.chat_id = target.chat_id and cm.user_id = p_actor_id
  );
  belongs := target.caller_id = p_actor_id or target.callee_id = p_actor_id;
  if target.caller_id = p_actor_id then
    belongs := target.call_id is not null and target.caller_id = p_actor_id
      and exists (select 1 from private.call_rooms r where r.call_id = target.call_id and r.caller_session_id = p_client_session_id);
    can_cancel := belongs and target.status = 'ringing'
      and statement_timestamp() < target.ring_expires_at;
    can_join := belongs and target.status in ('accepted', 'in_progress');
    can_end := can_join;
  elsif target.callee_id = p_actor_id then
    belongs := target.call_id is not null and target.callee_id = p_actor_id
      and exists (select 1 from private.call_rooms r where r.call_id = target.call_id and r.callee_session_id = p_client_session_id);
    can_answer := target.status = 'ringing' and has_membership and not belongs
      and statement_timestamp() < target.ring_expires_at;
    can_join := belongs and target.status in ('accepted', 'in_progress');
    can_end := can_join;
  end if;
  if not available or not private.call_user_is_call_eligible(target.caller_id)
     or not private.call_user_is_call_eligible(target.callee_id)
     or (cardinality(pilots) > 0 and (
       (target.caller_id = any(pilots)) is distinct from true
       or (target.callee_id = any(pilots)) is distinct from true))
     or (select count(*) from public.chat_members cm
         where cm.chat_id = target.chat_id and cm.user_id in (target.caller_id, target.callee_id)) <> 2 then
    can_answer := false;
    can_join := false;
  end if;
  if target.status = 'accepted' and statement_timestamp() >= target.connect_expires_at then
    can_join := false;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'callId', cp.call_id::text,
      'userId', cp.user_id::text,
      'role', cp.role,
      'connected', cp.connected,
      'connectionGeneration', cp.connection_generation::text,
      'joinedAt', case when cp.joined_at is null then null else to_char(cp.joined_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
      'leftAt', case when cp.left_at is null then null else to_char(cp.left_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
      'revision', cp.revision::text
    ) order by cp.role
  ), '[]'::jsonb) into participants
  from public.call_participants cp where cp.call_id = target.call_id;
  cleanup_state := private.call_cleanup_state(target.call_id);

  return jsonb_build_object(
    'call', private.call_state_json(target),
    'participants', participants,
    'capabilities', jsonb_build_object(
      'canAnswer', can_answer,
      'canCancel', can_cancel,
      'canJoin', can_join,
      'canEnd', can_end,
      'belongsToThisSession', belongs
    ),
    'availability', jsonb_build_object('callingEnabled', available),
    'serverTime', to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'cleanupState', cleanup_state
  );
end;
$$;

create or replace function private.call_enqueue_cleanup(p_call_id uuid, p_epoch bigint)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  room private.call_rooms;
begin
  select r.* into room from private.call_rooms r where r.call_id = p_call_id;
  if room.room_name is null then
    return;
  end if;
  insert into private.call_jobs(
    dedupe_key, diagnostic_call_id, kind, room_name, caller_identity, callee_identity,
    room_sid, room_generation, termination_epoch, max_finalized_nbf, max_finalized_exp,
    outstanding_operation_id, outstanding_operation_until
  )
  values (
    'cleanup:' || p_call_id::text || ':' || p_epoch::text,
    p_call_id, 'cleanup', room.room_name, room.caller_identity, room.callee_identity,
    room.room_sid, room.room_generation, p_epoch,
    greatest(coalesce(room.caller_finalized_nbf, 0), coalesce(room.callee_finalized_nbf, 0)),
    greatest(coalesce(room.caller_finalized_exp, 0), coalesce(room.callee_finalized_exp, 0)),
    room.operation_id, room.operation_lease_expires_at
  )
  on conflict (dedupe_key) do nothing;
end;
$$;

create or replace function private.call_mark_terminal(
  p_call_id uuid,
  p_status text,
  p_reason text,
  p_ended_by uuid default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  changed boolean;
  next_epoch bigint;
begin
  if p_status not in ('declined', 'cancelled', 'missed', 'ended', 'failed')
     or p_reason not in (
       'declined', 'cancelled', 'no_answer', 'busy', 'hangup', 'connection_timeout',
       'media_disconnected', 'permission_denied', 'provider_error', 'access_lost',
       'account_restricted', 'max_duration', 'feature_disabled'
     ) then
    raise exception 'CALL_INVALID_REQUEST' using errcode = 'P0001';
  end if;

  update public.calls c
  set status = p_status,
      ended_at = clock_timestamp(),
      ended_by = p_ended_by,
      end_reason = p_reason,
      revision = c.revision + 1
  where c.call_id = p_call_id
    and c.status in ('ringing', 'accepted', 'in_progress');
  changed := found;
  if not changed then
    return;
  end if;

  update private.call_rooms r
  set epoch = r.epoch + 1,
      readiness = 'unprovisioned',
      next_reconcile_at = null
  where r.call_id = p_call_id
  returning epoch into next_epoch;
  perform private.call_enqueue_cleanup(p_call_id, coalesce(next_epoch, 0));

  update public.call_participants cp
  set connected = false, left_at = clock_timestamp(), revision = cp.revision + 1
  where cp.call_id = p_call_id and cp.connected;
  delete from private.call_admissions where call_id = p_call_id;
  delete from private.call_user_reservations where call_id = p_call_id;
end;
$$;

create or replace function private.call_before_delete_cleanup()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  room private.call_rooms;
begin
  select r.* into room from private.call_rooms r where r.call_id = old.call_id;
  if room.call_id is not null then
    perform private.call_enqueue_cleanup(old.call_id, room.epoch);
  end if;
  return old;
end;
$$;

drop trigger if exists calls_before_delete_cleanup on public.calls;
create trigger calls_before_delete_cleanup
before delete on public.calls
for each row execute function private.call_before_delete_cleanup();

create or replace function public.call_create(
  p_actor_id uuid,
  p_chat_id uuid,
  p_media_type text,
  p_request_id uuid,
  p_client_session_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  peer_id uuid;
  existing private.call_action_requests;
  settings private.call_settings;
  call_id uuid;
  busy boolean;
  ring_deadline timestamptz;
  created_time timestamptz;
  missed_count integer;
  latest_miss timestamptz;
begin
  perform private.call_require_service_role();
  if p_chat_id is null or p_media_type is null or p_media_type not in ('voice', 'video')
     or p_request_id is null or p_client_session_id is null then
    raise exception 'CALL_INVALID_REQUEST' using errcode = 'P0001';
  end if;
  perform private.call_check_actor_exists(p_actor_id);
  perform pg_advisory_xact_lock(hashtextextended(p_actor_id::text || ':' || p_request_id::text, 0));

  select * into existing
  from private.call_action_requests a
  where a.actor_id = p_actor_id and a.request_id = p_request_id;
  if existing.actor_id is not null then
    if existing.action <> 'create' or existing.chat_id is distinct from p_chat_id
       or existing.media_type is distinct from p_media_type
       or existing.client_session_id is distinct from p_client_session_id then
      raise exception 'CALL_REQUEST_CONFLICT' using errcode = 'P0001';
    end if;
    return private.call_snapshot_json(p_actor_id, p_client_session_id, existing.result_call_id, false);
  end if;

  perform 1 from public.chats c where c.chat_id = p_chat_id for share;
  if not found then
    raise exception 'CALL_NOT_ALLOWED' using errcode = 'P0001';
  end if;
  peer_id := private.call_pair_member(p_chat_id, p_actor_id);
  perform private.call_check_enabled(p_actor_id);
  perform private.call_check_enabled(peer_id);
  select * into settings from private.call_settings s where s.singleton;
  perform private.call_check_actor_exists(peer_id);
  perform private.call_require_users_eligible(p_actor_id, peer_id);

  if p_actor_id < peer_id then
    perform pg_advisory_xact_lock(hashtextextended(p_actor_id::text, 0));
    perform pg_advisory_xact_lock(hashtextextended(peer_id::text, 0));
  else
    perform pg_advisory_xact_lock(hashtextextended(peer_id::text, 0));
    perform pg_advisory_xact_lock(hashtextextended(p_actor_id::text, 0));
  end if;

  created_time := clock_timestamp();
  select count(*) filter (where outcome.end_reason = 'no_answer'), max(outcome.ended_at)
    into missed_count, latest_miss
  from (
    select c.ended_at, c.end_reason
    from public.calls c
    where c.caller_id = p_actor_id and c.callee_id = peer_id
      and c.ended_at >= created_time - make_interval(secs => settings.missed_window_seconds)
      and c.end_reason <> 'busy'
    order by c.ended_at desc, c.call_id desc
    limit settings.missed_streak_limit
  ) outcome;
  if missed_count = settings.missed_streak_limit
     and latest_miss > created_time - make_interval(secs => settings.missed_cooldown_seconds) then
    raise exception 'CALL_RATE_LIMITED' using errcode = 'P0001';
  end if;

  perform private.call_rate_limit_event(
    p_actor_id, 'create', p_request_id, p_request_id,
    settings.create_limit, settings.create_window_seconds, peer_id
  );
  busy := exists (
    select 1 from private.call_user_reservations r
    where r.user_id in (p_actor_id, peer_id)
  );
  ring_deadline := created_time + make_interval(secs => settings.ring_seconds);
  call_id := extensions.gen_random_uuid();

  insert into public.calls(
    call_id, chat_id, caller_id, callee_id, media_type, status,
    created_at, ring_expires_at, ended_at, end_reason, revision, request_id
  )
  values (
    call_id, p_chat_id, p_actor_id, peer_id, p_media_type,
    case when busy then 'failed' else 'ringing' end,
    created_time, ring_deadline,
    case when busy then created_time else null end,
    case when busy then 'busy' else null end,
    1, p_request_id
  );

  insert into public.call_participants(call_id, user_id, role)
  values (call_id, p_actor_id, 'caller'), (call_id, peer_id, 'callee');

  if not busy then
    insert into private.call_user_reservations(user_id, call_id, due_at)
    values (p_actor_id, call_id, ring_deadline), (peer_id, call_id, ring_deadline);
    insert into private.call_rooms(
      call_id, room_name, epoch, room_generation, caller_session_id,
      caller_identity, callee_identity, next_reconcile_at
    )
    values (
      call_id,
      'call_' || extensions.gen_random_uuid()::text,
      1, 1, p_client_session_id,
      'caller_' || extensions.gen_random_uuid()::text,
      'callee_' || extensions.gen_random_uuid()::text,
      now() + make_interval(secs => settings.reconcile_seconds)
    );
  end if;

  insert into private.call_action_requests(actor_id, request_id, action, chat_id, media_type, client_session_id, result_call_id)
  values (p_actor_id, p_request_id, 'create', p_chat_id, p_media_type, p_client_session_id, call_id);

  return private.call_snapshot_json(p_actor_id, p_client_session_id, call_id, true);
end;
$$;

create or replace function public.call_transition(
  p_actor_id uuid,
  p_call_id uuid,
  p_action text,
  p_request_id uuid,
  p_client_session_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  existing private.call_action_requests;
  target public.calls;
  settings private.call_settings;
  bound boolean := false;
  caller_bound boolean := false;
  callee_bound boolean := false;
begin
  perform private.call_require_service_role();
  if p_action is null or p_action not in ('accept', 'decline', 'cancel', 'end')
     or p_call_id is null or p_request_id is null or p_client_session_id is null then
    raise exception 'CALL_INVALID_REQUEST' using errcode = 'P0001';
  end if;
  perform private.call_check_actor_exists(p_actor_id);
  perform pg_advisory_xact_lock(hashtextextended(p_actor_id::text || ':' || p_request_id::text, 0));

  select * into existing
  from private.call_action_requests a
  where a.actor_id = p_actor_id and a.request_id = p_request_id;
  if existing.actor_id is not null then
    if existing.action <> p_action or existing.call_id is distinct from p_call_id
       or existing.client_session_id is distinct from p_client_session_id then
      raise exception 'CALL_REQUEST_CONFLICT' using errcode = 'P0001';
    end if;
    return private.call_snapshot_json(p_actor_id, p_client_session_id, p_call_id, p_action in ('cancel', 'end'));
  end if;

  select c.* into target from public.calls c where c.call_id = p_call_id for update;
  if target.call_id is null then
    raise exception 'CALL_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not (target.caller_id = p_actor_id or target.callee_id = p_actor_id) then
    raise exception 'CALL_NOT_FOUND' using errcode = 'P0001';
  end if;

  select exists (
    select 1 from private.call_rooms r
    where r.call_id = p_call_id and r.caller_session_id = p_client_session_id
      and p_actor_id = target.caller_id
  ) into caller_bound;
  select exists (
    select 1 from private.call_rooms r
    where r.call_id = p_call_id and r.callee_session_id = p_client_session_id
      and p_actor_id = target.callee_id
  ) into callee_bound;
  bound := caller_bound or callee_bound;

  if target.status in ('declined', 'cancelled', 'missed', 'ended', 'failed') then
    if p_action in ('cancel', 'end') and bound then
      return private.call_snapshot_json(p_actor_id, p_client_session_id, p_call_id, true);
    end if;
    raise exception 'CALL_ALREADY_HANDLED' using errcode = 'P0001';
  end if;

  if p_action = 'accept' then
    if p_actor_id <> target.callee_id
       or not exists (
         select 1 from public.chat_members cm
         where cm.chat_id = target.chat_id and cm.user_id = p_actor_id
       ) then
      raise exception 'CALL_NOT_ALLOWED' using errcode = 'P0001';
    end if;
    if target.status <> 'ringing' then
      if callee_bound then
        return private.call_snapshot_json(p_actor_id, p_client_session_id, p_call_id);
      end if;
      raise exception 'CALL_ALREADY_HANDLED' using errcode = 'P0001';
    end if;
    if private.call_pair_member(target.chat_id, p_actor_id) is distinct from target.caller_id then
      raise exception 'CALL_NOT_ALLOWED' using errcode = 'P0001';
    end if;
    perform private.call_check_enabled(target.caller_id);
    perform private.call_check_enabled(target.callee_id);
    perform private.call_require_users_eligible(target.caller_id, target.callee_id);
    if clock_timestamp() >= target.ring_expires_at then
      raise exception 'CALL_EXPIRED' using errcode = 'P0001';
    end if;
    select * into settings from private.call_settings s where s.singleton;
    update public.calls c
    set status = 'accepted',
        accepted_at = clock_timestamp(),
        connect_expires_at = clock_timestamp() + make_interval(secs => settings.connect_seconds),
        revision = c.revision + 1
    where c.call_id = p_call_id;
    update private.call_rooms r
    set callee_session_id = p_client_session_id,
        next_reconcile_at = now() + make_interval(secs => settings.reconcile_seconds)
    where r.call_id = p_call_id;
    update private.call_user_reservations r
    set due_at = (select c.connect_expires_at from public.calls c where c.call_id = p_call_id)
    where r.call_id = p_call_id;
  elsif p_action = 'decline' then
    if p_actor_id <> target.callee_id or target.status <> 'ringing'
       or not exists (select 1 from public.chat_members cm where cm.chat_id = target.chat_id and cm.user_id = p_actor_id) then
      raise exception 'CALL_NOT_ALLOWED' using errcode = 'P0001';
    end if;
    if clock_timestamp() >= target.ring_expires_at then
      raise exception 'CALL_EXPIRED' using errcode = 'P0001';
    end if;
    perform private.call_mark_terminal(p_call_id, 'declined', 'declined', p_actor_id);
  elsif p_action = 'cancel' then
    if p_actor_id <> target.caller_id or target.status <> 'ringing' or not caller_bound then
      raise exception 'CALL_NOT_ALLOWED' using errcode = 'P0001';
    end if;
    if clock_timestamp() >= target.ring_expires_at then
      raise exception 'CALL_EXPIRED' using errcode = 'P0001';
    end if;
    perform private.call_mark_terminal(p_call_id, 'cancelled', 'cancelled', p_actor_id);
  elsif p_action = 'end' then
    if target.status not in ('accepted', 'in_progress') or not bound then
      raise exception 'CALL_NOT_ALLOWED' using errcode = 'P0001';
    end if;
    perform private.call_mark_terminal(p_call_id, 'ended', 'hangup', p_actor_id);
  end if;

  insert into private.call_action_requests(actor_id, request_id, action, call_id, client_session_id, result_call_id)
  values (p_actor_id, p_request_id, p_action, p_call_id, p_client_session_id, p_call_id);
  return private.call_snapshot_json(p_actor_id, p_client_session_id, p_call_id, true);
end;
$$;

create or replace function public.call_snapshot(
  p_actor_id uuid,
  p_client_session_id uuid,
  p_call_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.call_require_service_role();
  perform private.call_check_actor_exists(p_actor_id);
  if p_client_session_id is null then
    raise exception 'CALL_INVALID_REQUEST' using errcode = 'P0001';
  end if;
  return private.call_snapshot_json(p_actor_id, p_client_session_id, p_call_id, false);
end;
$$;

create or replace function public.call_finalize_provisioning(
  p_call_id uuid,
  p_operation_id uuid,
  p_epoch bigint,
  p_room_sid text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target public.calls;
  room private.call_rooms;
begin
  perform private.call_require_service_role();
  if p_call_id is null or p_operation_id is null or p_epoch is null
     or p_room_sid is null or length(btrim(p_room_sid)) = 0 or length(p_room_sid) > 256 then
    raise exception 'CALL_INVALID_REQUEST' using errcode = 'P0001';
  end if;
  select c.* into target from public.calls c where c.call_id = p_call_id for update;
  select r.* into room from private.call_rooms r where r.call_id = p_call_id for update;
  if target.call_id is null or room.call_id is null
     or target.status not in ('accepted', 'in_progress')
     or room.epoch <> p_epoch or room.operation_id is distinct from p_operation_id
     or room.readiness <> 'provisioning'
     or room.operation_lease_expires_at <= clock_timestamp()
     or (target.status = 'accepted' and target.connect_expires_at <= clock_timestamp()) then
    update private.call_jobs j
    set state = 'pending', attempts = 0, lease_id = null, lease_expires_at = null,
        room_sid = btrim(p_room_sid), next_attempt_at = clock_timestamp(),
        outstanding_operation_until = null, updated_at = clock_timestamp()
    where j.diagnostic_call_id = p_call_id and j.kind = 'cleanup'
      and j.outstanding_operation_id = p_operation_id
      and (j.outstanding_operation_until is not null or j.room_sid is distinct from btrim(p_room_sid));
    return jsonb_build_object('callId', p_call_id, 'roomSid', null,
      'roomGeneration', null, 'epoch', null, 'revision', null,
      'serverTime', to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  end if;
  update private.call_rooms r
  set room_sid = btrim(p_room_sid),
      room_generation = r.room_generation + 1,
      readiness = 'ready',
      operation_id = null,
      operation_lease_expires_at = null,
      next_reconcile_at = now()
  where r.call_id = p_call_id;
  return jsonb_build_object(
    'callId', p_call_id::text,
    'roomSid', btrim(p_room_sid),
    'roomGeneration', (room.room_generation + 1)::text,
    'epoch', room.epoch::text,
    'revision', target.revision::text,
    'serverTime', to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

create or replace function public.call_prepare_admission(
  p_actor_id uuid,
  p_call_id uuid,
  p_client_session_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target public.calls;
  room private.call_rooms;
  settings private.call_settings;
  admission_id uuid;
  claimed_operation_id uuid;
  now_utc timestamptz;
begin
  perform private.call_require_service_role();
  perform private.call_check_actor_exists(p_actor_id);
  perform private.call_check_enabled(p_actor_id);
  if p_call_id is null or p_client_session_id is null then
    raise exception 'CALL_INVALID_REQUEST' using errcode = 'P0001';
  end if;
  select c.* into target from public.calls c where c.call_id = p_call_id for update;
  if target.call_id is null or target.status not in ('accepted', 'in_progress')
     or not (target.caller_id = p_actor_id or target.callee_id = p_actor_id)
     or not exists (select 1 from public.chat_members cm where cm.chat_id = target.chat_id and cm.user_id = p_actor_id)
     or not exists (select 1 from public.chat_members cm where cm.chat_id = target.chat_id and cm.user_id = target.caller_id)
     or not exists (select 1 from public.chat_members cm where cm.chat_id = target.chat_id and cm.user_id = target.callee_id) then
    raise exception 'CALL_NOT_FOUND' using errcode = 'P0001';
  end if;
  perform private.call_require_users_eligible(target.caller_id, target.callee_id);
  perform private.call_check_enabled(target.caller_id);
  perform private.call_check_enabled(target.callee_id);
  select * into room from private.call_rooms r where r.call_id = p_call_id for update;
  if room.call_id is null then
    raise exception 'CALL_PROVIDER_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if (p_actor_id = target.caller_id and room.caller_session_id is distinct from p_client_session_id)
     or (p_actor_id = target.callee_id and room.callee_session_id is distinct from p_client_session_id) then
    raise exception 'CALL_NOT_ALLOWED' using errcode = 'P0001';
  end if;
  now_utc := clock_timestamp();
  select * into settings from private.call_settings s where s.singleton;
  if (target.status = 'accepted' and now_utc >= target.connect_expires_at)
     or (target.status = 'in_progress'
         and now_utc >= target.connected_at + make_interval(secs => settings.maximum_duration_seconds)) then
    raise exception 'CALL_EXPIRED' using errcode = 'P0001';
  end if;

  if room.readiness <> 'ready' then
    if room.readiness = 'unprovisioned'
       or room.operation_lease_expires_at is null
       or room.operation_lease_expires_at <= now_utc then
      update private.call_rooms r
      set readiness = 'provisioning',
          operation_id = extensions.gen_random_uuid(),
          operation_lease_expires_at = now_utc + interval '10 seconds'
      where r.call_id = p_call_id
      returning r.* into room;
      claimed_operation_id := room.operation_id;
    end if;
    return jsonb_build_object(
      'admission_id', null,
      'epoch', room.epoch::text,
      'lease_expires_at', null,
      'room_name', room.room_name,
      'room_sid', room.room_sid,
      'room_generation', room.room_generation::text,
      'participant_identity', case when p_actor_id = target.caller_id then room.caller_identity else room.callee_identity end,
      'media_type', target.media_type,
      'readiness', room.readiness,
      'operation_id', claimed_operation_id,
      'operation_lease_expires_at', case when room.operation_lease_expires_at is null then null else to_char((room.operation_lease_expires_at) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
      'revision', target.revision::text,
      'server_time', to_char((now_utc) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );
  end if;

  admission_id := extensions.gen_random_uuid();
  perform private.call_rate_limit_event(
    p_actor_id, 'token', admission_id, admission_id,
    settings.token_limit, settings.token_window_seconds, target.callee_id
  );
  insert into private.call_admissions(admission_id, call_id, actor_id, client_session_id, epoch, lease_expires_at)
  values (admission_id, p_call_id, p_actor_id, p_client_session_id, room.epoch, now_utc + interval '10 seconds');
  return jsonb_build_object(
    'admission_id', admission_id,
    'epoch', room.epoch::text,
    'lease_expires_at', to_char((now_utc + interval '10 seconds') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'room_name', room.room_name,
    'room_sid', room.room_sid,
    'room_generation', room.room_generation::text,
    'participant_identity', case when p_actor_id = target.caller_id then room.caller_identity else room.callee_identity end,
    'media_type', target.media_type,
    'readiness', room.readiness,
    'operation_id', room.operation_id,
    'operation_lease_expires_at', case when room.operation_lease_expires_at is null then null else to_char((room.operation_lease_expires_at) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
    'revision', target.revision::text,
    'server_time', to_char((now_utc) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

create or replace function public.call_finalize_admission(
  p_actor_id uuid,
  p_call_id uuid,
  p_client_session_id uuid,
  p_admission_id uuid,
  p_epoch bigint,
  p_token_nbf bigint,
  p_token_exp bigint
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target public.calls;
  room private.call_rooms;
  admission private.call_admissions;
  now_seconds bigint;
  checked_at timestamptz;
  revision_text text;
begin
  perform private.call_require_service_role();
  if p_actor_id is null or p_call_id is null or p_client_session_id is null or p_admission_id is null
     or p_epoch is null or p_token_nbf is null or p_token_exp is null
     or p_token_exp <= p_token_nbf or p_token_exp::numeric - p_token_nbf > 300 then
    return jsonb_build_object('authorized', false, 'revision', null,
      'server_time', to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  end if;

  select c.* into target from public.calls c where c.call_id = p_call_id for update;
  select * into room from private.call_rooms r where r.call_id = p_call_id for update;
  select * into admission from private.call_admissions a
  where a.admission_id = p_admission_id and a.call_id = p_call_id
  for update;
  checked_at := clock_timestamp();
  now_seconds := floor(extract(epoch from checked_at))::bigint;
  if admission.admission_id is null or target.call_id is null or room.call_id is null
     or admission.actor_id <> p_actor_id or admission.client_session_id <> p_client_session_id
     or admission.epoch <> p_epoch or admission.lease_expires_at <= checked_at
     or room.epoch <> p_epoch or room.readiness <> 'ready'
     or target.status not in ('accepted', 'in_progress')
     or p_token_nbf < now_seconds - 60 or p_token_nbf > now_seconds + 60
     or p_token_exp <= now_seconds
     or p_actor_id not in (target.caller_id, target.callee_id)
     or p_client_session_id is distinct from
        (case when p_actor_id = target.caller_id then room.caller_session_id else room.callee_session_id end)
     or (target.status = 'accepted' and checked_at >= target.connect_expires_at)
     or not private.call_user_is_call_eligible(target.caller_id)
     or not private.call_user_is_call_eligible(target.callee_id)
     or (select count(*) from public.chat_members cm
         where cm.chat_id = target.chat_id and cm.user_id in (target.caller_id, target.callee_id)) <> 2
     or not exists (
       select 1 from private.call_settings s where s.singleton and s.calling_enabled
         and (cardinality(s.pilot_user_ids) = 0
           or (target.caller_id = any(s.pilot_user_ids) and target.callee_id = any(s.pilot_user_ids)))
         and (target.status <> 'in_progress'
           or checked_at < target.connected_at + make_interval(secs => s.maximum_duration_seconds))
     )
     or (admission.finalized_nbf is not null
       and (admission.finalized_nbf <> p_token_nbf or admission.finalized_exp <> p_token_exp)) then
    return jsonb_build_object('authorized', false, 'revision', null,
      'server_time', to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  end if;

  update private.call_admissions a
  set finalized_nbf = greatest(coalesce(a.finalized_nbf, 0), p_token_nbf),
      finalized_exp = greatest(coalesce(a.finalized_exp, 0), p_token_exp)
  where a.admission_id = p_admission_id;
  if p_actor_id = target.caller_id then
    update private.call_rooms r
    set caller_finalized_nbf = greatest(coalesce(r.caller_finalized_nbf, 0), p_token_nbf),
        caller_finalized_exp = greatest(coalesce(r.caller_finalized_exp, 0), p_token_exp)
    where r.call_id = p_call_id;
  else
    update private.call_rooms r
    set callee_finalized_nbf = greatest(coalesce(r.callee_finalized_nbf, 0), p_token_nbf),
        callee_finalized_exp = greatest(coalesce(r.callee_finalized_exp, 0), p_token_exp)
    where r.call_id = p_call_id;
  end if;
  revision_text := target.revision::text;
  return jsonb_build_object(
    'authorized', true,
    'revision', revision_text,
    'server_time', to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

create or replace function private.call_claim_due_jobs(p_limit integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  result jsonb := '[]'::jsonb;
  job record;
  lease uuid;
begin
  for job in
    select j.*
    from private.call_jobs j
    where (j.state = 'pending' and j.next_attempt_at <= clock_timestamp())
       or (j.state = 'claimed' and j.lease_expires_at <= clock_timestamp())
    order by j.next_attempt_at, j.job_id
    limit greatest(1, least(coalesce(p_limit, 50), 100))
    for update skip locked
  loop
    if job.attempts >= 5 then
      update private.call_jobs j
      set state = 'failed', lease_id = null, lease_expires_at = null,
          last_error_code = 'lease_expired', updated_at = clock_timestamp()
      where j.job_id = job.job_id;
      continue;
    end if;
    lease := extensions.gen_random_uuid();
    update private.call_jobs j
    set state = 'claimed', lease_id = lease, attempts = j.attempts + 1,
        lease_expires_at = clock_timestamp() + interval '10 seconds',
        updated_at = clock_timestamp()
    where j.job_id = job.job_id;
    result := result || jsonb_build_array(jsonb_build_object(
      'kind', job.kind::text,
      'job_id', job.job_id::text,
      'call_id', job.diagnostic_call_id,
      'lease_id', lease::text,
      'room_generation', job.room_generation::text,
      'termination_epoch', job.termination_epoch::text,
      'room_name', job.room_name, 'room_sid', job.room_sid,
      'caller_identity', job.caller_identity, 'callee_identity', job.callee_identity,
      'max_finalized_nbf', job.max_finalized_nbf::text,
      'max_finalized_exp', job.max_finalized_exp::text,
      'outstanding_operation_until', job.outstanding_operation_until
    ));
  end loop;
  return result;
end;
$$;

create or replace function public.call_worker_tick(p_limit integer default 50)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  settings private.call_settings;
  due record;
  sweep_at timestamptz := clock_timestamp();
  batch_size integer := greatest(1, least(coalesce(p_limit, 50), 100));
begin
  perform private.call_require_service_role();
  select * into settings from private.call_settings s where s.singleton;

  for due in
    select c.*
    from public.calls c
    where c.status in ('ringing', 'accepted', 'in_progress') and (
       not private.call_user_is_call_eligible(c.caller_id)
       or not private.call_user_is_call_eligible(c.callee_id)
       or not settings.calling_enabled
       or (cardinality(settings.pilot_user_ids) > 0 and (
         (c.caller_id = any(settings.pilot_user_ids)) is distinct from true
         or (c.callee_id = any(settings.pilot_user_ids)) is distinct from true))
       or (select count(*) from public.chat_members cm
           where cm.chat_id = c.chat_id and cm.user_id in (c.caller_id, c.callee_id)) <> 2
       or (c.status = 'ringing' and c.ring_expires_at <= sweep_at)
       or (c.status = 'accepted' and c.connect_expires_at <= sweep_at)
       or (c.status = 'in_progress' and c.connected_at + make_interval(secs => settings.maximum_duration_seconds) <= sweep_at))
    order by c.created_at, c.call_id
    limit batch_size
    for update skip locked
  loop
    if not private.call_user_is_call_eligible(due.caller_id)
       or not private.call_user_is_call_eligible(due.callee_id) then
      perform private.call_mark_terminal(due.call_id,
        case when due.status = 'in_progress' then 'ended' else 'failed' end, 'account_restricted');
    elsif not settings.calling_enabled or (cardinality(settings.pilot_user_ids) > 0 and (
       (due.caller_id = any(settings.pilot_user_ids)) is distinct from true
       or (due.callee_id = any(settings.pilot_user_ids)) is distinct from true)) then
      perform private.call_mark_terminal(due.call_id,
        case when due.status = 'in_progress' then 'ended' else 'failed' end, 'feature_disabled');
    elsif (select count(*) from public.chat_members cm
       where cm.chat_id = due.chat_id and cm.user_id in (due.caller_id, due.callee_id)) <> 2 then
      perform private.call_mark_terminal(due.call_id,
        case when due.status = 'in_progress' then 'ended' else 'failed' end, 'access_lost');
    elsif due.status = 'ringing' then
      perform private.call_mark_terminal(due.call_id, 'missed', 'no_answer');
    elsif due.status = 'accepted' then
      perform private.call_mark_terminal(due.call_id, 'failed', 'connection_timeout');
    else
      perform private.call_mark_terminal(due.call_id, 'ended', 'max_duration');
    end if;
  end loop;

  insert into private.call_jobs(
    dedupe_key, diagnostic_call_id, kind, room_name, caller_identity, callee_identity,
    room_sid, room_generation, termination_epoch, next_attempt_at
  )
  select
    'reconcile:' || c.call_id::text || ':' || r.epoch::text || ':' ||
      floor(extract(epoch from sweep_at) / settings.reconcile_seconds)::text,
    c.call_id, 'reconcile', r.room_name, r.caller_identity, r.callee_identity,
    r.room_sid, r.room_generation, r.epoch, now()
  from public.calls c
  join private.call_rooms r on r.call_id = c.call_id
  where c.status in ('accepted', 'in_progress')
    and r.readiness = 'ready'
    and r.next_reconcile_at <= sweep_at
    and not exists (
      select 1 from private.call_jobs j
      where j.diagnostic_call_id = c.call_id and j.kind = 'reconcile'
        and j.state in ('pending', 'claimed')
    )
  order by r.next_reconcile_at, c.call_id
  limit batch_size
  for update of c skip locked
  on conflict do nothing;

  delete from private.call_rate_limits r where r.ctid in (
    select expired.ctid from private.call_rate_limits expired
    where expired.occurred_at < sweep_at - interval '1 hour'
    order by expired.occurred_at limit batch_size for update skip locked
  );
  delete from private.call_admissions a where a.admission_id in (
    select expired.admission_id from private.call_admissions expired
    where expired.lease_expires_at <= sweep_at
    order by expired.lease_expires_at limit batch_size for update skip locked
  );

  return private.call_claim_due_jobs(p_limit);
end;
$$;

create or replace function public.call_reconcile(
  p_call_id uuid,
  p_job_lease_id uuid,
  p_epoch bigint,
  p_room_generation bigint,
  p_observation jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  job private.call_jobs;
  target public.calls;
  room private.call_rooms;
  observed_result text;
  observed_room_sid text;
  participants jsonb;
  observed_at timestamptz;
  caller_sid text;
  callee_sid text;
  caller_present boolean := false;
  callee_present boolean := false;
  caller_count integer;
  callee_count integer;
  settings private.call_settings;
  next_at timestamptz;
  checked_at timestamptz;
begin
  perform private.call_require_service_role();
  if p_call_id is null or p_job_lease_id is null or p_epoch is null or p_room_generation is null
     or jsonb_typeof(p_observation) is distinct from 'object'
     or octet_length(p_observation::text) > 4096 then
    raise exception 'CALL_INVALID_REQUEST' using errcode = 'P0001';
  end if;
  select c.* into target from public.calls c where c.call_id = p_call_id for update;
  select * into room from private.call_rooms r where r.call_id = p_call_id for update;
  select * into job from private.call_jobs j
  where j.diagnostic_call_id = p_call_id and j.lease_id = p_job_lease_id
    and j.kind = 'reconcile' and j.state = 'claimed'
  for update;
  checked_at := clock_timestamp();
  if job.job_id is null or target.call_id is null or room.call_id is null
     or job.lease_expires_at <= checked_at
     or job.termination_epoch <> p_epoch or job.room_generation <> p_room_generation
     or target.status not in ('accepted', 'in_progress') or room.readiness <> 'ready'
     or room.epoch <> p_epoch or room.room_generation <> p_room_generation then
    return jsonb_build_object('applied', false, 'call_id', p_call_id::text, 'revision', null,
      'next_reconcile_at', null, 'cleanup_state', 'not_required');
  end if;

  observed_result := p_observation ->> 'result';
  if observed_result is null or observed_result not in ('unknown', 'missing', 'present')
     or jsonb_typeof(p_observation -> 'observed_at') is distinct from 'string' then
    raise exception 'CALL_INVALID_REQUEST' using errcode = 'P0001';
  end if;
  begin
    observed_at := (p_observation ->> 'observed_at')::timestamptz;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception 'CALL_INVALID_REQUEST' using errcode = 'P0001';
  end;
  if observed_at < date_trunc('milliseconds', job.updated_at) or observed_at > checked_at + interval '1 second'
     or not isfinite(observed_at) then
    raise exception 'CALL_INVALID_REQUEST' using errcode = 'P0001';
  end if;

  if observed_result = 'unknown' and (
     coalesce(p_observation ->> 'error_code', '') not in ('timeout', 'unavailable')
     or p_observation - array['observed_at', 'result', 'error_code'] <> '{}'::jsonb
  ) then
    raise exception 'CALL_INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if observed_result = 'missing' and p_observation - array['observed_at', 'result'] <> '{}'::jsonb then
    raise exception 'CALL_INVALID_REQUEST' using errcode = 'P0001';
  end if;

  if observed_result = 'present' then
    observed_room_sid := p_observation ->> 'room_sid';
    participants := p_observation -> 'participants';
    if observed_room_sid is distinct from room.room_sid
       or jsonb_typeof(participants) is distinct from 'array'
       or p_observation - array['observed_at', 'result', 'room_sid', 'participants'] <> '{}'::jsonb then
      raise exception 'CALL_INVALID_REQUEST' using errcode = 'P0001';
    end if;
    if jsonb_array_length(participants) > 2 or exists (
      select 1 from jsonb_array_elements(participants) x
      where jsonb_typeof(x) is distinct from 'object'
         or jsonb_typeof(x->'identity') is distinct from 'string'
         or jsonb_typeof(x->'participant_sid') is distinct from 'string'
         or coalesce(length(btrim(x->>'participant_sid')), 0) not between 1 and 256
         or coalesce(x->>'identity', '') not in (room.caller_identity, room.callee_identity)
    ) then
      raise exception 'CALL_INVALID_REQUEST' using errcode = 'P0001';
    end if;
    select min(x.participant_sid) filter (where x.identity = room.caller_identity),
           min(x.participant_sid) filter (where x.identity = room.callee_identity),
           count(*) filter (where x.identity = room.caller_identity),
           count(*) filter (where x.identity = room.callee_identity)
      into caller_sid, callee_sid, caller_count, callee_count
    from jsonb_to_recordset(participants) as x(identity text, participant_sid text);
    caller_present := caller_sid is not null;
    callee_present := callee_sid is not null;
    if caller_count > 1 or callee_count > 1 or (caller_sid = callee_sid) then
      raise exception 'CALL_INVALID_REQUEST' using errcode = 'P0001';
    end if;
    update private.call_rooms r
    set caller_participant_sid = coalesce(caller_sid, r.caller_participant_sid),
        callee_participant_sid = coalesce(callee_sid, r.callee_participant_sid),
        disconnect_deadline = case when caller_present and callee_present then null else r.disconnect_deadline end
    where r.call_id = p_call_id;
  end if;

  select * into settings from private.call_settings s where s.singleton;

  if observed_result <> 'unknown' then
    with presence(role, sid, previous_sid) as (
      values ('caller', caller_sid, room.caller_participant_sid),
             ('callee', callee_sid, room.callee_participant_sid)
    )
    update public.call_participants cp
    set connected = p.sid is not null,
        connection_generation = cp.connection_generation
          + case when p.sid is not null and p.sid is distinct from p.previous_sid then 1 else 0 end,
        joined_at = case when p.sid is not null then checked_at else cp.joined_at end,
        left_at = case when p.sid is null then checked_at else null end,
        revision = cp.revision + 1
    from presence p
    where cp.call_id = p_call_id and cp.role = p.role
      and (cp.connected is distinct from (p.sid is not null)
        or (p.sid is not null and p.sid is distinct from p.previous_sid));
  end if;

  if observed_result <> 'unknown' and target.status = 'in_progress'
     and not (caller_present and callee_present) then
    if room.disconnect_deadline is null then
      update private.call_rooms r
      set disconnect_deadline = checked_at + make_interval(secs => settings.disconnect_grace_seconds)
      where r.call_id = p_call_id;
    elsif room.disconnect_deadline <= checked_at then
      perform private.call_mark_terminal(p_call_id, 'failed', 'media_disconnected');
    end if;
  end if;

  if target.status = 'accepted' and target.connect_expires_at <= checked_at then
    perform private.call_mark_terminal(p_call_id, 'failed', 'connection_timeout');
  elsif target.status = 'accepted' and caller_present and callee_present then
    update public.calls c
    set status = 'in_progress', connected_at = checked_at, revision = c.revision + 1
    where c.call_id = p_call_id and c.status = 'accepted';
    update private.call_user_reservations r
    set due_at = checked_at + make_interval(secs => settings.maximum_duration_seconds)
    where r.call_id = p_call_id;
  end if;

  select c.* into target from public.calls c where c.call_id = p_call_id;
  if target.status in ('accepted', 'in_progress') then
    next_at := checked_at + make_interval(secs => settings.reconcile_seconds);
    update private.call_rooms r set next_reconcile_at = next_at where r.call_id = p_call_id;
  end if;
  update private.call_jobs j
  set state = 'confirmed', lease_id = null, lease_expires_at = null,
      updated_at = now()
  where j.job_id = job.job_id;
  return jsonb_build_object(
    'applied', true,
    'call_id', p_call_id::text,
    'revision', case when target.call_id is null then null else target.revision::text end,
    'next_reconcile_at', next_at,
    'cleanup_state', private.call_cleanup_state(p_call_id)
  );
end;
$$;

create or replace function public.call_complete_cleanup(
  p_job_lease_id uuid,
  p_outcome text,
  p_error_code text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  job private.call_jobs;
  next_state private.call_job_state;
  next_attempt timestamptz;
  next_attempt_number integer;
begin
  perform private.call_require_service_role();
  if p_job_lease_id is null or p_outcome is null or p_outcome not in ('confirmed', 'retryable', 'failed')
     or (p_error_code is not null and (length(p_error_code) = 0 or length(p_error_code) > 64 or p_error_code !~ '^[a-z0-9_]+$')) then
    raise exception 'CALL_INVALID_REQUEST' using errcode = 'P0001';
  end if;
  select j.* into job from private.call_jobs j
  where j.lease_id = p_job_lease_id and j.state = 'claimed' and j.kind = 'cleanup'
  for update;
  if job.job_id is null or job.lease_expires_at <= clock_timestamp() then
    return jsonb_build_object('applied', false, 'state', null, 'jobId', null);
  end if;
  if p_outcome = 'confirmed' and job.outstanding_operation_until > clock_timestamp() then
    p_outcome := 'retryable';
    p_error_code := 'provisioning_pending';
  end if;
  if p_outcome = 'confirmed' then
    next_state := 'confirmed';
  elsif p_outcome = 'failed' or job.attempts >= 5 then
    next_state := 'failed';
  else
    next_state := 'pending';
  end if;
  next_attempt_number := job.attempts;
  next_attempt := clock_timestamp() +
    case next_attempt_number when 1 then interval '2 seconds' when 2 then interval '5 seconds'
      when 3 then interval '15 seconds' when 4 then interval '60 seconds' else interval '0 seconds' end;
  update private.call_jobs j
  set state = next_state,
      attempts = next_attempt_number,
      next_attempt_at = next_attempt,
      lease_id = null,
      lease_expires_at = null,
      last_error_code = case when p_outcome = 'confirmed' then null else p_error_code end,
      updated_at = now()
  where j.job_id = job.job_id;
  return jsonb_build_object(
    'applied', true,
    'jobId', job.job_id::text,
    'state', next_state::text,
    'attempts', next_attempt_number,
    'nextAttemptAt', to_char((next_attempt) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

revoke all on function private.call_is_service_role() from public, anon, authenticated, service_role;
revoke all on function private.call_require_service_role() from public, anon, authenticated, service_role;
revoke all on function private.call_is_current_participant(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function private.call_pair_member(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function private.call_check_actor_exists(uuid) from public, anon, authenticated, service_role;
revoke all on function private.call_user_is_call_eligible(uuid) from public, anon, authenticated, service_role;
revoke all on function private.call_require_users_eligible(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function private.call_check_enabled(uuid) from public, anon, authenticated, service_role;
revoke all on function private.call_rate_limit_event(uuid, text, uuid, uuid, integer, integer, uuid) from public, anon, authenticated, service_role;
revoke all on function private.call_state_json(public.calls) from public, anon, authenticated, service_role;
revoke all on function private.call_cleanup_state(uuid) from public, anon, authenticated, service_role;
revoke all on function private.call_snapshot_json(uuid, uuid, uuid, boolean) from public, anon, authenticated, service_role;
revoke all on function private.call_enqueue_cleanup(uuid, bigint) from public, anon, authenticated, service_role;
revoke all on function private.call_mark_terminal(uuid, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function private.call_before_delete_cleanup() from public, anon, authenticated, service_role;
revoke all on function private.call_claim_due_jobs(integer) from public, anon, authenticated, service_role;

revoke all on function public.call_create(uuid, uuid, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.call_transition(uuid, uuid, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.call_snapshot(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.call_finalize_provisioning(uuid, uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.call_prepare_admission(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.call_finalize_admission(uuid, uuid, uuid, uuid, bigint, bigint, bigint) from public, anon, authenticated;
revoke all on function public.call_worker_tick(integer) from public, anon, authenticated;
revoke all on function public.call_reconcile(uuid, uuid, bigint, bigint, jsonb) from public, anon, authenticated;
revoke all on function public.call_complete_cleanup(uuid, text, text) from public, anon, authenticated;
grant execute on function public.call_create(uuid, uuid, text, uuid, uuid) to service_role;
grant execute on function public.call_transition(uuid, uuid, text, uuid, uuid) to service_role;
grant execute on function public.call_snapshot(uuid, uuid, uuid) to service_role;
grant execute on function public.call_finalize_provisioning(uuid, uuid, bigint, text) to service_role;
grant execute on function public.call_prepare_admission(uuid, uuid, uuid) to service_role;
grant execute on function public.call_finalize_admission(uuid, uuid, uuid, uuid, bigint, bigint, bigint) to service_role;
grant execute on function public.call_worker_tick(integer) to service_role;
grant execute on function public.call_reconcile(uuid, uuid, bigint, bigint, jsonb) to service_role;
grant execute on function public.call_complete_cleanup(uuid, text, text) to service_role;
grant usage on schema private to authenticated;
grant execute on function private.call_is_current_participant(uuid, uuid) to authenticated;

comment on table public.calls is 'Safe one-to-one call lifecycle rows; service-only mutation through calling RPCs.';
comment on table public.call_participants is 'Safe participant status rows; service-only mutation through calling RPCs.';
comment on table private.call_jobs is 'Deletion-safe provider cleanup and reconciliation work; never stores tokens.';
comment on table private.call_settings is 'Server-controlled calling flags, deadlines and bounded rate limits.';
