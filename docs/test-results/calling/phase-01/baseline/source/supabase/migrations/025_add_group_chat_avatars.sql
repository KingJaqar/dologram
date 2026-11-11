-- Shared group photos are stored once per chat and can be changed by the owner.
alter table public.chats add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-avatars',
  'chat-avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Group owners can upload chat avatars" on storage.objects;
create policy "Group owners can upload chat avatars"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-avatars'
    and (storage.foldername(name))[1] is not null
    and exists (
      select 1 from public.chats c
      where c.chat_id = ((storage.foldername(name))[1])::uuid and c.type = 'group'
    )
    and private.is_chat_owner(((storage.foldername(name))[1])::uuid, (select auth.uid()))
  );

drop policy if exists "Group members can read chat avatars" on storage.objects;
create policy "Group members can read chat avatars"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-avatars'
    and exists (
      select 1 from public.chats c
      where c.chat_id = ((storage.foldername(name))[1])::uuid and c.type = 'group'
    )
    and private.is_chat_member(((storage.foldername(name))[1])::uuid, (select auth.uid()))
  );

drop policy if exists "Group owners can update chat avatars" on storage.objects;
create policy "Group owners can update chat avatars"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'chat-avatars'
    and exists (
      select 1 from public.chats c
      where c.chat_id = ((storage.foldername(name))[1])::uuid and c.type = 'group'
    )
    and private.is_chat_owner(((storage.foldername(name))[1])::uuid, (select auth.uid()))
  )
  with check (
    bucket_id = 'chat-avatars'
    and exists (
      select 1 from public.chats c
      where c.chat_id = ((storage.foldername(name))[1])::uuid and c.type = 'group'
    )
    and private.is_chat_owner(((storage.foldername(name))[1])::uuid, (select auth.uid()))
  );

drop policy if exists "Group owners can delete chat avatars" on storage.objects;
create policy "Group owners can delete chat avatars"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'chat-avatars'
    and exists (
      select 1 from public.chats c
      where c.chat_id = ((storage.foldername(name))[1])::uuid and c.type = 'group'
    )
    and private.is_chat_owner(((storage.foldername(name))[1])::uuid, (select auth.uid()))
  );
