-- Migration must not rewrite rows, observations, received times or ownership.
do $$begin
 if (select jsonb_agg(to_jsonb(c)-array['canceled_at','cancellation_write_id'] order by id) from public.cook_sessions c) is distinct from (select cooks from public.hmb_cancellation_upgrade_expected) then raise exception 'FAIL: migration changed existing cooks';end if;
 if (select jsonb_agg(to_jsonb(e) order by id) from public.cook_events e) is distinct from (select events from public.hmb_cancellation_upgrade_expected) then raise exception 'FAIL: migration changed existing events';end if;
 if (select jsonb_agg(to_jsonb(w) order by owner_user_id) from public.cook_workspaces w) is distinct from (select workspaces from public.hmb_cancellation_upgrade_expected) then raise exception 'FAIL: migration changed workspace versions';end if;
 raise notice 'PASS: seeded migration preserves existing active/history/events and server metadata exactly';
end$$;
drop table public.hmb_cancellation_upgrade_expected;
delete from auth.users where id='00000000-0000-4000-8000-000000000003';
