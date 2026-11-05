\set ON_ERROR_STOP on
begin;
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$begin if value is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end$$;
create function pg_temp.denied(statement text,label text) returns void language plpgsql as $$begin
 begin execute statement;exception when insufficient_privilege or check_violation or unique_violation or serialization_failure or invalid_text_representation or invalid_datetime_format then raise notice 'PASS: %',label;return;end;
 raise exception 'FAIL: expected denial: %',label;
end$$;
create function pg_temp.meal(cook text,name text default 'Sunday brats') returns jsonb language sql as $$select jsonb_build_object('version',1,'id',cook,'name',name,'serveAt','2026-11-08T18:00','dishes','[]'::jsonb,'completed','{}'::jsonb,'notes','{}'::jsonb,'mode','planning','events','[]'::jsonb)$$;
create function pg_temp.plan(cook text,name text default 'Sunday brats',serve text default '2026-11-08T23:00:00Z') returns jsonb language sql as $$select jsonb_build_object('meal',pg_temp.meal(cook,name),'serveInstant',serve)$$;
create function pg_temp.doc(cook text,name text default 'Sunday brats') returns jsonb language sql as $$select jsonb_build_object('active',pg_temp.plan(cook,name),'history','[]'::jsonb)$$;
create function pg_temp.backup(cook text,name text default 'Sunday brats') returns jsonb language sql as $$select pg_temp.plan(cook,name)||jsonb_build_object('id',cook,'timeZone','America/New_York')$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select pg_temp.ok(public.load_cook_workspace(auth.uid())->'capabilities'->'savedPlans'='true'::jsonb,'installed schema advertises saved plan capability');
select pg_temp.ok(public.read_saved_cook_plan(auth.uid(),'18000000-0000-4000-8000-000000000099') is null,'new plan ID has no saved document');
select public.save_cook_workspace(auth.uid(),0,'51000000-0000-4000-8000-000000000001',jsonb_set(jsonb_set(pg_temp.doc('18000000-0000-4000-8000-000000000001','Pumpkin seeds'),'{active,meal,mode}','"cooking"'),'{active,meal,startedAt}','"2026-11-01T12:00:00Z"'),'America/New_York');
select pg_temp.ok(public.load_cook_workspace(auth.uid())->>'activeTimeZone'='America/New_York','workspace exposes stored active time zone independently of browser zone');
select public.load_cook_workspace(auth.uid()) as live \gset
select public.save_saved_cook_plan(auth.uid(),'18000000-0000-4000-8000-000000000002',0,'51000000-0000-4000-8000-000000000002',pg_temp.plan('18000000-0000-4000-8000-000000000002'),'America/New_York') as first \gset
select public.save_saved_cook_plan(auth.uid(),'18000000-0000-4000-8000-000000000003',0,'51000000-0000-4000-8000-000000000003',pg_temp.plan('18000000-0000-4000-8000-000000000003','Monday sides','2026-11-09T23:00:00Z'),'America/New_York');
select pg_temp.ok(public.load_cook_workspace(auth.uid())=:'live'::jsonb,'saving multiple future plans never changes live cook/history/revision');
select pg_temp.ok(jsonb_array_length(public.list_saved_cook_plans(auth.uid())->'plans')=2 and public.list_saved_cook_plans(auth.uid())->'plans'->0->>'id'='18000000-0000-4000-8000-000000000002','all upcoming plans listed in target-date order');
select public.save_saved_cook_plan(auth.uid(),'18000000-0000-4000-8000-000000000003',1,'51000000-0000-4000-8000-000000000004',pg_temp.plan('18000000-0000-4000-8000-000000000003','Tuesday sides','2026-11-10T23:00:00Z'),'America/New_York');
select pg_temp.ok(public.read_saved_cook_plan(auth.uid(),'18000000-0000-4000-8000-000000000002')=(:'first'::jsonb-'writeReceipt'),'editing another plan preserves first plan exactly');
select pg_temp.denied($q$select public.save_saved_cook_plan(auth.uid(),'18000000-0000-4000-8000-000000000003',1,'51000000-0000-4000-8000-000000000005',pg_temp.plan('18000000-0000-4000-8000-000000000003','STALE'),'UTC')$q$,'per-plan stale revision cannot overwrite independent edit');
select public.save_saved_cook_plan(auth.uid(),'18000000-0000-4000-8000-000000000002',1,'51000000-0000-4000-8000-000000000005',pg_temp.plan('18000000-0000-4000-8000-000000000002','Updated brats'),'America/New_York');
select public.save_saved_cook_plan(auth.uid(),'18000000-0000-4000-8000-000000000002',0,'51000000-0000-4000-8000-000000000002',pg_temp.plan('18000000-0000-4000-8000-000000000002'),'America/New_York') as retried \gset
select pg_temp.ok(:'retried'::jsonb->'meal'->>'name'='Updated brats' and (:'retried'::jsonb->>'revision')::int=2 and :'retried'::jsonb->'writeReceipt'->>'operationId'='51000000-0000-4000-8000-000000000002','lost save retry returns current plan plus original receipt without reapplying');
select pg_temp.denied($q$select public.save_saved_cook_plan(auth.uid(),'18000000-0000-4000-8000-000000000002',0,'51000000-0000-4000-8000-000000000002',pg_temp.plan('18000000-0000-4000-8000-000000000002','SUBSTITUTED'),'America/New_York')$q$,'same operation ID cannot carry different plan payload');
select pg_temp.denied($q$select public.promote_saved_cook_plan(auth.uid(),1,'18000000-0000-4000-8000-000000000002',2,'52000000-0000-4000-8000-000000000001')$q$,'starting future meal cannot replace a live cook');
select pg_temp.denied($q$select public.save_cook_workspace(auth.uid(),1,'51000000-0000-4000-8000-000000000099',pg_temp.doc('18000000-0000-4000-8000-000000000099','Old client replacement'),'UTC')$q$,'old client cannot replace real active cook while plans exist');
select pg_temp.denied($q$select public.save_cook_workspace(auth.uid(),1,'51000000-0000-4000-8000-000000000099','{"active":null,"history":[]}','UTC')$q$,'old client cannot clear real active cook by omission');
select pg_temp.denied($q$select public.save_cook_workspace(auth.uid(),1,'51000000-0000-4000-8000-000000000099',pg_temp.doc('18000000-0000-4000-8000-000000000002'),'UTC')$q$,'old client cannot bypass promotion with a reserved saved plan ID');
select pg_temp.ok(public.load_cook_workspace(auth.uid())=:'live'::jsonb,'rejected starts/replacements leave live cook unchanged');
select pg_temp.denied($q$select public.save_saved_cook_plan(auth.uid(),'18000000-0000-4000-8000-000000000099',0,'51000000-0000-4000-8000-000000000099','{}','UTC')$q$,'malformed saved plan rejected');
select pg_temp.denied($q$select public.save_saved_cook_plan(auth.uid(),'18000000-0000-4000-8000-000000000099',0,'51000000-0000-4000-8000-000000000099',jsonb_set(pg_temp.plan('18000000-0000-4000-8000-000000000099'),'{meal,startedAt}','"2026-11-01T12:00:00Z"'),'UTC')$q$,'physical starts cannot be stored as future planning');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select pg_temp.ok(public.list_saved_cook_plans(auth.uid())->'plans'='[]'::jsonb and public.read_saved_cook_plan(auth.uid(),'18000000-0000-4000-8000-000000000002') is null,'second account cannot list/read private plans');
select pg_temp.ok((select count(*)=0 from public.saved_cook_plans),'owner RLS hides saved plan rows');
select pg_temp.denied($q$select public.list_saved_cook_plans('00000000-0000-4000-8000-000000000001')$q$,'list cannot forge owner');
select pg_temp.denied($q$select public.save_saved_cook_plan(auth.uid(),'18000000-0000-4000-8000-000000000002',2,'51000000-0000-4000-8000-000000000099',pg_temp.plan('18000000-0000-4000-8000-000000000002'),'UTC')$q$,'known plan ID cannot transfer owners');
select pg_temp.denied($q$select public.promote_saved_cook_plan(auth.uid(),0,'18000000-0000-4000-8000-000000000002',2,'52000000-0000-4000-8000-000000000001')$q$,'other owner cannot promote known private ID');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select public.cancel_cook(auth.uid(),1,'18000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001');
select pg_temp.ok(public.load_cook_workspace(auth.uid())->'activeTimeZone'='null'::jsonb,'empty workspace exposes no active time zone');
select pg_temp.denied($q$select public.promote_saved_cook_plan(auth.uid(),1,'18000000-0000-4000-8000-000000000002',2,'52000000-0000-4000-8000-000000000001')$q$,'promotion pins acknowledged workspace revision');
select pg_temp.denied($q$select public.promote_saved_cook_plan(auth.uid(),2,'18000000-0000-4000-8000-000000000002',1,'52000000-0000-4000-8000-000000000001')$q$,'promotion pins selected plan revision');
select public.promote_saved_cook_plan(auth.uid(),2,'18000000-0000-4000-8000-000000000002',2,'52000000-0000-4000-8000-000000000001') as promoted \gset
select pg_temp.ok(:'promoted'::jsonb->'active'->'meal'->>'id'='18000000-0000-4000-8000-000000000002' and :'promoted'::jsonb->'active'->'meal'->>'mode'='cooking' and :'promoted'::jsonb->'active'->'meal'->>'startedAt' is not null,'promotion preserves ID/target and starts one cook');
select pg_temp.ok(public.read_saved_cook_plan(auth.uid(),'18000000-0000-4000-8000-000000000002') is null and jsonb_array_length(public.list_saved_cook_plans(auth.uid())->'plans')=1,'only acknowledged promoted plan leaves Upcoming');
select public.cancel_cook(auth.uid(),3,'18000000-0000-4000-8000-000000000002','53000000-0000-4000-8000-000000000002');
select public.promote_saved_cook_plan(auth.uid(),4,'18000000-0000-4000-8000-000000000003',2,'52000000-0000-4000-8000-000000000002');
select public.promote_saved_cook_plan(auth.uid(),2,'18000000-0000-4000-8000-000000000002',2,'52000000-0000-4000-8000-000000000001') as late_promoted \gset
select pg_temp.ok(:'late_promoted'::jsonb->'active'->'meal'->>'id'='18000000-0000-4000-8000-000000000003' and :'late_promoted'::jsonb->'promotion'->>'cookId'='18000000-0000-4000-8000-000000000002' and (:'late_promoted'::jsonb->>'revision')::int=5,'lost promotion response retries acknowledge original cook without restarting a later cook');
select pg_temp.denied($q$select public.promote_saved_cook_plan(auth.uid(),5,'18000000-0000-4000-8000-000000000003',2,'52000000-0000-4000-8000-000000000001')$q$,'promotion operation ID cannot be repurposed to another plan');
-- A separate owner exercises lossless lazy transfer of legacy planning.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select public.save_cook_workspace(auth.uid(),0,'54000000-0000-4000-8000-000000000001',jsonb_set(pg_temp.doc('19000000-0000-4000-8000-000000000001','Legacy Sunday meal'),'{active,meal,events}','[{"id":"removed-before-migration","taskId":"old-step","kind":"removed","occurredAt":"2021-04-04T03:07:00Z"}]'),'America/New_York');
select pg_temp.ok(public.load_cook_workspace(auth.uid())->>'activeTimeZone'='America/New_York','logical legacy plan exports its stored IANA zone without using device defaults');
select to_jsonb(c) as legacy from public.cook_sessions c where id='19000000-0000-4000-8000-000000000001' \gset
select jsonb_agg(to_jsonb(e) order by id) as legacy_events from public.cook_events e \gset
select public.save_saved_cook_plan(auth.uid(),'19000000-0000-4000-8000-000000000002',0,'54000000-0000-4000-8000-000000000002',pg_temp.plan('19000000-0000-4000-8000-000000000002','Another future meal'),'America/New_York');
select public.promote_saved_cook_plan(auth.uid(),1,'19000000-0000-4000-8000-000000000002',1,'55000000-0000-4000-8000-000000000001');
select pg_temp.ok((select state='planned' and to_jsonb(c)-array['state','revision','updated_at']=:'legacy'::jsonb-array['state','revision','updated_at'] from public.cook_sessions c where id='19000000-0000-4000-8000-000000000001'),'legacy transfer retains original row/plan/creation/actual metadata');
select pg_temp.ok((select jsonb_agg(to_jsonb(e) order by id) from public.cook_events e)=:'legacy_events'::jsonb,'legacy transfer preserves exact event IDs and received/occurred times');
select pg_temp.ok((select plan is null and legacy_cook_id=id and state='saved' from public.saved_cook_plans where id='19000000-0000-4000-8000-000000000001'),'legacy collection entry references one original payload authority');
select pg_temp.ok(public.read_saved_cook_plan(auth.uid(),'19000000-0000-4000-8000-000000000001')->'meal'=:'legacy'::jsonb->'plan'->'meal','linked plan loads original legacy meal');
select pg_temp.denied($q$select public.save_cook_workspace(auth.uid(),2,'54000000-0000-4000-8000-000000000099',pg_temp.doc('19000000-0000-4000-8000-000000000001'),'UTC')$q$,'old client cannot resurrect transferred planning source');
select public.save_saved_cook_plan(auth.uid(),'19000000-0000-4000-8000-000000000001',1,'54000000-0000-4000-8000-000000000003',jsonb_set(:'legacy'::jsonb->'plan','{meal,name}','"Edited legacy meal"'),'America/New_York');
select pg_temp.ok(public.read_saved_cook_plan(auth.uid(),'19000000-0000-4000-8000-000000000001')->'meal'->>'name'='Edited legacy meal' and (select jsonb_agg(to_jsonb(e) order by id) from public.cook_events e)=:'legacy_events'::jsonb,'linked plan edits preserve original observations without source duplication');
select public.cancel_cook(auth.uid(),2,'19000000-0000-4000-8000-000000000002','56000000-0000-4000-8000-000000000001');
select public.promote_saved_cook_plan(auth.uid(),3,'19000000-0000-4000-8000-000000000001',2,'55000000-0000-4000-8000-000000000002');
select pg_temp.ok((select state='active' from public.cook_sessions where id='19000000-0000-4000-8000-000000000001') and (select jsonb_agg(to_jsonb(e) order by id) from public.cook_events e)=:'legacy_events'::jsonb,'promoting linked legacy plan reuses original session/events');
-- Importing a new completed archive while active must not collide with one-open index.
select public.load_cook_workspace(auth.uid())->'active' as current_active \gset
select jsonb_build_object('id','19000000-0000-4000-8000-000000000003','meal',pg_temp.meal('19000000-0000-4000-8000-000000000003','Imported dinner'),'serveInstant','2021-04-04T18:00:00Z','archivedAt','2021-04-04T19:00:00Z','plannedTimeline','[]'::jsonb,'feedback','Imported safely') as archive \gset
select to_jsonb(c) as active_row from public.cook_sessions c where id='19000000-0000-4000-8000-000000000001' \gset
select public.save_cook_workspace(auth.uid(),4,'54000000-0000-4000-8000-000000000004',jsonb_build_object('active',:'current_active'::jsonb,'history',jsonb_build_array(:'archive'::jsonb)),'America/New_York');
select pg_temp.ok(public.load_cook_workspace(auth.uid())->'history'->0->>'feedback'='Imported safely' and public.load_cook_workspace(auth.uid())->'active'=:'current_active'::jsonb,'new archive imports atomically while retaining the live cook');
select pg_temp.ok((select to_jsonb(c)=:'active_row'::jsonb from public.cook_sessions c where id='19000000-0000-4000-8000-000000000001'),'archive import preserves unchanged active row including its server timestamps/revision');
select pg_temp.ok((select count(*)=0 from public.cook_sessions where state='archive_import'),'no transient import row remains after success');
select pg_temp.denied(format('select public.save_cook_workspace(auth.uid(),5,%L,jsonb_build_object(''active'',%L::jsonb,''history'',jsonb_build_array(%L::jsonb)),''UTC'')','54000000-0000-4000-8000-000000000005',:'current_active',jsonb_set(jsonb_set(:'archive'::jsonb,'{id}','"19000000-0000-4000-8000-000000000004"'),'{meal,id}','"19000000-0000-4000-8000-000000000004"')||'{"serveInstant":"INVALID"}'::jsonb),'late archive import failure rolls back staged rows and deletions');
select pg_temp.ok((select count(*)=0 from public.cook_sessions where state='archive_import') and (public.load_cook_workspace(auth.uid())->>'revision')::int=5 and public.load_cook_workspace(auth.uid())->'history'->0->>'feedback'='Imported safely','failed import leaves no staging row and preserves history/revision');
-- Draft backup merge, discard and retained operation receipts use a separate API.
select public.import_saved_cook_plans(auth.uid(),'57000000-0000-4000-8000-000000000001',jsonb_build_array(pg_temp.backup('19000000-0000-4000-8000-000000000005','Backup one'),pg_temp.backup('19000000-0000-4000-8000-000000000006','Backup two')));
select pg_temp.ok(jsonb_array_length(public.list_saved_cook_plans(auth.uid())->'plans')=2 and public.load_cook_workspace(auth.uid())->'active'=:'current_active'::jsonb,'atomic plans backup merge leaves live/history untouched');
select public.import_saved_cook_plans(auth.uid(),'57000000-0000-4000-8000-000000000002',jsonb_build_array(pg_temp.backup('19000000-0000-4000-8000-000000000005','Backup one')));
select pg_temp.ok(jsonb_array_length(public.list_saved_cook_plans(auth.uid())->'plans')=2,'backup omission does not delete another plan');
select pg_temp.denied($q$select public.import_saved_cook_plans(auth.uid(),'57000000-0000-4000-8000-000000000003',jsonb_build_array(pg_temp.backup('19000000-0000-4000-8000-000000000007','Would be new'),pg_temp.backup('19000000-0000-4000-8000-000000000005','Conflicting backup')))$q$,'divergent backup aborts entire batch');
select pg_temp.ok(public.read_saved_cook_plan(auth.uid(),'19000000-0000-4000-8000-000000000007') is null,'failed batch import cannot strand partially imported plans');
select public.discard_saved_cook_plan(auth.uid(),'19000000-0000-4000-8000-000000000005',1,'58000000-0000-4000-8000-000000000001');
select pg_temp.ok(public.read_saved_cook_plan(auth.uid(),'19000000-0000-4000-8000-000000000005') is null and (select state='discarded' from public.saved_cook_plans where id='19000000-0000-4000-8000-000000000005'),'discard hides plan but retains source record');
select public.import_saved_cook_plans(auth.uid(),'57000000-0000-4000-8000-000000000001',jsonb_build_array(pg_temp.backup('19000000-0000-4000-8000-000000000005','Backup one'),pg_temp.backup('19000000-0000-4000-8000-000000000006','Backup two')));
select pg_temp.ok(public.read_saved_cook_plan(auth.uid(),'19000000-0000-4000-8000-000000000005') is null,'late import retry acknowledges without resurrecting discarded plan');
select pg_temp.denied($q$select public.import_saved_cook_plans(auth.uid(),'57000000-0000-4000-8000-000000000004',jsonb_build_array(pg_temp.backup('19000000-0000-4000-8000-000000000005','Backup one')))$q$,'new import cannot resurrect terminal discarded plan');
select pg_temp.denied($q$select public.save_saved_cook_plan(auth.uid(),'19000000-0000-4000-8000-000000000005',0,'58000000-0000-4000-8000-000000000001',pg_temp.plan('19000000-0000-4000-8000-000000000005'),'UTC')$q$,'discard receipt ID cannot be reused for save');
select pg_temp.denied($q$select public.import_saved_cook_plans(auth.uid(),'57000000-0000-4000-8000-000000000005',jsonb_build_array(pg_temp.backup('19000000-0000-4000-8000-000000000002')))$q$,'backup cannot resurrect canceled cook ID as a future plan');
select pg_temp.denied($q$update public.saved_cook_plans set state='promoted'$q$,'raw clients cannot bypass plan API');
select pg_temp.denied($q$select * from public.saved_cook_plan_operations$q$,'operation receipts are private');
-- A planning-marked session with physical observations is still a real cook.
reset role;
insert into auth.users values ('00000000-0000-4000-8000-000000000003');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
select public.save_cook_workspace(auth.uid(),0,'59000000-0000-4000-8000-000000000001',jsonb_set(pg_temp.doc('19000000-0000-4000-8000-000000000008','Planning with actuals'),'{active,meal,events}','[{"id":"physical-before-mode","taskId":"start","kind":"started","startSource":"physical","occurredAt":"2021-04-04T03:07:00Z"}]'),'America/New_York');
select public.save_saved_cook_plan(auth.uid(),'19000000-0000-4000-8000-000000000009',0,'59000000-0000-4000-8000-000000000002',pg_temp.plan('19000000-0000-4000-8000-000000000009'),'America/New_York');
select pg_temp.denied($q$select public.promote_saved_cook_plan(auth.uid(),1,'19000000-0000-4000-8000-000000000009',1,'59000000-0000-4000-8000-000000000003')$q$,'planning mode cannot disguise a physical cook for transfer');
select pg_temp.denied($q$select public.save_cook_workspace(auth.uid(),1,'59000000-0000-4000-8000-000000000003',pg_temp.doc('19000000-0000-4000-8000-000000000099'),'UTC')$q$,'old client cannot replace physical cook disguised as planning');
select pg_temp.denied($q$select public.import_saved_cook_plans(auth.uid(),'59000000-0000-4000-8000-000000000003',jsonb_build_array(pg_temp.backup('19000000-0000-4000-8000-000000000008','Planning with actuals')))$q$,'backup cannot convert a physical cook into a future plan');
select public.cancel_cook(auth.uid(),1,'19000000-0000-4000-8000-000000000008','59000000-0000-4000-8000-000000000003');
select public.save_cook_workspace(auth.uid(),2,'59000000-0000-4000-8000-000000000004',pg_temp.doc('19000000-0000-4000-8000-000000000010','Legacy backup target'),'America/New_York');
select public.load_cook_workspace(auth.uid()) as legacy_backup_workspace \gset
select public.import_saved_cook_plans(auth.uid(),'59000000-0000-4000-8000-000000000005',jsonb_build_array(pg_temp.backup('19000000-0000-4000-8000-000000000010','Legacy backup target')));
select pg_temp.ok(public.load_cook_workspace(auth.uid())=:'legacy_backup_workspace'::jsonb and jsonb_array_length(public.list_saved_cook_plans(auth.uid())->'plans')=1,'matching logical legacy plan backup is a no-op without duplicating or moving workspace');
select pg_temp.denied($q$select public.save_cook_workspace(auth.uid(),3,'59000000-0000-4000-8000-000000000006',pg_temp.doc('19000000-0000-4000-8000-000000000009'),'UTC')$q$,'old planning client cannot use a saved plan identity without promotion');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select pg_temp.denied($q$select public.lock_saved_plan_workspace(auth.uid())$q$,'private workspace-lock helper has no public execute grant');
select set_config('request.jwt.claim.sub','',true);
select pg_temp.denied($q$select public.list_saved_cook_plans('00000000-0000-4000-8000-000000000001')$q$,'missing identity cannot list through definer plan API');
-- Old single-slot clients must preserve legacy plans they do not know to list.
reset role;
insert into auth.users values ('00000000-0000-4000-8000-000000000004');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
select public.save_cook_workspace(auth.uid(),0,'5a000000-0000-4000-8000-000000000001',jsonb_set(pg_temp.doc('19000000-0000-4000-8000-000000000011','Original legacy Sunday'),'{active,meal,events}','[{"id":"legacy-reorder","taskId":"removed-step","kind":"removed","occurredAt":"2021-04-04T03:07:00Z"}]'),'America/New_York');
select plan as original_v1_plan from public.cook_sessions where id='19000000-0000-4000-8000-000000000011' \gset
select jsonb_agg(to_jsonb(e) order by id) as original_v1_events from public.cook_events e \gset
select public.save_cook_workspace(auth.uid(),1,'5a000000-0000-4000-8000-000000000002',pg_temp.doc('19000000-0000-4000-8000-000000000012','Replacement planning slot'),'America/New_York');
select pg_temp.ok((select state='planned' and plan=:'original_v1_plan'::jsonb from public.cook_sessions where id='19000000-0000-4000-8000-000000000011') and (select jsonb_agg(to_jsonb(e) order by id) from public.cook_events e)=:'original_v1_events'::jsonb,'old v1 planning replacement retains original meal and event/received timestamps');
select pg_temp.ok(jsonb_array_length(public.list_saved_cook_plans(auth.uid())->'plans')=1 and public.load_cook_workspace(auth.uid())->'active'->'meal'->>'id'='19000000-0000-4000-8000-000000000012','old client replacement creates one retained Upcoming reference and its new planning slot');
select public.save_cook_workspace(auth.uid(),2,'5a000000-0000-4000-8000-000000000003','{"active":null,"history":[]}','America/New_York');
select pg_temp.ok(jsonb_array_length(public.list_saved_cook_plans(auth.uid())->'plans')=2 and public.load_cook_workspace(auth.uid())->'active'='null'::jsonb,'old v1 clear preserves omitted legacy planning as Upcoming');
select public.save_cook_workspace(auth.uid(),3,'5a000000-0000-4000-8000-000000000004','{"active":null,"history":[]}','America/New_York');
select pg_temp.ok(jsonb_array_length(public.list_saved_cook_plans(auth.uid())->'plans')=2 and (select count(*)=2 from public.cook_sessions where state='planned'),'repeated v1 clears cannot duplicate or delete retained planning records');
select public.save_cook_workspace(auth.uid(),4,'5a000000-0000-4000-8000-000000000005',jsonb_set(jsonb_set(pg_temp.doc('19000000-0000-4000-8000-000000000013','Normal finished dinner'),'{active,meal,mode}','"cooking"'),'{active,meal,startedAt}','"2026-11-01T12:00:00Z"'),'America/New_York');
select public.load_cook_workspace(auth.uid())->'active' as finish_active \gset
select jsonb_build_object('id','19000000-0000-4000-8000-000000000013','meal',:'finish_active'::jsonb->'meal','serveInstant',:'finish_active'::jsonb->'serveInstant','archivedAt','2026-11-01T15:00:00Z','plannedTimeline','[]'::jsonb,'feedback','Finished normally') as finish_archive \gset
select public.save_cook_workspace(auth.uid(),5,'5a000000-0000-4000-8000-000000000006',jsonb_build_object('active',null,'history',jsonb_build_array(:'finish_archive'::jsonb)),'America/New_York');
select pg_temp.ok(public.load_cook_workspace(auth.uid())->'history'->0->>'feedback'='Finished normally' and (select state='completed' from public.cook_sessions where id='19000000-0000-4000-8000-000000000013') and jsonb_array_length(public.list_saved_cook_plans(auth.uid())->'plans')=2,'normal explicit finish archives once instead of transferring the finished cook to Upcoming');
set local role anon;
select pg_temp.denied($q$select public.list_saved_cook_plans('00000000-0000-4000-8000-000000000001')$q$,'anonymous cannot list private plans');
select pg_temp.denied($q$select public.import_saved_cook_plans('00000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000001','[]')$q$,'anonymous cannot import plans');
rollback;
