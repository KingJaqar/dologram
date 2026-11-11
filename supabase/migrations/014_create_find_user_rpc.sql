-- Expose the exact username lookup used by the mobile New chat screen.
-- The profiles table is intentionally not broadly readable, so this function
-- performs the narrow lookup under the function owner and only for signed-in
-- callers.

create or replace function public.find_user(username text)
returns table (
  user_id uuid,
  display_name text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.id as user_id,
    p.display_name
  from public.profiles as p
  where auth.uid() is not null
    and lower(p.username) = lower($1)
  limit 1;
$$;

revoke all on function public.find_user(text) from public, anon, service_role;
grant execute on function public.find_user(text) to authenticated;

