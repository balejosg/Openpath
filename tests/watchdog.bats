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

@test "check_integrity reports expected and current hashes for modified exact path" {
    local helper_script="$TEST_TMP_DIR/run-watchdog-integrity-mismatch.sh"
    local bin_dir="$TEST_TMP_DIR/usr/local/bin"
    local state_dir="$TEST_TMP_DIR/var/lib/openpath"

    mkdir -p "$bin_dir" "$state_dir"
    printf '%s\n' 'openpath cli' > "$bin_dir/openpath"
    chmod +x "$bin_dir/openpath"

    cat > "$helper_script" <<'EOF'
#!/bin/bash
set -euo pipefail

project_dir="$1"
state_dir="$2"
bin_dir="$3"
extracted_script="$state_dir/watchdog-integrity-functions.sh"

export INTEGRITY_HASH_FILE="$state_dir/integrity.sha256"
export CRITICAL_FILES=("$bin_dir/openpath")

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
expected=$(sha256sum "$bin_dir/openpath" | cut -d' ' -f1)
printf '%s\n' 'tampered cli' > "$bin_dir/openpath"
current=$(sha256sum "$bin_dir/openpath" | cut -d' ' -f1)

if check_integrity; then
    echo "unexpected-ok"
    exit 1
fi

printf 'expected=%s\n' "$expected"
printf 'current=%s\n' "$current"
EOF
    chmod +x "$helper_script"

    run "$helper_script" "$PROJECT_DIR" "$state_dir" "$bin_dir"

    [ "$status" -eq 0 ]
    [[ "$output" != *"unexpected-ok"* ]]
    [[ "$output" == *"TAMPERED: $bin_dir/openpath (expected="* ]]
    [[ "$output" == *" actual="* ]]
}

@test "check_dns_resolving uses active whitelist domain and rejects sinkhole answers" {
    local helper_script="$TEST_TMP_DIR/run-watchdog-dns-resolving.sh"
    local state_dir="$TEST_TMP_DIR/var/lib/openpath"
    local whitelist_file="$state_dir/whitelist.txt"
    local probe_log="$state_dir/probes.log"

    mkdir -p "$state_dir"
    cat > "$whitelist_file" <<'EOF'
## WHITELIST
google.es
EOF

    cat > "$helper_script" <<'EOF'
#!/bin/bash
set -euo pipefail

project_dir="$1"
state_dir="$2"
whitelist_file="$3"
probe_log="$4"
extracted_script="$state_dir/watchdog-dns-functions.sh"

export WHITELIST_FILE="$whitelist_file"

timeout() {
    shift
    "$@"
}

dig() {
    printf '%s\n' "$2" >> "$probe_log"
    case "$2" in
        google.es)
            echo "216.58.204.163"
            return 0
            ;;
        google.com)
            echo "0.0.0.0"
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

source "$project_dir/linux/lib/dns.sh"
awk '/^check_dns_resolving\(\) \{/,/^}/' \
    "$project_dir/linux/scripts/runtime/dnsmasq-watchdog.sh" > "$extracted_script"
source "$extracted_script"

check_dns_resolving
EOF
    chmod +x "$helper_script"

    run "$helper_script" "$PROJECT_DIR" "$state_dir" "$whitelist_file" "$probe_log"

    [ "$status" -eq 0 ]
    grep -qx "google.es" "$probe_log"
    ! grep -qx "google.com" "$probe_log"
}
