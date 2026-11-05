#!/usr/bin/env bash
# Real separate PostgreSQL sessions. The caller provides an isolated local container.
set -euo pipefail
account_container="$1"
account_database="$2"
docker(){ env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock "$@"; }
account_psql(){ docker exec -i "$account_container" psql -X -U postgres -d "$account_database" -v ON_ERROR_STOP=1 "$@"; }
account_logs="$(mktemp -d /tmp/hmb-cancel-races.XXXXXX)"
trap 'rm -rf "$account_logs"' EXIT
account_psql > /dev/null <<'SQL'
create function public.hmb_race_doc(cook uuid) returns jsonb language sql as $$
 select jsonb_build_object('active',jsonb_build_object('meal',jsonb_build_object('version',1,'id',cook,'name','Race cook','serveAt','2026-11-08T18:00','dishes','[]'::jsonb,'completed','{}'::jsonb,'notes','{}'::jsonb,'mode','cooking','startedAt','2026-11-08T12:00:00Z','events','[]'::jsonb),'serveInstant','2026-11-08T23:00:00Z'),'history','[]'::jsonb)
$$;
insert into auth.users values ('00000000-0000-4000-8000-000000000005'),('00000000-0000-4000-8000-000000000006'),('00000000-0000-4000-8000-000000000007');
SQL
wait_activity(){
 local activity_name="$1" activity_condition="$2"
 for attempt in {1..30}; do
  if [ "$(account_psql -Atc "select exists(select 1 from pg_stat_activity where application_name='$activity_name' and $activity_condition)")" = t ]; then return; fi
  sleep .1
 done
 echo "FAIL: did not observe $activity_name $activity_condition" >&2
 return 1
}
for race_kind in save finish cancel; do
 case "$race_kind" in save) race_suffix=5;;finish) race_suffix=6;;cancel) race_suffix=7;;esac
 race_owner="00000000-0000-4000-8000-00000000000$race_suffix"
 race_cook="14000000-0000-4000-8000-00000000000$race_suffix"
 race_next="15000000-0000-4000-8000-00000000000$race_suffix"
 race_seed_id="44000000-0000-4000-8000-00000000000$race_suffix"
 race_cancel_id="45000000-0000-4000-8000-00000000000$race_suffix"
 race_loser_id="46000000-0000-4000-8000-00000000000$race_suffix"
 account_psql -c "set role authenticated;select set_config('request.jwt.claim.sub','$race_owner',false);select public.save_cook_workspace(auth.uid(),0,'$race_seed_id',public.hmb_race_doc('$race_cook'),'UTC');" > /dev/null
 account_psql -c "set application_name='hmb-cancel-holder';begin;set local role authenticated;select set_config('request.jwt.claim.sub','$race_owner',true);select public.cancel_cook(auth.uid(),1,'$race_cook','$race_cancel_id');select pg_sleep(3);commit;" > "$account_logs/holder-$race_kind" 2>&1 &
 race_holder_pid=$!
 wait_activity hmb-cancel-holder "wait_event='PgSleep'"
 case "$race_kind" in
  save) race_statement="select public.save_cook_workspace(auth.uid(),1,'$race_loser_id',public.hmb_race_doc('$race_next'),'UTC')";;
  finish) race_statement="select public.save_cook_workspace(auth.uid(),1,'$race_loser_id',jsonb_build_object('active',null,'history',jsonb_build_array(jsonb_build_object('id','$race_cook','meal',public.hmb_race_doc('$race_cook')->'active'->'meal','serveInstant','2026-11-08T23:00:00Z','archivedAt','2026-11-08T20:00:00Z','plannedTimeline','[]'::jsonb,'feedback',''))),'UTC')";;
  cancel) race_statement="select public.cancel_cook(auth.uid(),1,'$race_cook','$race_loser_id')";;
 esac
 account_psql -c "set application_name='hmb-cancel-contender';set role authenticated;select set_config('request.jwt.claim.sub','$race_owner',false);$race_statement" > "$account_logs/contender-$race_kind" 2>&1 &
 race_contender_pid=$!
 wait_activity hmb-cancel-contender "wait_event_type='Lock'"
 wait "$race_holder_pid"
 if wait "$race_contender_pid"; then echo "FAIL: competing $race_kind unexpectedly succeeded" >&2; exit 1; fi
 if ! grep -Eq 'Account cook changed; reload before (saving|canceling)' "$account_logs/contender-$race_kind"; then cat "$account_logs/contender-$race_kind" >&2; exit 1; fi
 if [ "$(account_psql -Atc "select state='canceled' and cancellation_write_id='$race_cancel_id' and (select revision=2 from public.cook_workspaces where owner_user_id='$race_owner') from public.cook_sessions where id='$race_cook'")" != t ]; then echo "FAIL: cancellation lost $race_kind race" >&2;exit 1;fi
 echo "PASS: cancel versus $race_kind serializes through workspace lock and rejects stale competitor"
 account_psql -c "set role authenticated;select set_config('request.jwt.claim.sub','$race_owner',false);select public.save_cook_workspace(auth.uid(),2,'$race_loser_id',public.hmb_race_doc('$race_next'),'UTC');select public.cancel_cook(auth.uid(),1,'$race_cook','$race_cancel_id');" > /dev/null
 if [ "$(account_psql -Atc "select (select count(*)=1 from public.cook_sessions where owner_user_id='$race_owner' and state='canceled') and (select count(*)=1 from public.cook_sessions where id='$race_next' and state='active') and (select revision=3 from public.cook_workspaces where owner_user_id='$race_owner')")" != t ]; then echo 'FAIL: race recovery or old receipt changed current cook' >&2;exit 1;fi
 echo 'PASS: acknowledged new cook and late old cancellation retry preserve both records'
done
account_psql > /dev/null <<'SQL'
drop function public.hmb_race_doc(uuid);
delete from auth.users where id in ('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000007');
SQL
