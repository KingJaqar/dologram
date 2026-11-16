-- Run against an isolated database after migrations through 038, with at least three profiles.
-- The transaction rolls back fixture data; the pg_cron registration itself is migration state.
begin;

do $$
declare
  sender uuid;
  reader uuid;
  third_member uuid;
begin
  select a.user_id, b.user_id, c.user_id
    into sender, reader, third_member
    from public.profiles a
    cross join public.profiles b
    cross join public.profiles c
   where a.user_id < b.user_id and b.user_id < c.user_id
   limit 1;

  if sender is null or reader is null or third_member is null then
    raise exception 'Read receipt tests require at least three profiles';
  end if;

  perform set_config('test.sender', sender::text, true);
  perform set_config('test.reader', reader::text, true);
  perform set_config('test.third_member', third_member::text, true);
  perform set_config('test.chat', gen_random_uuid()::text, true);
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.sender'), true);

do $$
declare
  target_chat uuid := current_setting('test.chat')::uuid;
  first_message uuid;
  first_seq bigint;
begin
  insert into public.chats (chat_id, type, title, created_by)
  values (target_chat, 'group', 'Read receipt regression', auth.uid());
  insert into public.chat_members (chat_id, user_id, role)
  values (target_chat, auth.uid(), 'owner');
  insert into public.chat_members (chat_id, user_id, role)
  values (target_chat, current_setting('test.reader')::uuid, 'member');
  insert into public.messages (chat_id, sender_id, content)
  values (target_chat, auth.uid(), 'first')
  returning message_id, seq into first_message, first_seq;

  perform set_config('test.first_message', first_message::text, true);
  perform set_config('test.first_seq', first_seq::text, true);
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test.reader'), true);

do $$
declare
  target_chat uuid := current_setting('test.chat')::uuid;
  joined_at timestamptz;
begin
  select cm.joined_at into joined_at
    from public.chat_members cm
   where cm.chat_id = target_chat and cm.user_id = auth.uid();
  perform public.mark_chat_read(target_chat, current_setting('test.first_seq')::bigint, joined_at);
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test.sender'), true);

do $$
declare
  details jsonb;
begin
  details := public.get_message_read_participants(
    current_setting('test.chat')::uuid,
    current_setting('test.first_message')::uuid
  );
  if details->>'state' <> 'available'
     or jsonb_array_length(details->'participants') <> 1
     or details#>>'{participants,0,user_id}' <> current_setting('test.reader')
     or details#>>'{participants,0,read_at}' is null then
    raise exception 'Available read roster is incorrect: %', details;
  end if;

  if public.get_my_read_privacy() <> 'everyone' then
    raise exception 'Missing privacy row did not default to everyone';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test.reader'), true);
select public.set_my_read_privacy('nobody');
select set_config('request.jwt.claim.sub', current_setting('test.sender'), true);

do $$
declare
  hidden_time_details jsonb;
begin
  hidden_time_details := public.get_message_read_participants(
    current_setting('test.chat')::uuid,
    current_setting('test.first_message')::uuid
  );
  if hidden_time_details->>'state' <> 'available'
     or hidden_time_details#>>'{participants,0,user_id}' <> current_setting('test.reader')
     or hidden_time_details#>'{participants,0,read_at}' <> 'null'::jsonb then
    raise exception 'Reader privacy did not retain identity with a null time: %', hidden_time_details;
  end if;

  perform public.set_my_read_privacy('nobody');
  hidden_time_details := public.get_message_read_participants(
    current_setting('test.chat')::uuid,
    current_setting('test.first_message')::uuid
  );
  if hidden_time_details#>'{participants,0,read_at}' <> 'null'::jsonb then
    raise exception 'Viewer reciprocity did not hide all exact times';
  end if;

  begin
    perform public.set_my_read_privacy('contacts');
    raise exception 'Invalid privacy value was accepted';
  exception when sqlstate 'DG422' then null;
  end;
end;
$$;

reset role;

do $$
declare
  cleanup_result jsonb;
