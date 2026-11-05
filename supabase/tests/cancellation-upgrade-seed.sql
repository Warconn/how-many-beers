-- Existing migration-002 data, created before migration 003 is installed.
insert into auth.users values ('00000000-0000-4000-8000-000000000003');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
with meal as (select jsonb_build_object('version',1,'id','13000000-0000-4000-8000-000000000001','name','Existing active cook','serveAt','2026-11-08T18:00','dishes','[]'::jsonb,'completed','{"prep":"2021-04-04T03:07:00Z"}'::jsonb,'notes','{"prep":"Keep this note"}'::jsonb,'mode','cooking','startedAt','2021-04-04T03:00:00Z','events','[{"id":"legacy-prep","taskId":"prep","kind":"completed","occurredAt":"2021-04-04T03:07:00Z"}]'::jsonb) m),
 archive as (select jsonb_build_object('id','13000000-0000-4000-8000-000000000002','meal',jsonb_set(m,'{id}','"13000000-0000-4000-8000-000000000002"'),'serveInstant','2021-04-04T18:00:00Z','archivedAt','2021-04-04T19:00:00Z','plannedTimeline','[]'::jsonb,'feedback','Original outcome') a from meal)
select public.save_cook_workspace(auth.uid(),0,'43000000-0000-4000-8000-000000000001',jsonb_build_object('active',jsonb_build_object('meal',m,'serveInstant','2026-11-08T23:00:00Z'),'history',jsonb_build_array(a)),'America/New_York') from meal,archive;
reset role;
create table public.hmb_cancellation_upgrade_expected as select
 (select jsonb_agg(to_jsonb(c) order by id) from public.cook_sessions c) as cooks,
 (select jsonb_agg(to_jsonb(e) order by id) from public.cook_events e) as events,
 (select jsonb_agg(to_jsonb(w) order by owner_user_id) from public.cook_workspaces w) as workspaces;
