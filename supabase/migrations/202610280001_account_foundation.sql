-- #19: ownership foundation. Auth owns identities; this schema stores private cooks.
begin;
create table public.cook_sessions (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 schema_version integer not null default 1 check (schema_version=1),
 name text not null check (length(name) between 1 and 160),
 state text not null default 'planning' check (state in ('planning','active','completed')),
 target_serve_at timestamptz,
 time_zone text not null check (length(time_zone) between 1 and 100),
 plan jsonb not null default '{}' check (jsonb_typeof(plan)='object' and octet_length(plan::text)<=1048576),
 completed_snapshot jsonb check (completed_snapshot is null or (jsonb_typeof(completed_snapshot)='object' and octet_length(completed_snapshot::text)<=2097152)),
 outcome text not null default '' check (length(outcome)<=4000),
 started_at timestamptz,
 finished_at timestamptz,
 revision bigint not null default 1 check (revision>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,owner_user_id),
 check ((state='completed' and finished_at is not null and completed_snapshot is not null)
     or (state<>'completed' and finished_at is null and completed_snapshot is null))
);
create unique index one_open_cook_per_owner on public.cook_sessions(owner_user_id) where state in ('planning','active');
create index cook_history_by_owner on public.cook_sessions(owner_user_id,finished_at desc,id) where state='completed';
create table public.cook_events (
 id uuid primary key default gen_random_uuid(),
 cook_id uuid not null,
 owner_user_id uuid not null default auth.uid(),
 task_id text not null check (length(task_id) between 1 and 250),
 event_type text not null check (event_type in ('started','completed','reopened','temperature','equipment','removed','note','outcome')),
 occurred_at timestamptz not null,
 received_at timestamptz not null default now(),
 payload jsonb not null default '{}' check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=65536),
 foreign key(cook_id,owner_user_id) references public.cook_sessions(id,owner_user_id) on delete cascade
);
create index cook_events_by_cook on public.cook_events(cook_id,occurred_at,id);
create function public.stamp_new_cook() returns trigger language plpgsql set search_path='' as $$
begin
 new.revision:=1; new.created_at:=clock_timestamp(); new.updated_at:=new.created_at; return new;
end $$;
create trigger stamp_new_cook before insert on public.cook_sessions for each row execute function public.stamp_new_cook();
revoke all on function public.stamp_new_cook() from public,anon,authenticated;
create function public.stamp_received_event() returns trigger language plpgsql set search_path='' as $$
begin new.received_at:=clock_timestamp(); return new; end $$;
create trigger stamp_received_event before insert on public.cook_events for each row execute function public.stamp_received_event();
revoke all on function public.stamp_received_event() from public,anon,authenticated;
create function public.guard_cook_update() returns trigger language plpgsql set search_path='' as $$
begin
 if new.owner_user_id<>old.owner_user_id or new.id<>old.id then raise exception 'Cook identity is immutable'; end if;
 if old.state='completed' then raise exception 'Completed cooks are immutable'; end if;
 new.revision:=old.revision+1; new.created_at:=old.created_at; new.updated_at:=clock_timestamp();
 return new;
end $$;
create trigger guard_cook_update before update on public.cook_sessions for each row execute function public.guard_cook_update();
revoke all on function public.guard_cook_update() from public,anon,authenticated;
alter table public.cook_sessions enable row level security;
alter table public.cook_sessions force row level security;
alter table public.cook_events enable row level security;
alter table public.cook_events force row level security;
revoke all on public.cook_sessions,public.cook_events from public,anon,authenticated;
grant select,insert,update,delete on public.cook_sessions to authenticated;
grant select,insert on public.cook_events to authenticated;
create policy own_cook_read on public.cook_sessions for select to authenticated using ((select auth.uid())=owner_user_id);
create policy own_cook_insert on public.cook_sessions for insert to authenticated with check ((select auth.uid())=owner_user_id and revision=1);
create policy own_cook_update on public.cook_sessions for update to authenticated using ((select auth.uid())=owner_user_id and state<>'completed') with check ((select auth.uid())=owner_user_id);
create policy own_cook_delete on public.cook_sessions for delete to authenticated using ((select auth.uid())=owner_user_id);
create policy own_event_read on public.cook_events for select to authenticated using ((select auth.uid())=owner_user_id);
create policy own_event_insert on public.cook_events for insert to authenticated with check (
 (select auth.uid())=owner_user_id and exists(select 1 from public.cook_sessions c where c.id=cook_id and c.owner_user_id=(select auth.uid()) and c.state<>'completed')
);
commit;
