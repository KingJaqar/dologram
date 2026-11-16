-- Disposable migrated database only; never run against a linked or shared target.
-- The runner must set `dologram.test_target = 'admin-audit-disposable'` in the same
-- session and apply migration 042 before this file.
begin;
set local statement_timeout = '15s';

do $$
begin
  if current_setting('dologram.test_target', true) is distinct from 'admin-audit-disposable' then
    raise exception 'Admin audit tests require an explicitly isolated database';
  end if;
  if to_regclass('private.admin_audit') is null then
    raise exception 'Admin audit migration 042 is not applied';
  end if;
end;
$$;

-- RLS is enabled with no policy, and client roles hold no table or sequence rights.
do $$
declare
  policies integer;
begin
  if not (select relrowsecurity from pg_class where oid = 'private.admin_audit'::regclass) then
    raise exception 'admin_audit does not enable row level security';
  end if;
  select count(*) into policies
  from pg_policies where schemaname = 'private' and tablename = 'admin_audit';
  if policies <> 0 then
    raise exception 'admin_audit must have no policies, found %', policies;
  end if;
  if not exists (select 1 from pg_indexes
    where schemaname = 'private' and tablename = 'admin_audit' and indexname = 'admin_audit_at_idx') then
    raise exception 'admin_audit_at_idx is missing';
  end if;
  if not exists (select 1 from pg_indexes
    where schemaname = 'private' and tablename = 'admin_audit' and indexname = 'admin_audit_event_idx') then
    raise exception 'admin_audit_event_idx is missing';
  end if;
  if has_table_privilege('anon', 'private.admin_audit', 'select')
    or has_table_privilege('anon', 'private.admin_audit', 'insert')
    or has_table_privilege('authenticated', 'private.admin_audit', 'select')
    or has_table_privilege('authenticated', 'private.admin_audit', 'insert')
    or has_table_privilege('authenticated', 'private.admin_audit', 'update')
    or has_table_privilege('authenticated', 'private.admin_audit', 'delete') then
    raise exception 'a client role holds admin_audit privileges';
  end if;
  if has_sequence_privilege('anon', 'private.admin_audit_id_seq', 'usage')
    or has_sequence_privilege('authenticated', 'private.admin_audit_id_seq', 'usage') then
    raise exception 'a client role can use the admin_audit identity sequence';
  end if;
end;
$$;

-- Trusted writes keep one row per event identity and preserve the actor UUID.
insert into private.admin_audit (event_id, actor_user_id, action, target_user_id, result, detail)
values ('50000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001',
  'session.unlock', null, 'success', '{}'::jsonb);
insert into private.admin_audit (event_id, actor_user_id, action, target_user_id, result, detail)
values ('50000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001',
  'session.unlock', null, 'success', '{}'::jsonb)
on conflict (event_id) do nothing;

do $$
declare
  inserted integer;
begin
  select count(*) into inserted from private.admin_audit
  where event_id = '50000000-0000-4000-8000-000000000005';
  if inserted <> 1 then
    raise exception 'reconciled audit event identity produced % rows', inserted;
  end if;
  if not exists (select 1 from private.admin_audit
    where event_id = '50000000-0000-4000-8000-000000000005'
      and actor_user_id = '10000000-0000-4000-8000-000000000001') then
    raise exception 'the authenticated actor UUID was not retained';
  end if;
end;
$$;

-- The result domain and object-only detail shape are enforced by the table itself.
do $$
begin
  begin
    insert into private.admin_audit (event_id, action, result)
    values (gen_random_uuid(), 'session.unlock', 'unknown');
    raise exception 'an invalid audit result was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into private.admin_audit (event_id, action, result, detail)
    values (gen_random_uuid(), 'session.unlock', 'success', '"text"'::jsonb);
    raise exception 'a non-object audit detail was accepted';
  exception when check_violation then null;
  end;
end;
$$;

-- A normal authenticated session cannot read or write the audit trail.
set local role authenticated;
do $$
begin
  begin
    perform count(*) from private.admin_audit;
    raise exception 'an authenticated session read admin_audit';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into private.admin_audit (event_id, action, result)
    values (gen_random_uuid(), 'session.unlock', 'success');
    raise exception 'an authenticated session wrote admin_audit';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

rollback;
