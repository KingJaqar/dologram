-- Run against a fully migrated database containing at least one profile.
-- Exercise actual RLS as the client role, and keep memo internals inaccessible.
begin;

do $$
declare
  caller uuid;
begin
  select user_id into caller from public.profiles limit 1;
  if caller is null then
    raise exception 'Test requires at least one profile';
  end if;
  perform set_config('request.jwt.claim.sub', caller::text, true);
end;
$$;

set local role authenticated;

do $$
declare
  own_profile public.profiles;
  helper regprocedure;
begin
  foreach helper in array array[
    'private.can_read_profile(uuid)'::regprocedure,
    'private.is_chat_member(uuid,uuid)'::regprocedure,
    'private.is_chat_owner(uuid,uuid)'::regprocedure,
    'private.can_add_chat_member(uuid,uuid,text)'::regprocedure,
    'private.call_is_current_participant(uuid,uuid)'::regprocedure
  ] loop
    if not has_function_privilege(current_user, helper, 'EXECUTE') then
      raise exception 'Missing policy helper permission: %', helper;
    end if;
  end loop;

  select * into strict own_profile from public.profiles where user_id = auth.uid();
  update public.profiles set display_name = own_profile.display_name
    where user_id = auth.uid();
  if not found then
    raise exception 'Own profile update was denied';
  end if;

  if has_function_privilege(current_user, 'private.memo_protection_revision()', 'EXECUTE') then
    raise exception 'Memo protection function must remain restricted';
  end if;
  if has_function_privilege('anon', 'private.can_read_profile(uuid)', 'EXECUTE') then
    raise exception 'Anonymous profile helper access must remain restricted';
  end if;
end;
$$;

rollback;
