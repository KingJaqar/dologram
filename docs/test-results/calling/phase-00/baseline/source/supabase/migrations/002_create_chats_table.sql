-- M1-02: Create chats table
-- Run: supabase migration up

create table if not exists public.chats (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  is_private boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);
comment on table public.chats is 'Chat rooms/collections';
comment on column public.chats.id is 'Primary key';
comment on column public.chats.title is 'Chat title/name';
comment on column public.chats.description is 'Optional chat description';
comment on column public.chats.is_private is 'Whether the chat is private';
comment on column public.chats.created_at is 'Chat creation timestamp';
comment on column public.chats.updated_at is 'Last update timestamp';
