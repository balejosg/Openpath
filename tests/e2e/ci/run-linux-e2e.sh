#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

IMAGE_TAG="${OPENPATH_E2E_IMAGE_TAG:-openpath-e2e:latest}"
CONTAINER_NAME="${OPENPATH_E2E_CONTAINER_NAME:-e2e-test}"

_context_dir=""

cleanup() {
    # Best-effort cleanup
    if [ -n "${CONTAINER_NAME:-}" ]; then
        docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
    fi

    if [ -n "${_context_dir:-}" ] && [ -d "$_context_dir" ]; then
        rm -rf "$_context_dir" || true
    fi
}

debug_container() {
    echo ""
    echo "Debug information..."
    docker ps -a || true
    echo ""
    echo "Systemd status (e2e-tests.service):"
    docker exec "$CONTAINER_NAME" systemctl status e2e-tests.service --no-pager 2>/dev/null || true
    echo ""
    echo "Systemd properties (e2e-tests.service):"
    docker exec "$CONTAINER_NAME" systemctl show e2e-tests.service \
        -p ActiveState -p SubState -p Result -p ExecMainStatus -p ExecMainCode -p ExecMainPID \
        --no-pager 2>/dev/null || true
    echo ""
    echo "Systemd journal tail (e2e-tests.service):"
    docker exec "$CONTAINER_NAME" journalctl -u e2e-tests.service --no-pager -n 400 2>/dev/null || true
}

on_error() {
    local rc=$?
    echo ""
    echo "Linux E2E failed (exit code: $rc)"
    debug_container
    exit "$rc"
}

trap cleanup EXIT
trap on_error ERR

require_file() {
    local path="$1"
    if [ ! -f "$path" ]; then
        echo "Missing required file: $path" >&2
        exit 1
    fi
}

require_dir() {
    local path="$1"
    if [ ! -d "$path" ]; then
        echo "Missing required directory: $path" >&2
        exit 1
    fi
}

create_minimal_context() {
    local tmp
    tmp="$(mktemp -d -t openpath-e2e-context.XXXXXXXX)"

    mkdir -p "$tmp/linux" "$tmp/tests/e2e" "$tmp/firefox-extension" "$tmp/windows"

    # Core Linux agent + E2E runner scripts
    cp -a "$PROJECT_ROOT/linux/." "$tmp/linux/"
    cp -a "$PROJECT_ROOT/tests/e2e/." "$tmp/tests/e2e/"

    # Keep Windows tree so pre-install validation does not warn
    cp -a "$PROJECT_ROOT/windows/." "$tmp/windows/"

    # Extension runtime assets validated by pre-install-validation.sh
    require_file "$PROJECT_ROOT/firefox-extension/manifest.json"
    require_dir "$PROJECT_ROOT/firefox-extension/dist"
    require_dir "$PROJECT_ROOT/firefox-extension/popup"
    require_dir "$PROJECT_ROOT/firefox-extension/blocked"
    require_dir "$PROJECT_ROOT/firefox-extension/native"
    require_dir "$PROJECT_ROOT/firefox-extension/icons"

    mkdir -p "$tmp/firefox-extension/dist"
    cp -a "$PROJECT_ROOT/firefox-extension/manifest.json" "$tmp/firefox-extension/"
    cp -a "$PROJECT_ROOT/firefox-extension/dist/." "$tmp/firefox-extension/dist/"
    cp -a "$PROJECT_ROOT/firefox-extension/popup" "$tmp/firefox-extension/"
    cp -a "$PROJECT_ROOT/firefox-extension/blocked" "$tmp/firefox-extension/"
    cp -a "$PROJECT_ROOT/firefox-extension/native" "$tmp/firefox-extension/"
    cp -a "$PROJECT_ROOT/firefox-extension/icons" "$tmp/firefox-extension/"

    require_file "$PROJECT_ROOT/VERSION"
    cp -a "$PROJECT_ROOT/VERSION" "$tmp/"

    echo "$tmp"
}

wait_for_oneshot_service() {
    local max_iters="$1" # number of polls
    local sleep_sec="$2"

    for ((i = 1; i <= max_iters; i++)); do
        local exit_ts
        exit_ts=$(docker exec "$CONTAINER_NAME" systemctl show e2e-tests.service --property=ExecMainExitTimestampMonotonic --value 2>/dev/null || true)
        if [ -n "$exit_ts" ] && [ "$exit_ts" != "0" ]; then
            echo "  Service completed"
            return 0
        fi

        if [ "$((i % 12))" = "0" ]; then
            local active_state
            local sub_state
            active_state=$(docker exec "$CONTAINER_NAME" systemctl show e2e-tests.service --property=ActiveState --value 2>/dev/null || true)
            sub_state=$(docker exec "$CONTAINER_NAME" systemctl show e2e-tests.service --property=SubState --value 2>/dev/null || true)
            echo "  [$i/$max_iters] Tests still running (${i}*${sleep_sec}s = $((i * sleep_sec))s elapsed)... (state=${active_state:-unknown}/${sub_state:-unknown})"
        fi
        sleep "$sleep_sec"
    done

    return 1
}

