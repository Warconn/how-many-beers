-- #20: transactional, revision-checked account workspace. Run after foundation.
begin;
create table public.cook_workspaces (
 owner_user_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null default 0 check(revision>=0),
 last_write_id uuid
);
alter table public.cook_workspaces enable row level security;
alter table public.cook_workspaces force row level security;
revoke all on public.cook_workspaces from public,anon,authenticated;
grant select on public.cook_workspaces to authenticated;
create policy own_workspace_read on public.cook_workspaces for select to authenticated using ((select auth.uid())=owner_user_id);
-- All application writes now pass through the transactional API below. Owner RLS
-- remains defense in depth; raw clients cannot bypass revision/event checks.
revoke insert,update,delete on public.cook_sessions from authenticated;
revoke insert on public.cook_events from authenticated;

create function public.valid_account_task(t jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text;
begin
 if t is null or jsonb_typeof(t) is distinct from 'object' or not(t ?& array['id','dishId','dishName','title','instructions','scheduledAt','isCondition']) then return false; end if;
 foreach k in array array['id','dishId','dishName','title','instructions'] loop if jsonb_typeof(t->k) is distinct from 'string' then return false; end if; end loop;
 if jsonb_typeof(t->'isCondition') is distinct from 'boolean' or jsonb_typeof(t->'scheduledAt') not in ('string','null') then return false; end if;
 if t ? 'durationMinutes' and t->'durationMinutes'<>'null'::jsonb and (jsonb_typeof(t->'durationMinutes')<>'number' or (t->>'durationMinutes')::numeric not between 0 and 43200) then return false; end if;
 if t ? 'equipment' and jsonb_typeof(t->'equipment')<>'string' then return false; end if;
 if t ? 'targetTempF' and jsonb_typeof(t->'targetTempF') not in ('number','null') then return false; end if;
 return true;
exception when others then return false;
end $$;
revoke all on function public.valid_account_task(jsonb) from public,anon,authenticated;

create function public.valid_account_meal(m jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare d jsonb; e jsonb; t jsonb; v jsonb; k text;
begin
 if m is null or jsonb_typeof(m) is distinct from 'object' or m->'version' is distinct from '1'::jsonb or jsonb_typeof(m->'id')<>'string'
 or jsonb_typeof(m->'name')<>'string' or length(m->>'name')>160
 or jsonb_typeof(m->'serveAt')<>'string' or jsonb_typeof(m->'dishes')<>'array'
 or jsonb_typeof(m->'completed')<>'object' or jsonb_typeof(m->'notes')<>'object' then return false; end if;
 if not (m ?& array['version','id','name','serveAt','dishes','completed','notes']) then return false; end if;
 perform (m->>'id')::uuid;
 if m ? 'mode' and (jsonb_typeof(m->'mode')<>'string' or m->>'mode' not in ('planning','cooking')) then return false; end if;
 if exists(select 1 from jsonb_each(m->'completed') x where jsonb_typeof(x.value)<>'string')
 or exists(select 1 from jsonb_each(m->'notes') x where jsonb_typeof(x.value)<>'string') then return false; end if;
 for d in select value from jsonb_array_elements(m->'dishes') loop
  if jsonb_typeof(d) is distinct from 'object' or not(d ?& array['id','name','preset','equipment','cookMinutes','restMinutes'])
  or jsonb_typeof(d->'id')<>'string' or jsonb_typeof(d->'name')<>'string' or jsonb_typeof(d->'equipment')<>'string'
  or jsonb_typeof(d->'preset')<>'string' or d->>'preset' not in ('brisket','turkey','ribs','chicken','side','wings','brats','custom')
  or jsonb_typeof(d->'cookMinutes')<>'number' or jsonb_typeof(d->'restMinutes')<>'number'
  or (d->>'cookMinutes')::numeric not between 0 and 43200 or (d->>'restMinutes')::numeric not between 0 and 43200 then return false; end if;
  if d ? 'pitTempF' and jsonb_typeof(d->'pitTempF')<>'number' then return false; end if;
  if d ? 'weightLb' and jsonb_typeof(d->'weightLb')<>'number' then return false; end if;
  if d ? 'steps' then
   if jsonb_typeof(d->'steps')<>'array' then return false; end if;
   for t in select value from jsonb_array_elements(d->'steps') loop
    if jsonb_typeof(t) is distinct from 'object' or not(t ?& array['id','title','minutes']) or jsonb_typeof(t->'id')<>'string' or jsonb_typeof(t->'title')<>'string'
    or (t->'minutes'<>'null'::jsonb and (jsonb_typeof(t->'minutes')<>'number' or (t->>'minutes')::numeric not between 0 and 43200)) then return false; end if;
   end loop;
  end if;
 end loop;
 if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(m->'dishes')) then return false; end if;
 if m ? 'events' then
  if jsonb_typeof(m->'events')<>'array' then return false; end if;
  for e in select value from jsonb_array_elements(m->'events') loop
   if jsonb_typeof(e) is distinct from 'object' or not(e ?& array['id','taskId','kind','occurredAt']) or jsonb_typeof(e->'id')<>'string'
   or jsonb_typeof(e->'taskId')<>'string' or jsonb_typeof(e->'occurredAt')<>'string'
   or length(e->>'taskId') not between 1 and 250 or length(e->>'id') not between 1 and 300
   or jsonb_typeof(e->'kind')<>'string' or e->>'kind' not in ('started','completed','reopened','temperature','equipment','removed') then return false; end if;
   perform (e->>'occurredAt')::timestamptz;
   if e ? 'value' and jsonb_typeof(e->'value')<>'number' then return false; end if;
   if e ? 'note' and jsonb_typeof(e->'note')<>'string' then return false; end if;
   if e ? 'unit' and e->>'unit' not in ('°F','°C') then return false; end if;
  end loop;
  if(select count(*)<>count(distinct value->>'id') from jsonb_array_elements(m->'events')) then return false; end if;
 end if;
 if m ? 'startedAt' then
  if jsonb_typeof(m->'startedAt')<>'string' then return false; end if;
  perform (m->>'startedAt')::timestamptz;
 end if;
 if m ? 'customTasks' then
  if jsonb_typeof(m->'customTasks')<>'array' then return false; end if;
  if exists(select 1 from jsonb_array_elements(m->'customTasks') x where public.valid_account_task(x) is distinct from true) then return false; end if;
 end if;
 if m ? 'taskOverrides' then
  if jsonb_typeof(m->'taskOverrides')<>'object' then return false; end if;
  for v in select value from jsonb_each(m->'taskOverrides') loop
   if jsonb_typeof(v)<>'object' then return false; end if;
   foreach k in array array['title','instructions','equipment'] loop if v ? k and jsonb_typeof(v->k)<>'string' then return false; end if; end loop;
   foreach k in array array['scheduledAt','recordedPlanAt'] loop if v ? k and jsonb_typeof(v->k) not in ('string','null') then return false; end if; end loop;
   if v ? 'durationMinutes' and v->'durationMinutes'<>'null'::jsonb and (jsonb_typeof(v->'durationMinutes')<>'number' or (v->>'durationMinutes')::numeric not between 0 and 43200) then return false; end if;
   if v ? 'targetTempF' and jsonb_typeof(v->'targetTempF') not in ('number','null') then return false; end if;
  end loop;
 end if;
 if m ? 'hiddenTaskIds' and jsonb_typeof(m->'hiddenTaskIds')<>'array' then return false; end if;
 if m ? 'taskOrder' and jsonb_typeof(m->'taskOrder')<>'array' then return false; end if;
 foreach k in array array['hiddenTaskIds','taskOrder'] loop
  if m ? k and exists(select 1 from jsonb_array_elements(m->k) x where jsonb_typeof(x)<>'string') then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;
revoke all on function public.valid_account_meal(jsonb) from public,anon,authenticated;

create function public.account_workspace_snapshot(account_owner uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('revision',w.revision,'writeId',w.last_write_id,
 'active',(select c.plan from public.cook_sessions c where c.owner_user_id=account_owner and c.state<>'completed'),
 'history',coalesce((select jsonb_agg(c.completed_snapshot order by c.finished_at desc,c.id) from public.cook_sessions c where c.owner_user_id=account_owner and c.state='completed'),'[]'::jsonb))
 from public.cook_workspaces w where w.owner_user_id=account_owner
$$;
revoke all on function public.account_workspace_snapshot(uuid) from public,anon,authenticated;

create function public.append_account_events(account_owner uuid,m jsonb) returns void language plpgsql set search_path='' as $$
declare e jsonb; event_id uuid; existing jsonb; cook uuid:=(m->>'id')::uuid;
begin
 if exists(select 1 from public.cook_events stored where stored.owner_user_id=account_owner and stored.cook_id=cook
 and not exists(select 1 from jsonb_array_elements(coalesce(m->'events','[]'::jsonb)) incoming where incoming=stored.payload)) then
 raise exception 'Recorded events cannot be removed or changed' using errcode='23514'; end if;
 for e in select value from jsonb_array_elements(coalesce(m->'events','[]'::jsonb)) loop
  -- Stable legacy IDs remain intact inside payload; deterministic row IDs dedupe retries.
  event_id:=md5(account_owner::text||':'||cook::text||':'||(e->>'id'))::uuid;
  select payload into existing from public.cook_events where id=event_id;
  if found and existing<>e then raise exception 'Recorded events cannot change' using errcode='23514'; end if;
  if not found then insert into public.cook_events(id,cook_id,owner_user_id,task_id,event_type,occurred_at,payload)
   values(event_id,cook,account_owner,e->>'taskId',e->>'kind',(e->>'occurredAt')::timestamptz,e); end if;
 end loop;
end $$;
revoke all on function public.append_account_events(uuid,jsonb) from public,anon,authenticated;

create function public.load_cook_workspace(expected_owner uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare account_owner uuid:=auth.uid();
begin
 if account_owner is null or expected_owner is distinct from account_owner then raise exception 'Not authorized' using errcode='42501'; end if;
 insert into public.cook_workspaces(owner_user_id) values(account_owner) on conflict do nothing;
 perform 1 from public.cook_workspaces where owner_user_id=account_owner for share;
 return public.account_workspace_snapshot(account_owner);
end $$;
revoke all on function public.load_cook_workspace(uuid) from public,anon;
grant execute on function public.load_cook_workspace(uuid) to authenticated;

create function public.save_cook_workspace(expected_owner uuid,expected_revision bigint,write_id uuid,document jsonb,time_zone text)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare account_owner uuid:=auth.uid(); meta public.cook_workspaces; record jsonb; m jsonb; cook uuid; old public.cook_sessions; active jsonb;
begin
 if account_owner is null or expected_owner is distinct from account_owner then raise exception 'Not authorized' using errcode='42501'; end if;
 if write_id is null or expected_revision is null then raise exception 'Missing revision or write ID' using errcode='23514'; end if;
 insert into public.cook_workspaces(owner_user_id) values(account_owner) on conflict do nothing;
 select * into meta from public.cook_workspaces where owner_user_id=account_owner for update;
 if meta.last_write_id=write_id then return public.account_workspace_snapshot(account_owner); end if;
 if meta.revision<>expected_revision then raise exception 'Account cook changed; reload before saving' using errcode='40001'; end if;
 if jsonb_typeof(document) is distinct from 'object' or not(document ?& array['active','history'])
 or jsonb_typeof(document->'history') is distinct from 'array' or octet_length(document::text)>33554432
 or time_zone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=time_zone) then raise exception 'Invalid workspace' using errcode='23514'; end if;
 active:=nullif(document->'active','null'::jsonb);
 if active is not null and (public.valid_account_meal(active->'meal') is distinct from true or not(active ? 'serveInstant') or jsonb_typeof(active->'serveInstant') not in ('string','null')) then raise exception 'Invalid active cook' using errcode='23514'; end if;
 for record in select value from jsonb_array_elements(document->'history') loop
  m:=record->'meal';
  if public.valid_account_meal(m) is distinct from true or not(record ?& array['id','archivedAt','plannedTimeline','feedback','serveInstant'])
  or jsonb_typeof(record->'serveInstant') not in ('string','null') or record->>'id' is distinct from m->>'id' or jsonb_typeof(record->'plannedTimeline')<>'array' or jsonb_typeof(record->'feedback')<>'string' then raise exception 'Invalid completed cook' using errcode='23514'; end if;
  if jsonb_typeof(record->'archivedAt')<>'string' or length(record->>'feedback')>4000 then raise exception 'Invalid archive metadata' using errcode='23514'; end if;
  perform (record->>'archivedAt')::timestamptz;
  if exists(select 1 from jsonb_array_elements(record->'plannedTimeline') x where public.valid_account_task(x) is distinct from true) then raise exception 'Invalid archived timeline' using errcode='23514'; end if;
 end loop;
 if(select count(*)<>count(distinct value->>'id') from jsonb_array_elements(document->'history')) then raise exception 'Duplicate completed cooks' using errcode='23514'; end if;
 if active is not null and exists(select 1 from jsonb_array_elements(document->'history') h where h->>'id'=active->'meal'->>'id') then raise exception 'Cook cannot be active and completed' using errcode='23514'; end if;
 delete from public.cook_sessions c where c.owner_user_id=account_owner and (
  (c.state='completed' and not exists(select 1 from jsonb_array_elements(document->'history') h where h->>'id'=c.id::text))
  or(c.state<>'completed' and c.id::text is distinct from active->'meal'->>'id' and not exists(select 1 from jsonb_array_elements(document->'history') h where h->>'id'=c.id::text)));
 for record in select value from jsonb_array_elements(document->'history') loop
  m:=record->'meal';cook:=(m->>'id')::uuid;
  select * into old from public.cook_sessions where id=cook;
  if found and old.owner_user_id<>account_owner then raise exception 'Cook ID unavailable' using errcode='23514'; end if;
  if found and old.state='completed' then
   if old.completed_snapshot<>record then raise exception 'Completed cooks are immutable' using errcode='23514'; end if;
   continue;
  end if;
  if not found then
   insert into public.cook_sessions(id,owner_user_id,name,time_zone,plan) values(cook,account_owner,coalesce(nullif(m->>'name',''),'Untitled cook'),time_zone,jsonb_build_object('meal',m,'serveInstant',record->'serveInstant'));
  end if;
  perform public.append_account_events(account_owner,m);
  update public.cook_sessions set state='completed',name=coalesce(nullif(m->>'name',''),'Untitled cook'),plan=jsonb_build_object('meal',m,'serveInstant',record->'serveInstant'),
   target_serve_at=(record->>'serveInstant')::timestamptz,completed_snapshot=record,outcome=record->>'feedback',finished_at=(record->>'archivedAt')::timestamptz,
   started_at=(m->>'startedAt')::timestamptz where id=cook and owner_user_id=account_owner;
 end loop;
 if active is not null then
  m:=active->'meal';cook:=(m->>'id')::uuid;
  select * into old from public.cook_sessions where id=cook;
  if found and (old.owner_user_id<>account_owner or old.state='completed') then raise exception 'Cook ID unavailable' using errcode='23514'; end if;
  if not found then insert into public.cook_sessions(id,owner_user_id,name,time_zone,plan) values(cook,account_owner,coalesce(nullif(m->>'name',''),'Untitled cook'),time_zone,active); end if;
  perform public.append_account_events(account_owner,m);
  update public.cook_sessions set name=coalesce(nullif(m->>'name',''),'Untitled cook'),state=case when m->>'mode'='cooking' then 'active' else 'planning' end,
   plan=active,target_serve_at=(active->>'serveInstant')::timestamptz,started_at=(m->>'startedAt')::timestamptz,time_zone=save_cook_workspace.time_zone where id=cook and owner_user_id=account_owner;
 end if;
 update public.cook_workspaces set revision=revision+1,last_write_id=write_id where owner_user_id=account_owner;
 return public.account_workspace_snapshot(account_owner);
end $$;
revoke all on function public.save_cook_workspace(uuid,bigint,uuid,jsonb,text) from public,anon;
grant execute on function public.save_cook_workspace(uuid,bigint,uuid,jsonb,text) to authenticated;
notify pgrst, 'reload schema';
commit;
