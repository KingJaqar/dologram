-- Run with psql and ON_ERROR_STOP on an isolated Supabase database.
-- Synthetic accounts and all mutations roll back.
begin;

update private.call_settings
set calling_enabled = false, pilot_user_ids = '{}', create_limit = 5, missed_streak_limit = 3;

insert into auth.users (id, email) values
  ('19f00000-0000-4000-8000-000000000001', 'phase1-caller@example.invalid'),
  ('19f00000-0000-4000-8000-000000000002', 'phase1-callee@example.invalid'),
  ('19f00000-0000-4000-8000-000000000003', 'phase1-outsider@example.invalid');

do $$
declare
  caller uuid := '19f00000-0000-4000-8000-000000000001';
  callee uuid := '19f00000-0000-4000-8000-000000000002';
  outsider uuid := '19f00000-0000-4000-8000-000000000003';
  chat uuid := gen_random_uuid();
  group_chat uuid := gen_random_uuid();
  incomplete_chat uuid := gen_random_uuid();
  caller_session uuid := gen_random_uuid();
  callee_session uuid := gen_random_uuid();
  request_id uuid := gen_random_uuid();
  transition_id uuid := gen_random_uuid();
  target uuid;
  snapshot jsonb;
  first_lease jsonb;
  second_lease jsonb;
  provision jsonb;
  worker_job jsonb;
  replacement jsonb;
  observed jsonb;
  epoch bigint;
  signed_at bigint;
