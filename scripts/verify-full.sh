#!/usr/bin/env bash

set -euo pipefail

export OPENPATH_VERIFY_HEAD="${OPENPATH_VERIFY_HEAD:-HEAD}"

if [[ -z "${OPENPATH_VERIFY_BASE:-}" ]]; then
  if git rev-parse --verify --quiet origin/main >/dev/null; then
    OPENPATH_VERIFY_BASE="$(git merge-base origin/main "$OPENPATH_VERIFY_HEAD")"
  elif git rev-parse --verify --quiet HEAD~1 >/dev/null; then
    OPENPATH_VERIFY_BASE="HEAD~1"
  else
    OPENPATH_VERIFY_BASE=""
  fi
  export OPENPATH_VERIFY_BASE
fi

npx concurrently --group --names 'static,checks,security' 'npm:verify:static' 'npm:verify:checks' 'npm:verify:security'
npm run verify:coverage
npm run verify:unit
npm run e2e:full
