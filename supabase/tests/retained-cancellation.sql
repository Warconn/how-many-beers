\set ON_ERROR_STOP on
begin;
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$begin if value is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end$$;
create function pg_temp.denied(statement text,label text) returns void language plpgsql as $$begin
 begin execute statement;exception when insufficient_privilege or check_violation or unique_violation or serialization_failure then raise notice 'PASS: %',label;return;end;
 raise exception 'FAIL: expected denial: %',label;
end$$;
create function pg_temp.meal(cook text,name text default 'Retained brisket') returns jsonb language sql as $$ select jsonb_build_object('version',1,'id',cook,'name',name,'serveAt','2026-11-08T18:00','dishes','[]'::jsonb,'completed','{}'::jsonb,'notes','{"prep":"original note"}'::jsonb,'mode','cooking','startedAt','2021-04-04T03:00:00Z','events','[{"id":"legacy:prep","taskId":"prep","kind":"completed","occurredAt":"2021-04-04T03:07:00Z"}]'::jsonb) $$;
create function pg_temp.doc(cook text,name text default 'Retained brisket',history jsonb default '[]') returns jsonb language sql as $$ select jsonb_build_object('active',jsonb_build_object('meal',pg_temp.meal(cook,name),'serveInstant','2026-11-08T23:00:00Z'),'history',history) $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select pg_temp.ok(public.load_cook_workspace(auth.uid())->'capabilities'->'cancelCook'='true'::jsonb,'installed schema advertises cancellation capability');
select jsonb_build_object('id','11000000-0000-4000-8000-000000000002','meal',pg_temp.meal('11000000-0000-4000-8000-000000000002','Finished dinner'),'serveInstant','2021-04-04T18:00:00Z','archivedAt','2021-04-04T19:00:00Z','plannedTimeline','[]'::jsonb,'feedback','Original outcome') as archive \gset
select public.save_cook_workspace(auth.uid(),0,'41000000-0000-4000-8000-000000000001',pg_temp.doc('11000000-0000-4000-8000-000000000001','Retained brisket',jsonb_build_array(:'archive'::jsonb)),'America/New_York');
select public.save_cook_workspace(auth.uid(),1,'41000000-0000-4000-8000-000000000002',pg_temp.doc('11000000-0000-4000-8000-000000000001','Retained brisket',jsonb_build_array(:'archive'::jsonb)),'America/New_York');
select to_jsonb(c) as original from public.cook_sessions c where c.id='11000000-0000-4000-8000-000000000001' \gset
select jsonb_agg(to_jsonb(e) order by id) as events from public.cook_events e \gset
select public.load_cook_workspace(auth.uid())->'history' as history \gset
select pg_temp.denied($q$select public.cancel_cook(auth.uid(),1,'11000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001')$q$,'stale cancellation cannot remove current cook');
select pg_temp.denied($q$select public.cancel_cook(auth.uid(),2,'11000000-0000-4000-8000-000000000002','42000000-0000-4000-8000-000000000001')$q$,'completed cook cannot be canceled');
select pg_temp.denied($q$select public.cancel_cook(auth.uid(),2,'11000000-0000-4000-8000-000000000099','42000000-0000-4000-8000-000000000001')$q$,'missing target cannot cancel another cook');
select pg_temp.denied($q$select public.cancel_cook(auth.uid(),2,'11000000-0000-4000-8000-000000000001',null)$q$,'request requires stable operation identity');
select pg_temp.denied($q$select public.cancel_cook(auth.uid(),null,'11000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001')$q$,'request requires known revision');
select pg_temp.ok((public.load_cook_workspace(auth.uid())->>'revision')::int=2,'rejected cancellations leave revision unchanged');
select public.cancel_cook(auth.uid(),2,'11000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001') as canceled \gset
select pg_temp.ok(:'canceled'::jsonb->'active'='null'::jsonb and (:'canceled'::jsonb->>'revision')::int=3,'cancellation atomically frees active slot');
select pg_temp.ok(:'canceled'::jsonb->'cancellation'->>'cookId'='11000000-0000-4000-8000-000000000001' and :'canceled'::jsonb->'cancellation'->>'operationId'='42000000-0000-4000-8000-000000000001','receipt acknowledges exact cook and operation');
select pg_temp.ok((:'canceled'::jsonb->'cancellation'->>'canceledAt')::timestamptz is not null,'receipt provides authoritative cancellation time');
select pg_temp.ok(public.load_cook_workspace(auth.uid())->'history'=:'history'::jsonb,'completed history remains byte-for-byte unchanged');
select pg_temp.ok((select to_jsonb(c)-array['state','canceled_at','cancellation_write_id','revision','updated_at']=:'original'::jsonb-array['state','canceled_at','cancellation_write_id','revision','updated_at'] from public.cook_sessions c where c.id='11000000-0000-4000-8000-000000000001'),'cancel retains original plan actuals owner and creation metadata');
select pg_temp.ok((select jsonb_agg(to_jsonb(e) order by id) from public.cook_events e)=:'events'::jsonb,'all actual event payloads and occurred/received times retained');
select to_jsonb(c) as retained from public.cook_sessions c where c.id='11000000-0000-4000-8000-000000000001' \gset
select pg_temp.ok((select state='canceled' and finished_at is null and completed_snapshot is null from public.cook_sessions where id='11000000-0000-4000-8000-000000000001'),'cancellation is distinct from completed history');
select pg_temp.ok(public.cancel_cook(auth.uid(),2,'11000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001')->'cancellation'=:'canceled'::jsonb->'cancellation','lost-response retry acknowledges original receipt');
select pg_temp.ok((public.load_cook_workspace(auth.uid())->>'revision')::int=3,'retry does not advance revision');
select pg_temp.denied($q$select public.cancel_cook(auth.uid(),3,'11000000-0000-4000-8000-000000000099','42000000-0000-4000-8000-000000000001')$q$,'operation ID cannot be substituted with another target');
select pg_temp.denied(format('select public.save_cook_workspace(auth.uid(),3,%L,%L::jsonb,''UTC'')','41000000-0000-4000-8000-000000000003',pg_temp.doc('11000000-0000-4000-8000-000000000001','Resurrection',:'history'::jsonb)),'current-revision v1 save cannot resurrect canceled cook');
select jsonb_set(:'archive'::jsonb,'{id}','"11000000-0000-4000-8000-000000000001"') as fake_archive \gset
select jsonb_set(:'fake_archive'::jsonb,'{meal,id}','"11000000-0000-4000-8000-000000000001"') as fake_archive \gset
select pg_temp.denied(format('select public.save_cook_workspace(auth.uid(),3,%L,jsonb_build_object(''active'',null,''history'',jsonb_build_array(%L::jsonb)),''UTC'')','41000000-0000-4000-8000-000000000003',:'fake_archive'),'v1 history import cannot relabel canceled cook completed');
select public.save_cook_workspace(auth.uid(),3,'41000000-0000-4000-8000-000000000003',pg_temp.doc('11000000-0000-4000-8000-000000000003','New dinner',:'history'::jsonb),'UTC');
select pg_temp.ok((select to_jsonb(c)=:'retained'::jsonb from public.cook_sessions c where id='11000000-0000-4000-8000-000000000001'),'normal v1 omission cannot delete or alter retained canceled row');
select pg_temp.ok(public.load_cook_workspace(auth.uid())->'active'->'meal'->>'name'='New dinner','new cook starts immediately after cancellation');
select public.cancel_cook(auth.uid(),2,'11000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001') as retried \gset
select pg_temp.ok((:'retried'::jsonb->>'revision')::int=4 and :'retried'::jsonb->'active'->'meal'->>'name'='New dinner' and :'retried'::jsonb->'cancellation'=:'canceled'::jsonb->'cancellation','late retry returns current workspace without canceling newer cook');
select pg_temp.denied($q$select public.cancel_cook(auth.uid(),4,'11000000-0000-4000-8000-000000000003','42000000-0000-4000-8000-000000000001')$q$,'old receipt ID cannot be repurposed to cancel newer cook');
select pg_temp.denied($q$select public.save_cook_workspace(auth.uid(),2,'41000000-0000-4000-8000-000000000099',pg_temp.doc('11000000-0000-4000-8000-000000000001'),'UTC')$q$,'old offline snapshot cannot overwrite cancellation/new cook');
select pg_temp.denied($q$update public.cook_sessions set state='active' where state='canceled'$q$,'raw authenticated mutation cannot reopen canceled data');
select pg_temp.denied($q$delete from public.cook_sessions where state='canceled'$q$,'raw authenticated deletion cannot remove canceled data');
select pg_temp.denied($q$select public.append_account_events(auth.uid(),pg_temp.meal('11000000-0000-4000-8000-000000000001'))$q$,'raw client cannot call event helper');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select pg_temp.denied($q$select public.cancel_cook('00000000-0000-4000-8000-000000000001',4,'11000000-0000-4000-8000-000000000003','42000000-0000-4000-8000-000000000002')$q$,'forged owner cannot cancel private cook');
select pg_temp.denied($q$select public.cancel_cook(auth.uid(),0,'11000000-0000-4000-8000-000000000003','42000000-0000-4000-8000-000000000002')$q$,'second account cannot cancel known first-account ID');
select pg_temp.denied($q$select public.cancel_cook(auth.uid(),0,'11000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001')$q$,'second account cannot recover another account receipt');
select pg_temp.ok((select count(*)=0 from public.cook_sessions) and (select count(*)=0 from public.cook_events),'RLS hides canceled cooks and events from other accounts');
set local role anon;
select pg_temp.denied($q$select public.cancel_cook('00000000-0000-4000-8000-000000000001',4,'11000000-0000-4000-8000-000000000003','42000000-0000-4000-8000-000000000002')$q$,'anonymous has no cancellation RPC grant');
set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.denied($q$select public.cancel_cook('00000000-0000-4000-8000-000000000001',4,'11000000-0000-4000-8000-000000000003','42000000-0000-4000-8000-000000000002')$q$,'missing JWT cannot call definer cancellation API');
-- Defense in depth even if a later migration accidentally routes an internal write.
reset role;
select pg_temp.denied($q$update public.cook_sessions set state='active',canceled_at=null,cancellation_write_id=null where id='11000000-0000-4000-8000-000000000001'$q$,'terminal trigger prevents internal canceled resurrection');
select pg_temp.denied($q$insert into public.cook_events(cook_id,owner_user_id,task_id,event_type,occurred_at) values('11000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','prep','temperature',now())$q$,'terminal trigger prevents internal canceled event additions');
select pg_temp.denied($q$insert into public.cook_events(cook_id,owner_user_id,task_id,event_type,occurred_at) values('11000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','prep','temperature',now())$q$,'terminal trigger prevents completed event additions');
select pg_temp.ok((select to_jsonb(c)=:'retained'::jsonb from public.cook_sessions c where id='11000000-0000-4000-8000-000000000001'),'every rejected mutation retains canceled row metadata exactly');
rollback;