run_whitelist_update_test() {
    echo ""
    echo "Testing whitelist update mechanism (openpath-update.sh)..."

    docker exec "$CONTAINER_NAME" bash -c '
        set -euo pipefail

        test_file="/tmp/test-whitelist.txt"
        cat > "$test_file" << EOF
## WHITELIST
google.com
github.com
newdomain.example.com
example.org
example.net

## BLOCKED-SUBDOMAINS
ads.example.com
EOF

        conf="/etc/openpath/whitelist-url.conf"
        backup="${conf}.bak"
        if [ -f "$conf" ]; then
            cp -f "$conf" "$backup"
        fi

        echo "file://$test_file" > "$conf"

        /usr/local/bin/openpath-update.sh

        if ! grep -q "newdomain.example.com" /var/lib/openpath/whitelist.txt; then
            echo "Updated whitelist does not contain expected domain"
            exit 1
        fi

        # Restore config
        if [ -f "$backup" ]; then
            mv -f "$backup" "$conf"
        fi
    '

    echo "Whitelist update test completed"
}

run_agent_self_update_test() {
    echo ""
    echo "Testing agent self-update mechanism (openpath-self-update.sh)..."

    docker exec "$CONTAINER_NAME" bash -lc '
        set -euo pipefail

        workdir="/tmp/openpath-agent-self-update"
        release_dir="$workdir/release"
        build_log="$workdir/build.log"
        server_log="$workdir/http.log"
        current_conf="$(cat /etc/openpath/whitelist-url.conf)"
        current_version="$(cat /openpath/VERSION 2>/dev/null || echo 4.1.0)"

        target_version="$(CURRENT_VERSION="$current_version" python3 - <<'"'"'PY'"'"'
import os
import re

raw = os.environ.get("CURRENT_VERSION", "4.1.0")
parts = [int(p) for p in re.findall(r"\d+", raw)[:3]]
while len(parts) < 3:
    parts.append(0)
parts[0] += 1
print(f"{parts[0]}.{parts[1]}.{parts[2]}")
PY
)"

        rm -rf "$workdir"
        mkdir -p "$release_dir"

        cd /openpath
        ./linux/scripts/build/build-deb.sh "$target_version" 1 >"$build_log" 2>&1

        deb_name="openpath-dnsmasq_${target_version}-1_amd64.deb"
        cp "build/$deb_name" "$release_dir/$deb_name"

        cat > "$release_dir/latest.json" <<EOF
{
  "tag_name": "v${target_version}",
  "assets": [
    {
      "browser_download_url": "http://127.0.0.1:18080/$deb_name"
    }
  ]
}
EOF

        python3 -m http.server 18080 --bind 127.0.0.1 --directory "$release_dir" >"$server_log" 2>&1 &
        server_pid=$!
        trap "kill \$server_pid >/dev/null 2>&1 || true" EXIT
        sleep 1

        OPENPATH_SELF_UPDATE_API="http://127.0.0.1:18080/latest.json" /usr/local/bin/openpath-self-update.sh

        if ! dpkg -s openpath-dnsmasq 2>/dev/null | grep -q "Version: ${target_version}-1"; then
            echo "Self-update did not install package version ${target_version}-1"
            exit 1
        fi

        if [ "$(cat /etc/openpath/whitelist-url.conf)" != "$current_conf" ]; then
            echo "Self-update did not preserve whitelist-url.conf"
            exit 1
        fi

        if [ ! -x /usr/local/bin/openpath-self-update.sh ]; then
            echo "Self-update removed the installed self-update command"
            exit 1
        fi
    '

    echo "Agent self-update test completed"
}

verify_linux_uninstall() {
    echo ""
    echo "Verifying Linux uninstall removes installed state..."

    docker exec "$CONTAINER_NAME" bash -lc '
        set -euo pipefail

        /usr/local/lib/openpath/uninstall.sh --auto-yes

        if [ -e /etc/dnsmasq.d/openpath.conf ]; then
            echo "/etc/dnsmasq.d/openpath.conf still exists after uninstall"
            exit 1
        fi

        if [ -e /usr/local/bin/openpath-update.sh ]; then
            echo "/usr/local/bin/openpath-update.sh still exists after uninstall"
            exit 1
        fi

        if [ -d /usr/local/lib/openpath ]; then
            echo "/usr/local/lib/openpath still exists after uninstall"
            exit 1
        fi
    '

    echo "Linux uninstall test completed"
}

main() {
    echo "Building systemd-enabled E2E test Docker image (minimal context)..."

    _context_dir="$(create_minimal_context)"

    docker build -t "$IMAGE_TAG" -f "$_context_dir/tests/e2e/Dockerfile" "$_context_dir"

    echo ""
    echo "Starting systemd container..."

    docker run -d --name "$CONTAINER_NAME" \
        --privileged \
        --cgroupns=host \
        -v /sys/fs/cgroup:/sys/fs/cgroup:rw \
        --dns 8.8.8.8 \
        -e CI=true \
        "$IMAGE_TAG"

    echo "Waiting for systemd to boot..."
    sleep 5

    echo "Waiting for e2e-tests.service to complete..."
    if ! wait_for_oneshot_service 96 5; then
        echo "Timed out waiting for e2e-tests.service to finish"
        debug_container
        exit 1
    fi

    echo ""
    echo "Test output:"
    docker exec "$CONTAINER_NAME" journalctl -u e2e-tests.service --no-pager -n 200 || true

    echo ""
    echo "Checking service result..."
    result=$(docker exec "$CONTAINER_NAME" systemctl show e2e-tests.service --property=Result --value 2>/dev/null || echo "failed")
    echo "Service Result: $result"

    if [ "$result" != "success" ]; then
        echo "E2E tests failed (result: $result)"
        debug_container
        exit 1
    fi

    run_whitelist_update_test
    run_agent_self_update_test
    verify_linux_uninstall

    echo ""
    echo "Linux E2E tests passed"
}

main "$@"
