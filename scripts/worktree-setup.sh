#!/usr/bin/env bash
# Bootstrap a git worktree so it can run in parallel with others: its own
# database on the shared Postgres container, its own .env and its own port.
# Usage (from inside a worktree): scripts/worktree-setup.sh [--force]
set -euo pipefail

REQUIRED_NPM="11.18.0"
DB_PREFIX="vivetutiempo"
MAIN_DB="vivetutiempo"
PG_USER="vivetutiempo"

die() { echo "error: $*" >&2; exit 1; }

force=false
case "${1:-}" in
  "") ;;
  --force) force=true ;;
  *) die "usage: $0 [--force]" ;;
esac

root="$(git rev-parse --show-toplevel)"
cd "$root"

# The main checkout owns the compose file and the shared Postgres container.
common_dir="$(cd "$(git rev-parse --git-common-dir)" && pwd)"
main_root="$(dirname "$common_dir")"
[ "$root" != "$main_root" ] || die "run this from a linked worktree, not the main checkout"
compose=(docker compose -f "$main_root/docker-compose.yml")

# Slug: lowercase, [a-z0-9_] only, max 40 chars.
slug="$(basename "$root" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9_\n' '_' | cut -c1-40)"
[ -n "$slug" ] || slug="wt"
db_name="${DB_PREFIX}_${slug}"
[ "$db_name" != "$MAIN_DB" ] || die "refusing to use the main database name"

command -v npm >/dev/null || die "npm not found (load nvm first)"
[ "$(npm -v)" = "$REQUIRED_NPM" ] || die "npm $REQUIRED_NPM required, found $(npm -v) (fix with: npm i -g npm@$REQUIRED_NPM, never sudo)"

psql_main() { "${compose[@]}" exec -T postgres psql -U "$PG_USER" -d postgres -Atq "$@"; }

# 1. Shared Postgres must already be up; never start a second one.
"${compose[@]}" exec -T postgres pg_isready -U "$PG_USER" >/dev/null 2>&1 \
  || die "shared Postgres is not running; start it from $main_root with: docker compose up -d --wait"

# 2. Database for this worktree (slug is [a-z0-9_] only, safe to inline).
if [ "$(psql_main -c "SELECT 1 FROM pg_database WHERE datname = '$db_name'")" = "1" ]; then
  echo "database $db_name already exists"
else
  psql_main -c "CREATE DATABASE \"$db_name\"" >/dev/null
  echo "created database $db_name"
fi

# 3. .env with a deterministic, collision-free port.
if [ -e .env ] && ! $force; then
  echo ".env exists, keeping it (use --force to regenerate)"
else
  [ -f .env.example ] || die ".env.example not found"
  # Ports already claimed by sibling worktrees' .env files.
  taken="$(git worktree list --porcelain | awk '/^worktree /{print substr($0,10)}' \
    | while read -r wt; do [ "$wt" = "$root" ] || awk -F: '/^APP_ORIGIN=/{gsub(/[^0-9]/,"",$NF); print $NF}' "$wt/.env" 2>/dev/null; done)"
  # 3001..3500: 3000 stays free for the main checkout.
  port=$((3001 + $(printf '%s' "$slug" | cksum | cut -d' ' -f1) % 500))
  for _ in $(seq 500); do
    if echo "$taken" | grep -qx "$port" || (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
      port=$((port >= 3500 ? 3001 : port + 1))
    else
      break
    fi
  done
  awk -v db="postgresql://$PG_USER:$PG_USER@localhost:5432/$db_name?schema=public" \
      -v s1="$(openssl rand -hex 32)" -v s2="$(openssl rand -hex 32)" \
      -v origin="http://localhost:$port" '
    /^DATABASE_URL=/ { print "DATABASE_URL=\"" db "\""; next }
    /^SESSION_SECRET=/ { print "SESSION_SECRET=\"" s1 "\""; next }
    /^RATE_LIMIT_HMAC_SECRET=/ { print "RATE_LIMIT_HMAC_SECRET=\"" s2 "\""; next }
    /^APP_ORIGIN=/ { print "APP_ORIGIN=\"" origin "\""; next }
    { print }' .env.example > .env
  chmod 600 .env
  echo "wrote .env (port $port)"
fi

# Export the worktree env so a DATABASE_URL already set in the caller's shell
# can never point Prisma at another database.
set -a; . ./.env; set +a
case "$DATABASE_URL" in
  *"/$db_name?"*) ;;
  *) die ".env DATABASE_URL does not target $db_name; rerun with --force" ;;
esac
port="${APP_ORIGIN##*:}"

# 4. Dependencies, client, schema, seed.
npm ci
npx prisma generate
npx prisma migrate deploy
npm run db:seed

cat <<MSG

Worktree ready: database $db_name, port $port.

Dev server:
  npm run dev -- --port $port

Unit tests:
  npm test

Integration tests (env must be exported; Vitest does not read .env):
  set -a; . ./.env; set +a; VIVETUTIEMPO_RUN_INTEGRATION=true npm test

E2E (dev server running; integration tests wipe the seed, re-run npm run db:seed first):
  PLAYWRIGHT_BASE_URL=http://localhost:$port npm run test:e2e
MSG
