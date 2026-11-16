-- Phase 7: expose the existing server-controlled native background flag.
-- The default remains false so older and disabled deployments stay foreground-only.

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
  native_background_available boolean;
  pilots uuid[];
begin
  select s.calling_enabled, s.native_background_enabled, s.pilot_user_ids
    into available, native_background_available, pilots
  from private.call_settings s where s.singleton;
  available := coalesce(available, false)
    and (cardinality(pilots) = 0 or (p_actor_id = any(pilots)) is true);
  native_background_available := coalesce(native_background_available, false) and available;

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
        'availability', jsonb_build_object(
          'callingEnabled', available,
          'nativeBackgroundEnabled', native_background_available
        ),
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
    'availability', jsonb_build_object(
      'callingEnabled', available,
      'nativeBackgroundEnabled', native_background_available
    ),
    'serverTime', to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'cleanupState', cleanup_state
  );
end;
$$;
