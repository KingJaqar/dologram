-- Store bounded, server-recorded read details without changing aggregate read semantics.
-- Receipt collection is invoked by the existing cursor trigger, so new RPC and legacy UPDATE
-- callers share one transactional path.

create table private.message_read_detail_config (
  singleton boolean primary key default true check (singleton),
  retention interval not null check (retention > interval '0 seconds' and retention <= interval '365 days'),
  group_member_limit integer not null check (group_member_limit between 1 and 10000),
  collection_started_at timestamptz not null,
  details_enabled boolean not null
);

insert into private.message_read_detail_config (
  singleton, retention, group_member_limit, collection_started_at, details_enabled
) values (true, interval '7 days', 100, clock_timestamp(), true)
on conflict (singleton) do nothing;

create table private.message_read_detail_windows (
  message_id uuid primary key references public.messages(message_id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp()
);

create index message_read_detail_windows_expiry_idx
  on private.message_read_detail_windows (expires_at, message_id);

create table public.message_read_receipts (
  message_id uuid not null references public.messages(message_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chat_id uuid not null references public.chats(chat_id) on delete cascade,
  message_seq bigint not null check (message_seq >= 0),
  read_at timestamptz not null,
  expires_at timestamptz not null,
  primary key (message_id, user_id)
);

create index message_read_receipts_message_order_idx
  on public.message_read_receipts (message_id, read_at, user_id);
create index message_read_receipts_expiry_idx
  on public.message_read_receipts (expires_at, message_id, user_id);
create index message_read_receipts_chat_seq_idx
  on public.message_read_receipts (chat_id, message_seq, user_id);

create table public.user_read_privacy (
  user_id uuid primary key references auth.users(id) on delete cascade,
  read_time_visibility text not null check (read_time_visibility in ('everyone', 'nobody')),
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.message_read_receipts enable row level security;
alter table public.user_read_privacy enable row level security;

revoke all on public.message_read_receipts, public.user_read_privacy from public, anon, authenticated;
revoke all on private.message_read_detail_config, private.message_read_detail_windows
  from public, anon, authenticated, service_role;

create or replace function private.enforce_message_read_receipt_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_message public.messages;
  window_expiry timestamptz;
begin
  select m.*
    into source_message
    from public.messages m
   where m.message_id = new.message_id;

  if not found then
    raise exception 'read receipt message is unavailable' using errcode = 'DG422';
  end if;

  select w.expires_at
    into window_expiry
    from private.message_read_detail_windows w
   where w.message_id = source_message.message_id;

  if window_expiry is null then
    raise exception 'invalid read receipt' using errcode = 'DG422';
  end if;

  if tg_op = 'UPDATE' then
    if new.message_id is distinct from old.message_id
       or new.user_id is distinct from old.user_id
       or new.read_at is distinct from old.read_at
       or new.expires_at is null
       or new.expires_at > old.expires_at then
      raise exception 'read receipt is immutable' using errcode = 'DG422';
    end if;
  else
    if source_message.deleted_at is not null
       or new.user_id = source_message.sender_id
       or not exists (
         select 1
           from public.chat_members cm
          where cm.chat_id = source_message.chat_id
            and cm.user_id = new.user_id
       ) then
      raise exception 'invalid read receipt' using errcode = 'DG422';
    end if;
    new.read_at := clock_timestamp();
  end if;

  new.chat_id := source_message.chat_id;
  new.message_seq := source_message.seq;
  new.expires_at := least(new.expires_at, window_expiry);
  return new;
end;
$$;

create trigger message_read_receipts_integrity
before insert or update on public.message_read_receipts
for each row execute function private.enforce_message_read_receipt_integrity();

create or replace function private.collect_message_read_receipts(
  p_chat_id uuid,
  p_reader_id uuid,
  p_old_seq bigint,
  p_next_seq bigint
)
returns void
language plpgsql
security definer
set search_path = ''
set statement_timeout = '10s'
set lock_timeout = '2s'
as $$
declare
  config private.message_read_detail_config;
  chat_type text;
  member_count integer;
begin
  if p_next_seq <= p_old_seq then
    return;
  end if;

  select cfg.*
    into config
    from private.message_read_detail_config cfg
   where cfg.singleton
   for share;

  if not found or not config.details_enabled then
    return;
  end if;

  select c.type, count(cm.user_id)::integer
    into chat_type, member_count
    from public.chats c
    left join public.chat_members cm on cm.chat_id = c.chat_id
   where c.chat_id = p_chat_id
   group by c.type;

  if chat_type is null
     or (chat_type = 'group' and member_count > config.group_member_limit) then
    return;
  end if;

  insert into private.message_read_detail_windows (message_id, expires_at)
  select m.message_id, m.created_at + config.retention
    from public.messages m
   where m.chat_id = p_chat_id
     and m.seq > p_old_seq
     and m.seq <= p_next_seq
     and m.sender_id <> p_reader_id
     and m.deleted_at is null
     and m.created_at is not null
     and m.created_at >= config.collection_started_at
     and clock_timestamp() < m.created_at + config.retention
  on conflict (message_id) do nothing;

  insert into public.message_read_receipts (
    message_id, user_id, chat_id, message_seq, read_at, expires_at
  )
  select m.message_id, p_reader_id, m.chat_id, m.seq, clock_timestamp(),
         least(w.expires_at, m.created_at + config.retention)
    from public.messages m
    join private.message_read_detail_windows w on w.message_id = m.message_id
   where m.chat_id = p_chat_id
     and m.seq > p_old_seq
     and m.seq <= p_next_seq
     and m.sender_id <> p_reader_id
     and m.deleted_at is null
     and m.created_at is not null
     and m.created_at >= config.collection_started_at
     and clock_timestamp() < least(w.expires_at, m.created_at + config.retention)
  on conflict (message_id, user_id) do nothing;
end;
$$;

-- Replace the Phase 1 trigger function in place. public.mark_chat_read performs an UPDATE, so this
-- remains the only receipt collection call site for both the RPC and legacy clients.
create or replace function private.clamp_chat_member_read_seq()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  highest_seq bigint;
begin
  if tg_op <> 'UPDATE' or new.last_read_seq is not distinct from old.last_read_seq then
    return new;
  end if;

  if new.last_read_seq is null
     or new.last_read_seq < 0
     or new.last_read_seq > 9007199254740991 then
    raise exception 'invalid read cursor' using errcode = 'DG422';
  end if;

  select coalesce(max(m.seq), 0)
    into highest_seq
    from public.messages m
   where m.chat_id = new.chat_id;

  new.last_read_seq := greatest(old.last_read_seq, least(new.last_read_seq, highest_seq));
  perform private.collect_message_read_receipts(
    new.chat_id, new.user_id, old.last_read_seq, new.last_read_seq
  );
  return new;
end;
$$;

create or replace function private.configure_message_read_details(
  p_retention interval,
  p_group_member_limit integer,
  p_details_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '15s'
set lock_timeout = '2s'
as $$
declare
  current_config private.message_read_detail_config;
begin
  if p_retention is null
     or p_retention <= interval '0 seconds'
     or p_retention > interval '365 days'
     or p_group_member_limit is null
     or p_group_member_limit < 1
     or p_group_member_limit > 10000
     or p_details_enabled is null then
    raise exception 'invalid read detail configuration' using errcode = 'DG422';
  end if;

  select cfg.*
    into current_config
    from private.message_read_detail_config cfg
   where cfg.singleton
   for update;

  if not found then
    raise exception 'read detail configuration missing' using errcode = 'DG500';
  end if;

  update private.message_read_detail_windows w
     set expires_at = least(w.expires_at, m.created_at + p_retention)
    from public.messages m
   where m.message_id = w.message_id
     and m.created_at is not null;

  update public.message_read_receipts r
     set expires_at = least(r.expires_at, m.created_at + p_retention)
    from public.messages m
   where m.message_id = r.message_id
     and m.created_at is not null;

  update private.message_read_detail_config
     set retention = p_retention,
         group_member_limit = p_group_member_limit,
         details_enabled = p_details_enabled
   where singleton;

  return jsonb_build_object(
    'retention_seconds', extract(epoch from p_retention)::bigint,
    'group_member_limit', p_group_member_limit,
    'details_enabled', p_details_enabled
  );
end;
$$;

create or replace function public.get_my_read_privacy()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  visibility text;
begin
  if caller is null then
    raise exception 'authentication required' using errcode = 'DG401';
  end if;

  select p.read_time_visibility
    into visibility
    from public.user_read_privacy p
   where p.user_id = caller;

  return coalesce(visibility, 'everyone');
end;
$$;

create or replace function public.set_my_read_privacy(p_read_time_visibility text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'authentication required' using errcode = 'DG401';
  end if;

  if p_read_time_visibility is null
     or p_read_time_visibility not in ('everyone', 'nobody') then
    raise exception 'invalid read privacy value' using errcode = 'DG422';
  end if;

  insert into public.user_read_privacy (user_id, read_time_visibility, updated_at)
  values (caller, p_read_time_visibility, clock_timestamp())
  on conflict (user_id) do update
    set read_time_visibility = excluded.read_time_visibility,
        updated_at = excluded.updated_at;

  return p_read_time_visibility;
end;
$$;

create or replace function public.get_message_read_participants(
  p_chat_id uuid,
  p_message_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  caller uuid := auth.uid();
  target_message public.messages;
  config private.message_read_detail_config;
  window_expiry timestamptz;
  effective_expiry timestamptz;
  chat_type text;
  member_count integer;
  required_count integer;
  covered_count integer;
  viewer_visibility text;
  participants jsonb;
begin
  if caller is null then
    raise exception 'authentication required' using errcode = 'DG401';
  end if;

  if p_chat_id is null or p_message_id is null then
    raise exception 'chat and message ids are required' using errcode = 'DG422';
  end if;

  if not exists (
    select 1 from public.chat_members cm
     where cm.chat_id = p_chat_id and cm.user_id = caller
  ) then
    raise exception 'chat membership not found' using errcode = 'DG403';
  end if;

  select m.*
    into target_message
    from public.messages m
   where m.message_id = p_message_id
     and m.chat_id = p_chat_id
     and m.deleted_at is null;

  if not found then
    return jsonb_build_object('state', 'not_found');
  end if;

  if target_message.sender_id <> caller then
    raise exception 'message author required' using errcode = 'DG405';
  end if;

  select cfg.*
    into config
    from private.message_read_detail_config cfg
   where cfg.singleton;

  if not found or not config.details_enabled then
    return jsonb_build_object('state', 'hidden');
  end if;

  select c.type, count(cm.user_id)::integer
    into chat_type, member_count
    from public.chats c
    left join public.chat_members cm on cm.chat_id = c.chat_id
   where c.chat_id = p_chat_id
   group by c.type;

  if chat_type = 'group' and member_count > config.group_member_limit then
    return jsonb_build_object('state', 'not_available_for_large_group');
  end if;

  if target_message.created_at is null
     or target_message.created_at < config.collection_started_at then
    return jsonb_build_object('state', 'not_recorded');
  end if;

  select w.expires_at
    into window_expiry
    from private.message_read_detail_windows w
   where w.message_id = target_message.message_id;

  effective_expiry := least(
    coalesce(window_expiry, target_message.created_at + config.retention),
    target_message.created_at + config.retention
  );

  if clock_timestamp() >= effective_expiry then
    return jsonb_build_object('state', 'expired');
  end if;

  select count(*)::integer
    into required_count
    from public.chat_members cm
   where cm.chat_id = p_chat_id
     and cm.user_id <> caller
     and cm.last_read_seq >= target_message.seq;

  select count(*)::integer
    into covered_count
    from public.chat_members cm
    join public.message_read_receipts r
      on r.message_id = target_message.message_id
     and r.user_id = cm.user_id
   where cm.chat_id = p_chat_id
     and cm.user_id <> caller
     and cm.last_read_seq >= target_message.seq
     and clock_timestamp() < r.expires_at;

  if required_count <> covered_count then
    return jsonb_build_object('state', 'not_recorded');
  end if;

  select coalesce(p.read_time_visibility, 'everyone')
    into viewer_visibility
    from (select caller as user_id) me
    left join public.user_read_privacy p on p.user_id = me.user_id;

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'user_id', visible.user_id,
               'display_name', visible.display_name,
               'avatar_url', visible.avatar_url,
               'read_at', visible.visible_read_at
             )
             order by (visible.visible_read_at is null), visible.visible_read_at, visible.user_id
           ),
           '[]'::jsonb
         )
    into participants
    from (
      select cm.user_id,
             coalesce(nullif(p.display_name, ''), 'Unknown user') as display_name,
             p.avatar_url,
             case
               when viewer_visibility = 'everyone'
                and coalesce(reader_privacy.read_time_visibility, 'everyone') = 'everyone'
               then r.read_at
               else null
             end as visible_read_at
        from public.chat_members cm
        join public.message_read_receipts r
          on r.message_id = target_message.message_id
         and r.user_id = cm.user_id
        left join public.profiles p on p.user_id = cm.user_id
        left join public.user_read_privacy reader_privacy on reader_privacy.user_id = cm.user_id
       where cm.chat_id = p_chat_id
         and cm.user_id <> caller
         and cm.last_read_seq >= target_message.seq
         and clock_timestamp() < r.expires_at
    ) visible;

  return jsonb_build_object(
    'state', 'available',
    'participants', participants,
    'expires_at', effective_expiry
  );
end;
$$;

create or replace function private.cleanup_message_read_receipts(
  p_batch_size integer default 1000,
  p_max_batches integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '20s'
set lock_timeout = '2s'
as $$
declare
  deleted_in_batch integer;
  total_deleted integer := 0;
  batches integer := 0;
  has_more boolean;
begin
  if p_batch_size is null
     or p_batch_size < 1
     or p_batch_size > 1000
     or p_max_batches is null
     or p_max_batches < 1
     or p_max_batches > 10 then
    raise exception 'invalid cleanup bounds' using errcode = 'DG422';
  end if;

  if not pg_try_advisory_xact_lock(hashtextextended('dologram.message_read_receipts.cleanup', 0)) then
    return jsonb_build_object('state', 'already_running', 'deleted', 0, 'batches', 0);
  end if;

  loop
    exit when batches >= p_max_batches;

    with expired as (
      select r.ctid
        from public.message_read_receipts r
        left join public.messages m on m.message_id = r.message_id
       where r.expires_at <= clock_timestamp()
          or m.message_id is null
          or m.deleted_at is not null
       order by r.expires_at, r.message_id, r.user_id
       limit p_batch_size
       for update of r skip locked
    )
    delete from public.message_read_receipts r
     using expired e
     where r.ctid = e.ctid;

    get diagnostics deleted_in_batch = row_count;
    total_deleted := total_deleted + deleted_in_batch;
    batches := batches + 1;
    exit when deleted_in_batch < p_batch_size;
  end loop;

  select exists (
    select 1
      from public.message_read_receipts r
      left join public.messages m on m.message_id = r.message_id
     where r.expires_at <= clock_timestamp()
        or m.message_id is null
        or m.deleted_at is not null
  ) into has_more;

  return jsonb_build_object(
    'state', 'complete',
    'deleted', total_deleted,
    'batches', batches,
    'has_more', has_more
  );
end;
$$;

revoke all on function private.enforce_message_read_receipt_integrity()
  from public, anon, authenticated, service_role;
revoke all on function private.collect_message_read_receipts(uuid, uuid, bigint, bigint)
  from public, anon, authenticated, service_role;
revoke all on function private.configure_message_read_details(interval, integer, boolean)
  from public, anon, authenticated, service_role;
revoke all on function private.cleanup_message_read_receipts(integer, integer)
  from public, anon, authenticated, service_role;

revoke all on function public.get_my_read_privacy() from public, anon, service_role;
grant execute on function public.get_my_read_privacy() to authenticated;
revoke all on function public.set_my_read_privacy(text) from public, anon, service_role;
grant execute on function public.set_my_read_privacy(text) to authenticated;
revoke all on function public.get_message_read_participants(uuid, uuid)
  from public, anon, service_role;
grant execute on function public.get_message_read_participants(uuid, uuid) to authenticated;

-- Supabase Cron uses pg_cron. The migration owner registers a stable named job; scheduling the
-- same name again replaces its command, which makes migration recovery idempotent.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'dologram-read-receipt-cleanup',
  '*/5 * * * *',
  $cron$select private.cleanup_message_read_receipts(1000, 10);$cron$
);
