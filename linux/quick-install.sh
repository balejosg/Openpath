#!/bin/bash

# OpenPath - Strict Internet Access Control
# Copyright (C) 2025 OpenPath Authors
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

################################################################################
# quick-install.sh - One-liner installation script
#
# Usage (run on each student PC):
#   curl -sSL https://raw.githubusercontent.com/balejosg/openpath/main/quick-install.sh | sudo bash
#
# Or with wget:
#   wget -qO- https://raw.githubusercontent.com/balejosg/openpath/main/quick-install.sh | sudo bash
################################################################################

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || pwd)"

# ========== CONFIGURE THESE VALUES BEFORE USE ==========
# These MUST be set to your deployment-specific values
WHITELIST_URL="${WHITELIST_URL:-}"
HEALTH_API_URL="${HEALTH_API_URL:-}"
HEALTH_API_SECRET="${HEALTH_API_SECRET:-}"
# ========================================================

# Override REPO_URL for your fork/deployment
REPO_URL="${REPO_URL:-https://github.com/your-org/openpath}"
BRANCH="main"
VERBOSE=false
EXTRA_INSTALLER_ARGS=()

if [ -f "$SCRIPT_DIR/lib/progress.sh" ]; then
    # shellcheck source=lib/progress.sh
    source "$SCRIPT_DIR/lib/progress.sh"
else
    openpath_show_progress() {
        local current="$1"
        local total="$2"
        local label="$3"
        local verbose="${4:-false}"
        local percent=$((current * 100 / total))

        if [ "$verbose" = true ]; then
            printf '[%s/%s] %s\n' "$current" "$total" "$label"
            return 0
        fi

        if [ -t 1 ]; then
            local width=24
            local filled=$((percent * width / 100))
            local empty=$((width - filled))
            local bar
            bar="$(printf '%*s' "$filled" '' | tr ' ' '#')$(printf '%*s' "$empty" '' | tr ' ' '-')"
            printf '\r[%s] %3d%% %s/%s %s' "$bar" "$percent" "$current" "$total" "$label"
            if [ "$current" -eq "$total" ]; then
                printf '\n'
            fi
        else
            printf 'Progress %s/%s: %s\n' "$current" "$total" "$label"
        fi
    }
fi

while [[ $# -gt 0 ]]; do
    case "$1" in
        --verbose)
            VERBOSE=true
            shift
            ;;
        --url|--whitelist-url)
            WHITELIST_URL="$2"
            shift 2
            ;;
        --health-api-url)
            HEALTH_API_URL="$2"
            shift 2
            ;;
        --health-api-secret)
            HEALTH_API_SECRET="$2"
            shift 2
            ;;
        *)
            EXTRA_INSTALLER_ARGS+=("$1")
            shift
            ;;
    esac
done

show_progress() {
    openpath_show_progress "$1" "$2" "$3" "$VERBOSE"
}

if [ "$VERBOSE" = true ]; then
    echo ""
    echo "╔═══════════════════════════════════════════════════╗"
    echo "║     🛡️  Whitelist System Quick Install            ║"
    echo "╚═══════════════════════════════════════════════════╝"
    echo ""
else
    echo "Installing OpenPath..."
fi

# Create temp directory
TMPDIR=$(mktemp -d)
cd "$TMPDIR"

show_progress 1 3 "Downloading latest release"
curl -sSL "${REPO_URL}/archive/refs/heads/${BRANCH}.tar.gz" | tar -xz
cd whitelist-${BRANCH}

show_progress 2 3 "Running installer"
installer_args=(
    --unattended
    --url "$WHITELIST_URL" \
    --health-api-url "$HEALTH_API_URL" \
    --health-api-secret "$HEALTH_API_SECRET"
)
if [ "$VERBOSE" = true ]; then
    installer_args+=(--verbose)
fi
installer_args+=("${EXTRA_INSTALLER_ARGS[@]}")

./install.sh "${installer_args[@]}"

# Cleanup
cd /
rm -rf "$TMPDIR"

show_progress 3 3 "Installation complete"
echo "Installation complete."
