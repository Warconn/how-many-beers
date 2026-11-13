#!/usr/bin/env bash
# Isolated PostgreSQL test harness; never connects to a hosted project.
set -euo pipefail
# Always use the local daemon; inherited remote contexts must not receive test containers.
docker(){ env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock "$@"; }
account_container="hmb-ownership-${RANDOM}-${RANDOM}"
cleanup(){
 local account_exit_status=$?
 if [ "$account_exit_status" -ne 0 ]; then docker logs --tail 80 "$account_container" >&2 || true; fi
 docker rm -f "$account_container" >/dev/null 2>&1 || true
 return "$account_exit_status"
}
trap cleanup EXIT
docker run --rm -d --name "$account_container" --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine >/dev/null
for attempt in {1..30}; do
 # The entrypoint's temporary initialization server accepts Unix sockets, then
 # shuts down. TCP readiness waits for the final server, even with network none.
 if docker exec "$account_container" pg_isready -h 127.0.0.1 -U postgres -q; then break; fi
 if [ "$attempt" = 30 ]; then echo 'Test PostgreSQL did not start' >&2; exit 1; fi
 sleep 1
done
# Separate fresh-install and existing-data upgrade databases use the same local
# server. Auth roles are cluster-wide; only bootstrap them in the first database.
for account_database in hmb_clean hmb_upgrade; do
 docker exec "$account_container" createdb -U postgres "$account_database"
 account_psql(){ docker exec -i "$account_container" psql -X -U postgres -d "$account_database" -v ON_ERROR_STOP=1; }
 if [ "$account_database" = hmb_clean ]; then
  account_psql < supabase/tests/bootstrap.sql
 else
  sed '/^create role /d' supabase/tests/bootstrap.sql | account_psql
 fi
 for sql_file in supabase/migrations/*.sql; do
  account_psql < "$sql_file"
  # Check the original RLS contract before upgrading it to RPC-only writes.
  if [ "$sql_file" = supabase/migrations/202610280001_account_foundation.sql ]; then
   account_psql < supabase/tests/ownership.sql
  fi
  if [ "$account_database" = hmb_upgrade ] && [ "$sql_file" = supabase/migrations/202610280002_account_cook_workspace.sql ]; then
   account_psql < supabase/tests/cancellation-upgrade-seed.sql
  fi
  if [ "$account_database" = hmb_upgrade ] && [ "$sql_file" = supabase/migrations/202611050001_retained_cancellation.sql ]; then
   account_psql < supabase/tests/cancellation-upgrade-verify.sql
   account_psql < supabase/tests/plans-upgrade-seed.sql
  fi
 done
 if [ "$account_database" = hmb_upgrade ]; then
  account_psql < supabase/tests/plans-upgrade-verify.sql
 fi
 account_psql < supabase/tests/account-workspace.sql
 account_psql < supabase/tests/retained-cancellation.sql
 account_psql < supabase/tests/saved-upcoming-plans.sql
 account_psql < supabase/tests/personal-recipes.sql
 account_psql < supabase/tests/personal-recipe-edits.sql
 bash supabase/tests/cancellation-races.sh "$account_container" "$account_database"
 bash supabase/tests/personal-recipe-races.sh "$account_container" "$account_database"
 bash supabase/tests/saved-plan-races.sh "$account_container" "$account_database"
done
