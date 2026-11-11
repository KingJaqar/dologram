-- Keep tombstones in the sync stream; only the sender may delete their own attachment.
alter table public.message_media add column deleted_at timestamptz;

create or replace function public.delete_chat_attachment(p_media_id uuid)
returns public.message_media
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.message_media;
  live_count integer;
begin
  select * into target from public.message_media where media_id = p_media_id for update;
  if target.media_id is null or auth.uid() is null
     or not private.is_chat_member(target.chat_id, auth.uid())
     or not exists (
       select 1 from public.messages
       where message_id = target.message_id and sender_id = auth.uid()
     ) then
    raise exception 'Attachment unavailable' using errcode = '42501';
  end if;
  if target.deleted_at is null then
    update public.message_media
       set deleted_at = clock_timestamp(), sync_seq = private.claim_chat_sequence(target.chat_id)
     where media_id = p_media_id returning * into target;
    select count(*) into live_count from public.message_media
      where message_id = target.message_id and deleted_at is null;
    update public.messages set attachment_count = live_count,
      deleted_at = case when live_count = 0 and btrim(content) = '' then coalesce(deleted_at, clock_timestamp()) else deleted_at end,
      sync_seq = private.claim_chat_sequence(target.chat_id)
      where message_id = target.message_id;
  end if;
  return target;
end;
$$;
revoke all on function public.delete_chat_attachment(uuid) from public, anon;
grant execute on function public.delete_chat_attachment(uuid) to authenticated;

-- Existing signed URLs expire after their normal lifetime; no new URLs for tombstones.
drop policy "Chat members can read live attachments" on storage.objects;
create policy "Chat members can read live attachments"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('chat-media-small', 'chat-media-large')
    and exists (
      select 1 from public.message_media as media
      join public.messages as message
        on message.message_id = media.message_id and message.chat_id = media.chat_id
      where objects.name = media.chat_id::text || '/' || media.media_id::text
        and media.storage_path = objects.name
        and media.deleted_at is null and message.deleted_at is null
        and objects.bucket_id = case when media.media_type in ('photo', 'voice')
          then 'chat-media-small' else 'chat-media-large' end
    )
  );
