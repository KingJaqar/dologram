-- Run against a migrated isolated database with at least three profiles.
-- All writes are rolled back. The test exercises the authenticated PostgREST-compatible paths.
begin;

do $$
declare
  sender uuid;
  recipient uuid;
  outsider uuid;
begin
  select a.user_id, b.user_id
    into sender, recipient
    from public.profiles a
    cross join public.profiles b
   where a.user_id < b.user_id
     and not exists (
       select 1
         from public.chats c
        where c.direct_key = a.user_id::text || ':' || b.user_id::text
     )
   limit 1;

  select p.user_id
    into outsider
    from public.profiles p
   where p.user_id not in (sender, recipient)
   limit 1;

  if sender is null or recipient is null or outsider is null then
    raise exception 'Test requires three profiles and an unused direct-chat pair';
  end if;

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
  target_chat_id uuid := current_setting('test.chat')::uuid;
  first_seq bigint;
  second_seq bigint;
  sender_joined_at timestamptz;
  recipient_joined_at timestamptz;
  returned public.chat_members;
  snapshot jsonb;
begin
  insert into public.chats(chat_id, type, title, created_by)
  values (target_chat_id, 'group', 'Read state regression', auth.uid());
  insert into public.chat_members(chat_id, user_id, role)
  values (target_chat_id, auth.uid(), 'owner')
  returning joined_at into sender_joined_at;
  insert into public.chat_members(chat_id, user_id, role)
  values (target_chat_id, current_setting('test.recipient')::uuid, 'member')
  returning joined_at into recipient_joined_at;

  insert into public.messages(chat_id, sender_id, content)
  values (target_chat_id, auth.uid(), 'first')
  returning seq into first_seq;
  insert into public.messages(chat_id, sender_id, content)
  values (target_chat_id, auth.uid(), 'second')
  returning seq into second_seq;

  if second_seq <= first_seq then
    raise exception 'Message sequences are not increasing';
  end if;

  select * into returned
    from public.mark_chat_read(target_chat_id, 9007199254740991, sender_joined_at);
  if returned.last_read_seq <> second_seq then
    raise exception 'RPC did not clamp to the highest stored sequence';
  end if;

  select * into returned
    from public.mark_chat_read(target_chat_id, first_seq, sender_joined_at);
  if returned.last_read_seq <> second_seq then
    raise exception 'RPC lowered a read cursor';
  end if;

  update public.chat_members as cm
     set last_read_seq = 9007199254740991
   where cm.chat_id = target_chat_id and cm.user_id = auth.uid();
  if (select cm.last_read_seq from public.chat_members cm where cm.chat_id = target_chat_id and cm.user_id = auth.uid()) <> second_seq then
    raise exception 'Legacy direct update did not clamp to history';
  end if;

  begin
    perform public.mark_chat_read(target_chat_id, 0, sender_joined_at + interval '1 second');
    raise exception 'Membership generation race was accepted';
  exception when sqlstate 'DG409' then null;
  end;

  begin
    perform public.mark_chat_read(target_chat_id, -1, sender_joined_at);
    raise exception 'Negative read cursor was accepted';
  exception when sqlstate 'DG422' then null;
  end;

  snapshot := public.get_chat_member_snapshot(target_chat_id);
  if (snapshot->>'total_count')::bigint <> 2
     or jsonb_array_length(snapshot->'members') <> 2
     or not exists (
       select 1
         from jsonb_array_elements(snapshot->'members') row_data
        where row_data->>'user_id' = auth.uid()::text
     ) then
    raise exception 'Complete member snapshot contract failed';
  end if;

  if has_table_privilege('authenticated', 'public.chat_members', 'UPDATE') then
    raise exception 'Authenticated table-wide UPDATE remains granted';
  end if;
  if not has_column_privilege('authenticated', 'public.chat_members', 'last_read_seq', 'UPDATE')
     or has_column_privilege('authenticated', 'public.chat_members', 'role', 'UPDATE')
     or has_column_privilege('authenticated', 'public.chat_members', 'joined_at', 'INSERT') then
    raise exception 'Chat-member column privileges are not narrowed';
  end if;
  if not has_function_privilege('authenticated', 'public.mark_chat_read(uuid,bigint,timestamptz)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_chat_member_snapshot(uuid)', 'EXECUTE') then
    raise exception 'Read-state RPC grants are missing';
  end if;
  if not has_function_privilege('authenticated', 'private.is_chat_member(uuid,uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'private.is_chat_owner(uuid,uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'private.can_read_profile(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'private.can_add_chat_member(uuid,uuid,text)', 'EXECUTE') then
    raise exception 'Existing private chat authorization grants are missing';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test.outsider'), true);

do $$
declare
  target_chat_id uuid := current_setting('test.chat')::uuid;
begin
  begin
    perform public.get_chat_member_snapshot(target_chat_id);
    raise exception 'Outsider received a member snapshot';
  exception when sqlstate 'DG403' then null;
  end;

  begin
    perform public.mark_chat_read(target_chat_id, 1, now());
    raise exception 'Outsider advanced a read cursor';
  exception when sqlstate 'DG403' then null;
  end;
end;
$$;

select 'read-state regression checks passed' as result;
rollback;
