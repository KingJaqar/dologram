-- Harden aggregate read-state writes without changing chat membership semantics.
-- The membership generation passed by new clients is the server-issued joined_at value.

create or replace function private.clamp_chat_member_read_seq()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  highest_seq bigint;
begin
  if tg_op <> 'UPDATE' or new.last_read_seq is not distinct from old.last_read_seq then
    return new;
  end if;

  if new.last_read_seq is null
     or new.last_read_seq < 0
     or new.last_read_seq > 9007199254740991 then
    raise exception 'invalid read cursor' using errcode = 'DG422';
  end if;

  select coalesce(max(m.seq), 0)
    into highest_seq
    from public.messages m
   where m.chat_id = new.chat_id;

  new.last_read_seq := greatest(old.last_read_seq, least(new.last_read_seq, highest_seq));
  return new;
end;
$$;

drop trigger if exists chat_members_clamp_read_seq on public.chat_members;
create trigger chat_members_clamp_read_seq
before update on public.chat_members
for each row execute function private.clamp_chat_member_read_seq();

create or replace function public.mark_chat_read(
  p_chat_id uuid,
  p_max_seq bigint,
  p_membership_joined_at timestamptz
)
returns setof public.chat_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  own_member public.chat_members;
  highest_seq bigint;
  next_seq bigint;
begin
  if caller is null then
    raise exception 'authentication required' using errcode = 'DG401';
  end if;

  if p_chat_id is null
     or p_max_seq is null
     or p_membership_joined_at is null
     or p_max_seq < 0
     or p_max_seq > 9007199254740991 then
    raise exception 'invalid read cursor request' using errcode = 'DG422';
  end if;

  select cm.*
    into own_member
    from public.chat_members cm
   where cm.chat_id = p_chat_id
     and cm.user_id = caller
   for update;

  if not found then
    raise exception 'chat membership not found' using errcode = 'DG403';
  end if;

  if own_member.joined_at is distinct from p_membership_joined_at then
    raise exception 'chat membership changed' using errcode = 'DG409';
  end if;

  select coalesce(max(m.seq), 0)
    into highest_seq
    from public.messages m
   where m.chat_id = p_chat_id;

  next_seq := greatest(own_member.last_read_seq, least(p_max_seq, highest_seq));

  update public.chat_members cm
     set last_read_seq = next_seq
   where cm.chat_id = p_chat_id
     and cm.user_id = caller
  returning cm.* into own_member;

  return next own_member;
end;
$$;

create or replace function public.get_chat_member_snapshot(p_chat_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  snapshot jsonb;
begin
  if caller is null then
    raise exception 'authentication required' using errcode = 'DG401';
  end if;

  if p_chat_id is null then
    raise exception 'chat id is required' using errcode = 'DG422';
  end if;

  -- The authorization check and the member aggregation share one statement snapshot. The HAVING
  -- clause also makes an empty or caller-less result a denial rather than a valid empty roster.
  select jsonb_build_object(
           'members', coalesce(jsonb_agg(to_jsonb(cm) order by cm.user_id), '[]'::jsonb),
           'total_count', count(*)
         )
    into snapshot
    from public.chat_members cm
   where cm.chat_id = p_chat_id
  having count(*) filter (where cm.user_id = caller) = 1;

  if not found then
    raise exception 'chat membership not found' using errcode = 'DG403';
  end if;

  return snapshot;
end;
$$;

-- Existing callers may continue to use direct PostgREST updates for the read cursor during the
-- client transition. The trigger above supplies monotonic/clamped behavior; new callers use the
-- membership-bound RPC instead. Settings remain writable only on the caller's own row.
revoke update on public.chat_members from authenticated;
grant update (last_read_seq, archived, muted_until) on public.chat_members to authenticated;

-- INSERT must not accept a client-supplied cursor, identity, or membership timestamp. Existing
-- group/direct-chat creation still supplies exactly chat_id, user_id, and role.
revoke insert on public.chat_members from authenticated;
grant insert (chat_id, user_id, role) on public.chat_members to authenticated;

revoke all on function public.mark_chat_read(uuid, bigint, timestamptz)
  from public, anon, service_role;
grant execute on function public.mark_chat_read(uuid, bigint, timestamptz) to authenticated;

revoke all on function public.get_chat_member_snapshot(uuid)
  from public, anon, service_role;
grant execute on function public.get_chat_member_snapshot(uuid) to authenticated;

revoke all on function private.clamp_chat_member_read_seq() from public, anon, authenticated, service_role;
