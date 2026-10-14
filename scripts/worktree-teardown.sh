#!/usr/bin/env bash
# Drop the database created by worktree-setup.sh for this worktree. Nothing else.
# Usage (from inside a worktree): scripts/worktree-teardown.sh
set -euo pipefail

DB_PREFIX="vivetutiempo"
MAIN_DB="vivetutiempo"
PG_USER="vivetutiempo"

die() { echo "error: $*" >&2; exit 1; }

root="$(git rev-parse --show-toplevel)"
common_dir="$(cd "$(git rev-parse --git-common-dir)" && pwd)"
main_root="$(dirname "$common_dir")"
[ "$root" != "$main_root" ] || die "run this from a linked worktree, not the main checkout"
compose=(docker compose -f "$main_root/docker-compose.yml")

slug="$(basename "$root" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9_\n' '_' | cut -c1-40)"
[ -n "$slug" ] || slug="wt"
db_name="${DB_PREFIX}_${slug}"
[ "$db_name" != "$MAIN_DB" ] || die "refusing to drop the main database"

read -r -p "Drop database '$db_name'? Type its name to confirm: " answer
[ "$answer" = "$db_name" ] || die "confirmation did not match, nothing dropped"

"${compose[@]}" exec -T postgres psql -U "$PG_USER" -d postgres -Atq \
  -c "DROP DATABASE IF EXISTS \"$db_name\" WITH (FORCE)"
echo "dropped database $db_name"
