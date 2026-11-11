-- Make Saved Messages discoverable through the same direct-chat key used by the mobile client,
-- and create it for every new auth user. This also makes searching for one's own username open
-- Saved Messages instead of attempting to add the same member twice.

create or replace function private.set_direct_key()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_chat uuid;
  member_count integer;
  member_key text;
  chat_type text;
begin
  if tg_op = 'DELETE' then
    target_chat := old.chat_id;
  else
    target_chat := new.chat_id;
  end if;

  select c.type into chat_type from public.chats c where c.chat_id = target_chat;
  if chat_type <> 'direct' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select count(*)::integer, string_agg(cm.user_id::text, ':' order by cm.user_id::text)
    into member_count, member_key
    from public.chat_members cm
   where cm.chat_id = target_chat;

  if member_count > 2 then
    raise exception 'direct_chat_member_limit';
  elsif member_count = 2 then
    update public.chats set direct_key = member_key where chat_id = target_chat;
  elsif member_count = 1 then
    -- The one-member direct chat is Saved Messages. Its stable key is the caller's id.
    update public.chats set direct_key = member_key where chat_id = target_chat;
  else
    update public.chats set direct_key = null where chat_id = target_chat;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Repair one-member direct chats created before this migration. Keep the update guarded so a
-- malformed database containing duplicate Saved Messages does not make the migration fail.
update public.chats c
set direct_key = member.user_id::text
from (
  select cm.chat_id, min(cm.user_id::text)::uuid as user_id
  from public.chat_members cm
  group by cm.chat_id
  having count(*) = 1
) member
where c.chat_id = member.chat_id
  and c.type = 'direct'
  and c.direct_key is null
  and not exists (
    select 1 from public.chats existing
    where existing.direct_key = member.user_id::text
  );

create or replace function private.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  saved_chat_id uuid;
begin
  insert into public.profiles (id, email, username, display_name, must_change_password)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'username', ''),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'User'
    ),
    false
  )
  on conflict (id) do update set
    email = excluded.email,
    username = excluded.username,
    display_name = excluded.display_name,
    updated_at = timezone('utc'::text, now());

  -- The trigger also runs when auth metadata changes, so make this idempotent.
  if not exists (
    select 1 from public.chats c
    where c.type = 'direct' and c.direct_key = new.id::text
  ) then
    saved_chat_id := extensions.gen_random_uuid();
    insert into public.chats (chat_id, type, title, created_by)
    values (saved_chat_id, 'direct', null, new.id);

    insert into public.chat_members (chat_id, user_id, role)
    values (saved_chat_id, new.id, 'owner');
  end if;

  return new;
end;
$$;
