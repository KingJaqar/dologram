-- Shared Messenger-style nicknames.
-- A nickname belongs to one member in one conversation; it never changes the profile name.

alter table public.chat_members
  add column if not exists nickname text;

create or replace function public.set_chat_nickname(
  p_chat_id uuid,
  p_user_id uuid,
  p_nickname text
)
returns setof public.chat_members
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_nickname text := nullif(btrim(p_nickname), '');
begin
  if not private.is_chat_member(p_chat_id, (select auth.uid())) then
    raise exception 'not_chat_member';
  end if;

  if not private.is_chat_member(p_chat_id, p_user_id) then
    raise exception 'target_not_chat_member';
  end if;

  if next_nickname is not null and char_length(next_nickname) > 64 then
    raise exception 'nickname_too_long';
  end if;

  return query
    update public.chat_members
       set nickname = next_nickname
     where chat_id = p_chat_id and user_id = p_user_id
     returning *;
end;
$$;

alter table public.chat_members enable row level security;
revoke all on function public.set_chat_nickname(uuid, uuid, text) from public, anon, service_role;
grant execute on function public.set_chat_nickname(uuid, uuid, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'chat_members'
     ) then
    alter publication supabase_realtime add table public.chat_members;
  end if;
end;
$$;
