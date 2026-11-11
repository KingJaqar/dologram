-- Run with psql and ON_ERROR_STOP on an isolated database after migrations 029 and 030.
-- All fixtures are synthetic and rolled back.
begin;

update private.call_settings set calling_enabled = true, pilot_user_ids = '{}';

insert into auth.users (id, email) values
  ('29f00000-0000-4000-8000-000000000001', 'phase2-caller@example.invalid'),
  ('29f00000-0000-4000-8000-000000000002', 'phase2-callee@example.invalid');

do $$
declare
  caller uuid := '29f00000-0000-4000-8000-000000000001';
  callee uuid := '29f00000-0000-4000-8000-000000000002';
  chat uuid := gen_random_uuid();
  caller_session uuid := gen_random_uuid();
  callee_session uuid := gen_random_uuid();
  target_call_id uuid;
  room_name text;
  first jsonb;
  duplicate jsonb;
  stale jsonb;
begin
  insert into public.chats(chat_id, type, created_by) values (chat, 'direct', caller);
  insert into public.chat_members(chat_id, user_id, role)
  values (chat, caller, 'owner'), (chat, callee, 'member');

  set local role service_role;
  first := public.call_create(caller, chat, 'video', gen_random_uuid(), caller_session);
  target_call_id := (first #>> '{call,callId}')::uuid;
  perform public.call_transition(callee, target_call_id, 'accept', gen_random_uuid(), callee_session);
  select r.room_name into room_name
  from private.call_rooms r where r.call_id = target_call_id;
  perform public.call_finalize_provisioning(
    target_call_id,
    (public.call_prepare_admission(caller, target_call_id, caller_session)->>'operation_id')::uuid,
    (select r.epoch from private.call_rooms r where r.call_id = target_call_id),
    'RM_PHASE2_TEST'
  );

  first := public.call_record_webhook(
    'phase2-event-join', clock_timestamp(), 'participant_joined',
    room_name, 'RM_PHASE2_TEST', 'caller_identity', 'PA_PHASE2_CALLER'
  );
  assert (first->>'accepted')::boolean, 'First verified event was not accepted';
  assert not (first->>'duplicate')::boolean, 'First event was marked duplicate';
  assert (select state = 'processed' from private.call_webhook_events
    where provider_event_id = 'phase2-event-join');
  assert (select next_reconcile_at <= clock_timestamp() from private.call_rooms where call_id = target_call_id);

  duplicate := public.call_record_webhook(
    'phase2-event-join', clock_timestamp(), 'participant_joined',
    room_name, 'RM_PHASE2_TEST', 'caller_identity', 'PA_PHASE2_CALLER'
  );
  assert (duplicate->>'duplicate')::boolean, 'Webhook replay was not deduplicated';

  stale := public.call_record_webhook(
    'phase2-event-stale', clock_timestamp(), 'participant_left',
    room_name, 'RM_OLD_GENERATION', 'caller_identity', 'PA_OLD'
  );
  assert not (stale->>'accepted')::boolean, 'Stale room event was accepted';
  assert (select error_code = 'stale_room' and state = 'failed'
    from private.call_webhook_events where provider_event_id = 'phase2-event-stale');

  set local role authenticated;
  begin
    perform public.call_record_webhook(
      'phase2-event-unauthorized', clock_timestamp(), 'room_started',
      room_name, 'RM_PHASE2_TEST', null, null
    );
    raise exception 'Authenticated/anon webhook RPC invocation succeeded';
  exception when insufficient_privilege then null;
  end;
  reset role;
end;
$$;

select 'Phase 2 webhook signature handoff, deduplication, stale-generation and grant assertions passed' as result;
rollback;
