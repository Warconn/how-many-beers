-- #61: retained cancellation. Existing callers keep the v1 save/load contract.
-- Additive schema only; apply first to dev, then enable the capability-aware UI.
begin;
alter table public.cook_sessions drop constraint cook_sessions_state_check;
alter table public.cook_sessions add constraint cook_sessions_state_check check (state in ('planning','active','completed','canceled'));
alter table public.cook_sessions add column canceled_at timestamptz;
alter table public.cook_sessions add column cancellation_write_id uuid;
alter table public.cook_sessions add constraint canceled_receipt_required check (
 (state='canceled' and canceled_at is not null and cancellation_write_id is not null)
 or (state<>'canceled' and canceled_at is null and cancellation_write_id is null));
create unique index cancellation_receipt_by_owner on public.cook_sessions(owner_user_id,cancellation_write_id) where cancellation_write_id is not null;
-- one_open_cook_per_owner deliberately stays planning/active only.

create or replace function public.guard_cook_update() returns trigger language plpgsql set search_path='' as $$
begin
 if new.owner_user_id<>old.owner_user_id or new.id<>old.id then raise exception 'Cook identity is immutable'; end if;
 if old.state in ('completed','canceled') then raise exception 'Terminal cooks are immutable' using errcode='23514'; end if;
 if new.state='canceled' and (new.plan is distinct from old.plan or new.started_at is distinct from old.started_at
  or new.name is distinct from old.name or new.target_serve_at is distinct from old.target_serve_at
  or new.time_zone is distinct from old.time_zone or new.outcome is distinct from old.outcome) then
  raise exception 'Cancellation must retain the original cook' using errcode='23514'; end if;
 new.revision:=old.revision+1; new.created_at:=old.created_at; new.updated_at:=clock_timestamp();
 return new;
end $$;

create function public.guard_terminal_event_insert() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.cook_sessions c where c.id=new.cook_id and c.owner_user_id=new.owner_user_id and c.state in ('planning','active')) then
  raise exception 'Terminal cooks cannot receive events' using errcode='23514'; end if;
 return new;
end $$;
create trigger guard_terminal_event_insert before insert on public.cook_events for each row execute function public.guard_terminal_event_insert();
revoke all on function public.guard_terminal_event_insert() from public,anon,authenticated;
drop policy own_cook_insert on public.cook_sessions;
create policy own_cook_insert on public.cook_sessions for insert to authenticated with check ((select auth.uid())=owner_user_id and revision=1 and state in ('planning','active') and canceled_at is null and cancellation_write_id is null);
drop policy own_cook_update on public.cook_sessions;
create policy own_cook_update on public.cook_sessions for update to authenticated using ((select auth.uid())=owner_user_id and state in ('planning','active')) with check ((select auth.uid())=owner_user_id and state in ('planning','active') and canceled_at is null and cancellation_write_id is null);
drop policy own_cook_delete on public.cook_sessions;
create policy own_cook_delete on public.cook_sessions for delete to authenticated using ((select auth.uid())=owner_user_id and state<>'canceled');
drop policy own_event_insert on public.cook_events;
create policy own_event_insert on public.cook_events for insert to authenticated with check (
 (select auth.uid())=owner_user_id and exists(select 1 from public.cook_sessions c where c.id=cook_id and c.owner_user_id=(select auth.uid()) and c.state in ('planning','active')));

create or replace function public.account_workspace_snapshot(account_owner uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('revision',w.revision,'writeId',w.last_write_id,
 'capabilities',jsonb_build_object('cancelCook',true),
 'active',(select c.plan from public.cook_sessions c where c.owner_user_id=account_owner and c.state in ('planning','active')),
 'history',coalesce((select jsonb_agg(c.completed_snapshot order by c.finished_at desc,c.id) from public.cook_sessions c where c.owner_user_id=account_owner and c.state='completed'),'[]'::jsonb))
 from public.cook_workspaces w where w.owner_user_id=account_owner
$$;

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
 delete from public.cook_sessions c where c.owner_user_id=account_owner and (
  (c.state='completed' and not exists(select 1 from jsonb_array_elements(document->'history') h where h->>'id'=c.id::text))
  or(c.state in ('planning','active') and c.id::text is distinct from active->'meal'->>'id' and not exists(select 1 from jsonb_array_elements(document->'history') h where h->>'id'=c.id::text)));
 for record in select value from jsonb_array_elements(document->'history') loop
  m:=record->'meal';cook:=(m->>'id')::uuid;
  select * into old from public.cook_sessions where id=cook;
  if found and old.owner_user_id<>account_owner then raise exception 'Cook ID unavailable' using errcode='23514'; end if;
  if found and old.state='canceled' then raise exception 'Canceled cooks are terminal' using errcode='23514'; end if;
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
  if found and (old.owner_user_id<>account_owner or old.state in ('completed','canceled')) then raise exception 'Cook ID unavailable' using errcode='23514'; end if;
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

-- The retained row is the cancellation receipt. Retry stays safe after any later
-- workspace write/new cook, without canceling whichever cook happens to be active.
create function public.cancel_cook(expected_owner uuid,expected_revision bigint,target_cook_id uuid,write_id uuid)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare account_owner uuid:=auth.uid(); meta public.cook_workspaces; target public.cook_sessions;
begin
 if account_owner is null or expected_owner is distinct from account_owner then raise exception 'Not authorized' using errcode='42501'; end if;
 if expected_revision is null or expected_revision<0 or write_id is null or target_cook_id is null then raise exception 'Missing cancellation identity or revision' using errcode='23514'; end if;
 insert into public.cook_workspaces(owner_user_id) values(account_owner) on conflict do nothing;
 select * into meta from public.cook_workspaces where owner_user_id=account_owner for update;
 select * into target from public.cook_sessions where owner_user_id=account_owner and cancellation_write_id=write_id;
 if found then
  if target.id<>target_cook_id then raise exception 'Cancellation operation ID already used' using errcode='23514'; end if;
 else
  if meta.revision<>expected_revision then raise exception 'Account cook changed; reload before canceling' using errcode='40001'; end if;
  select * into target from public.cook_sessions where owner_user_id=account_owner and id=target_cook_id and state in ('planning','active') for update;
  if not found then raise exception 'Cook is no longer active' using errcode='40001'; end if;
  update public.cook_sessions set state='canceled',canceled_at=clock_timestamp(),cancellation_write_id=write_id
   where id=target_cook_id and owner_user_id=account_owner returning * into target;
  update public.cook_workspaces set revision=revision+1,last_write_id=write_id where owner_user_id=account_owner;
 end if;
 return public.account_workspace_snapshot(account_owner)||jsonb_build_object('cancellation',jsonb_build_object(
  'operationId',write_id,'cookId',target.id,'canceledAt',target.canceled_at));
end $$;
revoke all on function public.cancel_cook(uuid,bigint,uuid,uuid) from public,anon;
grant execute on function public.cancel_cook(uuid,bigint,uuid,uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
