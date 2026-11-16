-- Required Phase 6 database contracts. Run only on a disposable test target.
begin;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
do $$
declare
 a uuid:='00000000-0000-4000-8000-000000000001'; b uuid:='00000000-0000-4000-8000-000000000002';
 m uuid:='10000000-0000-4000-8000-000000000001'; g uuid:='20000000-0000-4000-8000-000000000001';
 o uuid:='30000000-0000-4000-8000-000000000001'; edit uuid:='40000000-0000-4000-8000-000000000001';
 c uuid:='50000000-0000-4000-8000-000000000001'; receipt jsonb; replay jsonb; accepted boolean;
 note_op uuid:='60000000-0000-4000-8000-000000000001'; snap uuid:='70000000-0000-4000-8000-000000000001'; long_body text:=repeat('😀',500000); block integer;
 reminder_id uuid:='80000000-0000-4000-8000-000000000001'; device_id uuid:='90000000-0000-4000-8000-000000000001'; occurrence public.memo_reminder_occurrences; due bigint;
begin
 receipt:=public.memo_create(a,m,g,o,'Test memo','','keep_all',true);
 if receipt->>'operation_id'<>o::text or receipt->>'remote_revision'<>'1' or receipt->>'change_position'<>'0' then raise exception 'Bootstrap acknowledgment contract failed'; end if;
 if not (select protection_required from public.memo_memos where memo_id=m) then raise exception 'Protected cloud metadata missing'; end if;
 replay:=public.memo_create(a,m,g,o,'Test memo','','keep_all',true);
 if replay<>receipt then raise exception 'Lost response replay changed result'; end if;
 begin perform public.memo_create(a,m,g,o,'Test memo','','keep_all',false); raise exception 'Changed protection replay accepted'; exception when raise_exception then if SQLERRM<>'MEMO_OPERATION_CONFLICT' then raise; end if; end;
 begin perform public.memo_create(b,m,g,o,'Test memo','','keep_all'); raise exception 'Foreign receipt replay accepted'; exception when raise_exception then if SQLERRM<>'MEMO_OPERATION_CONFLICT' then raise; end if; end;
 begin perform public.memo_create(a,m,g,o,'Changed payload','','keep_all'); raise exception 'Changed payload replay accepted'; exception when raise_exception then if SQLERRM<>'MEMO_OPERATION_CONFLICT' then raise; end if; end;
 receipt:=public.memo_apply_mutation(a,m,g,edit,c,'item',1,o,'{"text":"offline text","created_at":12}',false);
 replay:=public.memo_apply_mutation(a,m,g,edit,c,'item',1,o,'{"text":"offline text","created_at":12}',false);
 if replay<>receipt or (select count(*) from public.memo_changes where memo_id=m)<>1 then raise exception 'Mutation response-loss duplication'; end if;
 begin perform public.memo_apply_mutation(b,m,g,edit,c,'item',1,o,'{"text":"offline text","created_at":12}',false); raise exception 'Unauthorized mutation receipt accepted'; exception when raise_exception then if SQLERRM<>'MEMO_NOT_ALLOWED' then raise; end if; end;
 begin perform public.memo_apply_mutation(a,m,g,edit,c,'item',1,o,'{"text":"different"}',false); raise exception 'Changed mutation accepted'; exception when raise_exception then if SQLERRM<>'MEMO_OPERATION_CONFLICT' then raise; end if; end;
 begin perform public.memo_apply_mutation(a,m,g,gen_random_uuid(),c,'item',1,o,'{"text":"stale"}',false); raise exception 'Stale revision accepted'; exception when raise_exception then if SQLERRM<>'MEMO_REVISION_CONFLICT' then raise; end if; end;
 for block in 0..30 loop
   perform public.memo_stage_note_block(a,m,g,note_op,block,substring(long_body from block*16384+1 for 16384));
 end loop;
 receipt:=public.memo_commit_note(a,m,g,note_op,note_op,2,edit,'{"title":"Large note","description":""}',31,encode(extensions.digest(long_body,'sha256'),'hex'));
 if receipt->>'remote_revision'<>'3' or (select char_length(payload->>'body') from public.memo_item_revisions where entity_type='note' and memo_id=m)<>500000 then raise exception 'Large Unicode note publication failed'; end if;
 if public.memo_commit_note(a,m,g,note_op,note_op,2,edit,'{"title":"Large note","description":""}',31,encode(extensions.digest(long_body,'sha256'),'hex'))<>receipt then raise exception 'Chunked note lost-response replay failed'; end if;
 begin perform public.memo_stage_note_block(a,m,g,note_op,0,'changed'); raise exception 'Mutable note block accepted'; exception when raise_exception then if SQLERRM<>'MEMO_OPERATION_CONFLICT' then raise; end if; end;
 receipt:=public.memo_create_snapshot(a,m,g,snap);
 perform public.memo_apply_mutation(a,m,g,gen_random_uuid(),c,'item',3,note_op,'{"text":"later edit"}',false);
 if public.memo_create_snapshot(a,m,g,snap)<>receipt then raise exception 'Snapshot watermark changed after mutation'; end if;
 delete from public.memo_changes where memo_id=m and change_position<=2;
 replay:=public.memo_read_snapshot(a,m,g,snap,0,50);
 if jsonb_array_length(replay->'changes')<>2 or replay->>'watermark'<>'2' or replay->'changes'->0->'payload'->>'text'<>'offline text' then raise exception 'Immutable snapshot lost pruned content'; end if;
 begin perform public.memo_read_snapshot(b,m,g,snap,0,50); raise exception 'Foreign snapshot read'; exception when raise_exception then if SQLERRM<>'MEMO_NOT_ALLOWED' then raise; end if; end;
 receipt:=public.memo_reserve_asset(a,m,g,gen_random_uuid(),snap,'test.bin','application/octet-stream',5,'md5:5d41402abc4b2a76b9719d911017c592');
 if receipt->>'storage_path'<>m::text||'/'||g::text||'/'||snap::text then raise exception 'Asset generation path missing'; end if;
 begin perform public.memo_reserve_asset(b,m,g,gen_random_uuid(),snap,'test.bin','application/octet-stream',5,null); raise exception 'Foreign asset overwrite'; exception when raise_exception then if SQLERRM<>'MEMO_NOT_ALLOWED' then raise; end if; end;
 begin perform public.memo_finalize_asset(a,m,g,snap,'md5:00000000000000000000000000000000'); raise exception 'Digest mismatch accepted'; exception when raise_exception then if SQLERRM<>'MEMO_ASSET_CHECKSUM_MISMATCH' then raise; end if; end;
 insert into public.push_tokens(token,user_id) values('ExponentPushToken[fixture-only]',a);
 perform public.memo_set_reminder_preferences(a,m,device_id,true,false,false,'ExponentPushToken[fixture-only]');
 due:=floor(extract(epoch from now())*1000)::bigint-1000;
 perform public.memo_apply_mutation(a,m,g,gen_random_uuid(),reminder_id,'reminder',4,null,jsonb_build_object('mode','regular','state','ready','target_set_state','ready','schedule_revision',1,'next_occurrence_at',due,'item_ids',jsonb_build_array(c)),false);
 select * into occurrence from public.memo_claim_reminder_occurrences(5);
 if occurrence.occurrence_id is null or occurrence.attempt<>1 then raise exception 'Due reminder was not claimed'; end if;
 if exists(select 1 from public.memo_claim_reminder_occurrences(5)) then raise exception 'Reminder claimed twice'; end if;
 if jsonb_array_length(public.memo_reminder_recipients(occurrence.occurrence_id,occurrence.claimed_by))<>1 then raise exception 'Reminder recipient preferences missing'; end if;
 begin perform public.memo_finish_reminder(occurrence.occurrence_id,gen_random_uuid(),true); raise exception 'Wrong reminder lease accepted'; exception when raise_exception then if SQLERRM<>'MEMO_NOT_ALLOWED' then raise; end if; end;
 perform public.memo_record_reminder_delivery(occurrence.occurrence_id,occurrence.claimed_by,device_id);
 if jsonb_array_length(public.memo_reminder_recipients(occurrence.occurrence_id,occurrence.claimed_by))<>0 then raise exception 'Accepted recipient redelivered'; end if;
 perform public.memo_finish_reminder(occurrence.occurrence_id,occurrence.claimed_by,false);
 update public.memo_reminder_occurrences set next_attempt_at=now()-interval '1 second' where occurrence_id=occurrence.occurrence_id;
 select * into occurrence from public.memo_claim_reminder_occurrences(5);
 if occurrence.attempt<>2 then raise exception 'Failed reminder not retried'; end if;
 perform public.memo_finish_reminder(occurrence.occurrence_id,occurrence.claimed_by,true,due+86400000);
 if not exists(select 1 from public.memo_reminder_occurrences where memo_id=m and state='pending' and occurrence_at>now()) then raise exception 'Recurring reminder successor missing'; end if;
 perform public.memo_apply_mutation(a,m,g,gen_random_uuid(),m,'trash',5,null,'{"deleted":true}',false);
 if exists(select 1 from public.memo_claim_reminder_occurrences(5)) then raise exception 'Trashed memo reminder dispatched'; end if;
 perform public.memo_pin_reset_create(c,a,'test-device-nonce-123',repeat('a',64),now()+interval '5 minutes');
 begin perform public.memo_pin_reset_create(gen_random_uuid(),a,'test-device-nonce-123',repeat('a',64),now()+interval '5 minutes'); raise exception 'Reset rate limit missing'; exception when raise_exception then if SQLERRM<>'MEMO_RATE_LIMITED' then raise; end if; end;
 if (public.memo_pin_reset_consume(c,a,null,null)->>'authorized')::boolean then raise exception 'Null reset bypass'; end if;
 if (public.memo_pin_reset_consume(c,b,'test-device-nonce-123',repeat('a',64))->>'authorized')::boolean then raise exception 'Wrong account reset'; end if;
 if (public.memo_pin_reset_consume(c,a,'wrong-device-nonce',repeat('a',64))->>'authorized')::boolean then raise exception 'Wrong device reset'; end if;
 if not (public.memo_pin_reset_consume(c,a,'test-device-nonce-123',repeat('a',64))->>'authorized')::boolean then raise exception 'Valid reset rejected'; end if;
 if (public.memo_pin_reset_consume(c,a,'test-device-nonce-123',repeat('a',64))->>'authorized')::boolean then raise exception 'Reset replay accepted'; end if;
 begin perform public.memo_prepare_close(a,m,g,gen_random_uuid(),6,false); raise exception 'Incomplete local copy accepted'; exception when raise_exception then if SQLERRM<>'MEMO_INVALID_REQUEST' then raise; end if; end;
 perform public.memo_prepare_close(a,m,g,snap,6,true);
 receipt:=public.memo_close_remote_copy(a,m,g,snap);
 if receipt->>'closed'<>'true' or exists(select 1 from public.memo_item_revisions where memo_id=m) then raise exception 'Remote payload cleanup incomplete'; end if;
 if public.memo_close_remote_copy(a,m,g,snap)<>receipt then raise exception 'Removal lost-response replay failed'; end if;
 receipt:=public.memo_create(a,m,b,gen_random_uuid(),'Relinked memo','','keep_all',false);
 if receipt->>'generation'<>b::text or receipt->>'remote_revision'<>'1' then raise exception 'Fresh generation re-link failed'; end if;
 begin perform public.memo_apply_mutation(a,m,g,gen_random_uuid(),c,'item',6,null,'{"text":"stale generation"}',false); raise exception 'Old device resurrected remote memo'; exception when raise_exception then if SQLERRM<>'MEMO_GENERATION_UNSUPPORTED' then raise; end if; end;
 if has_function_privilege('authenticated','public.memo_apply_mutation(uuid,uuid,uuid,uuid,uuid,text,bigint,uuid,jsonb,boolean)','execute') then raise exception 'Direct mutation grant'; end if;
