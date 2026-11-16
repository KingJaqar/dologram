-- 035 revoked EXECUTE on every private function while securing memo internals.
-- Restore only the pre-existing RLS helpers needed by authenticated clients.
-- These remain private implementation details, with their existing caller checks.
grant usage on schema private to authenticated;
grant execute on function private.can_read_profile(uuid) to authenticated;
grant execute on function private.is_chat_member(uuid, uuid) to authenticated;
grant execute on function private.is_chat_owner(uuid, uuid) to authenticated;
grant execute on function private.can_add_chat_member(uuid, uuid, text) to authenticated;
grant execute on function private.call_is_current_participant(uuid, uuid) to authenticated;
