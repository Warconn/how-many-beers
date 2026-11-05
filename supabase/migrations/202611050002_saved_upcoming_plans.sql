-- #83: independently versioned account plans, with exactly one live cook.
-- Legacy planning rows move only during an explicit promotion transaction.
begin;
alter table public.cook_sessions drop constraint cook_sessions_state_check;
alter table public.cook_sessions add constraint cook_sessions_state_check check (state in ('planning','active','completed','canceled','planned','archive_import'));
-- planned: retained legacy plan source, excluded from the ordinary workspace.
-- archive_import: private staging state used only inside atomic history imports.
-- Neither state participates in one_open_cook_per_owner; that index is unchanged.

create table public.saved_cook_plans (
 id uuid primary key,
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 state text not null default 'saved' check (state in ('saved','promoted','discarded')),
 schema_version integer not null default 1 check (schema_version=1),
 plan jsonb,
 legacy_cook_id uuid,
 time_zone text not null check (length(time_zone) between 1 and 100),
 target_serve_at timestamptz,
 revision bigint not null default 1 check (revision>0),
 last_write_id uuid,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 foreign key(legacy_cook_id,owner_user_id) references public.cook_sessions(id,owner_user_id) on delete cascade,
 unique(legacy_cook_id),
 check ((legacy_cook_id is null and plan is not null and jsonb_typeof(plan)='object' and octet_length(plan::text)<=1048576)
  or (legacy_cook_id is not null and plan is null and legacy_cook_id=id))
);
create index upcoming_plans_by_owner on public.saved_cook_plans(owner_user_id,target_serve_at,id) where state='saved';
alter table public.saved_cook_plans enable row level security;
alter table public.saved_cook_plans force row level security;
revoke all on public.saved_cook_plans from public,anon,authenticated;
grant select on public.saved_cook_plans to authenticated;
create policy own_saved_plan_read on public.saved_cook_plans for select to authenticated using ((select auth.uid())=owner_user_id);

-- Private receipts are independent of a mutable "last write" pointer. SHA-256
-- binds retries to their original operation/payload without retaining recipe copies.
create table public.saved_cook_plan_operations (
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 operation_id uuid not null,
 operation_kind text not null check (operation_kind in ('save','discard','promote','import')),
 plan_id uuid,
 request_hash bytea not null check (octet_length(request_hash)=32),
 result jsonb not null default '{}',
 created_at timestamptz not null default clock_timestamp(),
 primary key(owner_user_id,operation_id)
);
alter table public.saved_cook_plan_operations enable row level security;
alter table public.saved_cook_plan_operations force row level security;
revoke all on public.saved_cook_plan_operations from public,anon,authenticated;

create function public.cook_has_actual_activity(m jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(m->>'mode'='cooking',false) or coalesce(m ? 'startedAt' and m->'startedAt'<>'null'::jsonb,false)
 or coalesce(m->'completed'<>'{}'::jsonb,false)
 or exists(select 1 from jsonb_array_elements(coalesce(m->'events','[]'::jsonb)) e where e->>'kind' in ('started','completed','reopened','temperature','equipment'))
$$;
revoke all on function public.cook_has_actual_activity(jsonb) from public,anon,authenticated;

create function public.valid_saved_cook_plan(d jsonb) returns boolean language plpgsql immutable set search_path='' as $$
begin
 if d is null or jsonb_typeof(d)<>'object' or not(d ?& array['meal','serveInstant']) or octet_length(d::text)>1048576
 or public.valid_account_meal(d->'meal') is distinct from true or public.cook_has_actual_activity(d->'meal')
 or coalesce(d->'meal'->>'mode','planning')<>'planning' or jsonb_typeof(d->'serveInstant') not in ('string','null') then return false; end if;
 if d->'serveInstant'<>'null'::jsonb then perform (d->>'serveInstant')::timestamptz;end if;
 return true;
exception when others then return false;
end $$;
revoke all on function public.valid_saved_cook_plan(jsonb) from public,anon,authenticated;

create or replace function public.guard_terminal_event_insert() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.cook_sessions c where c.id=new.cook_id and c.owner_user_id=new.owner_user_id
 and (c.state in ('planning','active','archive_import') or (c.state='planned' and new.event_type='removed'))) then
  raise exception 'Terminal cooks cannot receive events' using errcode='23514'; end if;
 return new;
