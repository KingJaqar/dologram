-- Create profiles for Auth users created before the profile sync trigger existed.
insert into public.profiles (id, email, username, display_name, must_change_password)
select
  u.id,
  u.email,
  nullif(u.raw_user_meta_data ->> 'username', ''),
  coalesce(
    nullif(u.raw_user_meta_data ->> 'display_name', ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'User'
  ),
  false
from auth.users u
where not exists (
  select 1
  from public.profiles p
  where p.id = u.id
);
