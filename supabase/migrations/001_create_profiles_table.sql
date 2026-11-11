-- M1-01: Create profiles table
-- Run: supabase migration up

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  display_name text not null,
  must_change_password boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  created_at timestamp with time zone default timezone('utc'::text, now())
);
comment on table public.profiles is 'User profile extension with display name and password change flag';
comment on column public.profiles.id is 'Primary key, references auth.users';
comment on column public.profiles.display_name is 'User display name';
comment on column public.profiles.must_change_password is 'Flag: user must change password on next sign-in';
comment on column public.profiles.updated_at is 'Last update timestamp';
comment on column public.profiles.created_at is 'Account creation timestamp';
