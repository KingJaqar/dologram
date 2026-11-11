-- Run with psql against a migrated TEST database containing at least three profiles.
-- Fixtures and all assertions roll back. No storage objects are needed for this RPC test.
begin;
do $$
declare
  people uuid[];
  chat uuid := gen_random_uuid();
  message uuid := gen_random_uuid();
  media uuid := gen_random_uuid();
begin
  select array_agg(user_id) into people from (select user_id from public.profiles order by user_id limit 3) p;
  if cardinality(people) < 3 then raise exception 'Requires three test profiles'; end if;
  perform set_config('test.owner', people[1]::text, true);
  perform set_config('test.recipient', people[2]::text, true);
  perform set_config('test.outsider', people[3]::text, true);
  perform set_config('test.media', media::text, true);
  perform set_config('request.jwt.claim.sub', people[1]::text, true);
  insert into public.chats(chat_id, type, title, created_by) values(chat, 'group', 'Attachment regression', people[1]);
  insert into public.chat_members(chat_id, user_id, role) values(chat, people[1], 'owner'), (chat, people[2], 'member');
  insert into public.messages(message_id, chat_id, sender_id, content, attachment_count) values(message, chat, people[1], 'Keep this caption', 1);
  insert into public.message_media(media_id, message_id, media_type) values(media, message, 'photo');
end;
$$;
set local role authenticated;

select set_config('request.jwt.claim.sub', current_setting('test.recipient'), true);
do $$ begin
  begin
    perform public.delete_chat_attachment(current_setting('test.media')::uuid);
    raise exception 'Recipient deleted another sender''s attachment';
  exception when insufficient_privilege then null; end;
end; $$;

select set_config('request.jwt.claim.sub', current_setting('test.outsider'), true);
do $$ begin
  begin
    perform public.delete_chat_attachment(current_setting('test.media')::uuid);
    raise exception 'Outsider deleted an attachment';
  exception when insufficient_privilege then null; end;
end; $$;

select set_config('request.jwt.claim.sub', current_setting('test.owner'), true);
do $$
declare
  before_seq bigint;
  first public.message_media;
  again public.message_media;
begin
  select sync_seq into before_seq from public.message_media where media_id = current_setting('test.media')::uuid;
  first := public.delete_chat_attachment(current_setting('test.media')::uuid);
  again := public.delete_chat_attachment(current_setting('test.media')::uuid);
  if first.deleted_at is null or first.sync_seq <= before_seq
    or first.deleted_at is distinct from again.deleted_at or first.sync_seq <> again.sync_seq then
    raise exception 'Deletion must return one idempotent, sequenced tombstone';
  end if;
  if not exists(select 1 from public.messages where message_id = first.message_id and attachment_count = 0 and content = 'Keep this caption' and deleted_at is null) then
    raise exception 'Deletion lost the caption or did not update the attachment count';
  end if;
end;
$$;
rollback;
