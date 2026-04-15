#!/bin/bash
set -o pipefail

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
# dns.sh - DNS management functions
# Part of the OpenPath DNS system
################################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! declare -F get_openpath_protected_domains >/dev/null 2>&1 && [ -f "$SCRIPT_DIR/common.sh" ]; then
    # shellcheck source=./common.sh
    source "$SCRIPT_DIR/common.sh"
fi

for helper_lib in dns-validation.sh dns-runtime.sh dns-dnsmasq.sh; do
    # shellcheck disable=SC1090
    source "$SCRIPT_DIR/$helper_lib"
done
