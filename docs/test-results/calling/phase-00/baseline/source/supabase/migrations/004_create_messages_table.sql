-- M1-04: Create messages table
-- Run: supabase migration up

create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  chat_id uuid references public.chats on delete cascade not null,
  sender_id uuid references auth.users on delete cascade not null,
  content text not null,
  image_url text,
  reply_to uuid references public.messages on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
comment on table public.messages is 'Individual messages within chats';
comment on column public.messages.id is 'Primary key';
comment on column public.messages.chat_id is 'Foreign key to chats';
comment on column public.messages.sender_id is 'Foreign key to auth.users who sent the message';
comment on column public.messages.content is 'Message text content';
comment on column public.messages.image_url is 'Optional image attachment URL';
comment on column public.messages.reply_to is 'Optional self-reference for threaded replies';
comment on column public.messages.created_at is 'When the message was sent';
