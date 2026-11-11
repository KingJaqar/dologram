-- Align the original scaffold schema with the DoloGram v14 client contract.
-- The first scaffold migrations used id/title/is_private and only allowed users to
-- insert themselves into chat_members. The mobile client uses chat_id/type and the
-- D-124 two-member direct-chat flow, so upgrade the existing tables in place.

create schema if not exists private;

-- Profiles keep the original id column for compatibility with the auth trigger, while
-- user_id is the public contract consumed by the clients.
alter table public.profiles add column if not exists user_id uuid;
update public.profiles set user_id = id where user_id is null;

create or replace function private.sync_profile_user_id()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.user_id := coalesce(new.user_id, new.id);
  return new;
end;
$$;

drop trigger if exists profiles_sync_user_id on public.profiles;
create trigger profiles_sync_user_id
before insert or update on public.profiles
for each row execute function private.sync_profile_user_id();

alter table public.profiles alter column user_id set not null;
create unique index if not exists profiles_user_id_unique_idx on public.profiles (user_id);

-- Chats retain id as a compatibility key, but chat_id is now the client-facing key.
alter table public.chats add column if not exists chat_id uuid;
update public.chats set chat_id = id where chat_id is null;
alter table public.chats alter column chat_id set default gen_random_uuid();
alter table public.chats alter column chat_id set not null;
create unique index if not exists chats_chat_id_unique_idx on public.chats (chat_id);

alter table public.chats add column if not exists created_by uuid;
alter table public.chats add column if not exists type text;
alter table public.chats add column if not exists direct_key text;
alter table public.chats add column if not exists next_seq bigint;
update public.chats set next_seq = 1 where next_seq is null;
alter table public.chats alter column title drop not null;
alter table public.chats alter column type set default 'group';
alter table public.chats alter column type set not null;
alter table public.chats alter column created_by set not null;
alter table public.chats alter column next_seq set default 1;
alter table public.chats alter column next_seq set not null;
alter table public.chats drop constraint if exists chats_type_check;
alter table public.chats add constraint chats_type_check check (type in ('direct', 'group'));
alter table public.chats drop constraint if exists chats_created_by_fkey;
alter table public.chats add constraint chats_created_by_fkey
  foreign key (created_by) references public.profiles(user_id);
create unique index if not exists chats_direct_key_unique_idx on public.chats (direct_key)
  where direct_key is not null;

-- Point the existing member/message foreign keys at the new client-facing chat key.
alter table public.chat_members drop constraint if exists chat_members_chat_id_fkey;
alter table public.chat_members add constraint chat_members_chat_id_fkey
  foreign key (chat_id) references public.chats(chat_id) on delete cascade;
alter table public.chat_members add column if not exists last_read_seq bigint;
alter table public.chat_members add column if not exists archived boolean;
alter table public.chat_members add column if not exists muted_until timestamptz;
update public.chat_members set last_read_seq = 0 where last_read_seq is null;
update public.chat_members set archived = false where archived is null;
alter table public.chat_members alter column last_read_seq set default 0;
alter table public.chat_members alter column last_read_seq set not null;
alter table public.chat_members alter column archived set default false;
alter table public.chat_members alter column archived set not null;
create unique index if not exists chat_members_chat_user_unique_idx
  on public.chat_members(chat_id, user_id);

alter table public.messages add column if not exists message_id uuid;
update public.messages set message_id = id where message_id is null;
alter table public.messages alter column message_id set default gen_random_uuid();
alter table public.messages alter column message_id set not null;
create unique index if not exists messages_message_id_unique_idx on public.messages(message_id);
alter table public.messages add column if not exists attachment_count smallint;
alter table public.messages add column if not exists seq bigint;
alter table public.messages add column if not exists sync_seq bigint;
alter table public.messages add column if not exists edited_at timestamptz;
alter table public.messages add column if not exists deleted_at timestamptz;
update public.messages set attachment_count = 0 where attachment_count is null;
update public.messages set seq = 0 where seq is null;
update public.messages set sync_seq = 0 where sync_seq is null;
alter table public.messages alter column content set default '';
alter table public.messages alter column attachment_count set default 0;
alter table public.messages alter column attachment_count set not null;
alter table public.messages alter column seq set default 0;
alter table public.messages alter column seq set not null;
alter table public.messages alter column sync_seq set default 0;
alter table public.messages alter column sync_seq set not null;
alter table public.messages drop constraint if exists messages_chat_id_fkey;
alter table public.messages add constraint messages_chat_id_fkey
  foreign key (chat_id) references public.chats(chat_id) on delete cascade;
alter table public.messages drop constraint if exists messages_reply_to_fkey;
alter table public.messages add constraint messages_reply_to_fkey
  foreign key (reply_to) references public.messages(message_id) on delete set null;

create table if not exists public.message_media (
  media_id uuid primary key,
  message_id uuid not null references public.messages(message_id) on delete cascade,
  chat_id uuid not null references public.chats(chat_id) on delete cascade,
  media_type text not null,
  storage_path text not null,
  compressed boolean not null default false,
  sync_seq bigint not null default 0
);

