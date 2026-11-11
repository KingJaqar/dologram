-- Chat attachments use private buckets and canonical <chat_id>/<media_id> paths.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'chat-media-small', 'chat-media-small', false, 10485760,
    array[
      'image/jpeg', 'image/png', 'image/webp',
      'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/webm'
    ]
  ),
  (
    'chat-media-large', 'chat-media-large', false, 52428800,
    array[
      'image/jpeg', 'image/png', 'image/webp',
      'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/webm',
      'video/mp4', 'video/webm',
      'application/pdf', 'text/plain', 'application/zip',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]
  );

-- Upload happens before the app inserts message_media.
create policy "Chat members can upload attachments"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('chat-media-small', 'chat-media-large')
    and case
      when name ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
      then private.is_chat_member(split_part(name, '/', 1)::uuid, (select auth.uid()))
      else false
    end
  );

-- The existing message and media RLS policies limit the lookup to the caller's chats.
create policy "Chat members can read live attachments"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('chat-media-small', 'chat-media-large')
    and exists (
      select 1
      from public.message_media as media
      join public.messages as message
        on message.message_id = media.message_id
        and message.chat_id = media.chat_id
      where media.media_id = substring(objects.name from '/([0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12})$')::uuid
        and objects.name = media.chat_id::text || '/' || media.media_id::text
        and media.storage_path = objects.name
        and message.deleted_at is null
        and objects.bucket_id = case
          when media.media_type in ('photo', 'voice') then 'chat-media-small'
          when media.media_type in ('video', 'file') then 'chat-media-large'
        end
    )
  );
