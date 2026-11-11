-- M1-06: Enable RLS on chats and add policies
-- Run: supabase migration up

alter table public.chats enable row level security;
create policy "Users can read chats they're members of"
  on public.chats for select
  using ( exists ( select 1 from public.chat_members where chat_id = id and user_id = auth.uid() ) );
create policy "Admins can manage chats"
  on public.chats for all
  using ( exists ( select 1 from public.chat_members where chat_id = id and user_id = auth.uid() and role = 'admin' ) )
  with check ( exists ( select 1 from public.chat_members where chat_id = id and user_id = auth.uid() and role = 'admin' ) );
create policy "Service role can manage chats"
  on public.chats using ( auth.role() = 'service_role' );