begin
  if has_table_privilege('authenticated', 'public.message_read_receipts', 'SELECT')
     or has_table_privilege('authenticated', 'public.message_read_receipts', 'INSERT')
     or has_table_privilege('authenticated', 'public.user_read_privacy', 'SELECT')
     or has_table_privilege('authenticated', 'public.user_read_privacy', 'UPDATE') then
    raise exception 'Receipt or privacy table bypass remains available';
  end if;

  if not has_function_privilege('authenticated', 'public.get_message_read_participants(uuid,uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_my_read_privacy()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.set_my_read_privacy(text)', 'EXECUTE') then
    raise exception 'Required read-detail RPC grant is missing';
  end if;

  if has_function_privilege('authenticated', 'private.cleanup_message_read_receipts(integer,integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.configure_message_read_details(interval,integer,boolean)', 'EXECUTE') then
    raise exception 'Private maintenance function is client executable';
  end if;

  if not exists (
    select 1 from cron.job where jobname = 'dologram-read-receipt-cleanup'
  ) then
    raise exception 'Read receipt cleanup job is not registered';
  end if;

  if exists (
    select 1 from public.message_read_receipts r
     where r.message_id = current_setting('test.first_message')::uuid
       and r.user_id = current_setting('test.sender')::uuid
  ) then
    raise exception 'Sender self-receipt was collected';
  end if;

  perform private.configure_message_read_details(interval '7 days', 1, true);
  if public.get_message_read_participants(
       current_setting('test.chat')::uuid,
       current_setting('test.first_message')::uuid
     )->>'state' <> 'not_available_for_large_group' then
    raise exception 'Over-limit group details were exposed';
  end if;
  perform private.configure_message_read_details(interval '7 days', 2, true);
  if public.get_message_read_participants(
       current_setting('test.chat')::uuid,
       current_setting('test.first_message')::uuid
     )->>'state' <> 'available' then
    raise exception 'Inclusive group threshold rejected the limit-sized group';
  end if;
  perform private.configure_message_read_details(interval '7 days', 100, true);

  -- A missing required receipt must fail closed instead of appearing as an empty roster.
  delete from public.message_read_receipts
   where message_id = current_setting('test.first_message')::uuid;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.sender'), true);

do $$
begin
  if public.get_message_read_participants(
       current_setting('test.chat')::uuid,
       current_setting('test.first_message')::uuid
     )->>'state' <> 'not_recorded' then
    raise exception 'A receipt coverage gap appeared complete';
  end if;
end;
$$;

reset role;

do $$
declare
  cleanup_result jsonb;
begin

  -- Recollect, then shorten, clean, and extend. The durable window must prevent revival.
  update public.chat_members
     set last_read_seq = 0
   where chat_id = current_setting('test.chat')::uuid
     and user_id = current_setting('test.reader')::uuid;
  -- The monotonic trigger prevents lowering. Restore the missing receipt through the private
  -- collector to model the same eligible range without fabricating a timestamp from a cursor.
  perform private.collect_message_read_receipts(
    current_setting('test.chat')::uuid,
    current_setting('test.reader')::uuid,
    0,
    current_setting('test.first_seq')::bigint
  );
  perform private.configure_message_read_details(interval '1 microsecond', 100, true);
  cleanup_result := private.cleanup_message_read_receipts(1000, 10);
  if cleanup_result->>'state' <> 'complete' then
    raise exception 'First cleanup did not complete: %', cleanup_result;
  end if;
  cleanup_result := private.cleanup_message_read_receipts(1000, 10);
  if cleanup_result->>'state' <> 'complete' then
    raise exception 'Repeated cleanup did not complete: %', cleanup_result;
  end if;
  perform private.configure_message_read_details(interval '7 days', 100, true);

  if not exists (
       select 1 from private.message_read_detail_windows w
        where w.message_id = current_setting('test.first_message')::uuid
     )
     or exists (
       select 1 from public.message_read_receipts r
        where r.message_id = current_setting('test.first_message')::uuid
     ) then
    raise exception 'Cleanup did not retain only the durable collection window';
  end if;

  perform private.collect_message_read_receipts(
    current_setting('test.chat')::uuid,
    current_setting('test.reader')::uuid,
    0,
    current_setting('test.first_seq')::bigint
  );
  if exists (
    select 1 from public.message_read_receipts r
     where r.message_id = current_setting('test.first_message')::uuid
  ) then
    raise exception 'Retention increase revived an expired collected detail';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.sender'), true);

do $$
begin
  if public.get_message_read_participants(
       current_setting('test.chat')::uuid,
       current_setting('test.first_message')::uuid
     )->>'state' <> 'expired' then
    raise exception 'Durable expired window was not authoritative';
  end if;
end;
$$;

reset role;

-- Inject a receipt failure and prove the member cursor update rolls back with it.
do $$
declare
  cursor_before text;
begin
  perform private.configure_message_read_details(interval '7 days', 100, true);
  insert into public.messages (chat_id, sender_id, content)
  values (
    current_setting('test.chat')::uuid,
    current_setting('test.sender')::uuid,
    'rollback probe'
  );

  select cm.last_read_seq::text
    into strict cursor_before
    from public.chat_members cm
   where cm.chat_id = current_setting('test.chat')::uuid
     and cm.user_id = current_setting('test.reader')::uuid;
  perform set_config('test.cursor_before', cursor_before, true);
