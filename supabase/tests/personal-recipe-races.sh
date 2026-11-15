#!/usr/bin/env bash
# Disposable PostgreSQL only; prove save/remove conflicts with separate sessions.
set -euo pipefail
account_container="$1"; account_database="$2"
docker(){ env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock "$@"; }
account_psql(){ docker exec -i "$account_container" psql -X -U postgres -d "$account_database" -v ON_ERROR_STOP=1 "$@"; }
recipe_logs="$(mktemp -d /tmp/hmb-recipe-races.XXXXXX)"
trap 'rm -rf "$recipe_logs"' EXIT
account_psql >/dev/null <<'SQL'
insert into auth.users values ('00000000-0000-4000-8000-000000000014');
create function public.hmb_recipe_race_doc(target uuid) returns jsonb language sql as $$select jsonb_build_object('format','how-many-beers','schemaVersion',1,'type','recipe','id',target,'name','Race method','recipe','{"method":"manual","equipment":[],"source":{"kind":"manual"},"steps":[{"id":"mix","type":"instruction","title":"Mix","timing":{"estimatedMinutes":5},"actions":[{"type":"custom"}]}],"phases":[]}'::jsonb)$$;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000014',false);
select public.mutate_personal_recipe(auth.uid(),'a1400000-0000-4000-8000-000000000014',0,'b1400000-0000-4000-8000-000000000014','save',public.hmb_recipe_race_doc('a1400000-0000-4000-8000-000000000014'));
SQL
account_psql -c "set application_name='hmb-recipe-holder';begin;set local role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000014',true);select public.mutate_personal_recipe(auth.uid(),'a1400000-0000-4000-8000-000000000014',1,'b1400000-0000-4000-8000-000000000015','remove');select pg_sleep(3);commit;" > "$recipe_logs/holder" 2>&1 &
recipe_holder=$!
for attempt in {1..30};do
 if [ "$(account_psql -Atc "select exists(select 1 from pg_stat_activity where application_name='hmb-recipe-holder' and wait_event='PgSleep')")" = t ];then break;fi
 if [ "$attempt" = 30 ];then echo 'FAIL: recipe holder not observed';exit 1;fi
 sleep .1
done
set +e
account_psql -c "set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000014',false);select public.mutate_personal_recipe(auth.uid(),'a1400000-0000-4000-8000-000000000014',1,'b1400000-0000-4000-8000-000000000016','save',public.hmb_recipe_race_doc('a1400000-0000-4000-8000-000000000014'));" > "$recipe_logs/contender" 2>&1
recipe_result=$?
set -e
wait "$recipe_holder"
if [ "$recipe_result" = 0 ]||! grep -q 'Recipe changed or removed' "$recipe_logs/contender";then echo 'FAIL: stale save passed competing removal';cat "$recipe_logs/contender";exit 1;fi
if [ "$(account_psql -Atc "select state='deleted' and revision=2 and deleted_at is not null from public.personal_recipes where id='a1400000-0000-4000-8000-000000000014'")" != t ];then echo 'FAIL: recipe was resurrected';exit 1;fi
account_psql >/dev/null <<'SQL'
drop function public.hmb_recipe_race_doc(uuid);
delete from auth.users where id='00000000-0000-4000-8000-000000000014';
SQL
echo 'PASS: concurrent recipe save versus remove retains deletion and rejects stale update'
