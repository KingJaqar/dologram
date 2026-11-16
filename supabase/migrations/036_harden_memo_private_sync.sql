-- Phase 6 corrective migration; 035 remains unchanged.
-- Bound receipts to the original actor and complete immutable request before replay.
create or replace function public.memo_create(
  p_actor_id uuid, p_memo_id uuid, p_generation uuid, p_operation_id uuid, p_title text, p_description text,
  p_residency text default 'keep_all'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare receipt public.memo_operation_receipts; fingerprint text; result jsonb;
begin
  if p_actor_id is null or p_memo_id is null or p_generation is null or p_operation_id is null or p_title is null or char_length(p_title) not between 1 and 128 or char_length(coalesce(p_description,'')) > 500 or p_residency is null or p_residency not in ('keep_all','on_demand') then raise exception 'MEMO_INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text, 0));
  fingerprint := md5(jsonb_build_array('create',p_memo_id,p_generation,p_title,coalesce(p_description,''),p_residency)::text);
  select * into receipt from public.memo_operation_receipts where operation_id=p_operation_id;
  if found then
    if receipt.actor_id<>p_actor_id or receipt.memo_id<>p_memo_id or receipt.generation<>p_generation or receipt.payload_hash<>fingerprint then raise exception 'MEMO_OPERATION_CONFLICT'; end if;
    return receipt.result;
  end if;
  perform 1 from public.memo_memos where memo_id=p_memo_id for update;
  if found then
    if not exists(select 1 from public.memo_memos m where m.memo_id=p_memo_id and m.owner_id=p_actor_id and m.closed_at is not null and m.generation<>p_generation and exists(select 1 from public.memo_operation_receipts r where r.memo_id=m.memo_id and r.generation=m.generation and r.result->>'closed'='true')) then raise exception 'MEMO_OPERATION_CONFLICT'; end if;
    update public.memo_memos set generation=p_generation,title=p_title,description=coalesce(p_description,''),residency=p_residency,revision=1,change_position=0,closed_at=null,updated_at=now() where memo_id=p_memo_id;
  else
    insert into public.memo_memos(memo_id,owner_id,generation,title,description,residency) values(p_memo_id,p_actor_id,p_generation,p_title,coalesce(p_description,''),p_residency);
    insert into public.memo_members(memo_id,user_id,role) values(p_memo_id,p_actor_id,'owner');
  end if;
  result := jsonb_build_object('operation_id',p_operation_id,'memo_id',p_memo_id,'generation',p_generation,'remote_revision',1,'change_position',0);
  insert into public.memo_operation_receipts(operation_id,memo_id,generation,actor_id,payload_hash,result) values(p_operation_id,p_memo_id,p_generation,p_actor_id,fingerprint,result);
  return result;
exception when unique_violation then raise exception 'MEMO_OPERATION_CONFLICT';
end;
$$;

create or replace function public.memo_apply_mutation(
  p_actor_id uuid,p_memo_id uuid,p_generation uuid,p_operation_id uuid,p_entity_id uuid,p_entity_type text,
  p_base_revision bigint,p_predecessor_id uuid,p_payload jsonb,p_deleted boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.memo_memos; receipt public.memo_operation_receipts; predecessor public.memo_operation_receipts;
  fingerprint text; result jsonb; original_author uuid; asset_ref text[];
begin
  if p_actor_id is null or p_memo_id is null or p_generation is null or p_operation_id is null or p_entity_id is null or p_entity_type is null or p_base_revision is null or p_base_revision<0 or p_deleted is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>(case when p_entity_type='note' then 2200000 else 262144 end) then raise exception 'MEMO_INVALID_REQUEST'; end if;
  if p_entity_type not in ('memo','item','note','asset','tag','pin','reminder','preference','folder','trash') then raise exception 'MEMO_INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,0));
  select * into m from public.memo_memos where memo_id=p_memo_id for update;
  if m.memo_id is null or m.closed_at is not null or m.generation<>p_generation then raise exception 'MEMO_GENERATION_UNSUPPORTED'; end if;
  -- Private synchronization is owner-only. Collaboration authorization belongs to Phase 7.
  if m.owner_id<>p_actor_id or not exists(select 1 from public.memo_members where memo_id=p_memo_id and user_id=p_actor_id and role='owner' and revoked_at is null) then raise exception 'MEMO_NOT_ALLOWED'; end if;
  fingerprint:=md5(jsonb_build_array('mutation',p_memo_id,p_generation,p_entity_id,p_entity_type,p_base_revision,p_predecessor_id,p_payload,p_deleted)::text);
  select * into receipt from public.memo_operation_receipts where operation_id=p_operation_id;
  if found then
    if receipt.actor_id<>p_actor_id or receipt.memo_id<>p_memo_id or receipt.generation<>p_generation or receipt.payload_hash<>fingerprint then raise exception 'MEMO_OPERATION_CONFLICT'; end if;
    return receipt.result;
  end if;
  if p_predecessor_id is not null then
    select * into predecessor from public.memo_operation_receipts where operation_id=p_predecessor_id;
    if predecessor.operation_id is null or predecessor.actor_id<>p_actor_id or predecessor.memo_id<>p_memo_id or predecessor.generation<>p_generation or (predecessor.result->>'remote_revision')::bigint<>p_base_revision then raise exception 'MEMO_OPERATION_CONFLICT'; end if;
  end if;
  if p_base_revision>m.revision or (m.revision<>p_base_revision and exists(select 1 from public.memo_item_revisions where memo_id=p_memo_id and generation=p_generation and entity_id=p_entity_id and entity_type=p_entity_type and revision>p_base_revision)) then raise exception 'MEMO_REVISION_CONFLICT'; end if;
  if p_entity_type='item' and (jsonb_typeof(p_payload->'text') is distinct from 'string' or char_length(p_payload->>'text')>4096) then raise exception 'MEMO_INVALID_REQUEST'; end if;
  if p_entity_type='note' and (jsonb_typeof(p_payload->'body') is distinct from 'string' or char_length(p_payload->>'body')>500000 or jsonb_typeof(p_payload->'title') is distinct from 'string' or char_length(p_payload->>'title') not between 1 and 128 or char_length(coalesce(p_payload->>'description',''))>500) then raise exception 'MEMO_INVALID_REQUEST'; end if;
  if p_entity_type='asset' and not exists(select 1 from public.memo_assets where asset_id=(p_payload->>'asset_id')::uuid and memo_id=p_memo_id and generation=p_generation and state='verified') then raise exception 'MEMO_ASSET_UNAVAILABLE'; end if;
  if p_entity_type='note' then
    for asset_ref in select regexp_matches(p_payload->>'body','memo-asset://([a-fA-F0-9-]{36})','g') loop
      if not exists(select 1 from public.memo_assets where asset_id=asset_ref[1]::uuid and memo_id=p_memo_id and generation=p_generation and state='verified') then raise exception 'MEMO_ASSET_UNAVAILABLE'; end if;
    end loop;
  end if;
  select author_id into original_author from public.memo_item_revisions where memo_id=p_memo_id and generation=p_generation and entity_id=p_entity_id and entity_type=p_entity_type order by revision limit 1;
  update public.memo_memos set revision=revision+1,change_position=change_position+1,updated_at=now() where memo_id=p_memo_id returning * into m;
  insert into public.memo_item_revisions(revision_id,memo_id,generation,entity_id,entity_type,revision,author_id,payload,deleted) values(extensions.gen_random_uuid(),p_memo_id,p_generation,p_entity_id,p_entity_type,m.revision,coalesce(original_author,p_actor_id),p_payload,p_deleted);
  insert into public.memo_changes(memo_id,generation,change_position,operation_id,entity_id,entity_type,revision,payload,deleted) values(p_memo_id,p_generation,m.change_position,p_operation_id,p_entity_id,p_entity_type,m.revision,p_payload,p_deleted);
  result:=jsonb_build_object('operation_id',p_operation_id,'memo_id',p_memo_id,'generation',p_generation,'remote_revision',m.revision,'change_position',m.change_position);
  insert into public.memo_operation_receipts(operation_id,memo_id,generation,actor_id,predecessor_id,payload_hash,result) values(p_operation_id,p_memo_id,p_generation,p_actor_id,p_predecessor_id,fingerprint,result);
  return result;
end;
$$;

create or replace function public.memo_pin_reset_create(p_challenge_id uuid,p_account_id uuid,p_device_nonce text,p_code_hash text,p_expires_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_challenge_id is null or p_account_id is null or p_device_nonce is null or char_length(p_device_nonce) not between 16 and 128 or p_code_hash is null or p_code_hash !~ '^[a-fA-F0-9]{64}$' or p_expires_at is null or p_expires_at<=now() or p_expires_at>now()+interval '10 minutes' then raise exception 'MEMO_INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text,1));
  if exists(select 1 from private.memo_pin_reset_challenges where account_id=p_account_id and created_at>now()-interval '60 seconds') or (select count(*) from private.memo_pin_reset_challenges where account_id=p_account_id and created_at>now()-interval '1 hour')>=5 then raise exception 'MEMO_RATE_LIMITED'; end if;
  insert into private.memo_pin_reset_challenges(challenge_id,account_id,device_nonce,code_hash,expires_at) values(p_challenge_id,p_account_id,p_device_nonce,lower(p_code_hash),p_expires_at);
end;
$$;

-- Policy helpers require explicit execution permission even when invoked by RLS.
grant usage on schema private to authenticated;
grant execute on function private.memo_member_role(uuid,uuid) to authenticated;
revoke all on function public.memo_create(uuid,uuid,uuid,uuid,text,text,text), public.memo_apply_mutation(uuid,uuid,uuid,uuid,uuid,text,bigint,uuid,jsonb,boolean), public.memo_pin_reset_create(uuid,uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.memo_create(uuid,uuid,uuid,uuid,text,text,text), public.memo_apply_mutation(uuid,uuid,uuid,uuid,uuid,text,bigint,uuid,jsonb,boolean), public.memo_pin_reset_create(uuid,uuid,text,text,timestamptz) to service_role;

create or replace function public.memo_pin_reset_consume(p_challenge_id uuid,p_account_id uuid,p_device_nonce text,p_code_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare challenge private.memo_pin_reset_challenges;
begin
  if p_challenge_id is null or p_account_id is null or p_device_nonce is null or p_code_hash is null or p_code_hash !~ '^[a-fA-F0-9]{64}$' then return jsonb_build_object('authorized',false); end if;
  select * into challenge from private.memo_pin_reset_challenges where challenge_id=p_challenge_id and account_id=p_account_id for update;
  if not found or challenge.consumed_at is not null or challenge.expires_at<=now() or challenge.attempts>=5 then return jsonb_build_object('authorized',false); end if;
  if challenge.device_nonce<>p_device_nonce or challenge.code_hash<>lower(p_code_hash) then
    update private.memo_pin_reset_challenges set attempts=attempts+1 where challenge_id=p_challenge_id;
    return jsonb_build_object('authorized',false);
  end if;
  update private.memo_pin_reset_challenges set consumed_at=now() where challenge_id=p_challenge_id;
  return jsonb_build_object('authorized',true,'account_id',p_account_id,'device_nonce',p_device_nonce);
end;
$$;
revoke all on function public.memo_pin_reset_consume(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.memo_pin_reset_consume(uuid,uuid,text,text) to service_role;

create or replace function public.memo_reserve_asset(
 p_actor_id uuid,p_memo_id uuid,p_generation uuid,p_operation_id uuid,p_asset_id uuid,
 p_original_name text,p_mime_type text,p_byte_size bigint,p_checksum text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.memo_memos; a public.memo_assets; result jsonb; fingerprint text; receipt public.memo_operation_receipts;
begin
 if p_actor_id is null or p_operation_id is null or p_asset_id is null or p_byte_size is null or p_byte_size<0 or p_original_name is null or char_length(p_original_name) not between 1 and 255 or p_mime_type is null or char_length(p_mime_type)>255 or (p_checksum is not null and p_checksum !~ '^(md5:[a-f0-9]{32}|sha256:[a-f0-9]{64})$') then raise exception 'MEMO_INVALID_REQUEST'; end if;
 if p_byte_size>52428800 then raise exception 'MEMO_QUOTA_EXCEEDED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,0));
 select * into m from public.memo_memos where memo_id=p_memo_id for update;
 if m.memo_id is null or m.generation<>p_generation or m.closed_at is not null then raise exception 'MEMO_GENERATION_UNSUPPORTED'; end if;
 if m.owner_id<>p_actor_id then raise exception 'MEMO_NOT_ALLOWED'; end if;
 fingerprint:=md5(jsonb_build_array('asset_reserve',p_memo_id,p_generation,p_asset_id,p_original_name,p_mime_type,p_byte_size,p_checksum)::text);
 select * into receipt from public.memo_operation_receipts where operation_id=p_operation_id;
 if found then
   if receipt.actor_id<>p_actor_id or receipt.memo_id<>p_memo_id or receipt.generation<>p_generation or receipt.payload_hash<>fingerprint then raise exception 'MEMO_OPERATION_CONFLICT'; end if;
   return receipt.result;
 end if;
 select * into a from public.memo_assets where asset_id=p_asset_id for update;
 if found then raise exception 'MEMO_OPERATION_CONFLICT'; end if;
 if (select coalesce(sum(byte_size),0) from public.memo_assets where memo_id=p_memo_id and state<>'deleted')+p_byte_size>1073741824 then raise exception 'MEMO_QUOTA_EXCEEDED'; end if;
 insert into public.memo_assets(asset_id,memo_id,generation,storage_path,original_name,mime_type,byte_size,checksum) values(p_asset_id,p_memo_id,p_generation,p_memo_id::text||'/'||p_generation::text||'/'||p_asset_id::text,p_original_name,p_mime_type,p_byte_size,p_checksum) returning * into a;
 result:=jsonb_build_object('asset_id',p_asset_id,'storage_path',a.storage_path,'state',a.state);
 insert into public.memo_operation_receipts(operation_id,memo_id,generation,actor_id,payload_hash,result) values(p_operation_id,p_memo_id,p_generation,p_actor_id,fingerprint,result);
 return result;
end;
$$;
revoke all on function public.memo_reserve_asset(uuid,uuid,uuid,uuid,uuid,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.memo_reserve_asset(uuid,uuid,uuid,uuid,uuid,text,text,bigint,text) to service_role;

-- Objects are immutable after trusted verification; users cannot remove an acknowledged original.
drop policy if exists memo_asset_insert on storage.objects;
create policy memo_asset_insert on storage.objects for insert to authenticated with check (
 bucket_id='memo-assets' and exists(select 1 from public.memo_assets a join public.memo_memos m on m.memo_id=a.memo_id where a.storage_path=name and a.state='reserved' and a.generation=m.generation and m.closed_at is null and m.owner_id=(select auth.uid()))
);
drop policy if exists memo_asset_read on storage.objects;
create policy memo_asset_read on storage.objects for select to authenticated using (
 bucket_id='memo-assets' and exists(select 1 from public.memo_assets a join public.memo_memos m on m.memo_id=a.memo_id where a.storage_path=name and a.state='verified' and a.generation=m.generation and m.closed_at is null and m.owner_id=(select auth.uid()))
);
drop policy if exists memo_asset_delete on storage.objects;

create or replace function public.memo_fetch_changes(p_actor_id uuid,p_memo_id uuid,p_generation uuid,p_after bigint,p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.memo_memos; minimum_position bigint; changes jsonb;
begin
 select * into m from public.memo_memos where memo_id=p_memo_id;
 if m.memo_id is null or m.owner_id<>p_actor_id then raise exception 'MEMO_NOT_ALLOWED'; end if;
 if m.generation<>p_generation or m.closed_at is not null then raise exception 'MEMO_GENERATION_UNSUPPORTED'; end if;
 if p_after is null or p_after<0 or p_after>m.change_position or p_limit is null or p_limit not between 1 and 100 then raise exception 'MEMO_INVALID_REQUEST'; end if;
 select coalesce(min(change_position),m.change_position+1) into minimum_position from public.memo_changes where memo_id=p_memo_id and generation=p_generation;
 select coalesce(jsonb_agg(to_jsonb(c) order by c.change_position),'[]'::jsonb) into changes from (select * from public.memo_changes where memo_id=p_memo_id and generation=p_generation and change_position>p_after order by change_position limit p_limit)c;
 return jsonb_build_object('changes',changes,'minimum_position',minimum_position,'has_more',p_after+jsonb_array_length(changes)<m.change_position);
end;
$$;

create or replace function public.memo_create_snapshot(p_actor_id uuid,p_memo_id uuid,p_generation uuid,p_snapshot_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.memo_memos; s public.memo_snapshots;
begin
 select * into m from public.memo_memos where memo_id=p_memo_id for update;
 if m.memo_id is null or m.owner_id<>p_actor_id then raise exception 'MEMO_NOT_ALLOWED'; end if;
 if m.generation<>p_generation or m.closed_at is not null then raise exception 'MEMO_GENERATION_UNSUPPORTED'; end if;
 select * into s from public.memo_snapshots where snapshot_id=p_snapshot_id;
 if found then
   if s.memo_id<>p_memo_id or s.generation<>p_generation then raise exception 'MEMO_OPERATION_CONFLICT'; end if;
   if s.expires_at<=now() or s.state<>'ready' then raise exception 'MEMO_SNAPSHOT_EXPIRED'; end if;
 else
   insert into public.memo_snapshots(snapshot_id,memo_id,generation,watermark,expires_at) values(p_snapshot_id,p_memo_id,p_generation,m.change_position,now()+interval '15 minutes') returning * into s;
   insert into public.memo_snapshot_items(snapshot_id,revision_id)
   select s.snapshot_id,r.revision_id from (select distinct on (entity_type,entity_id) revision_id from public.memo_item_revisions where memo_id=p_memo_id and generation=p_generation and revision<=m.revision order by entity_type,entity_id,revision desc)r;
 end if;
 return jsonb_build_object('snapshot_id',s.snapshot_id,'memo_id',s.memo_id,'generation',s.generation,'watermark',s.watermark,'expires_at',extract(epoch from s.expires_at)*1000,'item_count',(select count(*) from public.memo_snapshot_items where snapshot_id=s.snapshot_id));
end;
$$;

create or replace function public.memo_read_snapshot(p_actor_id uuid,p_memo_id uuid,p_generation uuid,p_snapshot_id uuid,p_after bigint default 0,p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.memo_snapshots; entries jsonb; total bigint;
begin
 if not exists(select 1 from public.memo_memos where memo_id=p_memo_id and generation=p_generation and closed_at is null and owner_id=p_actor_id) then raise exception 'MEMO_NOT_ALLOWED'; end if;
 select * into s from public.memo_snapshots where snapshot_id=p_snapshot_id and memo_id=p_memo_id and generation=p_generation;
 if not found or s.state<>'ready' or s.expires_at<=now() then raise exception 'MEMO_SNAPSHOT_EXPIRED'; end if;
 if p_after is null or p_after<0 or p_limit is null or p_limit not between 1 and 100 then raise exception 'MEMO_INVALID_REQUEST'; end if;
 select count(*) into total from public.memo_snapshot_items where snapshot_id=p_snapshot_id;
 select coalesce(jsonb_agg(to_jsonb(c) order by c.change_position),'[]'::jsonb) into entries from (
 select r.memo_id,r.generation,r.entity_id,r.entity_type,r.revision,r.payload,r.deleted,receipt.operation_id,(receipt.result->>'change_position')::bigint as change_position from public.memo_snapshot_items si join public.memo_item_revisions r on r.revision_id=si.revision_id join public.memo_operation_receipts receipt on receipt.memo_id=r.memo_id and receipt.generation=r.generation and (receipt.result->>'remote_revision')::bigint=r.revision
 where si.snapshot_id=p_snapshot_id order by (receipt.result->>'change_position')::bigint offset p_after limit p_limit)c;
 return jsonb_build_object('changes',entries,'watermark',s.watermark,'has_more',p_after+jsonb_array_length(entries)<total,'next_offset',p_after+jsonb_array_length(entries));
end;
$$;
revoke all on function public.memo_read_snapshot(uuid,uuid,uuid,uuid,bigint,integer) from public,anon,authenticated;
grant execute on function public.memo_read_snapshot(uuid,uuid,uuid,uuid,bigint,integer) to service_role;

create or replace function public.memo_finalize_asset(p_actor_id uuid,p_memo_id uuid,p_generation uuid,p_asset_id uuid,p_checksum text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.memo_assets;
begin
 perform 1 from public.memo_memos where memo_id=p_memo_id and generation=p_generation and owner_id=p_actor_id and closed_at is null for update;
 if not found then raise exception 'MEMO_NOT_ALLOWED'; end if;
 select * into a from public.memo_assets where asset_id=p_asset_id and memo_id=p_memo_id and generation=p_generation for update;
 if not found or p_checksum is null or p_checksum !~ '^(md5:[a-f0-9]{32}|sha256:[a-f0-9]{64})$' then raise exception 'MEMO_INVALID_REQUEST'; end if;
 if a.checksum is not null and a.checksum<>p_checksum then raise exception 'MEMO_ASSET_CHECKSUM_MISMATCH'; end if;
 -- This service-only function receives the digest computed from Storage bytes by memo-sync.
 update public.memo_assets set state='verified',verified_at=now(),checksum=p_checksum where asset_id=p_asset_id;
 return jsonb_build_object('asset_id',p_asset_id,'state','verified');
end;
$$;


create table if not exists private.memo_note_blocks (
 operation_id uuid not null, memo_id uuid not null references public.memo_memos(memo_id), generation uuid not null,
 actor_id uuid not null references auth.users(id), block_index integer not null check(block_index between 0 and 30),
 body text not null check(char_length(body)<=16384), created_at timestamptz not null default now(), primary key(operation_id,block_index)
);
revoke all on private.memo_note_blocks from public,anon,authenticated;
create or replace function public.memo_stage_note_block(p_actor_id uuid,p_memo_id uuid,p_generation uuid,p_operation_id uuid,p_index integer,p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare prior private.memo_note_blocks;
begin
 if p_index is null or p_index not between 0 and 30 or p_body is null or char_length(p_body)>16384 or p_operation_id is null then raise exception 'MEMO_INVALID_REQUEST'; end if;
 perform 1 from public.memo_memos where memo_id=p_memo_id and generation=p_generation and owner_id=p_actor_id and closed_at is null for update;
 if not found then raise exception 'MEMO_NOT_ALLOWED'; end if;
 select * into prior from private.memo_note_blocks where operation_id=p_operation_id and block_index=p_index;
 if found then
   if prior.memo_id<>p_memo_id or prior.generation<>p_generation or prior.actor_id<>p_actor_id or prior.body<>p_body then raise exception 'MEMO_OPERATION_CONFLICT'; end if;
 else
   if (select count(*) from private.memo_note_blocks where memo_id=p_memo_id and created_at>now()-interval '1 day')>=3100 then raise exception 'MEMO_QUOTA_EXCEEDED'; end if;
   insert into private.memo_note_blocks(operation_id,memo_id,generation,actor_id,block_index,body) values(p_operation_id,p_memo_id,p_generation,p_actor_id,p_index,p_body);
 end if;
 return jsonb_build_object('staged',true);
end;
$$;
create or replace function public.memo_commit_note(p_actor_id uuid,p_memo_id uuid,p_generation uuid,p_operation_id uuid,p_entity_id uuid,p_base_revision bigint,p_predecessor_id uuid,p_payload jsonb,p_count integer,p_digest text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare body text; blocks bigint;
begin
 if p_count is null or p_count not between 1 and 31 or p_digest is null then raise exception 'MEMO_INVALID_REQUEST'; end if;
 select string_agg(b.body,'' order by b.block_index),count(*) into body,blocks from private.memo_note_blocks b where operation_id=p_operation_id and memo_id=p_memo_id and generation=p_generation and actor_id=p_actor_id and block_index<p_count;
 if blocks<>p_count or char_length(body)>500000 or encode(extensions.digest(body,'sha256'),'hex')<>p_digest then raise exception 'MEMO_INVALID_REQUEST'; end if;
 return public.memo_apply_mutation(p_actor_id,p_memo_id,p_generation,p_operation_id,p_entity_id,'note',p_base_revision,p_predecessor_id,p_payload||jsonb_build_object('body',body),false);
end;
$$;
revoke all on function public.memo_stage_note_block(uuid,uuid,uuid,uuid,integer,text),public.memo_commit_note(uuid,uuid,uuid,uuid,uuid,bigint,uuid,jsonb,integer,text) from public,anon,authenticated;
grant execute on function public.memo_stage_note_block(uuid,uuid,uuid,uuid,integer,text),public.memo_commit_note(uuid,uuid,uuid,uuid,uuid,bigint,uuid,jsonb,integer,text) to service_role;



alter table public.memo_reminder_preferences add column if not exists push_token text;
create or replace function private.memo_reminder_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target jsonb; trigger_ms bigint; current_state text;
begin
 if new.entity_type='trash' and coalesce((new.payload->>'deleted')::boolean,false) then
   update public.memo_reminder_occurrences set state='cancelled',lease_expires_at=null where memo_id=new.memo_id and generation=new.generation and state in ('pending','claimed','failed');
 elsif new.entity_type='reminder' then
   if new.payload->>'state' not in ('ready','suspended','completed','cancelled') or new.payload->>'mode' not in ('regular','alarm') or jsonb_typeof(new.payload->'item_ids') is distinct from 'array' then raise exception 'MEMO_INVALID_REQUEST'; end if;
   for target in select value from jsonb_array_elements(new.payload->'item_ids') loop
     if not exists(select 1 from public.memo_item_revisions where memo_id=new.memo_id and generation=new.generation and entity_id=(target#>>'{}')::uuid and entity_type in ('item','note','asset') and not deleted) then raise exception 'MEMO_INVALID_REQUEST'; end if;
   end loop;
   update public.memo_reminder_occurrences set state='cancelled',lease_expires_at=null where memo_id=new.memo_id and reminder_id=new.entity_id and state in ('pending','claimed','failed');
   if new.payload->>'state'='ready' and new.payload->>'target_set_state'='ready' and new.payload->>'next_occurrence_at' is not null then
     trigger_ms:=(new.payload->>'next_occurrence_at')::bigint;
     insert into public.memo_reminder_occurrences(occurrence_id,memo_id,generation,reminder_id,occurrence_at)
     values(new.entity_id::text||':'||(new.payload->>'schedule_revision')||':'||trigger_ms::text,new.memo_id,new.generation,new.entity_id,to_timestamp(trigger_ms/1000.0)) on conflict(occurrence_id) do nothing;
   end if;
 end if;
 return new;
end;
$$;
drop trigger if exists memo_reminder_revision on public.memo_item_revisions;
create trigger memo_reminder_revision after insert on public.memo_item_revisions for each row execute function private.memo_reminder_revision();

create or replace function private.memo_claim_reminder_occurrences(p_limit integer default 100)
returns setof public.memo_reminder_occurrences language plpgsql security definer set search_path = '' as $$
declare occurrence public.memo_reminder_occurrences;
begin
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'MEMO_INVALID_REQUEST'; end if;
 for occurrence in select o.* from public.memo_reminder_occurrences o join public.memo_memos m on m.memo_id=o.memo_id and m.generation=o.generation and m.closed_at is null
 where (o.state in ('pending','failed') or o.state='claimed' and o.lease_expires_at<now()) and o.attempt<5 and o.next_attempt_at<=now() and o.occurrence_at<=now()
 and exists(select 1 from public.memo_members where memo_id=m.memo_id and user_id=m.owner_id and role='owner' and revoked_at is null)
 order by o.occurrence_at limit p_limit for update of o skip locked loop
   update public.memo_reminder_occurrences set state='claimed',attempt=attempt+1,claimed_by=extensions.gen_random_uuid(),lease_expires_at=now()+interval '60 seconds' where occurrence_id=occurrence.occurrence_id returning * into occurrence;
   return next occurrence;
 end loop;
end;
$$;

create or replace function public.memo_reminder_recipients(p_occurrence_id text,p_lease uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o public.memo_reminder_occurrences; m public.memo_memos; result jsonb;
begin
 select * into o from public.memo_reminder_occurrences where occurrence_id=p_occurrence_id and claimed_by=p_lease and state='claimed' and lease_expires_at>now();
 if not found then raise exception 'MEMO_NOT_ALLOWED'; end if;
 select * into m from public.memo_memos where memo_id=o.memo_id and generation=o.generation and closed_at is null;
 if not found then raise exception 'MEMO_NOT_ALLOWED'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('token',p.push_token,'user_id',p.user_id,'device_id',p.device_id,'sounds',p.sounds,'vibration',p.vibration)),'[]'::jsonb) into result from public.memo_reminder_preferences p
 where p.memo_id=m.memo_id and p.user_id=m.owner_id and p.enabled and p.push_token is not null
 and exists(select 1 from public.memo_members where memo_id=m.memo_id and user_id=p.user_id and role='owner' and revoked_at is null) and not exists(select 1 from private.memo_reminder_delivery d where d.occurrence_id=o.occurrence_id and d.device_id=p.device_id and d.accepted_at is not null);
 return result;
end;
$$;
create or replace function public.memo_finish_reminder(p_occurrence_id text,p_lease uuid,p_accepted boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
 update public.memo_reminder_occurrences set state=case when p_accepted then 'accepted' else 'failed' end,lease_expires_at=null,next_attempt_at=now()+interval '5 minutes'
 where occurrence_id=p_occurrence_id and claimed_by=p_lease and state='claimed';
 if not found then raise exception 'MEMO_NOT_ALLOWED'; end if;
end;
$$;
revoke all on function public.memo_reminder_recipients(text,uuid), public.memo_finish_reminder(text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.memo_reminder_recipients(text,uuid), public.memo_finish_reminder(text,uuid,boolean) to service_role;

create table if not exists private.memo_reminder_delivery (
 occurrence_id text not null references public.memo_reminder_occurrences(occurrence_id) on delete cascade,
 device_id uuid not null, accepted_at timestamptz, primary key(occurrence_id,device_id)
);
revoke all on private.memo_reminder_delivery from public,anon,authenticated;
create or replace function public.memo_record_reminder_delivery(p_occurrence_id text,p_lease uuid,p_device_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.memo_reminder_occurrences where occurrence_id=p_occurrence_id and claimed_by=p_lease and state='claimed' and lease_expires_at>now()) then raise exception 'MEMO_NOT_ALLOWED'; end if;
 insert into private.memo_reminder_delivery(occurrence_id,device_id,accepted_at) values(p_occurrence_id,p_device_id,now()) on conflict(occurrence_id,device_id) do update set accepted_at=excluded.accepted_at;
end;
$$;
create or replace function public.memo_set_reminder_preferences(p_actor_id uuid,p_memo_id uuid,p_device_id uuid,p_enabled boolean,p_sounds boolean,p_vibration boolean,p_push_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
 if p_device_id is null or p_enabled is null or p_sounds is null or p_vibration is null then raise exception 'MEMO_INVALID_REQUEST'; end if;
 if not exists(select 1 from public.memo_memos where memo_id=p_memo_id and owner_id=p_actor_id and closed_at is null) then raise exception 'MEMO_NOT_ALLOWED'; end if;
 if p_push_token is not null and not exists(select 1 from public.push_tokens where token=p_push_token and user_id=p_actor_id) then raise exception 'MEMO_NOT_ALLOWED'; end if;
 insert into public.memo_reminder_preferences(memo_id,user_id,device_id,enabled,sounds,vibration,push_token) values(p_memo_id,p_actor_id,p_device_id,p_enabled,p_sounds,p_vibration,p_push_token)
 on conflict(memo_id,user_id,device_id) do update set enabled=excluded.enabled,sounds=excluded.sounds,vibration=excluded.vibration,push_token=excluded.push_token,updated_at=now();
 return jsonb_build_object('saved',true);
end;
$$;
revoke all on function public.memo_record_reminder_delivery(text,uuid,uuid),public.memo_set_reminder_preferences(uuid,uuid,uuid,boolean,boolean,boolean,text) from public,anon,authenticated;
grant execute on function public.memo_record_reminder_delivery(text,uuid,uuid),public.memo_set_reminder_preferences(uuid,uuid,uuid,boolean,boolean,boolean,text) to service_role;
-- Preferences are changed through a service contract that verifies token ownership.
drop policy if exists memo_reminder_prefs_owner on public.memo_reminder_preferences;
create policy memo_reminder_prefs_owner on public.memo_reminder_preferences for select to authenticated using(user_id=(select auth.uid()));


create or replace function public.memo_prepare_close(p_actor_id uuid,p_memo_id uuid,p_generation uuid,p_operation_id uuid,p_expected_revision bigint,p_complete boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.memo_memos;
begin
 if p_complete is distinct from true or p_operation_id is null then raise exception 'MEMO_INVALID_REQUEST'; end if;
 select * into m from public.memo_memos where memo_id=p_memo_id for update;
 if m.memo_id is null or m.owner_id<>p_actor_id then raise exception 'MEMO_NOT_ALLOWED'; end if;
 if m.generation<>p_generation or m.revision<>p_expected_revision then raise exception 'MEMO_REVISION_CONFLICT'; end if;
 update public.memo_memos set closed_at=coalesce(closed_at,now()) where memo_id=p_memo_id;
 update public.memo_reminder_occurrences set state='cancelled',lease_expires_at=null where memo_id=p_memo_id and state not in ('completed','accepted');
 return jsonb_build_object('closing',true);
end;
$$;
create or replace function public.memo_close_remote_copy(p_actor_id uuid,p_memo_id uuid,p_generation uuid,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.memo_memos; receipt public.memo_operation_receipts; result jsonb;
begin
 select * into m from public.memo_memos where memo_id=p_memo_id for update;
 if m.memo_id is null or m.owner_id<>p_actor_id then raise exception 'MEMO_NOT_ALLOWED'; end if;
 select * into receipt from public.memo_operation_receipts where operation_id=p_operation_id;
 if found then
   if receipt.actor_id<>p_actor_id or receipt.memo_id<>p_memo_id or receipt.generation<>p_generation or receipt.result->>'closed'<>'true' then raise exception 'MEMO_OPERATION_CONFLICT'; end if;
   return receipt.result;
 end if;
 if m.generation<>p_generation or m.closed_at is null then raise exception 'MEMO_GENERATION_UNSUPPORTED'; end if;
 if exists(select 1 from storage.objects o join public.memo_assets a on a.storage_path=o.name where o.bucket_id='memo-assets' and a.memo_id=p_memo_id) then return jsonb_build_object('closing',true); end if;
 update public.memo_snapshots set state='invalidated' where memo_id=p_memo_id;
 delete from public.memo_snapshot_items where snapshot_id in(select snapshot_id from public.memo_snapshots where memo_id=p_memo_id);
 delete from public.memo_item_revisions where memo_id=p_memo_id;
 delete from public.memo_changes where memo_id=p_memo_id;
 delete from public.memo_assets where memo_id=p_memo_id;
 delete from private.memo_note_blocks where memo_id=p_memo_id;
 update public.memo_memos set title='Removed remote copy',description='' where memo_id=p_memo_id;
 result:=jsonb_build_object('operation_id',p_operation_id,'memo_id',p_memo_id,'generation',p_generation,'remote_revision',m.revision,'change_position',m.change_position,'closed',true);
 insert into public.memo_operation_receipts(operation_id,memo_id,generation,actor_id,payload_hash,result) values(p_operation_id,p_memo_id,p_generation,p_actor_id,md5(result::text),result);
 return result;
end;
$$;
revoke all on function public.memo_prepare_close(uuid,uuid,uuid,uuid,bigint,boolean) from public,anon,authenticated;
grant execute on function public.memo_prepare_close(uuid,uuid,uuid,uuid,bigint,boolean) to service_role;


create or replace function public.memo_note_history(p_actor_id uuid,p_memo_id uuid,p_generation uuid,p_after bigint,p_watermark bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare entries jsonb;
begin
 if not exists(select 1 from public.memo_memos where memo_id=p_memo_id and generation=p_generation and owner_id=p_actor_id and closed_at is null) then raise exception 'MEMO_NOT_ALLOWED'; end if;
 if p_after is null or p_after<0 or p_watermark is null or p_watermark<0 then raise exception 'MEMO_INVALID_REQUEST'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into entries from (
 select revision_id,revision,payload,extract(epoch from created_at)*1000 as created_at from public.memo_item_revisions
 where memo_id=p_memo_id and generation=p_generation and entity_type='note' and not deleted and revision>p_after and revision<=p_watermark+1 order by revision limit 1)r;
 return jsonb_build_object('revisions',entries);
end;
$$;
revoke all on function public.memo_note_history(uuid,uuid,uuid,bigint,bigint) from public,anon,authenticated;
grant execute on function public.memo_note_history(uuid,uuid,uuid,bigint,bigint) to service_role;

alter table public.memo_memos add column if not exists protection_required boolean not null default false;
create or replace function public.memo_create(p_actor_id uuid,p_memo_id uuid,p_generation uuid,p_operation_id uuid,p_title text,p_description text,p_residency text,p_protection_required boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare created_result jsonb;
begin
 if p_protection_required is null then raise exception 'MEMO_INVALID_REQUEST'; end if;
 created_result:=public.memo_create(p_actor_id,p_memo_id,p_generation,p_operation_id,p_title,p_description,p_residency);
 if created_result ? 'protection_required' and (created_result->>'protection_required')::boolean<>p_protection_required then raise exception 'MEMO_OPERATION_CONFLICT'; end if;
 update public.memo_memos set protection_required=p_protection_required where memo_id=p_memo_id and generation=p_generation;
 created_result:=created_result||jsonb_build_object('protection_required',p_protection_required);
 update public.memo_operation_receipts set result=created_result where operation_id=p_operation_id;
 return created_result;
end;
$$;
revoke all on function public.memo_create(uuid,uuid,uuid,uuid,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.memo_create(uuid,uuid,uuid,uuid,text,text,text,boolean) to service_role;
create or replace function private.memo_protection_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.entity_type='memo' then
   if new.payload ? 'protection_required' then
     if jsonb_typeof(new.payload->'protection_required')<>'boolean' then raise exception 'MEMO_INVALID_REQUEST'; end if;
     update public.memo_memos set protection_required=(new.payload->>'protection_required')::boolean where memo_id=new.memo_id and generation=new.generation;
   end if;
   update public.memo_memos set title=coalesce(new.payload->>'title',title),description=coalesce(new.payload->>'description',description) where memo_id=new.memo_id and generation=new.generation;
 end if;
 return new;
end;
$$;
drop trigger if exists memo_protection_revision on public.memo_item_revisions;
create trigger memo_protection_revision after insert on public.memo_item_revisions for each row execute function private.memo_protection_revision();
revoke all on function private.memo_protection_revision() from public,anon,authenticated;

create or replace function public.memo_dispatch_schedule(p_occurrence_id text,p_lease uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o public.memo_reminder_occurrences; result jsonb;
begin
 select * into o from public.memo_reminder_occurrences where occurrence_id=p_occurrence_id and claimed_by=p_lease and state='claimed' and lease_expires_at>now();
 if not found then raise exception 'MEMO_NOT_ALLOWED'; end if;
 select payload into result from public.memo_item_revisions where memo_id=o.memo_id and generation=o.generation and entity_id=o.reminder_id and entity_type='reminder' order by revision desc limit 1;
 return result;
end;
$$;
create or replace function public.memo_finish_reminder(p_occurrence_id text,p_lease uuid,p_accepted boolean,p_next_at bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.memo_reminder_occurrences; current_payload jsonb; next_id text;
begin
 select * into o from public.memo_reminder_occurrences where occurrence_id=p_occurrence_id;
 if not found then raise exception 'MEMO_NOT_ALLOWED'; end if;
 perform 1 from public.memo_memos where memo_id=o.memo_id and generation=o.generation and closed_at is null for update;
 if not found then raise exception 'MEMO_NOT_ALLOWED'; end if;
 perform public.memo_finish_reminder(p_occurrence_id,p_lease,p_accepted);
 if not p_accepted or p_next_at is null then return; end if;
 if p_next_at<=floor(extract(epoch from now())*1000)::bigint or p_next_at>floor(extract(epoch from now()+interval '366 days')*1000)::bigint then raise exception 'MEMO_INVALID_REQUEST'; end if;
 select payload into current_payload from public.memo_item_revisions where memo_id=o.memo_id and generation=o.generation and entity_id=o.reminder_id and entity_type='reminder' order by revision desc limit 1;
 if current_payload->>'state'<>'ready' or current_payload->>'target_set_state'<>'ready' or current_payload->>'schedule_revision'<>split_part(o.occurrence_id,':',2) then return; end if;
 next_id:=o.reminder_id::text||':'||(current_payload->>'schedule_revision')||':'||p_next_at::text;
 insert into public.memo_reminder_occurrences(occurrence_id,memo_id,generation,reminder_id,occurrence_at) values(next_id,o.memo_id,o.generation,o.reminder_id,to_timestamp(p_next_at/1000.0)) on conflict(occurrence_id) do nothing;
end;
$$;
create or replace function public.memo_run_maintenance(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare expired integer;
begin
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'MEMO_INVALID_REQUEST'; end if;
 with batch as(select snapshot_id from public.memo_snapshots where state='ready' and expires_at<=now() order by expires_at limit p_limit for update skip locked)
 update public.memo_snapshots set state='expired' where snapshot_id in(select snapshot_id from batch);
 get diagnostics expired=row_count;
 delete from public.memo_snapshot_items where snapshot_id in(select snapshot_id from public.memo_snapshots where state in ('expired','invalidated') order by expires_at limit p_limit);
 delete from private.memo_note_blocks where (operation_id,block_index) in(select operation_id,block_index from private.memo_note_blocks where created_at<now()-interval '1 day' and not exists(select 1 from public.memo_operation_receipts where operation_id=memo_note_blocks.operation_id) order by created_at limit p_limit);
 return jsonb_build_object('expired_snapshots',expired);
end;
$$;
revoke all on function public.memo_dispatch_schedule(text,uuid), public.memo_finish_reminder(text,uuid,boolean,bigint),public.memo_run_maintenance(integer) from public,anon,authenticated;
grant execute on function public.memo_dispatch_schedule(text,uuid), public.memo_finish_reminder(text,uuid,boolean,bigint),public.memo_run_maintenance(integer) to service_role;

do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='memo_changes') then
   alter publication supabase_realtime add table public.memo_changes;
 end if;
end $$;

-- Supabase Auth owns OTP generation, email delivery and code verification.
-- Local-purpose challenges independently bind the PIN reset to the account/device.
alter table private.memo_pin_reset_challenges add column if not exists verification_id uuid;
alter table private.memo_pin_reset_challenges add column if not exists verification_expires_at timestamptz;
create or replace function public.memo_pin_reset_begin_otp(p_challenge_id uuid,p_account_id uuid,p_device_nonce text,p_verification_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c private.memo_pin_reset_challenges;
begin
 if p_device_nonce is null or p_verification_id is null then return jsonb_build_object('allowed',false); end if;
 select * into c from private.memo_pin_reset_challenges where challenge_id=p_challenge_id and account_id=p_account_id for update;
 if not found or c.device_nonce<>p_device_nonce or c.expires_at<=now() or c.consumed_at is not null or c.attempts>=5 or c.verification_expires_at>now() then return jsonb_build_object('allowed',false); end if;
 update private.memo_pin_reset_challenges set attempts=attempts+1,verification_id=p_verification_id,verification_expires_at=now()+interval '30 seconds' where challenge_id=p_challenge_id;
 return jsonb_build_object('allowed',true);
end;
$$;
create or replace function public.memo_pin_reset_finish_otp(p_challenge_id uuid,p_account_id uuid,p_device_nonce text,p_verification_id uuid,p_authorized boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c private.memo_pin_reset_challenges;
begin
 if p_device_nonce is null or p_verification_id is null or p_authorized is null then return jsonb_build_object('authorized',false); end if;
 select * into c from private.memo_pin_reset_challenges where challenge_id=p_challenge_id and account_id=p_account_id for update;
 if not found or c.device_nonce<>p_device_nonce or c.verification_id is distinct from p_verification_id or c.verification_expires_at<=now() or c.expires_at<=now() or c.consumed_at is not null then return jsonb_build_object('authorized',false); end if;
 update private.memo_pin_reset_challenges set consumed_at=case when p_authorized then now() else consumed_at end,verification_id=null,verification_expires_at=null where challenge_id=p_challenge_id;
 return jsonb_build_object('authorized',p_authorized);
end;
$$;
revoke all on function public.memo_pin_reset_begin_otp(uuid,uuid,text,uuid),public.memo_pin_reset_finish_otp(uuid,uuid,text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.memo_pin_reset_begin_otp(uuid,uuid,text,uuid),public.memo_pin_reset_finish_otp(uuid,uuid,text,uuid,boolean) to service_role;
