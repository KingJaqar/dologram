-- Phase 1 concurrency test procedure.
--
-- Run this file in two isolated psql sessions at the same time after substituting the
-- same direct-chat id, caller/callee ids and two different request/session UUIDs. Both
-- sessions must use the service role and request.jwt.claim.role = service_role.
--
-- Expected result: exactly one session returns status=ringing and reserves both users;
-- the other returns a persisted status=failed/endReason=busy. No session may observe
-- two ringing calls or a reservation owned by another call. This two-session gate is
-- intentionally not faked with dblink or an unverified local harness.

begin;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

select public.call_create(
  :'caller_id'::uuid,
  :'chat_id'::uuid,
  'voice',
  :'request_id'::uuid,
  :'session_id'::uuid
);

commit;
