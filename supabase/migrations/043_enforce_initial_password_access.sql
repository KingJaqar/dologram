-- AB-02 / Phase 8 prerequisite. Existing migrations and policies remain intact.
set lock_timeout = '5s';
set statement_timeout = '15s';

create function private.account_access_allowed(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u where u.id = p_user_id and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
      and coalesce(u.raw_app_meta_data -> 'must_change_password', 'false'::jsonb) = 'false'::jsonb
      -- An interrupted admin creation remains denied even if its first password
      -- has already changed. Recovery must finish initialization and the audit.
      and (u.raw_app_meta_data -> 'admin_creation' is null or (
        exists (select 1 from public.profiles p where p.user_id = u.id)
        and exists (select 1 from public.chats c join public.chat_members m on m.chat_id = c.chat_id
          where c.type = 'direct' and c.direct_key = u.id::text and m.user_id = u.id and m.role = 'owner')
        and exists (select 1 from private.admin_audit a where a.event_id::text = u.raw_app_meta_data -> 'admin_creation' ->> 'id'
          and a.target_user_id = u.id and a.action = 'account.create' and a.result = 'success')
      ))
  );
$$;
revoke all on function private.account_access_allowed(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.account_access_allowed(uuid) to authenticated, service_role;

-- Edge Functions use this server-only RPC before any service-role data access.
create function public.account_access_allowed(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.account_access_allowed(p_user_id);
$$;
revoke all on function public.account_access_allowed(uuid) from public, anon, authenticated;
grant execute on function public.account_access_allowed(uuid) to service_role;

create function private.require_account_access()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.account_access_allowed(auth.uid()) then
    raise exception using errcode = '42501', message = 'ACCOUNT_ACCESS_RESTRICTED';
  end if;
end;
$$;
revoke all on function private.require_account_access() from public, anon;
grant execute on function private.require_account_access() to authenticated;

-- RLS reads the current Auth row, never the potentially stale JWT flag. Existing
-- permissive policies still decide ownership; this restrictive gate only denies.
do $$
declare target record;
begin
  for target in
    select n.nspname, c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p') and
      (n.nspname = 'public' or (n.nspname = 'storage' and c.relname = 'objects')
        or (n.nspname = 'realtime' and c.relname = 'messages'))
      and not exists (select 1 from pg_depend d where d.objid = c.oid and d.classid = 'pg_class'::regclass and d.deptype = 'e')
  loop
    -- Hosted Storage/Realtime already enable RLS and reserve ALTER TABLE for
    -- their managed owners. Do not issue redundant ownership-restricted DDL.
    if not target.relrowsecurity then
      execute format('alter table %I.%I enable row level security', target.nspname, target.relname);
    end if;
    execute format('create policy account_access_gate on %I.%I as restrictive for all to authenticated using ((select private.account_access_allowed(auth.uid()))) with check ((select private.account_access_allowed(auth.uid())))', target.nspname, target.relname);
  end loop;
end;
$$;

create function private.clear_initial_password_flag()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.raw_app_meta_data ->> 'must_change_password' = 'true'
    and new.encrypted_password is distinct from old.encrypted_password
    and coalesce(new.encrypted_password, '') <> '' then
    new.raw_app_meta_data := jsonb_set(coalesce(new.raw_app_meta_data, '{}'::jsonb), '{must_change_password}', 'false'::jsonb, true);
  end if;
  return new;
end;
$$;
revoke all on function private.clear_initial_password_flag() from public, anon, authenticated, service_role;
create trigger on_auth_initial_password_clearing before update of encrypted_password on auth.users
for each row execute function private.clear_initial_password_flag();

create function private.sync_profile_password_flag()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set must_change_password = coalesce(new.raw_app_meta_data ->> 'must_change_password' = 'true', false)
  where user_id = new.id and must_change_password is distinct from coalesce(new.raw_app_meta_data ->> 'must_change_password' = 'true', false);
  return new;
end;
$$;
revoke all on function private.sync_profile_password_flag() from public, anon, authenticated, service_role;
-- Runs after on_auth_user_profile_sync on insert and after any password update.
create trigger zz_sync_profile_password_flag after insert or update on auth.users
for each row execute function private.sync_profile_password_flag();

-- The historical seed helper has no application callers and must not provide an
-- unguarded SECURITY DEFINER metadata-write endpoint to ordinary users.
do $$ begin
  if to_regprocedure('public.set_user_metadata(text,jsonb)') is not null then
    revoke all on function public.set_user_metadata(text,jsonb) from public, anon, authenticated;
  end if;
end; $$;

-- Preserve 016_align_messenger_schema.sql behavior; add the current-account access gate.
create or replace function public.find_user(username text)
returns table (user_id uuid, display_name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.user_id, p.display_name
  from public.profiles p
  where (select auth.uid()) is not null
    and (select private.account_access_allowed(auth.uid()))
    and lower(p.username) = lower($1)
  limit 1;
$$;

-- Preserve 024_soft_delete_chat_attachments.sql behavior; add the current-account access gate.
create or replace function public.delete_chat_attachment(p_media_id uuid)
returns public.message_media
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.message_media;
  live_count integer;
begin
  perform private.require_account_access();
  select * into target from public.message_media where media_id = p_media_id for update;
  if target.media_id is null or auth.uid() is null
     or not private.is_chat_member(target.chat_id, auth.uid())
     or not exists (
       select 1 from public.messages
       where message_id = target.message_id and sender_id = auth.uid()
     ) then
    raise exception 'Attachment unavailable' using errcode = '42501';
  end if;
  if target.deleted_at is null then
    update public.message_media
       set deleted_at = clock_timestamp(), sync_seq = private.claim_chat_sequence(target.chat_id)
     where media_id = p_media_id returning * into target;
    select count(*) into live_count from public.message_media
      where message_id = target.message_id and deleted_at is null;
    update public.messages set attachment_count = live_count,
      deleted_at = case when live_count = 0 and btrim(content) = '' then coalesce(deleted_at, clock_timestamp()) else deleted_at end,
      sync_seq = private.claim_chat_sequence(target.chat_id)
      where message_id = target.message_id;
  end if;
  return target;
end;
$$;

-- Preserve 026_shared_chat_nicknames.sql behavior; add the current-account access gate.
create or replace function public.set_chat_nickname(
  p_chat_id uuid,
  p_user_id uuid,
  p_nickname text
)
returns setof public.chat_members
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_nickname text := nullif(btrim(p_nickname), '');
begin
  perform private.require_account_access();
  if not private.is_chat_member(p_chat_id, (select auth.uid())) then
    raise exception 'not_chat_member';
  end if;

  if not private.is_chat_member(p_chat_id, p_user_id) then
    raise exception 'target_not_chat_member';
  end if;

  if next_nickname is not null and char_length(next_nickname) > 64 then
    raise exception 'nickname_too_long';
  end if;

  return query
    update public.chat_members
       set nickname = next_nickname
     where chat_id = p_chat_id and user_id = p_user_id
     returning *;
end;
$$;

-- Preserve 034_create_direct_chat_atomically.sql behavior; add the current-account access gate.
create or replace function public.open_direct_chat(p_other_user_id uuid, p_chat_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  target_key text;
  existing_chat_id uuid;
begin
  perform private.require_account_access();
  if caller is null or p_other_user_id is null or p_chat_id is null then
    raise exception 'invalid direct chat request' using errcode = '22023';
  end if;

  target_key := case
    when caller = p_other_user_id then caller::text
    else least(caller, p_other_user_id)::text || ':' || greatest(caller, p_other_user_id)::text
  end;

  select chat_id into existing_chat_id from public.chats
    where direct_key = target_key and type = 'direct';
  if found then return existing_chat_id; end if;

  set constraints public.chat_members_set_direct_key deferred;
  insert into public.chats (chat_id, type, created_by) values (p_chat_id, 'direct', caller);
  insert into public.chat_members (chat_id, user_id, role) values (p_chat_id, caller, 'owner');
  if p_other_user_id <> caller then
    insert into public.chat_members (chat_id, user_id, role) values (p_chat_id, p_other_user_id, 'member');
  end if;
  set constraints public.chat_members_set_direct_key immediate;
  return p_chat_id;
exception when unique_violation then
  -- Another request can create the pair first. PostgreSQL has rolled back our
  -- inserts at this point, so a retry returns the winner without leaving a shell.
  select chat_id into existing_chat_id from public.chats
    where direct_key = target_key and type = 'direct';
  if found then return existing_chat_id; end if;
  raise;
end;
$$;

-- Preserve 037_harden_chat_read_state.sql behavior; add the current-account access gate.
create or replace function public.mark_chat_read(
  p_chat_id uuid,
  p_max_seq bigint,
  p_membership_joined_at timestamptz
)
returns setof public.chat_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  own_member public.chat_members;
  highest_seq bigint;
  next_seq bigint;
begin
  perform private.require_account_access();
  if caller is null then
    raise exception 'authentication required' using errcode = 'DG401';
  end if;

  if p_chat_id is null
     or p_max_seq is null
     or p_membership_joined_at is null
     or p_max_seq < 0
     or p_max_seq > 9007199254740991 then
    raise exception 'invalid read cursor request' using errcode = 'DG422';
  end if;

  select cm.*
    into own_member
    from public.chat_members cm
   where cm.chat_id = p_chat_id
     and cm.user_id = caller
   for update;

  if not found then
    raise exception 'chat membership not found' using errcode = 'DG403';
  end if;

  if own_member.joined_at is distinct from p_membership_joined_at then
    raise exception 'chat membership changed' using errcode = 'DG409';
  end if;

  select coalesce(max(m.seq), 0)
    into highest_seq
    from public.messages m
   where m.chat_id = p_chat_id;

  next_seq := greatest(own_member.last_read_seq, least(p_max_seq, highest_seq));

  update public.chat_members cm
     set last_read_seq = next_seq
   where cm.chat_id = p_chat_id
     and cm.user_id = caller
  returning cm.* into own_member;

  return next own_member;
end;
$$;

-- Preserve 037_harden_chat_read_state.sql behavior; add the current-account access gate.
create or replace function public.get_chat_member_snapshot(p_chat_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  snapshot jsonb;
begin
  perform private.require_account_access();
  if caller is null then
    raise exception 'authentication required' using errcode = 'DG401';
  end if;

  if p_chat_id is null then
    raise exception 'chat id is required' using errcode = 'DG422';
  end if;

  -- The authorization check and the member aggregation share one statement snapshot. The HAVING
  -- clause also makes an empty or caller-less result a denial rather than a valid empty roster.
  select jsonb_build_object(
           'members', coalesce(jsonb_agg(to_jsonb(cm) order by cm.user_id), '[]'::jsonb),
           'total_count', count(*)
         )
    into snapshot
    from public.chat_members cm
   where cm.chat_id = p_chat_id
  having count(*) filter (where cm.user_id = caller) = 1;

  if not found then
    raise exception 'chat membership not found' using errcode = 'DG403';
  end if;

  return snapshot;
end;
$$;

-- Preserve 038_message_read_receipts.sql behavior; add the current-account access gate.
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
  perform private.require_account_access();
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

-- Preserve 038_message_read_receipts.sql behavior; add the current-account access gate.
create or replace function public.set_my_read_privacy(p_read_time_visibility text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  perform private.require_account_access();
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

-- Preserve 038_message_read_receipts.sql behavior; add the current-account access gate.
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
  perform private.require_account_access();
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

-- Preserve 040_add_global_people_search.sql behavior; add the current-account access gate.
create or replace function public.search_people(p_query text)
returns table (user_id uuid, username text, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  with query as (
    select lower(btrim(regexp_replace(btrim(p_query), '^@', ''))) as term
  )
  select p.user_id, p.username, p.display_name
  from public.profiles p cross join query q
  where (select auth.uid()) is not null
    and (select private.account_access_allowed(auth.uid()))
    and p.user_id <> (select auth.uid())
    and length(q.term) between 1 and 100
    -- Literal substrings: underscores and percent signs are not wildcards.
    and (strpos(lower(p.username), q.term) > 0 or strpos(lower(p.display_name), q.term) > 0)
  order by case
    when lower(p.username) = q.term or lower(p.display_name) = q.term then 0
    when starts_with(lower(p.username), q.term) or starts_with(lower(p.display_name), q.term) then 1
    else 2
  end, lower(p.display_name), p.user_id
  limit 50;
$$;

-- Preserve 036_harden_memo_private_sync.sql behavior; add the current-account access gate.
create or replace function public.memo_reminder_recipients(p_occurrence_id text,p_lease uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o public.memo_reminder_occurrences; m public.memo_memos; result jsonb;
begin
 select * into o from public.memo_reminder_occurrences where occurrence_id=p_occurrence_id and claimed_by=p_lease and state='claimed' and lease_expires_at>now();
 if not found then raise exception 'MEMO_NOT_ALLOWED'; end if;
 select * into m from public.memo_memos where memo_id=o.memo_id and generation=o.generation and closed_at is null;
 if not found then raise exception 'MEMO_NOT_ALLOWED'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('token',p.push_token,'user_id',p.user_id,'device_id',p.device_id,'sounds',p.sounds,'vibration',p.vibration)),'[]'::jsonb) into result from public.memo_reminder_preferences p
 where p.memo_id=m.memo_id and p.user_id=m.owner_id and private.account_access_allowed(p.user_id) and p.enabled and p.push_token is not null
 and exists(select 1 from public.memo_members where memo_id=m.memo_id and user_id=p.user_id and role='owner' and revoked_at is null) and not exists(select 1 from private.memo_reminder_delivery d where d.occurrence_id=o.occurrence_id and d.device_id=p.device_id and d.accepted_at is not null);
 return result;
end;
$$;

-- The admin consumes this live, fail-closed capability. Preparing this migration
-- does not enable a hosted target: it must actually be applied and pass this test.
-- 036 replaced this worker function without repeating 035's client revocation.
revoke all on function public.memo_claim_reminder_occurrences(integer) from public, anon, authenticated;
grant execute on function public.memo_claim_reminder_occurrences(integer) to service_role;

create function private.admin_creation_contract_version()
returns integer language sql stable security definer set search_path = '' as $$
  select case when
    exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass
      and tgname = 'on_auth_initial_password_clearing' and tgenabled = 'O')
    and exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass
      and tgname = 'zz_sync_profile_password_flag' and tgenabled = 'O')
    and to_regclass('storage.objects') is not null
    and to_regclass('realtime.messages') is not null
    and to_regprocedure('public.account_access_allowed(uuid)') is not null
    and not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('r','p')
        and (n.nspname = 'public' or (n.nspname = 'storage' and c.relname = 'objects')
          or (n.nspname = 'realtime' and c.relname = 'messages'))
        and not exists (select 1 from pg_depend d where d.objid = c.oid and d.classid = 'pg_class'::regclass and d.deptype = 'e')
        and (not c.relrowsecurity or not exists (
          select 1 from pg_policy p where p.polrelid = c.oid and p.polname = 'account_access_gate'
            and not p.polpermissive and p.polcmd = '*'
            and 'authenticated'::regrole::oid = any(p.polroles)
            and position('account_access_allowed' in pg_get_expr(p.polqual, p.polrelid)) > 0
            and position('account_access_allowed' in pg_get_expr(p.polwithcheck, p.polrelid)) > 0
        ))
    )
    and not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
        and has_function_privilege('authenticated', p.oid, 'execute')
        and not exists (select 1 from pg_depend d where d.objid=p.oid and d.classid='pg_proc'::regclass and d.deptype='e')
        and position('private.require_account_access()' in p.prosrc) = 0
        and position('private.account_access_allowed(auth.uid())' in p.prosrc) = 0
    )
  then 43 else 0 end;
$$;
revoke all on function private.admin_creation_contract_version() from public, anon, authenticated, service_role;
comment on function private.admin_creation_contract_version() is 'Phase 8 creation only. Does not enable reset, ban, delete or CSV import.';
notify pgrst, 'reload schema';
reset lock_timeout;
reset statement_timeout;