create table if not exists public.reactions (
  message_id uuid not null references public.messages(message_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  chat_id uuid not null references public.chats(chat_id) on delete cascade,
  sync_seq bigint not null default 0,
  removed_at timestamptz,
  primary key (message_id, user_id, emoji)
);

create table if not exists public.folders (
  folder_id uuid primary key,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  name text not null
);

create table if not exists public.folder_chats (
  folder_id uuid not null references public.folders(folder_id) on delete cascade,
  chat_id uuid not null references public.chats(chat_id) on delete cascade,
  primary key (folder_id, chat_id)
);

-- Helpers are private so RLS policies can inspect membership without recursively
-- evaluating the chat_members policy. They are not client endpoints.
create or replace function private.is_chat_member(p_chat_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.chat_members cm
    where cm.chat_id = p_chat_id and cm.user_id = p_user_id
  );
$$;

create or replace function private.is_chat_owner(p_chat_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.chat_members cm
    where cm.chat_id = p_chat_id and cm.user_id = p_user_id and cm.role = 'owner'
  );
$$;

create or replace function private.can_read_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_user_id = (select auth.uid())
    or exists (
      select 1
      from public.chat_members mine
      join public.chat_members theirs on theirs.chat_id = mine.chat_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = p_user_id
    );
$$;

create or replace function private.claim_chat_sequence(p_chat_id uuid)
returns bigint
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  claimed bigint;
begin
  update public.chats
     set next_seq = next_seq + 1
   where chat_id = p_chat_id
   returning next_seq - 1 into claimed;
  if claimed is null then
    raise exception 'chat_not_found';
  end if;
  return claimed;
end;
$$;

create or replace function private.set_message_sequence()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.seq := private.claim_chat_sequence(new.chat_id);
    new.sync_seq := new.seq;
  elsif new.content is distinct from old.content
     or new.deleted_at is distinct from old.deleted_at then
    new.edited_at := coalesce(new.edited_at, timezone('utc'::text, now()));
    new.sync_seq := private.claim_chat_sequence(new.chat_id);
  end if;
  return new;
end;
$$;

drop trigger if exists messages_set_sequence on public.messages;
create trigger messages_set_sequence
before insert or update on public.messages
for each row execute function private.set_message_sequence();

create or replace function private.set_media_metadata()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select m.chat_id into new.chat_id from public.messages m where m.message_id = new.message_id;
  new.storage_path := coalesce(new.storage_path, new.chat_id::text || '/' || new.media_id::text);
  new.sync_seq := private.claim_chat_sequence(new.chat_id);
  return new;
end;
$$;

drop trigger if exists message_media_set_metadata on public.message_media;
create trigger message_media_set_metadata
before insert on public.message_media
for each row execute function private.set_media_metadata();

create or replace function private.set_reaction_metadata()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select m.chat_id into new.chat_id from public.messages m where m.message_id = new.message_id;
  new.sync_seq := private.claim_chat_sequence(new.chat_id);
  return new;
end;
$$;

drop trigger if exists reactions_set_metadata on public.reactions;
create trigger reactions_set_metadata
before insert on public.reactions
for each row execute function private.set_reaction_metadata();

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
  else
    update public.chats set direct_key = null where chat_id = target_chat;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists chat_members_set_direct_key on public.chat_members;
create trigger chat_members_set_direct_key
after insert or update or delete on public.chat_members
for each row execute function private.set_direct_key();

-- Replace the scaffold policies. Every exposed table is RLS-protected and grants only
-- the operations used by an authenticated client.
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Service role can manage profiles" on public.profiles;
drop policy if exists "Users can read chats they're members of" on public.chats;
drop policy if exists "Admins can manage chats" on public.chats;
drop policy if exists "Service role can manage chats" on public.chats;
drop policy if exists "Users can read chat members of chats they joined" on public.chat_members;
drop policy if exists "Users can insert themselves into chats" on public.chat_members;
drop policy if exists "Service role can manage chat_members" on public.chat_members;
drop policy if exists "Users can read messages in chats they're members of" on public.messages;
drop policy if exists "Users can create messages in chats they joined" on public.messages;
drop policy if exists "Service role can manage messages" on public.messages;

alter table public.profiles enable row level security;
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_media enable row level security;
alter table public.reactions enable row level security;
alter table public.folders enable row level security;
alter table public.folder_chats enable row level security;

create policy "Authenticated users can read visible profiles"
  on public.profiles for select to authenticated
  using (private.can_read_profile(user_id));
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Members can read chats"
  on public.chats for select to authenticated
  using (created_by = (select auth.uid()) or private.is_chat_member(chat_id, (select auth.uid())));
create policy "Users can create chats"
  on public.chats for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "Owners can update chats"
  on public.chats for update to authenticated
  using (private.is_chat_owner(chat_id, (select auth.uid())))
  with check (private.is_chat_owner(chat_id, (select auth.uid())));

create policy "Members can read chat members"
  on public.chat_members for select to authenticated
  using (user_id = (select auth.uid()) or private.is_chat_member(chat_id, (select auth.uid())));
create policy "Users can add chat members"
  on public.chat_members for insert to authenticated
  with check (
    (
      user_id = (select auth.uid())
      and role = 'owner'
      and exists (
        select 1 from public.chats c
        where c.chat_id = chat_members.chat_id and c.created_by = (select auth.uid())
      )
      and not exists (
        select 1 from public.chat_members cm
        where cm.chat_id = chat_members.chat_id
      )
    )
    or (
      role = 'member'
      and private.is_chat_owner(chat_id, (select auth.uid()))
      and (
        (
          (select c.type from public.chats c where c.chat_id = chat_members.chat_id) = 'direct'
          and (select count(*) from public.chat_members cm where cm.chat_id = chat_members.chat_id) < 2
        )
        or (select c.type from public.chats c where c.chat_id = chat_members.chat_id) = 'group'
      )
    )
  );
create policy "Users can update their member state"
  on public.chat_members for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Owners can remove group members"
  on public.chat_members for delete to authenticated
  using (
    (user_id = (select auth.uid()) and (select c.type from public.chats c where c.chat_id = chat_members.chat_id) = 'group')
    or (private.is_chat_owner(chat_id, (select auth.uid()))
      and (select c.type from public.chats c where c.chat_id = chat_members.chat_id) = 'group')
  );

create policy "Members can read messages"
  on public.messages for select to authenticated
  using (private.is_chat_member(chat_id, (select auth.uid())));
create policy "Members can send messages"
  on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and private.is_chat_member(chat_id, (select auth.uid())));
