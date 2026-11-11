-- Run against a migrated database with at least three profiles and an unused
-- direct-chat pair. All test writes are rolled back, including on assertion failure.
begin;

do $$
declare
  owner_id uuid;
  other_id uuid;
  outsider_id uuid;
begin
  select a.user_id, b.user_id into owner_id, other_id
  from public.profiles a cross join public.profiles b
  where a.user_id < b.user_id
    and not exists (
      select 1 from public.chats c
      where c.direct_key = a.user_id::text || ':' || b.user_id::text
    )
  limit 1;
  select user_id into outsider_id from public.profiles
  where user_id not in (owner_id, other_id) limit 1;
  if owner_id is null or outsider_id is null then
    raise exception 'Test requires three profiles and an unused direct-chat pair';
  end if;
  perform set_config('test.owner_id', owner_id::text, true);
  perform set_config('test.other_id', other_id::text, true);
  perform set_config('test.outsider_id', outsider_id::text, true);
  perform set_config('test.chat_id', gen_random_uuid()::text, true);
  perform set_config('test.group_id', gen_random_uuid()::text, true);
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.owner_id'), true);

do $$
declare
  target uuid := current_setting('test.chat_id')::uuid;
  returned_id uuid;
begin
  -- Match createChat/insertMember, including their RETURNING/SELECT requests.
  insert into public.chats(chat_id, type, title, created_by)
  values (target, 'direct', null, auth.uid()) returning chat_id into returned_id;
  insert into public.chat_members(chat_id, user_id, role)
  values (target, auth.uid(), 'owner') returning user_id into returned_id;
  insert into public.chat_members(chat_id, user_id, role)
  values (target, current_setting('test.other_id')::uuid, 'member')
  returning user_id into returned_id;
  if (select count(*) from public.chat_members where chat_id = target) <> 2
    or (select direct_key from public.chats where chat_id = target)
       is distinct from current_setting('test.owner_id') || ':' || current_setting('test.other_id') then
    raise exception 'Direct-chat creation did not complete';
  end if;
  begin
    insert into public.chat_members(chat_id, user_id, role)
    values (target, current_setting('test.outsider_id')::uuid, 'member');
    raise exception 'A direct chat accepted a third member';
  exception when insufficient_privilege then null;
  end;

  insert into public.chats(chat_id, type, title, created_by)
  values (current_setting('test.group_id')::uuid, 'group', 'RLS regression', auth.uid());
  insert into public.chat_members(chat_id, user_id, role)
  values (current_setting('test.group_id')::uuid, auth.uid(), 'owner');
  insert into public.chat_members(chat_id, user_id, role)
  values (current_setting('test.group_id')::uuid, current_setting('test.other_id')::uuid, 'member');
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test.other_id'), true);
do $$
begin
  if (select count(*) from public.chat_members
      where chat_id = current_setting('test.chat_id')::uuid) <> 2 then
    raise exception 'Recipient cannot read the direct-chat members';
  end if;
  begin
    insert into public.chat_members(chat_id, user_id, role)
    values (current_setting('test.group_id')::uuid, current_setting('test.outsider_id')::uuid, 'member');
    raise exception 'A non-owner added a group member';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test.outsider_id'), true);
do $$
begin
  if exists (select 1 from public.chats where chat_id = current_setting('test.chat_id')::uuid)
    or exists (select 1 from public.chat_members where chat_id = current_setting('test.chat_id')::uuid) then
    raise exception 'An outsider can read the direct chat';
  end if;
  begin
    insert into public.chat_members(chat_id, user_id, role)
    values (current_setting('test.group_id')::uuid, auth.uid(), 'owner');
    raise exception 'An outsider claimed ownership';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  if private.can_add_chat_member(current_setting('test.group_id')::uuid,
      current_setting('test.outsider_id')::uuid, 'member') then
    raise exception 'The lookup authorized a caller without a user identity';
  end if;
end;
$$;

select 'chat membership regression checks passed' as result;
rollback;
