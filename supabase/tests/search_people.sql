-- Run as the database owner against a migrated test database with two unrelated profiles.
-- All fixture edits are rolled back.
begin;
do $$
declare
  caller uuid;
  stranger uuid;
begin
  select a.user_id, b.user_id into caller, stranger
  from public.profiles a cross join public.profiles b
  where a.user_id <> b.user_id and not exists (
    select 1 from public.chat_members x join public.chat_members y using (chat_id)
    where x.user_id = a.user_id and y.user_id = b.user_id
  ) limit 1;
  if stranger is null then raise exception 'Requires two unrelated profiles'; end if;
  update public.profiles set username = 'dg_search_7x', display_name = 'Discovery Stranger 7x'
    where user_id = stranger;
  perform set_config('request.jwt.claim.sub', caller::text, true);
  perform set_config('test.search_target', stranger::text, true);
end;
$$;

set local role authenticated;
do $$
declare
  query text;
begin
  foreach query in array array['DG_SEARCH_7X', 'g_search', 'DISCOVERY STRANGER 7X', 'sTrAnGeR', '@dg_search_7x'] loop
    if not exists (select 1 from public.search_people(query)
      where user_id = current_setting('test.search_target')::uuid) then
      raise exception 'Unrelated user missing for query %', query;
    end if;
  end loop;
  if exists (select 1 from public.search_people(''))
    or exists (select 1 from public.search_people('   '))
    or exists (select 1 from public.search_people(null)) then
    raise exception 'Empty query returned profiles';
  end if;
  if exists (select 1 from public.search_people('%')
    where user_id = current_setting('test.search_target')::uuid) then
    raise exception 'Percent was treated as a wildcard';
  end if;
  if exists (select 1 from public.profiles where user_id = current_setting('test.search_target')::uuid) then
    raise exception 'Full profile RLS was broadened';
  end if;
  if has_function_privilege('anon', 'public.search_people(text)', 'EXECUTE') then
    raise exception 'Anonymous search must remain forbidden';
  end if;
end;
$$;
-- Even an authenticated role without a caller claim must receive no results.
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  if exists (select 1 from public.search_people('dg_search')) then
    raise exception 'Search without an authenticated identity returned results';
  end if;
end;
$$;
rollback;
