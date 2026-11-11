-- Migration: Create test accounts for DoloGram
-- Creates 5 public test accounts with predefined credentials
-- Run: supabase db push

-- Insert users into auth.users table
-- Password is hashed using bcrypt with cost factor 10
-- Using correct Supabase auth schema column names

-- Supabase installs pgcrypto in the extensions schema.
create extension if not exists pgcrypto with schema extensions;

-- Account 1: kingjaqar
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  extensions.gen_random_uuid(),
  'authenticated',
  'authenticated',
  'kingjaqar@gmail.com',
  extensions.crypt('password12345', extensions.gen_salt('bf', 10)),
  now(),
  now(),
  now(),
  '',
  '',
  '',
  ''
);

-- Account 2: juan
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  extensions.gen_random_uuid(),
  'authenticated',
  'authenticated',
  'juan@gmail.com',
  extensions.crypt('password12345', extensions.gen_salt('bf', 10)),
  now(),
  now(),
  now(),
  '',
  '',
  '',
  ''
);

-- Account 3: james
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  extensions.gen_random_uuid(),
  'authenticated',
  'authenticated',
  'james@gmail.com',
  extensions.crypt('password12345', extensions.gen_salt('bf', 10)),
  now(),
  now(),
  now(),
  '',
  '',
  '',
  ''
);

-- Account 4: bronny
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  extensions.gen_random_uuid(),
  'authenticated',
  'authenticated',
  'bronny@gmail.com',
  extensions.crypt('password12345', extensions.gen_salt('bf', 10)),
  now(),
  now(),
  now(),
  '',
  '',
  '',
  ''
);

-- Account 5: white
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  extensions.gen_random_uuid(),
  'authenticated',
  'authenticated',
  'white@gmail.com',
  extensions.crypt('password12345', extensions.gen_salt('bf', 10)),
  now(),
  now(),
  now(),
  '',
  '',
  '',
  ''
);

-- Create profiles for each user
-- The M1-03 trigger should handle this automatically based on raw_user_meta_data
-- But we need to set the metadata first via a separate approach

-- Since we can't directly insert into auth.users with metadata easily,
-- let's use the admin API approach instead via a function

-- Create a temporary function to set user metadata
create or replace function public.set_user_metadata(user_email text, meta jsonb)
returns void
language plpgsql
security definer
as $$
begin
  update auth.users
  set raw_user_meta_data = meta
  where email = user_email;
end;
$$;

-- Set metadata for each user
select public.set_user_metadata('kingjaqar@gmail.com', '{"username": "kingjaqar123", "display_name": "kingjaqar"}');
select public.set_user_metadata('juan@gmail.com', '{"username": "juan123", "display_name": "juan"}');
select public.set_user_metadata('james@gmail.com', '{"username": "james123", "display_name": "james"}');
select public.set_user_metadata('bronny@gmail.com', '{"username": "bronny123", "display_name": "bronny"}');
select public.set_user_metadata('white@gmail.com', '{"username": "white123", "display_name": "white"}');

-- Create identities for email provider (required for Supabase Auth)
insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select 
  u.id,
  u.id,
  u.email,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email
  ),
  'email',
  now(),
  now(),
  now()
from auth.users u
where u.email in (
  'kingjaqar@gmail.com',
  'juan@gmail.com',
  'james@gmail.com', 
  'bronny@gmail.com',
  'white@gmail.com'
)
and not exists (
  select 1 from auth.identities i where i.user_id = u.id
);

-- Clean up the helper function
drop function public.set_user_metadata;