end $$;

create or replace function public.account_workspace_snapshot(account_owner uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('revision',w.revision,'writeId',w.last_write_id,
 'capabilities',jsonb_build_object('cancelCook',true,'savedPlans',true),
 'activeTimeZone',(select c.time_zone from public.cook_sessions c where c.owner_user_id=account_owner and c.state in ('planning','active')),
 'active',(select c.plan from public.cook_sessions c where c.owner_user_id=account_owner and c.state in ('planning','active')),
 'history',coalesce((select jsonb_agg(c.completed_snapshot order by c.finished_at desc,c.id) from public.cook_sessions c where c.owner_user_id=account_owner and c.state='completed'),'[]'::jsonb))
 from public.cook_workspaces w where w.owner_user_id=account_owner
$$;

create function public.saved_cook_plan_snapshot(account_owner uuid,target uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',p.id,'revision',p.revision,'writeId',p.last_write_id,
 'meal',coalesce(p.plan,c.plan)->'meal','serveInstant',coalesce(p.plan,c.plan)->'serveInstant',
 'timeZone',p.time_zone,'createdAt',p.created_at,'updatedAt',p.updated_at)
 from public.saved_cook_plans p left join public.cook_sessions c on c.id=p.legacy_cook_id and c.owner_user_id=p.owner_user_id
 where p.owner_user_id=account_owner and p.id=target and p.state='saved'
$$;
revoke all on function public.saved_cook_plan_snapshot(uuid,uuid) from public,anon,authenticated;
create function public.saved_cook_plans_snapshot(account_owner uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('plans',coalesce(jsonb_agg(public.saved_cook_plan_snapshot(account_owner,p.id) order by p.target_serve_at nulls last,p.created_at,p.id),'[]'::jsonb))
 from public.saved_cook_plans p where p.owner_user_id=account_owner and p.state='saved'
$$;
revoke all on function public.saved_cook_plans_snapshot(uuid) from public,anon,authenticated;

create function public.lock_saved_plan_workspace(expected_owner uuid) returns uuid language plpgsql set search_path='' as $$
declare account_owner uuid:=auth.uid();
begin
 if account_owner is null or expected_owner is distinct from account_owner then raise exception 'Not authorized' using errcode='42501';end if;
 insert into public.cook_workspaces(owner_user_id) values(account_owner) on conflict do nothing;
 perform 1 from public.cook_workspaces where owner_user_id=account_owner for update;
 return account_owner;
end $$;
revoke all on function public.lock_saved_plan_workspace(uuid) from public,anon,authenticated;

create function public.list_saved_cook_plans(expected_owner uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare account_owner uuid:=auth.uid();
begin
 if account_owner is null or expected_owner is distinct from account_owner then raise exception 'Not authorized' using errcode='42501';end if;
 return public.saved_cook_plans_snapshot(account_owner);
end $$;
create function public.read_saved_cook_plan(expected_owner uuid,target_plan_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare account_owner uuid:=auth.uid();
begin
 if account_owner is null or expected_owner is distinct from account_owner then raise exception 'Not authorized' using errcode='42501';end if;
 return public.saved_cook_plan_snapshot(account_owner,target_plan_id);
end $$;
revoke all on function public.list_saved_cook_plans(uuid),public.read_saved_cook_plan(uuid,uuid) from public,anon;
grant execute on function public.list_saved_cook_plans(uuid),public.read_saved_cook_plan(uuid,uuid) to authenticated;

create function public.save_saved_cook_plan(expected_owner uuid,target_plan_id uuid,expected_revision bigint,write_id uuid,document jsonb,time_zone text)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare account_owner uuid; p public.saved_cook_plans; receipt public.saved_cook_plan_operations; request bytea;
begin
 account_owner:=public.lock_saved_plan_workspace(expected_owner);
 if target_plan_id is null or expected_revision is null or expected_revision<0 or write_id is null
 or public.valid_saved_cook_plan(document) is distinct from true or document->'meal'->>'id' is distinct from target_plan_id::text
 or time_zone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=time_zone) then raise exception 'Invalid saved plan' using errcode='23514';end if;
 request:=sha256(convert_to(jsonb_build_object('planId',target_plan_id,'revision',expected_revision,'document',document,'timeZone',time_zone)::text,'UTF8'));
 select * into receipt from public.saved_cook_plan_operations where owner_user_id=account_owner and operation_id=write_id;
 if found then
  if receipt.operation_kind<>'save' or receipt.plan_id<>target_plan_id or receipt.request_hash<>request then raise exception 'Operation ID already used' using errcode='23514';end if;
  if public.saved_cook_plan_snapshot(account_owner,target_plan_id) is null then raise exception 'Plan is no longer upcoming' using errcode='40001';end if;
 else
  select * into p from public.saved_cook_plans where id=target_plan_id and owner_user_id=account_owner for update;
  if found then
   if p.owner_user_id<>account_owner or p.state<>'saved' then raise exception 'Plan ID unavailable' using errcode='23514';end if;
   if p.revision<>expected_revision then raise exception 'Plan changed; reload before saving' using errcode='40001';end if;
   if p.legacy_cook_id is not null then
    perform public.append_account_events(account_owner,document->'meal');
    update public.cook_sessions set plan=document,name=coalesce(nullif(document->'meal'->>'name',''),'Untitled cook'),target_serve_at=(document->>'serveInstant')::timestamptz,time_zone=save_saved_cook_plan.time_zone
     where id=p.legacy_cook_id and owner_user_id=account_owner and state='planned';
    if not found then raise exception 'Legacy plan changed' using errcode='40001';end if;
   end if;
   update public.saved_cook_plans set plan=case when legacy_cook_id is null then document else null end,time_zone=save_saved_cook_plan.time_zone,
    target_serve_at=(document->>'serveInstant')::timestamptz,revision=revision+1,last_write_id=write_id,updated_at=clock_timestamp() where id=target_plan_id;
  else
   if expected_revision<>0 then raise exception 'Plan changed; reload before saving' using errcode='40001';end if;
   if exists(select 1 from public.cook_sessions where id=target_plan_id) or exists(select 1 from public.saved_cook_plans where id=target_plan_id) then raise exception 'Plan ID unavailable' using errcode='23514';end if;
   insert into public.saved_cook_plans(id,owner_user_id,plan,time_zone,target_serve_at,last_write_id) values(target_plan_id,account_owner,document,time_zone,(document->>'serveInstant')::timestamptz,write_id);
  end if;
  insert into public.saved_cook_plan_operations(owner_user_id,operation_id,operation_kind,plan_id,request_hash) values(account_owner,write_id,'save',target_plan_id,request);
 end if;
 return public.saved_cook_plan_snapshot(account_owner,target_plan_id)||jsonb_build_object('writeReceipt',jsonb_build_object('operationId',write_id,'planId',target_plan_id));
end $$;
revoke all on function public.save_saved_cook_plan(uuid,uuid,bigint,uuid,jsonb,text) from public,anon;
grant execute on function public.save_saved_cook_plan(uuid,uuid,bigint,uuid,jsonb,text) to authenticated;

create function public.discard_saved_cook_plan(expected_owner uuid,target_plan_id uuid,expected_revision bigint,write_id uuid)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare account_owner uuid; p public.saved_cook_plans; receipt public.saved_cook_plan_operations; request bytea;
begin
 account_owner:=public.lock_saved_plan_workspace(expected_owner);
 if target_plan_id is null or expected_revision is null or expected_revision<1 or write_id is null then raise exception 'Invalid discard request' using errcode='23514';end if;
 request:=sha256(convert_to(jsonb_build_object('planId',target_plan_id,'revision',expected_revision)::text,'UTF8'));
 select * into receipt from public.saved_cook_plan_operations where owner_user_id=account_owner and operation_id=write_id;
 if found then
  if receipt.operation_kind<>'discard' or receipt.plan_id<>target_plan_id or receipt.request_hash<>request then raise exception 'Operation ID already used' using errcode='23514';end if;
 else
  select * into p from public.saved_cook_plans where id=target_plan_id and owner_user_id=account_owner for update;
  if not found or p.state<>'saved' or p.revision<>expected_revision then raise exception 'Plan changed; reload before discarding' using errcode='40001';end if;
  update public.saved_cook_plans set state='discarded',revision=revision+1,last_write_id=write_id,updated_at=clock_timestamp() where id=target_plan_id;
  insert into public.saved_cook_plan_operations(owner_user_id,operation_id,operation_kind,plan_id,request_hash) values(account_owner,write_id,'discard',target_plan_id,request);
 end if;
 return jsonb_build_object('operationId',write_id,'planId',target_plan_id,'discarded',true);
end $$;
revoke all on function public.discard_saved_cook_plan(uuid,uuid,bigint,uuid) from public,anon;
grant execute on function public.discard_saved_cook_plan(uuid,uuid,bigint,uuid) to authenticated;

create function public.transfer_legacy_planning(account_owner uuid) returns void language plpgsql set search_path='' as $$
declare old public.cook_sessions; meaningful boolean;
begin
 select * into old from public.cook_sessions where owner_user_id=account_owner and state in ('planning','active') for update;
 if not found then return;end if;
 if public.cook_has_actual_activity(old.plan->'meal') then raise exception 'Continue the current cook before starting another' using errcode='40001';end if;
 meaningful:=jsonb_array_length(old.plan->'meal'->'dishes')>0
  or jsonb_array_length(coalesce(old.plan->'meal'->'customTasks','[]'::jsonb))>0
  or old.plan->'meal'->>'name'<>'Next cook' or coalesce(old.plan->'meal'->'notes','{}')<>'{}'::jsonb
  or coalesce(old.plan->'meal'->'events','[]')<>'[]'::jsonb or coalesce(old.plan->'meal'->'taskOverrides','{}')<>'{}'::jsonb;
 -- Identity, plan and events stay in their original row. The collection owns only
 -- a reference; linked and native plans each have exactly one payload authority.
 update public.cook_sessions set state='planned' where id=old.id;
 if meaningful then
  insert into public.saved_cook_plans(id,owner_user_id,legacy_cook_id,time_zone,target_serve_at,created_at,updated_at)
   values(old.id,account_owner,old.id,old.time_zone,old.target_serve_at,old.created_at,old.updated_at);
 end if;
end $$;
revoke all on function public.transfer_legacy_planning(uuid) from public,anon,authenticated;

create function public.promote_saved_cook_plan(expected_owner uuid,expected_workspace_revision bigint,target_plan_id uuid,expected_plan_revision bigint,write_id uuid)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare account_owner uuid; meta public.cook_workspaces; p public.saved_cook_plans; receipt public.saved_cook_plan_operations; request bytea; d jsonb; m jsonb;
begin
 account_owner:=public.lock_saved_plan_workspace(expected_owner);
 if target_plan_id is null or expected_workspace_revision is null or expected_workspace_revision<0 or expected_plan_revision is null or expected_plan_revision<1 or write_id is null then raise exception 'Invalid promotion request' using errcode='23514';end if;
 request:=sha256(convert_to(jsonb_build_object('planId',target_plan_id,'workspaceRevision',expected_workspace_revision,'planRevision',expected_plan_revision)::text,'UTF8'));
 select * into receipt from public.saved_cook_plan_operations where owner_user_id=account_owner and operation_id=write_id;
 if found then
  if receipt.operation_kind<>'promote' or receipt.plan_id<>target_plan_id or receipt.request_hash<>request then raise exception 'Operation ID already used' using errcode='23514';end if;
 else
  select * into meta from public.cook_workspaces where owner_user_id=account_owner;
  if meta.revision<>expected_workspace_revision then raise exception 'Account cook changed; reload before starting' using errcode='40001';end if;
  select * into p from public.saved_cook_plans where id=target_plan_id and owner_user_id=account_owner for update;
  if not found or p.state<>'saved' or p.revision<>expected_plan_revision then raise exception 'Plan changed; reload before starting' using errcode='40001';end if;
  d:=public.saved_cook_plan_snapshot(account_owner,target_plan_id);
  if d is null or public.valid_saved_cook_plan(jsonb_build_object('meal',d->'meal','serveInstant',d->'serveInstant')) is distinct from true then raise exception 'Plan is not safe to start' using errcode='23514';end if;
  perform public.transfer_legacy_planning(account_owner);
  m:=jsonb_set(jsonb_set(d->'meal','{mode}','"cooking"'),'{startedAt}',to_jsonb(clock_timestamp()));
  if p.legacy_cook_id is not null then
   update public.cook_sessions set state='active',plan=jsonb_build_object('meal',m,'serveInstant',d->'serveInstant'),started_at=(m->>'startedAt')::timestamptz
    where id=p.legacy_cook_id and owner_user_id=account_owner and state='planned';
   if not found then raise exception 'Legacy plan changed; reload before starting' using errcode='40001';end if;
  else
   insert into public.cook_sessions(id,owner_user_id,state,name,time_zone,plan,target_serve_at,started_at)
    values(target_plan_id,account_owner,'active',coalesce(nullif(m->>'name',''),'Untitled cook'),p.time_zone,jsonb_build_object('meal',m,'serveInstant',d->'serveInstant'),(d->>'serveInstant')::timestamptz,(m->>'startedAt')::timestamptz);
  end if;
  perform public.append_account_events(account_owner,m);
  update public.saved_cook_plans set state='promoted',revision=revision+1,last_write_id=write_id,updated_at=clock_timestamp() where id=target_plan_id;
  update public.cook_workspaces set revision=revision+1,last_write_id=write_id where owner_user_id=account_owner;
  insert into public.saved_cook_plan_operations(owner_user_id,operation_id,operation_kind,plan_id,request_hash,result)
   values(account_owner,write_id,'promote',target_plan_id,request,jsonb_build_object('cookId',target_plan_id));
 end if;
 return public.account_workspace_snapshot(account_owner)||jsonb_build_object('promotion',jsonb_build_object('operationId',write_id,'planId',target_plan_id,'cookId',target_plan_id));
end $$;
revoke all on function public.promote_saved_cook_plan(uuid,bigint,uuid,bigint,uuid) from public,anon;
grant execute on function public.promote_saved_cook_plan(uuid,bigint,uuid,bigint,uuid) to authenticated;

-- A separate, explicitly named upcoming-plans backup is an atomic merge. Older
-- active/history backups continue to work and never delete plans by omission.
create function public.import_saved_cook_plans(expected_owner uuid,write_id uuid,documents jsonb)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare account_owner uuid; receipt public.saved_cook_plan_operations; request bytea; item jsonb; d jsonb; p public.saved_cook_plans; legacy public.cook_sessions; ids jsonb:='[]'; target uuid;
begin
 account_owner:=public.lock_saved_plan_workspace(expected_owner);
 if write_id is null or jsonb_typeof(documents) is distinct from 'array' or octet_length(documents::text)>33554432 then raise exception 'Invalid plans backup' using errcode='23514';end if;
 request:=sha256(convert_to(documents::text,'UTF8'));
 select * into receipt from public.saved_cook_plan_operations where owner_user_id=account_owner and operation_id=write_id;
 if found then
  if receipt.operation_kind<>'import' or receipt.request_hash<>request then raise exception 'Operation ID already used' using errcode='23514';end if;
  ids:=receipt.result->'planIds';
 else
  if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(documents)) then raise exception 'Duplicate plan IDs' using errcode='23514';end if;
  for item in select value from jsonb_array_elements(documents) loop
   if jsonb_typeof(item)<>'object' or not(item ?& array['id','meal','serveInstant','timeZone']) then raise exception 'Invalid backup plan' using errcode='23514';end if;
   target:=(item->>'id')::uuid;d:=jsonb_build_object('meal',item->'meal','serveInstant',item->'serveInstant');
   if target is null or public.valid_saved_cook_plan(d) is distinct from true or d->'meal'->>'id' is distinct from target::text
    or jsonb_typeof(item->'timeZone')<>'string' or not exists(select 1 from pg_catalog.pg_timezone_names where name=item->>'timeZone') then raise exception 'Invalid backup plan' using errcode='23514';end if;
   select * into p from public.saved_cook_plans where id=target and owner_user_id=account_owner for update;
   if found then
    if p.owner_user_id<>account_owner or p.state<>'saved' then raise exception 'Plan ID unavailable' using errcode='23514';end if;
    if (public.saved_cook_plan_snapshot(account_owner,target)->'meal') is distinct from d->'meal'
     or (public.saved_cook_plan_snapshot(account_owner,target)->'serveInstant') is distinct from d->'serveInstant' or p.time_zone<>item->>'timeZone' then raise exception 'Existing plan differs; review before importing' using errcode='40001';end if;
   else
    if exists(select 1 from public.saved_cook_plans where id=target) then raise exception 'Plan ID unavailable' using errcode='23514';end if;
    select * into legacy from public.cook_sessions where id=target;
    if found then
     if legacy.owner_user_id<>account_owner or legacy.state<>'planning' or public.cook_has_actual_activity(legacy.plan->'meal') then raise exception 'Plan ID unavailable' using errcode='23514';end if;
     if legacy.plan is distinct from d or legacy.time_zone<>item->>'timeZone' then raise exception 'Existing legacy plan differs; review before importing' using errcode='40001';end if;
     -- Same logical legacy Upcoming is already present; do not duplicate/move it.
    else
     insert into public.saved_cook_plans(id,owner_user_id,plan,time_zone,target_serve_at,last_write_id)
      values(target,account_owner,d,item->>'timeZone',(d->>'serveInstant')::timestamptz,write_id);
    end if;
   end if;
   ids:=ids||jsonb_build_array(target);
  end loop;
  insert into public.saved_cook_plan_operations(owner_user_id,operation_id,operation_kind,request_hash,result)
   values(account_owner,write_id,'import',request,jsonb_build_object('planIds',ids));
 end if;
 return public.saved_cook_plans_snapshot(account_owner)||jsonb_build_object('importReceipt',jsonb_build_object('operationId',write_id,'planIds',ids));
end $$;
revoke all on function public.import_saved_cook_plans(uuid,uuid,jsonb) from public,anon;
grant execute on function public.import_saved_cook_plans(uuid,uuid,jsonb) to authenticated;

create or replace function public.save_cook_workspace(expected_owner uuid,expected_revision bigint,write_id uuid,document jsonb,time_zone text)
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
 if exists(select 1 from public.saved_cook_plans p where (p.id::text=active->'meal'->>'id' or exists(select 1 from jsonb_array_elements(document->'history') h where h->>'id'=p.id::text))
  and (p.owner_user_id<>account_owner or p.state in ('saved','discarded'))) then raise exception 'Saved plan IDs require the plans API' using errcode='23514';end if;
 if exists(select 1 from public.cook_sessions c where c.owner_user_id=account_owner and c.state in ('planning','active') and public.cook_has_actual_activity(c.plan->'meal')
  and c.id::text is distinct from active->'meal'->>'id' and not exists(select 1 from jsonb_array_elements(document->'history') h where h->>'id'=c.id::text)) then
  raise exception 'Finish or cancel the current cook before replacing it' using errcode='40001';end if;
 delete from public.cook_sessions c where c.owner_user_id=account_owner and (
  (c.state='completed' and not exists(select 1 from jsonb_array_elements(document->'history') h where h->>'id'=c.id::text))
  or(c.state in ('planning','active') and c.id::text is distinct from active->'meal'->>'id' and not exists(select 1 from jsonb_array_elements(document->'history') h where h->>'id'=c.id::text)));
 for record in select value from jsonb_array_elements(document->'history') loop
  m:=record->'meal';cook:=(m->>'id')::uuid;
  select * into old from public.cook_sessions where id=cook;
  if found and old.owner_user_id<>account_owner then raise exception 'Cook ID unavailable' using errcode='23514'; end if;
  if found and old.state in ('canceled','planned') then raise exception 'Canceled cooks are terminal' using errcode='23514'; end if;
  if found and old.state='completed' then
   if old.completed_snapshot<>record then raise exception 'Completed cooks are immutable' using errcode='23514'; end if;
   continue;
  end if;
  if not found then
   insert into public.cook_sessions(id,owner_user_id,state,name,time_zone,plan) values(cook,account_owner,'archive_import',coalesce(nullif(m->>'name',''),'Untitled cook'),time_zone,jsonb_build_object('meal',m,'serveInstant',record->'serveInstant'));
  end if;
  perform public.append_account_events(account_owner,m);
  update public.cook_sessions set state='completed',name=coalesce(nullif(m->>'name',''),'Untitled cook'),plan=jsonb_build_object('meal',m,'serveInstant',record->'serveInstant'),
   target_serve_at=(record->>'serveInstant')::timestamptz,completed_snapshot=record,outcome=record->>'feedback',finished_at=(record->>'archivedAt')::timestamptz,
   started_at=(m->>'startedAt')::timestamptz where id=cook and owner_user_id=account_owner;
 end loop;
 if active is not null then
  m:=active->'meal';cook:=(m->>'id')::uuid;
  select * into old from public.cook_sessions where id=cook;
  if found and (old.owner_user_id<>account_owner or old.state in ('completed','canceled','planned')) then raise exception 'Cook ID unavailable' using errcode='23514'; end if;
  if not found then insert into public.cook_sessions(id,owner_user_id,name,time_zone,plan) values(cook,account_owner,coalesce(nullif(m->>'name',''),'Untitled cook'),time_zone,active); end if;
  perform public.append_account_events(account_owner,m);
  update public.cook_sessions as current_active set name=coalesce(nullif(m->>'name',''),'Untitled cook'),state=case when m->>'mode'='cooking' then 'active' else 'planning' end,
   plan=active,target_serve_at=(active->>'serveInstant')::timestamptz,started_at=(m->>'startedAt')::timestamptz,time_zone=save_cook_workspace.time_zone where current_active.id=cook and current_active.owner_user_id=account_owner
   and (old.id is null or current_active.plan is distinct from active or current_active.time_zone is distinct from save_cook_workspace.time_zone or current_active.state is distinct from case when m->>'mode'='cooking' then 'active' else 'planning' end);
 end if;
 update public.cook_workspaces set revision=revision+1,last_write_id=write_id where owner_user_id=account_owner;
 return public.account_workspace_snapshot(account_owner);
end $$;
revoke all on function public.save_cook_workspace(uuid,bigint,uuid,jsonb,text) from public,anon;
grant execute on function public.save_cook_workspace(uuid,bigint,uuid,jsonb,text) to authenticated;

notify pgrst, 'reload schema';
commit;
