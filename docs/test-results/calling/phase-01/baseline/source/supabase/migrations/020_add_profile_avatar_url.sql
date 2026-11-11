-- Keep the public profile contract aligned with the mobile client.
-- Existing users keep their display name and username; avatar_url starts empty.

alter table public.profiles
  add column if not exists avatar_url text;

comment on column public.profiles.avatar_url is 'Storage path for the user profile picture';
