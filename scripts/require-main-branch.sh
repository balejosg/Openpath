#!/usr/bin/env bash

set -euo pipefail

MODE="${1:-git}"
REPO_NAME="${2:-$(basename "$(git rev-parse --show-toplevel)")}" 
CURRENT_BRANCH="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"

print_violation() {
  local detail="$1"

  echo ""
  echo "=============================================="
  echo "  TRUNK-BASED POLICY VIOLATION"
  echo "=============================================="
  echo "  Repository: $REPO_NAME"
  echo "  Check: $MODE"
  echo "  $detail"
  echo ""
  echo "  Required recovery:"
  echo "  1. Preserve any needed work with stash or patch"
  echo "  2. git switch main"
  echo "  3. Reapply the needed changes on main"
  echo "=============================================="
  echo ""
}

if [ -z "$CURRENT_BRANCH" ]; then
  print_violation "Detached HEAD is not allowed for LLM commits or pushes. Work must happen on 'main'."
  exit 1
fi

if [ "$CURRENT_BRANCH" != "main" ]; then
  print_violation "Current branch is '$CURRENT_BRANCH'. LLM work must happen on 'main'."
  exit 1
fi

if [ "$MODE" = "pre-push" ]; then
  while IFS=' ' read -r local_ref local_sha remote_ref remote_sha; do
    [ -z "${local_ref:-}" ] && continue

    case "$remote_ref" in
      refs/heads/main|refs/tags/*)
        continue
        ;;
    esac

    if [ "${local_ref:-}" = "(delete)" ] || [ "${local_sha:-}" = "0000000000000000000000000000000000000000" ]; then
      continue
    fi

    print_violation "Push target '$remote_ref' is not allowed. Only 'refs/heads/main' and tags may be pushed."
    exit 1
  done
fi