end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ begin if exists(select 1 from public.memo_memos) or exists(select 1 from public.memo_changes) then raise exception 'RLS exposed private memo'; end if; end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$ begin if (select count(*) from public.memo_memos)<>1 then raise exception 'RLS blocked owner'; end if; end $$;
rollback;

-- Built-in Auth OTP verification is represented by a service-only authorization result.
-- Challenge leases still enforce purpose, account/device, one use and a persistent attempt bound.
begin;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000001');
do $$
declare a uuid:='00000000-0000-4000-8000-000000000001'; c uuid:=gen_random_uuid(); lease uuid:=gen_random_uuid(); i integer;
begin
 perform public.memo_pin_reset_create(c,a,'builtin-otp-device-nonce',repeat('a',64),now()+interval '5 minutes');
 if (public.memo_pin_reset_begin_otp(c,a,'wrong-device-nonce',lease)->>'allowed')::boolean then raise exception 'OTP device binding bypass'; end if;
 if not (public.memo_pin_reset_begin_otp(c,a,'builtin-otp-device-nonce',lease)->>'allowed')::boolean then raise exception 'OTP lease rejected'; end if;
 if (public.memo_pin_reset_begin_otp(c,a,'builtin-otp-device-nonce',gen_random_uuid())->>'allowed')::boolean then raise exception 'Concurrent OTP verification allowed'; end if;
 if (public.memo_pin_reset_finish_otp(c,a,'builtin-otp-device-nonce',gen_random_uuid(),true)->>'authorized')::boolean then raise exception 'Wrong OTP lease authorized'; end if;
 if not (public.memo_pin_reset_finish_otp(c,a,'builtin-otp-device-nonce',lease,true)->>'authorized')::boolean then raise exception 'Verified OTP lease rejected'; end if;
 if (public.memo_pin_reset_finish_otp(c,a,'builtin-otp-device-nonce',lease,true)->>'authorized')::boolean then raise exception 'OTP replay allowed'; end if;
 update private.memo_pin_reset_challenges set created_at=now()-interval '2 minutes' where challenge_id=c;
 c:=gen_random_uuid();
 perform public.memo_pin_reset_create(c,a,'builtin-otp-device-nonce',repeat('b',64),now()+interval '5 minutes');
 for i in 1..5 loop
   lease:=gen_random_uuid();
   if not (public.memo_pin_reset_begin_otp(c,a,'builtin-otp-device-nonce',lease)->>'allowed')::boolean then raise exception 'OTP attempt rejected before limit'; end if;
   perform public.memo_pin_reset_finish_otp(c,a,'builtin-otp-device-nonce',lease,false);
 end loop;
 if (public.memo_pin_reset_begin_otp(c,a,'builtin-otp-device-nonce',gen_random_uuid())->>'allowed')::boolean then raise exception 'OTP attempt limit bypass'; end if;
end;
$$;
rollback;
