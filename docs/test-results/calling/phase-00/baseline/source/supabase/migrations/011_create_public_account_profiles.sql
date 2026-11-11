-- Backfill public profile rows for the five real Auth accounts created in 010.
-- Keep this idempotent and do not overwrite an existing profile.
insert into public.profiles (id, display_name, must_change_password)
select
  u.id,
  account.display_name,
  false
from auth.users u
join (
  values
    ('kingjaqar@gmail.com', 'kingjaqar'),
    ('juan@gmail.com', 'juan'),
    ('james@gmail.com', 'james'),
    ('bronny@gmail.com', 'bronny'),
    ('white@gmail.com', 'white')
) as account(email, display_name) on account.email = u.email
where not exists (
  select 1
  from public.profiles p
  where p.id = u.id
);
