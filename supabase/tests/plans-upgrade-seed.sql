-- Existing migration-003 cooks stay in place until a user explicitly starts a plan.
insert into auth.users values ('00000000-0000-4000-8000-000000000003'),('00000000-0000-4000-8000-000000000004');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
select public.save_cook_workspace(auth.uid(),0,'61000000-0000-4000-8000-000000000001',jsonb_build_object('active',jsonb_build_object('meal',jsonb_build_object('version',1,'id','23000000-0000-4000-8000-000000000001','name','Legacy upcoming Sunday','serveAt','2026-11-08T18:00','dishes','[]'::jsonb,'completed','{}'::jsonb,'notes','{"prep":"Legacy note"}'::jsonb,'mode','planning','events','[{"id":"old-edit","taskId":"old-step","kind":"removed","occurredAt":"2021-04-04T03:07:00Z"}]'::jsonb),'serveInstant','2026-11-08T23:00:00Z'),'history','[]'::jsonb),'America/New_York');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',false);
select public.save_cook_workspace(auth.uid(),0,'61000000-0000-4000-8000-000000000002',jsonb_build_object('active',jsonb_build_object('meal',jsonb_build_object('version',1,'id','23000000-0000-4000-8000-000000000002','name','Existing real cook','serveAt','2026-11-08T18:00','dishes','[]'::jsonb,'completed','{}'::jsonb,'notes','{}'::jsonb,'mode','cooking','startedAt','2021-04-04T03:00:00Z','events','[{"id":"old-actual","taskId":"start","kind":"started","startSource":"physical","occurredAt":"2021-04-04T03:07:00Z"}]'::jsonb),'serveInstant','2026-11-08T23:00:00Z'),'history','[]'::jsonb),'America/New_York');
select public.cancel_cook(auth.uid(),1,'23000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000003');
reset role;
create table public.hmb_plans_upgrade_expected as select
 (select jsonb_agg(to_jsonb(c) order by id) from public.cook_sessions c) as cooks,
 (select jsonb_agg(to_jsonb(e) order by id) from public.cook_events e) as events,
 (select jsonb_agg(to_jsonb(w) order by owner_user_id) from public.cook_workspaces w) as workspaces;