create policy "Senders can edit messages"
  on public.messages for update to authenticated
  using (sender_id = (select auth.uid()) and private.is_chat_member(chat_id, (select auth.uid())))
  with check (sender_id = (select auth.uid()) and private.is_chat_member(chat_id, (select auth.uid())));

create policy "Members can read media"
  on public.message_media for select to authenticated
  using (private.is_chat_member(chat_id, (select auth.uid())));
create policy "Members can add their media"
  on public.message_media for insert to authenticated
  with check (exists (
    select 1 from public.messages m
    where m.message_id = message_media.message_id and m.sender_id = (select auth.uid())
  ));

create policy "Members can read reactions"
  on public.reactions for select to authenticated
  using (private.is_chat_member(chat_id, (select auth.uid())));
create policy "Users can add their reactions"
  on public.reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_chat_member(chat_id, (select auth.uid())));
create policy "Users can update their reactions"
  on public.reactions for update to authenticated
  using (user_id = (select auth.uid()) and private.is_chat_member(chat_id, (select auth.uid())))
  with check (user_id = (select auth.uid()) and private.is_chat_member(chat_id, (select auth.uid())));

create policy "Users can manage their folders"
  on public.folders for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Users can manage their folder chats"
  on public.folder_chats for all to authenticated
  using (exists (
    select 1 from public.folders f
    where f.folder_id = folder_chats.folder_id and f.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.folders f
    where f.folder_id = folder_chats.folder_id and f.user_id = (select auth.uid())
  ));

revoke all on public.profiles, public.chats, public.chat_members, public.messages,
  public.message_media, public.reactions, public.folders, public.folder_chats from anon;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.chats to authenticated;
grant select, insert, update, delete on public.chat_members to authenticated;
grant select, insert, update on public.messages to authenticated;
grant select, insert on public.message_media to authenticated;
grant select, insert, update on public.reactions to authenticated;
grant select, insert, update, delete on public.folders, public.folder_chats to authenticated;
revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on function private.sync_profile_user_id() from public;
revoke all on function private.is_chat_member(uuid, uuid) from public;
revoke all on function private.is_chat_owner(uuid, uuid) from public;
revoke all on function private.can_read_profile(uuid) from public;
revoke all on function private.claim_chat_sequence(uuid) from public;
revoke all on function private.set_message_sequence() from public;
revoke all on function private.set_media_metadata() from public;
revoke all on function private.set_reaction_metadata() from public;
revoke all on function private.set_direct_key() from public;
grant execute on function private.is_chat_member(uuid, uuid) to authenticated;
grant execute on function private.is_chat_owner(uuid, uuid) to authenticated;
grant execute on function private.can_read_profile(uuid) to authenticated;

-- Keep the username RPC on the new profile key. It remains intentionally narrow and
-- requires an authenticated caller because profiles are not globally readable.
create or replace function public.find_user(username text)
returns table (user_id uuid, display_name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.user_id, p.display_name
  from public.profiles p
  where (select auth.uid()) is not null
    and lower(p.username) = lower($1)
  limit 1;
$$;
revoke all on function public.find_user(text) from public, anon, service_role;
grant execute on function public.find_user(text) to authenticated;

-- Add the synchronized tables when the standard Supabase publication exists.
do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['public.messages', 'public.message_media', 'public.reactions'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = split_part(table_name, '.', 1)
          and tablename = split_part(table_name, '.', 2)
      ) then
        execute format('alter publication supabase_realtime add table %s', table_name);
      end if;
    end loop;
  end if;
end;
$$;
