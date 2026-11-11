-- M1-05: Enable RLS on profiles and add policies
-- Run: supabase migration up

alter table public.profiles enable row level security;
create policy "Users can read own profile"
  on public.profiles for select
  using ( auth.uid() = id );
create policy "Users can update own profile"
  on public.profiles for update
  using ( auth.uid() = id );
create policy "Service role can manage profiles"
  on public.profiles using ( auth.role() = 'service_role' );
