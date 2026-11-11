-- Phase 2: signed provider event intake and durable webhook deduplication.
--
-- Provider events arrive through an unauthenticated Edge Function endpoint. The
-- endpoint verifies the LiveKit signature first, then forwards only normalized,
-- non-secret metadata through this service-only RPC. Reconciliation remains the
-- authority for participant presence and lifecycle transitions.

alter table private.call_webhook_events
  add column if not exists event_type text,
  add column if not exists participant_identity text,
  add column if not exists participant_sid text;

alter table private.call_webhook_events
  drop constraint if exists call_webhook_events_event_type_check;

alter table private.call_webhook_events
  add constraint call_webhook_events_event_type_check check (
    event_type is null or event_type in (
      'room_started', 'room_finished', 'participant_joined', 'participant_left',
      'participant_connection_aborted', 'track_published', 'track_unpublished'
    )
  );

create or replace function public.call_record_webhook(
  p_provider_event_id text,
  p_event_time timestamptz,
  p_event_type text,
  p_room_name text,
  p_room_sid text,
  p_participant_identity text default null,
  p_participant_sid text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  room private.call_rooms;
  target public.calls;
  inserted boolean;
begin
  perform private.call_require_service_role();
  if p_provider_event_id is null or length(btrim(p_provider_event_id)) = 0
     or length(p_provider_event_id) > 128
     or p_event_time is null or not isfinite(p_event_time)
     or p_event_type is null
     or p_event_type not in (
       'room_started', 'room_finished', 'participant_joined', 'participant_left',
       'participant_connection_aborted', 'track_published', 'track_unpublished'
     )
     or p_room_name is null or length(btrim(p_room_name)) = 0 or length(p_room_name) > 256
     or p_room_sid is null or length(btrim(p_room_sid)) = 0 or length(p_room_sid) > 256
     or (p_participant_identity is not null and length(p_participant_identity) > 256)
     or (p_participant_sid is not null and length(p_participant_sid) > 256) then
    raise exception 'CALL_INVALID_REQUEST' using errcode = 'P0001';
  end if;

  select r.* into room
  from private.call_rooms r
  where r.room_name = btrim(p_room_name)
  for update;

  insert into private.call_webhook_events(
    provider_event_id, event_time, call_id, room_sid, room_generation,
    event_type, participant_identity, participant_sid, state
  )
  values (
    btrim(p_provider_event_id), p_event_time,
    room.call_id, btrim(p_room_sid), coalesce(room.room_generation, 0),
    p_event_type, nullif(btrim(p_participant_identity), ''),
    nullif(btrim(p_participant_sid), ''),
    case when room.call_id is null then 'failed' else 'processed' end
  )
  on conflict (provider_event_id) do nothing;
  inserted := found;

  if not inserted then
    return jsonb_build_object('accepted', false, 'duplicate', true);
  end if;

  if room.call_id is null then
    update private.call_webhook_events
    set error_code = 'unknown_room', processed_at = clock_timestamp()
    where provider_event_id = btrim(p_provider_event_id);
    return jsonb_build_object('accepted', false, 'duplicate', false);
  end if;

  select c.* into target from public.calls c where c.call_id = room.call_id;
  if room.room_sid is not null and room.room_sid <> btrim(p_room_sid) then
    update private.call_webhook_events
    set state = 'failed', error_code = 'stale_room', processed_at = clock_timestamp()
    where provider_event_id = btrim(p_provider_event_id);
    return jsonb_build_object('accepted', false, 'duplicate', false);
  end if;
  if target.call_id is not null and target.status in ('accepted', 'in_progress')
     and room.room_sid is not null then
    update private.call_rooms
    set next_reconcile_at = clock_timestamp()
    where call_id = room.call_id;
  end if;

  update private.call_webhook_events
  set processed_at = clock_timestamp()
  where provider_event_id = btrim(p_provider_event_id);

  return jsonb_build_object(
    'accepted', true,
    'duplicate', false,
    'call_id', room.call_id::text,
    'room_generation', room.room_generation::text
  );
end;
$$;

revoke all on function public.call_record_webhook(text, timestamptz, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.call_record_webhook(text, timestamptz, text, text, text, text, text)
  to service_role;

comment on function public.call_record_webhook(text, timestamptz, text, text, text, text, text)
  is 'Accepts only signature-verified LiveKit event metadata, deduplicates it, and schedules reconciliation.';
