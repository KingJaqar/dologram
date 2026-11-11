-- M1-03: Create chat_members table
-- Run: supabase migration up

create table if not exists public.chat_members (
  id uuid default gen_random_uuid() primary key,
  chat_id uuid references public.chats on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  role text default 'member',
  joined_at timestamp with time zone default timezone('utc'::text, now()),
  unique (chat_id, user_id)
);
comment on table public.chat_members is 'Many-to-many: users in chats';
comment on column public.chat_members.id is 'Primary key';
comment on column public.chat_members.chat_id is 'Foreign key to chats';
comment on column public.chat_members.user_id is 'Foreign key to auth.users';
comment on column public.chat_members.role is 'Member role (e.g. member, admin)';
comment on column public.chat_members.joined_at is 'When user joined the chat';
