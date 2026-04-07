#!/bin/bash

read_firefox_release_metadata_field() {
    local metadata_path="$1"
    local field_name="$2"

    python3 << PYEOF
import json
from pathlib import Path

metadata_path = Path("$metadata_path")

try:
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
except Exception:
    raise SystemExit(1)

field_value = str(metadata.get("$field_name", "")).strip()
if not field_value:
    raise SystemExit(2)

print(field_value)
PYEOF
}

get_firefox_release_extension_policy() {
    local release_dir="${1:-$INSTALL_DIR/firefox-release}"
    local metadata_path="$release_dir/metadata.json"
    local policy_lines
    local policy_status

    if [ ! -f "$metadata_path" ]; then
        return 1
    fi

    policy_lines=$(python3 << PYEOF
import json
from pathlib import Path

metadata_path = Path("$metadata_path")
signed_xpi_path = Path("$release_dir") / "openpath-firefox-extension.xpi"

try:
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
except Exception:
    raise SystemExit(1)

extension_id = str(metadata.get("extensionId", "")).strip()
if not extension_id:
    raise SystemExit(2)

if signed_xpi_path.is_file():
    print(extension_id)
    print(str(signed_xpi_path.resolve()))
    print(signed_xpi_path.resolve().as_uri())
    print("staged-release")
    raise SystemExit(0)

install_url = str(metadata.get("installUrl", "")).strip()
if not install_url:
    raise SystemExit(3)

print(extension_id)
print(install_url)
print(install_url)
print("metadata-install-url")
PYEOF
)
    policy_status=$?

    if [ "$policy_status" -ne 0 ]; then
        case "$policy_status" in
            1)
                echo "⚠ Failed to parse Firefox release extension metadata: $metadata_path" >&2
                ;;
            2)
                echo "⚠ Firefox release extension metadata is incomplete: $metadata_path" >&2
                ;;
            3)
                echo "⚠ Firefox release extension metadata did not resolve to a signed XPI source: $metadata_path" >&2
                ;;
        esac
        return 1
    fi

    printf '%s\n' "$policy_lines"
}

get_openpath_api_url_conf() {
    echo "${OPENPATH_API_URL_CONF:-$ETC_CONFIG_DIR/api-url.conf}"
}

read_openpath_api_base_url() {
    local api_url_conf
    api_url_conf="$(get_openpath_api_url_conf)"

    if [ ! -r "$api_url_conf" ]; then
        return 1
    fi

    local api_url=""
    api_url="$(tr -d '\r\n' < "$api_url_conf" 2>/dev/null || true)"
    api_url="${api_url%/}"

    if [ -z "$api_url" ]; then
        return 1
    fi

    printf '%s\n' "$api_url"
}

resolve_firefox_managed_extension_id() {
    local release_dir="${1:-$INSTALL_DIR/firefox-release}"
    local metadata_path="$release_dir/metadata.json"
    local ext_id=""

    if [ -f "$metadata_path" ]; then
        ext_id="$(read_firefox_release_metadata_field "$metadata_path" "extensionId")" || ext_id=""
    fi

    if [ -n "$ext_id" ]; then
        printf '%s\n' "$ext_id"
        return 0
    fi

    printf '%s\n' "$FIREFOX_MANAGED_EXTENSION_ID"
}

openpath_can_fetch_managed_firefox_xpi() {
    local install_url="$1"

    if ! command -v curl >/dev/null 2>&1; then
        return 1
    fi

    if curl -fsSIL --max-time 5 "$install_url" >/dev/null 2>&1; then
        return 0
    fi

    curl -fsSL --max-time 5 --range 0-0 -o /dev/null "$install_url" >/dev/null 2>&1
}

get_firefox_managed_api_extension_policy() {
    local release_dir="${1:-$INSTALL_DIR/firefox-release}"
    local api_base_url=""
    api_base_url="$(read_openpath_api_base_url)" || return 1

    local install_url="${api_base_url}/api/extensions/firefox/openpath.xpi"
    openpath_can_fetch_managed_firefox_xpi "$install_url" || return 1

    local ext_id=""
    ext_id="$(resolve_firefox_managed_extension_id "$release_dir")" || return 1

    printf '%s\n%s\n%s\n%s\n' "$ext_id" "$install_url" "$install_url" "managed-api"
}

resolve_firefox_managed_extension_policy() {
    local release_source="${1:-$INSTALL_DIR/firefox-release}"

    if get_firefox_managed_api_extension_policy "$release_source"; then
        return 0
    fi

    get_firefox_release_extension_policy "$release_source"
}

sync_firefox_managed_extension_policy() {
    local release_source="${1:-$INSTALL_DIR/firefox-release}"
    local managed_policy=""
    local managed_policy_values=()

    managed_policy="$(resolve_firefox_managed_extension_policy "$release_source")" || return 1
    mapfile -t managed_policy_values <<< "$managed_policy"
    add_extension_to_policies \
        "${managed_policy_values[0]}" \
        "${managed_policy_values[1]}" \
        "${managed_policy_values[2]}"
}

install_firefox_release_extension() {
    local release_source="${1:-$INSTALL_DIR/firefox-release}"
    if ! sync_firefox_managed_extension_policy "$release_source"; then
        return 1
    fi

    log "Installing Firefox extension from managed release artifacts..."
    log "✓ Firefox extension installed from managed release artifacts"
    return 0
}

install_firefox_unpacked_extension() {
    local ext_source="${1:-$INSTALL_DIR/firefox-extension}"
    local ext_id="$FIREFOX_MANAGED_EXTENSION_ID"
    local firefox_app_id="{ec8030f7-c20a-464f-9b0e-13a3a9e97384}"
    local ext_dir=""

    ext_dir="$(get_firefox_extensions_root)/$firefox_app_id/$ext_id"

    log "Installing Firefox extension..."

    generate_firefox_autoconfig
    stage_firefox_unpacked_extension_assets "$ext_source" "$ext_dir" || return 1
    chmod -R 755 "$ext_dir"

    log "✓ Extension copied to $ext_dir"
    add_extension_to_policies "$ext_id" "$ext_dir"

    log "✓ Firefox extension installed"
    return 0
}

install_firefox_extension() {
    local ext_source="${1:-$INSTALL_DIR/firefox-extension}"
    local release_source="${2:-$INSTALL_DIR/firefox-release}"
    if install_firefox_release_extension "$release_source"; then
        return 0
    fi

    install_firefox_unpacked_extension "$ext_source"
}
