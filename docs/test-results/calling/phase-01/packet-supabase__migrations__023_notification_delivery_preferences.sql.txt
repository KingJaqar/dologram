-- Existing installations keep generic previews until they explicitly enable message text.
alter table public.push_tokens
  add column preview_text boolean not null default false,
  add column android_channel_id text,
  add constraint push_tokens_android_channel_check check (
    android_channel_id is null or (
      platform = 'android' and android_channel_id ~ '^messages-v2-[01]{3}$'
    )
  );

create index if not exists chat_members_user_chat_idx on public.chat_members (user_id, chat_id);
create index if not exists messages_unread_chat_seq_idx on public.messages (chat_id, seq)
  where deleted_at is null;

-- The Edge Function looks up counts only for devices that want a numeric push badge.
create function public.push_unread_counts(recipient_ids uuid[])
returns table (user_id uuid, unread_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select member.user_id, count(message.seq)
  from public.chat_members as member
  left join public.messages as message on message.chat_id = member.chat_id
    and message.seq > member.last_read_seq
    and message.sender_id <> member.user_id
    and message.deleted_at is null
  where member.user_id = any(recipient_ids)
  group by member.user_id;
$$;

revoke all on function public.push_unread_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.push_unread_counts(uuid[]) to service_role;
