-- Application authorization is separate from Supabase's auth.users.role and
-- chat/memo membership roles. Promotion retains the same normal user account.
set lock_timeout = '5s';
set statement_timeout = '15s';

alter table public.profiles
  add column roles text not null default 'user',
  add constraint profiles_roles_check check (roles in ('user', 'admin'));

comment on column public.profiles.roles is
  'Application role: user or admin. Admin retains normal account access. Only trusted database roles may change this value.';

-- Existing authenticated clients can update their own profile. Keep that path,
-- but prevent them (including an application admin) from changing authorization.
-- SECURITY INVOKER is intentional: current_user must be the actual SQL role,
-- not the function owner or a caller-controlled JWT/metadata value.
create function private.guard_profile_roles()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if current_user not in ('postgres', 'supabase_admin', 'service_role') then
    if tg_op = 'INSERT' then
      if new.roles is distinct from 'user' then
        raise exception using errcode = '42501', message = 'PROFILE_ROLE_CHANGE_NOT_ALLOWED';
      end if;
    elsif new.roles is distinct from old.roles then
      raise exception using errcode = '42501', message = 'PROFILE_ROLE_CHANGE_NOT_ALLOWED';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.guard_profile_roles() from public, anon, authenticated, service_role;

create trigger profiles_guard_roles
before insert or update on public.profiles
for each row execute function private.guard_profile_roles();

-- Refresh the Data API column cache after the transaction commits.
notify pgrst, 'reload schema';

reset lock_timeout;
reset statement_timeout;
