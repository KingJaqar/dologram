-- Disposable migrated database only; never mutate real accounts to test promotion.
-- The runner must explicitly identify its isolated target and seed an ordinary profile.
begin;
set local statement_timeout = '15s';

do $$
begin
  if current_setting('dologram.test_target', true) is distinct from 'profile-roles-disposable' then
    raise exception 'Profile role tests require an explicitly isolated database';
  end if;
  if not exists (select 1 from public.profiles where roles = 'user') then
    raise exception 'Profile role tests require an ordinary fixture profile';
  end if;
end;
$$;

create temporary table profile_roles_baseline as
select user_id, to_jsonb(p) - 'roles' as original_row
from public.profiles p where roles = 'user' order by user_id limit 1;
grant select on profile_roles_baseline to authenticated;

select set_config('request.jwt.claim.sub', user_id::text, true) from profile_roles_baseline;
set local role authenticated;

do $$
begin
  update public.profiles set display_name = display_name where user_id = auth.uid();
  if not found then raise exception 'Normal user profile access was broken'; end if;
  begin
    update public.profiles set roles = 'admin' where user_id = auth.uid();
    raise exception 'Client self-promotion was permitted';
  exception when insufficient_privilege then null;
  end;
  -- Caller-controlled claims must not turn an authenticated SQL role into a trusted operator.
  perform set_config('request.jwt.claim.role', 'service_role', true);
  begin
    update public.profiles set roles = 'admin' where user_id = auth.uid();
    raise exception 'Spoofed claim allowed self-promotion';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
update public.profiles set roles = 'admin'
where user_id in (select user_id from profile_roles_baseline);
set local role authenticated;

do $$
begin
  if not exists (select 1 from public.profiles where user_id = auth.uid() and roles = 'admin') then
    raise exception 'Admin lost normal own-profile visibility';
  end if;
  update public.profiles set display_name = display_name where user_id = auth.uid();
  if not found then raise exception 'Admin lost normal profile-edit access'; end if;
  begin
    update public.profiles set roles = 'user' where user_id = auth.uid();
    raise exception 'Application admin could edit its role through a user session';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
do $$
begin
  if exists (
    select 1 from public.profiles p join profile_roles_baseline b using (user_id)
    where to_jsonb(p) - 'roles' is distinct from b.original_row
  ) then raise exception 'Promotion changed the existing account/profile identity or fields'; end if;
  begin
    update public.profiles set roles = 'owner' where user_id in (select user_id from profile_roles_baseline);
    raise exception 'Unexpected application role accepted';
  exception when check_violation then null;
  end;
  begin
    update public.profiles set roles = null where user_id in (select user_id from profile_roles_baseline);
    raise exception 'Null role accepted';
  exception when not_null_violation then null;
  end;
end;
$$;

update public.profiles set roles = 'user'
where user_id in (select user_id from profile_roles_baseline);
do $$
begin
  if exists (select 1 from public.profiles p join profile_roles_baseline b using (user_id) where p.roles <> 'user') then
    raise exception 'Trusted database demotion failed';
  end if;
  if has_function_privilege('authenticated', 'private.guard_profile_roles()', 'EXECUTE') then
    raise exception 'Trigger function has unnecessary client execute grant';
  end if;
end;
$$;

rollback;
