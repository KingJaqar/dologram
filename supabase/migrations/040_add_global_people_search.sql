-- Allow authenticated discovery without making full profiles globally readable.
-- Blocking is currently an account-local chat preference, applied by the client.
create function public.search_people(p_query text)
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

revoke all on function public.search_people(text) from public, anon, service_role;
grant execute on function public.search_people(text) to authenticated;
