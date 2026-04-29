#!/usr/bin/env bats
################################################################################
# sse-listener.bats - Tests for Linux SSE listener debounce behavior
################################################################################

load 'test_helper'

@test "sse listener schedules one deferred update for events received during cooldown" {
    run env PROJECT_DIR="$PROJECT_DIR" bash -lc '
        set -euo pipefail

        tmpdir=$(mktemp -d)
        trap "rm -rf \"$tmpdir\"" EXIT

        export OPENPATH_TEST=1
        export OPENPATH_SSE_LISTENER_SOURCE_ONLY=1
        export OPENPATH_RUN="$tmpdir/run"
        export OPENPATH_ETC="$tmpdir/etc"
        export LOG_FILE="$tmpdir/openpath.log"
        mkdir -p "$OPENPATH_RUN" "$OPENPATH_ETC"

        # shellcheck source=/dev/null
        source "$PROJECT_DIR/linux/scripts/runtime/openpath-sse-listener.sh"

        UPDATE_SCRIPT="$tmpdir/openpath-update.sh"
        LAST_UPDATE_FILE="$OPENPATH_RUN/sse-last-update"
        PENDING_UPDATE_FILE="$OPENPATH_RUN/sse-pending-update"
        SSE_UPDATE_COOLDOWN=1
        export SSE_UPDATE_COOLDOWN

        cat > "$UPDATE_SCRIPT" <<EOF
#!/bin/sh
echo update >> "$tmpdir/update-calls"
EOF
        chmod +x "$UPDATE_SCRIPT"

        date +%s > "$LAST_UPDATE_FILE"

        trigger_update
        trigger_update

        [ -f "$PENDING_UPDATE_FILE" ]
        sleep 2

        [ ! -f "$PENDING_UPDATE_FILE" ]
        [ "$(wc -l < "$tmpdir/update-calls")" -eq 1 ]
    '
    [ "$status" -eq 0 ]
}
