-- Supabase projects may have explicit default grants for API roles. Remove
-- those grants as well as PUBLIC so anonymous callers cannot invoke the RPC.

revoke all on function public.find_user(text) from public, anon, service_role;
grant execute on function public.find_user(text) to authenticated;
