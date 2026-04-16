#!/usr/bin/env bats
################################################################################
# watchdog.bats - Tests for scripts/runtime/dnsmasq-watchdog.sh
################################################################################

load 'test_helper'

setup() {
    TEST_TMP_DIR=$(mktemp -d)
}

teardown() {
    if [ -n "$TEST_TMP_DIR" ] && [ -d "$TEST_TMP_DIR" ]; then
        rm -rf "$TEST_TMP_DIR"
    fi
}

@test "check_integrity matches exact file paths when command names share a prefix" {
    local helper_script="$TEST_TMP_DIR/run-watchdog-integrity.sh"
    local bin_dir="$TEST_TMP_DIR/usr/local/bin"
    local state_dir="$TEST_TMP_DIR/var/lib/openpath"

    mkdir -p "$bin_dir" "$state_dir"
    printf '%s\n' 'update helper' > "$bin_dir/openpath-update.sh"
    printf '%s\n' 'browser setup helper' > "$bin_dir/openpath-browser-setup.sh"
    printf '%s\n' 'openpath cli' > "$bin_dir/openpath"
    chmod +x "$bin_dir/openpath-update.sh" "$bin_dir/openpath-browser-setup.sh" "$bin_dir/openpath"

    cat > "$helper_script" <<'EOF'
#!/bin/bash
set -euo pipefail

project_dir="$1"
state_dir="$2"
bin_dir="$3"
extracted_script="$state_dir/watchdog-integrity-functions.sh"

export INTEGRITY_HASH_FILE="$state_dir/integrity.sha256"
export CRITICAL_FILES=(
    "$bin_dir/openpath-update.sh"
    "$bin_dir/openpath-browser-setup.sh"
    "$bin_dir/openpath"
)

log() { echo "$1"; }
log_warn() { echo "$1"; }
log_error() { echo "$1"; }
log_debug() { :; }

awk '
    /^generate_integrity_hashes\(\) \{/ { capture = 1 }
    capture && /^recover_integrity\(\) \{/ { exit }
    capture { print }
' "$project_dir/linux/scripts/runtime/dnsmasq-watchdog.sh" > "$extracted_script"
source "$extracted_script"

generate_integrity_hashes
check_integrity
EOF
    chmod +x "$helper_script"

    run "$helper_script" "$PROJECT_DIR" "$state_dir" "$bin_dir"

    [ "$status" -eq 0 ]
    [[ "$output" != *"TAMPERED: $bin_dir/openpath"* ]]
}
