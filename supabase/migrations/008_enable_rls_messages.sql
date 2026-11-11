-- M1-08: Enable RLS on messages and add policies
-- Run: supabase migration up

alter table public.messages enable row level security;
create policy "Users can read messages in chats they're members of"
  on public.messages for select
  using ( exists ( select 1 from public.chat_members where chat_id = messages.chat_id and user_id = auth.uid() ) );
create policy "Users can create messages in chats they joined"
  on public.messages for insert
  with check ( exists ( select 1 from public.chat_members where chat_id = chat_id and user_id = auth.uid() ) );
create policy "Service role can manage messages"
  on public.messages using ( auth.role() = 'service_role' );
