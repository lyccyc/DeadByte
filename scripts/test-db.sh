#!/usr/bin/env bash
# Runs the SQL migrations and database tests against a DISPOSABLE PostgreSQL.
#
#   TEST_DATABASE_URL=postgres://postgres@localhost:5432/postgres npm run test:db
#
# The script creates (and drops) a fresh database named deadbyte_test on that
# server, installs a minimal Supabase stub (roles + auth schema), applies every
# migration, runs supabase/tests/*.test.sql, then races concurrent correct
# submissions to prove only one solve is ever awarded.
# NEVER point this at your Supabase project.
set -euo pipefail

: "${TEST_DATABASE_URL:?Set TEST_DATABASE_URL to a disposable PostgreSQL server (not Supabase)}"
case "$TEST_DATABASE_URL" in
  *supabase.co*|*supabase.com*|*pooler.supabase*) echo "Refusing to run against a Supabase host." >&2; exit 1 ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB=deadbyte_test
ADMIN_URL="$TEST_DATABASE_URL"
# Replace the database name in the URL with deadbyte_test.
TEST_URL="$(node -e 'const u=new URL(process.argv[1]); u.pathname="/'"$DB"'"; console.log(u.toString())' "$ADMIN_URL")"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

"${PSQL[@]}" "$ADMIN_URL" -c "drop database if exists $DB" -c "create database $DB"
trap '"${PSQL[@]}" "$ADMIN_URL" -c "drop database if exists '"$DB"'" >/dev/null 2>&1 || true' EXIT

"${PSQL[@]}" "$TEST_URL" -f "$ROOT/supabase/tests/00_supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate: $(basename "$f")"
  "${PSQL[@]}" "$TEST_URL" -o /dev/null -f "$f"
done

for f in "$ROOT"/supabase/tests/*.test.sql; do
  echo "test: $(basename "$f")"
  "${PSQL[@]}" "$TEST_URL" -o /dev/null -f "$f"
done

# --- Concurrency: 8 simultaneous correct submissions by one user -> exactly one solve.
"${PSQL[@]}" "$TEST_URL" <<'SQL'
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-4000-8000-0000000000ff', 'race@example.test', '{"username":"racer"}');
select public.svc_admin_save_challenge(null, null,
  '{"slug":"race-case","region":"europe","title":"Race","difficulty":"easy","points":77,"requiresEvidence":false}',
  repeat('7', 64));
select public.svc_publish_challenge(null, (select id from public.challenges where slug = 'race-case'));
SQL
pids=()
for _ in 1 2 3 4 5 6 7 8; do
  "${PSQL[@]}" "$TEST_URL" -c "set role service_role; select * from public.svc_submit_flag('00000000-0000-4000-8000-0000000000ff', (select id from public.challenges where slug = 'race-case'), repeat('7', 64), 100);" >/dev/null &
  pids+=($!)
done
for p in "${pids[@]}"; do wait "$p"; done
result="$("${PSQL[@]}" "$TEST_URL" -At -c "select count(*) || ':' || coalesce(sum(points_awarded),0) from public.solves where user_id = '00000000-0000-4000-8000-0000000000ff'")"
if [ "$result" != "1:77" ]; then
  echo "concurrency: FAILED (solves:points = $result, expected 1:77)" >&2
  exit 1
fi
echo "concurrency: 8 parallel correct submissions -> exactly 1 solve (77 points). PASSED"

# --- Rollback applies cleanly.
"${PSQL[@]}" "$TEST_URL" -f "$ROOT"/supabase/rollbacks/20261031120000_core_schema.down.sql
echo "rollback: PASSED"
echo "All database tests passed."
