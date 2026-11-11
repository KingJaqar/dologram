-- M1-07: Enable RLS on chat_members and add policies
-- Run: supabase migration up

alter table public.chat_members enable row level security;
create policy "Users can read chat members of chats they joined"
  on public.chat_members for select
  using ( user_id = auth.uid() );
create policy "Users can insert themselves into chats"
  on public.chat_members for insert
  with check ( user_id = auth.uid() );
create policy "Service role can manage chat_members"
  on public.chat_members using ( auth.role() = 'service_role' );
