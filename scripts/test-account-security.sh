#!/usr/bin/env bash
# Isolated PostgreSQL test harness; never connects to a hosted project.
set -euo pipefail
# Always use the local daemon; inherited remote contexts must not receive test containers.
docker(){ env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock "$@"; }
account_container="hmb-ownership-${RANDOM}-${RANDOM}"
cleanup(){ docker rm -f "$account_container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run --rm -d --name "$account_container" --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine >/dev/null
for attempt in {1..30}; do
 if docker exec "$account_container" pg_isready -U postgres -q; then break; fi
 if [ "$attempt" = 30 ]; then echo 'Test PostgreSQL did not start' >&2; exit 1; fi
 sleep 1
done
for sql_file in supabase/tests/bootstrap.sql supabase/migrations/*.sql supabase/tests/ownership.sql; do
 docker exec -i "$account_container" psql -X -U postgres -v ON_ERROR_STOP=1 < "$sql_file"
done
