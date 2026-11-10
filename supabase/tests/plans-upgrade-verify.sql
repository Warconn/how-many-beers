do $$begin
 if (select jsonb_agg(to_jsonb(c) order by id) from public.cook_sessions c) is distinct from (select cooks from public.hmb_plans_upgrade_expected) then raise exception 'FAIL: plans migration changed existing cooks';end if;
 if (select jsonb_agg(to_jsonb(e) order by id) from public.cook_events e) is distinct from (select events from public.hmb_plans_upgrade_expected) then raise exception 'FAIL: plans migration changed existing events';end if;
 if (select jsonb_agg(to_jsonb(w) order by owner_user_id) from public.cook_workspaces w) is distinct from (select workspaces from public.hmb_plans_upgrade_expected) then raise exception 'FAIL: plans migration changed workspace versions';end if;
 if exists(select 1 from public.saved_cook_plans) then raise exception 'FAIL: plans migration duplicated legacy drafts';end if;
 raise notice 'PASS: saved-plans migration leaves original legacy planning/canceled rows and all event/server timestamps unchanged';
end$$;
drop table public.hmb_plans_upgrade_expected;
delete from auth.users where id in ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004');
