-- Profile avatar objects remain private, but chat members may read the avatar of another member.
-- The mobile client stores the object path in profiles.avatar_url and requests a signed URL when
-- rendering it, so the storage policy must authorize that signed URL request for shared chats.

drop policy if exists "Chat members can read profile avatars" on storage.objects;
create policy "Chat members can read profile avatars"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and exists (
      select 1
      from public.chat_members as viewer
      join public.chat_members as subject on subject.chat_id = viewer.chat_id
      where viewer.user_id = (select auth.uid())
        and subject.user_id::text = (storage.foldername(name))[1]
    )
  );