end;
$$;

create function pg_temp.reject_receipt() returns trigger language plpgsql as $body$
  begin
    raise exception 'injected receipt failure';
  end;
$body$;

create trigger reject_receipt before insert on public.message_read_receipts
for each row execute function pg_temp.reject_receipt();

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.reader'), true);

do $$
begin
  begin
    perform public.mark_chat_read(
      current_setting('test.chat')::uuid,
      9007199254740991,
      (select cm.joined_at from public.chat_members cm
        where cm.chat_id = current_setting('test.chat')::uuid and cm.user_id = auth.uid())
    );
    raise exception 'Injected receipt failure did not abort the cursor update';
  exception when others then
    if sqlerrm = 'Injected receipt failure did not abort the cursor update' then
      raise;
    end if;
  end;
end;
$$;

reset role;

do $$
declare
  cursor_after bigint;
begin
  select cm.last_read_seq into cursor_after
    from public.chat_members cm
   where cm.chat_id = current_setting('test.chat')::uuid
     and cm.user_id = current_setting('test.reader')::uuid;
  if cursor_after <> current_setting('test.cursor_before')::bigint then
    raise exception 'Cursor advanced despite receipt failure';
  end if;
end;
$$;

drop trigger reject_receipt on public.message_read_receipts;

-- A legacy direct UPDATE must use the same collection trigger, and deleted messages must hide
-- details immediately without changing the aggregate cursor.
do $$
declare
  legacy_message uuid;
  legacy_seq bigint;
begin
  insert into public.messages (chat_id, sender_id, content)
  values (
    current_setting('test.chat')::uuid,
    current_setting('test.sender')::uuid,
    'legacy update probe'
  ) returning message_id, seq into legacy_message, legacy_seq;
  perform set_config('test.legacy_message', legacy_message::text, true);
  perform set_config('test.legacy_seq', legacy_seq::text, true);
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.reader'), true);
update public.chat_members
   set last_read_seq = current_setting('test.legacy_seq')::bigint
 where chat_id = current_setting('test.chat')::uuid
   and user_id = auth.uid();

select set_config('request.jwt.claim.sub', current_setting('test.sender'), true);
do $$
begin
  if public.get_message_read_participants(
       current_setting('test.chat')::uuid,
       current_setting('test.legacy_message')::uuid
     )->>'state' <> 'available' then
    raise exception 'Legacy cursor update did not collect complete details';
  end if;

  update public.messages
     set deleted_at = clock_timestamp()
   where message_id = current_setting('test.legacy_message')::uuid;
  if public.get_message_read_participants(
       current_setting('test.chat')::uuid,
       current_setting('test.legacy_message')::uuid
     )->>'state' <> 'not_found' then
    raise exception 'Deleted message details remained visible';
  end if;
end;
$$;

reset role;

-- Exercise the same query contract for a direct chat.
do $$
declare
  direct_chat uuid := gen_random_uuid();
  direct_message uuid;
  direct_seq bigint;
begin
  insert into public.chats (chat_id, type, title, created_by)
  values (direct_chat, 'direct', null, current_setting('test.sender')::uuid);
  insert into public.chat_members (chat_id, user_id, role)
  values
    (direct_chat, current_setting('test.sender')::uuid, 'owner'),
    (direct_chat, current_setting('test.reader')::uuid, 'member');
  insert into public.messages (chat_id, sender_id, content)
  values (direct_chat, current_setting('test.sender')::uuid, 'direct probe')
  returning message_id, seq into direct_message, direct_seq;
  perform set_config('test.direct_chat', direct_chat::text, true);
  perform set_config('test.direct_message', direct_message::text, true);
  perform set_config('test.direct_seq', direct_seq::text, true);
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.reader'), true);
select public.mark_chat_read(
  current_setting('test.direct_chat')::uuid,
  current_setting('test.direct_seq')::bigint,
  (select cm.joined_at from public.chat_members cm
    where cm.chat_id = current_setting('test.direct_chat')::uuid and cm.user_id = auth.uid())
);

select set_config('request.jwt.claim.sub', current_setting('test.sender'), true);
do $$
begin
  if public.get_message_read_participants(
       current_setting('test.direct_chat')::uuid,
       current_setting('test.direct_message')::uuid
     )->>'state' <> 'available' then
    raise exception 'Direct-chat exact read time was unavailable';
  end if;
end;
$$;

reset role;

select 'read receipt regression checks passed' as result;
rollback;
