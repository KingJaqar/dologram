-- The INSERT policy queried chat_members directly to check the first-owner and
-- two-member rules. PostgreSQL expands those RLS lookups recursively and rejects
-- the owner's membership INSERT with 42P17, so Message never opens the chat.
-- Keep the same authorization rules in a private, caller-scoped lookup helper.
create or replace function private.can_add_chat_member(
  p_chat_id uuid,
  p_user_id uuid,
  p_role text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.chats c
    where c.chat_id = p_chat_id
      and (
        (
          p_user_id = (select auth.uid())
          and p_role = 'owner'
          and c.created_by = (select auth.uid())
          and not exists (
            select 1 from public.chat_members cm where cm.chat_id = p_chat_id
          )
        )
        or (
          p_role = 'member'
          and exists (
            select 1 from public.chat_members cm
            where cm.chat_id = p_chat_id
              and cm.user_id = (select auth.uid()) and cm.role = 'owner'
          )
          and (
            c.type = 'group'
            or (c.type = 'direct' and (
              select count(*) from public.chat_members cm where cm.chat_id = p_chat_id
            ) < 2)
          )
        )
      )
  );
$$;

-- This is an RLS implementation detail, not a public RPC. The policy's caller
-- needs EXECUTE, but every lookup checks auth.uid() rather than trusting an ID.
revoke all on function private.can_add_chat_member(uuid, uuid, text)
  from public, anon, service_role;
grant execute on function private.can_add_chat_member(uuid, uuid, text) to authenticated;

alter policy "Users can add chat members" on public.chat_members
  with check (private.can_add_chat_member(chat_id, user_id, role));
