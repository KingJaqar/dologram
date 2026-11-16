-- A direct chat temporarily has one member during creation. Defer computing its
-- key until both members exist, so that row never collides with Saved Messages.
drop trigger chat_members_set_direct_key on public.chat_members;
create constraint trigger chat_members_set_direct_key
after insert or update or delete on public.chat_members
deferrable initially immediate
for each row execute function private.set_direct_key();

create function public.open_direct_chat(p_other_user_id uuid, p_chat_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  target_key text;
  existing_chat_id uuid;
begin
  if caller is null or p_other_user_id is null or p_chat_id is null then
    raise exception 'invalid direct chat request' using errcode = '22023';
  end if;

  target_key := case
    when caller = p_other_user_id then caller::text
    else least(caller, p_other_user_id)::text || ':' || greatest(caller, p_other_user_id)::text
  end;

  select chat_id into existing_chat_id from public.chats
    where direct_key = target_key and type = 'direct';
  if found then return existing_chat_id; end if;

  set constraints public.chat_members_set_direct_key deferred;
  insert into public.chats (chat_id, type, created_by) values (p_chat_id, 'direct', caller);
  insert into public.chat_members (chat_id, user_id, role) values (p_chat_id, caller, 'owner');
  if p_other_user_id <> caller then
    insert into public.chat_members (chat_id, user_id, role) values (p_chat_id, p_other_user_id, 'member');
  end if;
  set constraints public.chat_members_set_direct_key immediate;
  return p_chat_id;
exception when unique_violation then
  -- Another request can create the pair first. PostgreSQL has rolled back our
  -- inserts at this point, so a retry returns the winner without leaving a shell.
  select chat_id into existing_chat_id from public.chats
    where direct_key = target_key and type = 'direct';
  if found then return existing_chat_id; end if;
  raise;
end;
$$;

revoke all on function public.open_direct_chat(uuid, uuid) from public, anon;
grant execute on function public.open_direct_chat(uuid, uuid) to authenticated;
