-- Run on a migrated test database with three profiles and two users with no shared chats.
-- All chats and messages created by this test are rolled back.
begin;

do $$
declare
  sender uuid;
  recipient uuid;
  outsider uuid;
begin
  select a.user_id, b.user_id into sender, recipient
  from public.profiles a cross join public.profiles b
  where a.user_id < b.user_id and not exists (
    select 1 from public.chat_members mine join public.chat_members theirs using (chat_id)
    where mine.user_id = a.user_id and theirs.user_id = b.user_id
  ) limit 1;
  select user_id into outsider from public.profiles where user_id not in (sender, recipient) limit 1;
  if outsider is null then raise exception 'Test requires three profiles and an unrelated pair'; end if;
  perform set_config('test.sender', sender::text, true);
  perform set_config('test.recipient', recipient::text, true);
  perform set_config('test.outsider', outsider::text, true);
  perform set_config('test.chat', gen_random_uuid()::text, true);
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.sender'), true);

do $$
declare
  target uuid := current_setting('test.chat')::uuid;
  recipient uuid := current_setting('test.recipient')::uuid;
  saved uuid;
  failed_chat uuid := gen_random_uuid();
  helper regprocedure;
begin
  -- Migration 035 revoked these permissions, causing chat opening to fail with 42501.
  -- Migration 039 restores only the policy helpers, preserving private memo restrictions.
  foreach helper in array array[
    'private.is_chat_member(uuid,uuid)'::regprocedure,
    'private.is_chat_owner(uuid,uuid)'::regprocedure,
    'private.can_add_chat_member(uuid,uuid,text)'::regprocedure,
    'private.can_read_profile(uuid)'::regprocedure
  ] loop
    if not has_function_privilege(current_user, helper, 'EXECUTE') then
      raise exception 'Missing direct-chat policy permission: %', helper;
    end if;
    if has_function_privilege('anon', helper, 'EXECUTE') then
      raise exception 'Anonymous policy helper access was broadened: %', helper;
    end if;
  end loop;
  if exists (select 1 from public.profiles where user_id = recipient) then
    raise exception 'Test pair is already connected or full profile privacy was broadened';
  end if;
  saved := public.open_direct_chat(auth.uid(), gen_random_uuid());
  if public.open_direct_chat(recipient, target) <> target then
    raise exception 'Pair creation failed with Saved Messages already present';
  end if;
  if public.open_direct_chat(auth.uid(), gen_random_uuid()) <> saved
    or (select count(*) from public.chat_members where chat_id = saved) <> 1 then
    raise exception 'Saved Messages changed while creating a pair';
  end if;
  if public.open_direct_chat(recipient, gen_random_uuid()) <> target then
    raise exception 'Repeated opening created a duplicate direct chat';
  end if;
  begin
    perform public.open_direct_chat(gen_random_uuid(), failed_chat);
    raise exception 'Accepted a missing recipient';
  exception when foreign_key_violation then null;
  end;
  if exists (select 1 from public.chats where chat_id = failed_chat) then
    raise exception 'Failed creation left a partial chat';
  end if;
  insert into public.messages (chat_id, sender_id, content) values (target, auth.uid(), 'From A');
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test.recipient'), true);
do $$
declare
  target uuid := current_setting('test.chat')::uuid;
begin
  if public.open_direct_chat(current_setting('test.sender')::uuid, gen_random_uuid()) <> target
    or (select count(*) from public.chat_members where chat_id = target) <> 2
    or not exists (select 1 from public.messages where chat_id = target and content = 'From A') then
    raise exception 'Second account could not reopen or read the same chat';
  end if;
  insert into public.messages (chat_id, sender_id, content) values (target, auth.uid(), 'From B');
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test.sender'), true);
do $$
begin
  if not exists (select 1 from public.messages where chat_id = current_setting('test.chat')::uuid and content = 'From B') then
    raise exception 'First account could not read the reply';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test.outsider'), true);
do $$
begin
  if exists (select 1 from public.chats where chat_id = current_setting('test.chat')::uuid) then
    raise exception 'An outsider could read the direct chat';
  end if;
  if exists (select 1 from public.messages where chat_id = current_setting('test.chat')::uuid)
    or exists (select 1 from public.chat_members where chat_id = current_setting('test.chat')::uuid) then
    raise exception 'An outsider could read direct-chat messages or memberships';
  end if;
  begin
    insert into public.messages (chat_id, sender_id, content)
      values (current_setting('test.chat')::uuid, auth.uid(), 'Not a member');
    raise exception 'An outsider could send a message to the direct chat';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select 'Unconnected users can open a chat and exchange messages; outsider access denied' as result;
rollback;