begin
  insert into public.chats(chat_id, type, created_by)
  values (chat, 'direct', caller), (group_chat, 'group', caller), (incomplete_chat, 'direct', caller);
  insert into public.chat_members(chat_id, user_id, role) values
    (chat, caller, 'owner'), (chat, callee, 'member'),
    (group_chat, caller, 'owner'), (group_chat, callee, 'member');

  set local role service_role;
  begin
    perform public.call_create(caller, chat, 'voice', request_id, caller_session);
    raise exception 'Disabled calling allowed create';
  exception when raise_exception then
    assert sqlerrm = 'CALL_FEATURE_DISABLED', sqlerrm;
  end;
  reset role;
  update private.call_settings set calling_enabled = true, pilot_user_ids = '{}';

  set local role service_role;
  begin
    perform public.call_create(caller, group_chat, 'voice', gen_random_uuid(), caller_session);
    raise exception 'Group allowed create';
  exception when raise_exception then
    assert sqlerrm = 'CALL_NOT_ALLOWED', sqlerrm;
  end;
  begin
    perform public.call_create(caller, incomplete_chat, 'voice', gen_random_uuid(), caller_session);
    raise exception 'Incomplete direct chat allowed create';
  exception when raise_exception then
    assert sqlerrm = 'CALL_NOT_ALLOWED', sqlerrm;
  end;
  begin
    perform public.call_create(outsider, chat, 'voice', gen_random_uuid(), caller_session);
    raise exception 'Nonmember allowed create';
  exception when raise_exception then
    assert sqlerrm = 'CALL_NOT_ALLOWED', sqlerrm;
  end;
  snapshot := public.call_create(caller, chat, 'voice', request_id, caller_session);
  target := (snapshot #>> '{call,callId}')::uuid;
  assert target is not null and snapshot #>> '{call,status}' = 'ringing';
  assert (snapshot #>> '{capabilities,belongsToThisSession}')::boolean;
  assert public.call_create(caller, chat, 'voice', request_id, caller_session) #>> '{call,callId}' = target::text;
  begin
    perform public.call_create(caller, chat, 'video', request_id, caller_session);
    raise exception 'Changed request inputs replayed';
  exception when raise_exception then
    assert sqlerrm = 'CALL_REQUEST_CONFLICT', sqlerrm;
  end;
  snapshot := public.call_snapshot(callee, callee_session);
  assert (snapshot #>> '{capabilities,canAnswer}')::boolean, 'Recovery snapshot cannot answer';
  reset role;
  assert (select count(*) from private.call_user_reservations where call_id = target) = 2;

  set local role anon;
  begin
    perform 1 from public.calls;
    raise exception 'Anonymous SELECT succeeded';
  exception when insufficient_privilege then null;
  end;
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', caller, 'role', 'authenticated')::text, true);
  assert (select count(*) from public.calls where call_id = target) = 1;
  assert (select count(*) from public.call_participants where call_id = target) = 2;
  begin
    perform public.call_snapshot(caller, caller_session, target);
    raise exception 'Authenticated lifecycle RPC succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.calls set status = 'ended' where call_id = target;
    raise exception 'Authenticated direct mutation succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from private.call_rooms;
    raise exception 'Authenticated room lookup succeeded';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', outsider, 'role', 'authenticated')::text, true);
  assert not exists (select 1 from public.calls where call_id = target);
  assert not exists (select 1 from public.call_participants where call_id = target);
  reset role;

  set local role service_role;
  snapshot := public.call_transition(callee, target, 'accept', transition_id, callee_session);
  assert snapshot #>> '{call,status}' = 'accepted';
  assert public.call_transition(callee, target, 'accept', transition_id, callee_session) #>> '{call,revision}' =
    snapshot #>> '{call,revision}';
  begin
    perform public.call_transition(callee, target, 'accept', gen_random_uuid(), gen_random_uuid());
    raise exception 'Second callee session accepted';
  exception when raise_exception then
    assert sqlerrm = 'CALL_ALREADY_HANDLED', sqlerrm;
  end;
  begin
    perform public.call_transition(caller, target, 'end', gen_random_uuid(), callee_session);
    raise exception 'Caller could end with callee session';
  exception when raise_exception then
    assert sqlerrm = 'CALL_NOT_ALLOWED', sqlerrm;
  end;
  begin
    perform public.call_prepare_admission(caller, target, callee_session);
    raise exception 'Caller obtained admission with callee session';
  exception when raise_exception then
    assert sqlerrm = 'CALL_NOT_ALLOWED', sqlerrm;
  end;

  provision := public.call_prepare_admission(caller, target, caller_session);
  assert provision->>'readiness' = 'provisioning' and provision->>'admission_id' is null;
  snapshot := public.call_prepare_admission(callee, target, callee_session);
  assert snapshot->>'readiness' = 'provisioning' and snapshot->>'operation_id' is null,
    'A second request received ownership of the in-flight operation';
  epoch := (provision->>'epoch')::bigint;
  snapshot := public.call_finalize_provisioning(target, (provision->>'operation_id')::uuid, epoch, 'RM_PHASE1_TEST');
  assert snapshot->>'roomSid' = 'RM_PHASE1_TEST' and snapshot->>'roomGeneration' = '2';

  first_lease := public.call_prepare_admission(caller, target, caller_session);
  second_lease := public.call_prepare_admission(caller, target, caller_session);
  assert first_lease->>'admission_id' is not null and second_lease->>'admission_id' is not null;
  assert first_lease->>'admission_id' <> second_lease->>'admission_id', 'Admission leases collided';
  signed_at := floor(extract(epoch from clock_timestamp()))::bigint;
  assert (public.call_finalize_admission(caller, target, caller_session,
    (first_lease->>'admission_id')::uuid, epoch, signed_at, signed_at + 300)->>'authorized')::boolean;
  reset role;

  update auth.users set raw_app_meta_data = '{"must_change_password":true}' where id = callee;
  set local role service_role;
  assert not (public.call_finalize_admission(caller, target, caller_session,
    (second_lease->>'admission_id')::uuid, epoch, signed_at, signed_at + 300)->>'authorized')::boolean;
  snapshot := public.call_transition(callee, target, 'end', gen_random_uuid(), callee_session);
  assert snapshot #>> '{call,status}' = 'ended' and snapshot #>> '{call,endReason}' = 'hangup';
  assert snapshot #>> '{call,connectedAt}' is null;
  assert not (public.call_finalize_admission(caller, target, caller_session,
    (first_lease->>'admission_id')::uuid, epoch, signed_at, signed_at + 300)->>'authorized')::boolean;
  reset role;
  assert not exists (select 1 from private.call_user_reservations where call_id = target);
  assert (select max_finalized_nbf from private.call_jobs where diagnostic_call_id = target and kind = 'cleanup') = signed_at;

  set local role service_role;
  select claim into worker_job from jsonb_array_elements(public.call_worker_tick(50)) claim
    where claim->>'call_id' = target::text;
  assert worker_job->>'kind' = 'cleanup';
  reset role;
  update private.call_jobs set lease_expires_at = clock_timestamp() - interval '1 second'
    where job_id = (worker_job->>'job_id')::uuid;
  set local role service_role;
  select claim into replacement from jsonb_array_elements(public.call_worker_tick(50)) claim
    where claim->>'job_id' = worker_job->>'job_id';
  assert replacement->>'lease_id' is not null and replacement->>'lease_id' <> worker_job->>'lease_id';
  assert not (public.call_complete_cleanup((worker_job->>'lease_id')::uuid, 'confirmed')->>'applied')::boolean;
  assert public.call_complete_cleanup((replacement->>'lease_id')::uuid, 'retryable', 'timeout')->>'state' = 'pending';
  reset role;

  update auth.users set raw_app_meta_data = '{}' where id = callee;
  set local role service_role;
  snapshot := public.call_create(caller, chat, 'video', gen_random_uuid(), caller_session);
  target := (snapshot #>> '{call,callId}')::uuid;
  assert public.call_transition(callee, target, 'decline', gen_random_uuid(), callee_session)
    #>> '{call,status}' = 'declined';

  snapshot := public.call_create(caller, chat, 'voice', gen_random_uuid(), caller_session);
  target := (snapshot #>> '{call,callId}')::uuid;
  reset role;
  update public.calls set created_at = clock_timestamp() - interval '31 seconds',
    ring_expires_at = clock_timestamp() - interval '1 second' where call_id = target;
  set local role service_role;
  begin
    perform public.call_transition(callee, target, 'accept', gen_random_uuid(), callee_session);
    raise exception 'Accept after the cutoff succeeded';
  exception when raise_exception then
    assert sqlerrm = 'CALL_EXPIRED', sqlerrm;
  end;
  perform public.call_worker_tick(50);
  assert public.call_snapshot(caller, caller_session, target) #>> '{call,status}' = 'missed';
  reset role;
  update private.call_settings set missed_streak_limit = 1;
  set local role service_role;
  begin
    perform public.call_create(caller, chat, 'voice', gen_random_uuid(), caller_session);
    raise exception 'Missed-call cooldown allowed create';
  exception when raise_exception then
    assert sqlerrm = 'CALL_RATE_LIMITED', sqlerrm;
  end;
  reset role;
  update private.call_settings set missed_streak_limit = 3, create_limit = 4;

  set local role service_role;
  snapshot := public.call_create(caller, chat, 'voice', gen_random_uuid(), caller_session);
  target := (snapshot #>> '{call,callId}')::uuid;
  perform public.call_transition(callee, target, 'accept', gen_random_uuid(), callee_session);
  provision := public.call_prepare_admission(caller, target, caller_session);
  epoch := (provision->>'epoch')::bigint;
  perform public.call_finalize_provisioning(target, (provision->>'operation_id')::uuid, epoch, 'RM_PHASE1_CONNECTED');
  select claim into worker_job from jsonb_array_elements(public.call_worker_tick(50)) claim
    where claim->>'call_id' = target::text;
  assert worker_job->>'kind' = 'reconcile';
  observed := jsonb_build_object('result', 'present', 'observed_at', clock_timestamp(),
    'room_sid', worker_job->>'room_sid', 'participants', jsonb_build_array(
      jsonb_build_object('identity', worker_job->>'caller_identity', 'participant_sid', 'PA_CALLER'),
      jsonb_build_object('identity', worker_job->>'callee_identity', 'participant_sid', 'PA_CALLEE')
    ));
  assert (public.call_reconcile(target, (worker_job->>'lease_id')::uuid, epoch, 2, observed)->>'applied')::boolean;
  assert public.call_snapshot(caller, caller_session, target) #>> '{call,status}' = 'in_progress';
  assert not (public.call_reconcile(target, (worker_job->>'lease_id')::uuid, epoch, 2, observed)->>'applied')::boolean;
  reset role;
  assert (select count(*) from public.call_participants
    where call_id = target and connected and connection_generation = 1) = 2;

  update public.calls set created_at = clock_timestamp() - interval '40 minutes',
    ring_expires_at = clock_timestamp() - interval '39 minutes',
    accepted_at = clock_timestamp() - interval '39 minutes',
    connect_expires_at = clock_timestamp() - interval '38 minutes',
    connected_at = clock_timestamp() - interval '38 minutes' where call_id = target;
  set local role service_role;
  perform public.call_worker_tick(50);
  assert public.call_snapshot(caller, caller_session, target) #>> '{call,endReason}' = 'max_duration';
  begin
    perform public.call_create(caller, chat, 'voice', gen_random_uuid(), caller_session);
    raise exception 'Create rate limit allowed one extra attempt';
  exception when raise_exception then
    assert sqlerrm = 'CALL_RATE_LIMITED', sqlerrm;
  end;
  reset role;
  update private.call_settings set create_limit = 100;

  set local role service_role;
  snapshot := public.call_create(caller, chat, 'voice', gen_random_uuid(), caller_session);
  target := (snapshot #>> '{call,callId}')::uuid;
  perform public.call_transition(callee, target, 'accept', gen_random_uuid(), callee_session);
  provision := public.call_prepare_admission(caller, target, caller_session);
  epoch := (provision->>'epoch')::bigint;
  reset role;
  -- The existing direct-key trigger treats a remaining member as a Saved Messages chat.
  delete from public.chats where direct_key = caller::text and created_by = caller;
  delete from public.chat_members where chat_id = chat and user_id = callee;
  set local role authenticated;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', callee, 'role', 'authenticated')::text, true);
  assert not exists (select 1 from public.calls where call_id = target), 'Former member still sees history';
  reset role;
  set local role service_role;
  perform public.call_worker_tick(50);
  assert public.call_snapshot(caller, caller_session, target) #>> '{call,endReason}' = 'access_lost';
  reset role;
  delete from public.chats where chat_id = chat;
  assert not exists (select 1 from public.calls where call_id = target);
  assert (select count(*) from private.call_jobs where diagnostic_call_id = target and kind = 'cleanup') = 1;
  assert (select outstanding_operation_id from private.call_jobs
    where diagnostic_call_id = target and kind = 'cleanup') = (provision->>'operation_id')::uuid;
  set local role service_role;
  snapshot := public.call_finalize_provisioning(target, (provision->>'operation_id')::uuid, epoch, 'RM_PHASE1_LATE');
  assert snapshot->>'roomSid' is null;
  reset role;
  assert exists (select 1 from private.call_jobs where diagnostic_call_id = target and kind = 'cleanup'
    and room_sid = 'RM_PHASE1_LATE' and state = 'pending' and lease_id is null);
end;
$$;

select 'Phase 1 SQL role, lifecycle, fencing, lease recovery and cascade assertions passed' as result;
rollback;
