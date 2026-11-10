#!/usr/bin/env bash
# Lock-order and optimistic revision proofs using real separate local sessions.
set -euo pipefail
account_container="$1"
account_database="$2"
docker(){ env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock "$@"; }
account_psql(){ docker exec -i "$account_container" psql -X -U postgres -d "$account_database" -v ON_ERROR_STOP=1 "$@"; }
account_logs="$(mktemp -d /tmp/hmb-plan-races.XXXXXX)"
trap 'rm -rf "$account_logs"' EXIT
account_psql > /dev/null <<'SQL'
create function public.hmb_plan_race_doc(cook uuid,label text default 'Race plan') returns jsonb language sql as $$
 select jsonb_build_object('meal',jsonb_build_object('version',1,'id',cook,'name',label,'serveAt','2026-11-08T18:00','dishes','[]'::jsonb,'completed','{}'::jsonb,'notes','{}'::jsonb,'mode','planning','events','[]'::jsonb),'serveInstant','2026-11-08T23:00:00Z')
$$;
insert into auth.users values ('00000000-0000-4000-8000-000000000008'),('00000000-0000-4000-8000-000000000009');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000008',false);
select public.save_saved_cook_plan(auth.uid(),'24000000-0000-4000-8000-000000000001',0,'62000000-0000-4000-8000-000000000001',public.hmb_plan_race_doc('24000000-0000-4000-8000-000000000001'),'UTC');
select public.save_saved_cook_plan(auth.uid(),'24000000-0000-4000-8000-000000000002',0,'62000000-0000-4000-8000-000000000002',public.hmb_plan_race_doc('24000000-0000-4000-8000-000000000002'),'UTC');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',false);
select public.save_saved_cook_plan(auth.uid(),'24000000-0000-4000-8000-000000000003',0,'62000000-0000-4000-8000-000000000003',public.hmb_plan_race_doc('24000000-0000-4000-8000-000000000003'),'UTC');
SQL
wait_activity(){
 local activity_name="$1" activity_condition="$2"
 for attempt in {1..30}; do
  if [ "$(account_psql -Atc "select exists(select 1 from pg_stat_activity where application_name='$activity_name' and $activity_condition)")" = t ]; then return; fi
  sleep .1
 done
 echo "FAIL: did not observe $activity_name $activity_condition" >&2;return 1
}
# Each holder pins the workspace row first; contenders demonstrably wait on Lock,
# then see committed revisions instead of racing a plan into a second active slot.
for race_kind in promote cancel save; do
 case "$race_kind" in
  promote)
   race_owner='00000000-0000-4000-8000-000000000008'
   race_holder="select public.promote_saved_cook_plan(auth.uid(),0,'24000000-0000-4000-8000-000000000001',1,'63000000-0000-4000-8000-000000000001')"
   race_contender="select public.promote_saved_cook_plan(auth.uid(),0,'24000000-0000-4000-8000-000000000002',1,'63000000-0000-4000-8000-000000000002')";;
  cancel)
   race_owner='00000000-0000-4000-8000-000000000008'
   race_holder="select public.cancel_cook(auth.uid(),1,'24000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000001')"
   race_contender="select public.promote_saved_cook_plan(auth.uid(),1,'24000000-0000-4000-8000-000000000002',1,'63000000-0000-4000-8000-000000000003')";;
  save)
   race_owner='00000000-0000-4000-8000-000000000009'
   race_holder="select public.save_saved_cook_plan(auth.uid(),'24000000-0000-4000-8000-000000000003',1,'65000000-0000-4000-8000-000000000001',public.hmb_plan_race_doc('24000000-0000-4000-8000-000000000003','First edit'),'UTC')"
   race_contender="select public.save_saved_cook_plan(auth.uid(),'24000000-0000-4000-8000-000000000003',1,'65000000-0000-4000-8000-000000000002',public.hmb_plan_race_doc('24000000-0000-4000-8000-000000000003','Lost edit'),'UTC')";;
 esac
 account_psql -c "set application_name='hmb-plan-holder';begin;set local role authenticated;select set_config('request.jwt.claim.sub','$race_owner',true);$race_holder;select pg_sleep(3);commit;" > "$account_logs/holder-$race_kind" 2>&1 &
 race_holder_pid=$!
 wait_activity hmb-plan-holder "wait_event='PgSleep'"
 account_psql -c "set application_name='hmb-plan-contender';set role authenticated;select set_config('request.jwt.claim.sub','$race_owner',false);$race_contender" > "$account_logs/contender-$race_kind" 2>&1 &
 race_contender_pid=$!
 wait_activity hmb-plan-contender "wait_event_type='Lock'"
 wait "$race_holder_pid"
 if wait "$race_contender_pid"; then echo "FAIL: competing $race_kind unexpectedly succeeded" >&2;exit 1;fi
 if ! grep -Eq 'changed; reload before (starting|saving)' "$account_logs/contender-$race_kind"; then cat "$account_logs/contender-$race_kind" >&2;exit 1;fi
 echo "PASS: saved-plan $race_kind race observes workspace-first lock and rejects stale competitor"
 case "$race_kind" in
  promote)
   if [ "$(account_psql -Atc "select (select count(*)=1 from public.cook_sessions where owner_user_id='$race_owner' and state='active') and (select state='saved' from public.saved_cook_plans where id='24000000-0000-4000-8000-000000000002')")" != t ];then echo 'FAIL: competing promotions lost future plan or created two active cooks' >&2;exit 1;fi
   echo 'PASS: competing promotions have one active winner and preserve the other saved plan';;
  cancel)
   if [ "$(account_psql -Atc "select (select count(*)=0 from public.cook_sessions where owner_user_id='$race_owner' and state='active') and (select state='canceled' from public.cook_sessions where id='24000000-0000-4000-8000-000000000001') and (select state='saved' from public.saved_cook_plans where id='24000000-0000-4000-8000-000000000002')")" != t ];then echo 'FAIL: cancellation/promotion race changed saved plan' >&2;exit 1;fi
   account_psql -c "set role authenticated;select set_config('request.jwt.claim.sub','$race_owner',false);select public.promote_saved_cook_plan(auth.uid(),2,'24000000-0000-4000-8000-000000000002',1,'63000000-0000-4000-8000-000000000004');select public.promote_saved_cook_plan(auth.uid(),0,'24000000-0000-4000-8000-000000000001',1,'63000000-0000-4000-8000-000000000001');" > /dev/null
   if [ "$(account_psql -Atc "select (public.account_workspace_snapshot('$race_owner')->'active'->'meal'->>'id'='24000000-0000-4000-8000-000000000002') and (public.account_workspace_snapshot('$race_owner')->>'revision')::int=3")" != t ];then echo 'FAIL: retry of original promotion restarted canceled cook' >&2;exit 1;fi
   echo 'PASS: promotion after acknowledged cancellation and late original receipt preserve current cook';;
  save)
   if [ "$(account_psql -Atc "select revision=2 and plan->'meal'->>'name'='First edit' from public.saved_cook_plans where id='24000000-0000-4000-8000-000000000003'")" != t ];then echo 'FAIL: saved-plan CAS lost winning edit' >&2;exit 1;fi
   echo 'PASS: concurrent edits retain the acknowledged winning revision';;
 esac
done
account_psql > /dev/null <<'SQL'
drop function public.hmb_plan_race_doc(uuid,text);
delete from auth.users where id in ('00000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000009');
SQL
