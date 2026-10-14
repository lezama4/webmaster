#!/usr/bin/env bash
# Drop the database created by worktree-setup.sh for this worktree. Nothing else.
# Usage (from inside a worktree): scripts/worktree-teardown.sh
set -euo pipefail

# shellcheck source-path=SCRIPTDIR
# shellcheck source=lib/worktree-common.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib/worktree-common.sh"

read -r -p "Drop database '$db_name'? Type its name to confirm: " answer
[ "$answer" = "$db_name" ] || die "confirmation did not match, nothing dropped"

"${compose[@]}" exec -T postgres psql -U "$PG_USER" -d postgres -Atq \
  -c "DROP DATABASE IF EXISTS \"$db_name\" WITH (FORCE)"
echo "dropped database $db_name"
