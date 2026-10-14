# shellcheck shell=bash
# shellcheck disable=SC2034 # variables are consumed by the sourcing scripts
# Shared by worktree-setup.sh and worktree-teardown.sh so the slug, database
# name and compose handle can never drift between them. Source it, don't run it.

DB_PREFIX="vivetutiempo"
MAIN_DB="vivetutiempo"
PG_USER="vivetutiempo"

die() { echo "error: $*" >&2; exit 1; }

root="$(git rev-parse --show-toplevel)"
common_dir="$(cd "$(git rev-parse --git-common-dir)" && pwd)"
main_root="$(dirname "$common_dir")"
[ "$root" != "$main_root" ] || die "run this from a linked worktree, not the main checkout"
compose=(docker compose -f "$main_root/docker-compose.yml")

# Slug = sanitized directory name (lowercase [a-z0-9_], max 33 chars) + "_" +
# 6 hex of sha1 of the ORIGINAL name, so "wt-test", "wt_test" and "WT-Test"
# get different databases. Longest db name: 13 + 33 + 1 + 6 = 53 < 63 (Postgres limit).
dir_name="$(basename "$root")"
hash="$(printf '%s' "$dir_name" | sha1sum | cut -c1-6)"
base="$(printf '%s' "$dir_name" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9_' '_' | cut -c1-33)"
slug="${base:-wt}_${hash}"
db_name="${DB_PREFIX}_${slug}"
[ "$db_name" != "$MAIN_DB" ] || die "refusing to use the main database name"
