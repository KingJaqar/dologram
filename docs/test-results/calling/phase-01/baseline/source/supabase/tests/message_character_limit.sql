-- Run against a migrated test database. Copies the real CHECK constraints into
-- an isolated table so this regression needs no users, chats, or storage fixtures.
begin;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.messages'::regclass
      and conname = 'messages_content_max_chars'
      and convalidated
  ) then
    raise exception 'Missing validated message character limit';
  end if;
end;
$$;

create temporary table message_limit_test
  (like public.messages including defaults including constraints);

do $$
declare
  test_message uuid := gen_random_uuid();
  rejected_by text;
begin
  insert into message_limit_test(message_id, chat_id, sender_id, content)
  values(test_message, gen_random_uuid(), gen_random_uuid(), repeat('a', 4096));
  update message_limit_test set content = repeat('👍', 4096) where message_id = test_message;

  begin
    insert into message_limit_test(message_id, chat_id, sender_id, content, attachment_count)
    values(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), repeat('a', 4097), 1);
    raise exception 'Accepted oversized attachment caption';
  exception when check_violation then
    get stacked diagnostics rejected_by = constraint_name;
    if rejected_by <> 'messages_content_max_chars' then raise; end if;
  end;

  begin
    update message_limit_test set content = repeat('👍', 4097) where message_id = test_message;
    raise exception 'Accepted oversized Unicode edit';
  exception when check_violation then
    get stacked diagnostics rejected_by = constraint_name;
    if rejected_by <> 'messages_content_max_chars' then raise; end if;
  end;

  if (select content from message_limit_test where message_id = test_message) <> repeat('👍', 4096) then
    raise exception 'Rejected edit changed the original content';
  end if;
end;
$$;

rollback;
