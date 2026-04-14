#!/bin/bash

################################################################################
# common-config-persistence.sh - Shared config persistence helpers
################################################################################

get_registered_machine_name() {
    if [ -n "${OPENPATH_MACHINE_NAME:-}" ]; then
        printf '%s\n' "$OPENPATH_MACHINE_NAME"
        return 0
    fi

    if [ -n "${OPENPATH_MACHINE_ID:-}" ]; then
        printf '%s\n' "$OPENPATH_MACHINE_ID"
        return 0
    fi

    if [ -r "$MACHINE_NAME_CONF" ]; then
        local saved_name
        saved_name=$(tr -d '\r\n' < "$MACHINE_NAME_CONF" 2>/dev/null || true)
        if [ -n "$saved_name" ]; then
            printf '%s\n' "$saved_name"
            return 0
        fi
    fi

    hostname
}

read_single_line_file() {
    local file="$1"

    if [ -r "$file" ]; then
        tr -d '\r\n' < "$file"
        return 0
    fi

    if [ "$EUID" -ne 0 ] && command -v sudo >/dev/null 2>&1 && sudo -n test -r "$file" 2>/dev/null; then
        sudo -n cat "$file" 2>/dev/null | tr -d '\r\n'
        return 0
    fi

    return 1
}

is_http_url() {
    local value="${1:-}"
    [[ "$value" =~ ^https?://[^[:space:]]+$ ]]
}

is_tokenized_whitelist_url() {
    local url="$1"
    [[ "$url" =~ /w/[^/]+/whitelist\.txt($|[?#].*) ]]
}

extract_machine_token_from_whitelist_url() {
    local whitelist_url="${1:-}"
    if [ -z "$whitelist_url" ]; then
        return 1
    fi

    local machine_token
    machine_token=$(printf '%s\n' "$whitelist_url" | sed -n 's#.*\/w\/\([^/][^/]*\)\/.*#\1#p')
    if [ -z "$machine_token" ]; then
        return 1
    fi

    printf '%s\n' "$machine_token"
}

get_machine_token_from_whitelist_url_file() {
    if [ ! -r "$WHITELIST_URL_CONF" ]; then
        return 1
    fi

    local whitelist_url
    whitelist_url=$(tr -d '\r\n' < "$WHITELIST_URL_CONF" 2>/dev/null || true)
    if [ -z "$whitelist_url" ]; then
        return 1
    fi

    extract_machine_token_from_whitelist_url "$whitelist_url"
}

normalize_machine_name_value() {
    printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9-]+/-/g; s/-+/-/g; s/^-+//; s/-+$//'
}

compute_scoped_machine_name() {
    local raw_hostname="$1"
    local classroom_id="$2"
    local base hash suffix max_base_length

    base=$(normalize_machine_name_value "$raw_hostname")
    [ -z "$base" ] && base="machine"

    hash=$(printf '%s' "$classroom_id" | sha256sum | awk '{print $1}' | cut -c1-8)
    suffix="-$hash"
    max_base_length=$((63 - ${#suffix}))
    [ "$max_base_length" -lt 1 ] && max_base_length=1
    base="${base:0:max_base_length}"
    base="${base%-}"
    [ -z "$base" ] && base="machine"

    printf '%s\n' "${base}${suffix}"
}

persist_machine_name() {
    local machine_name="$1"
    [ -z "$machine_name" ] && return 1
    machine_name=$(normalize_machine_name_value "$machine_name")
    [ -z "$machine_name" ] && return 1

    mkdir -p "$ETC_CONFIG_DIR"
    printf '%s' "$machine_name" > "$MACHINE_NAME_CONF"
    chown root:root "$MACHINE_NAME_CONF" 2>/dev/null || true
    chmod 640 "$MACHINE_NAME_CONF" 2>/dev/null || true
}

prepare_openpath_config_dir() {
    mkdir -p "$ETC_CONFIG_DIR"
    chown root:root "$ETC_CONFIG_DIR" 2>/dev/null || true
    chmod 750 "$ETC_CONFIG_DIR" 2>/dev/null || true
}

write_openpath_config_file() {
    local target_file="$1"
    local value="$2"
    local mode="${3:-640}"
    local temp_file

    prepare_openpath_config_dir

    temp_file=$(mktemp "${target_file}.tmp.XXXXXX") || return 1
    if ! printf '%s' "$value" > "$temp_file"; then
        rm -f "$temp_file"
        return 1
    fi

    chown root:root "$temp_file" 2>/dev/null || true
    chmod "$mode" "$temp_file" 2>/dev/null || true
    mv -f "$temp_file" "$target_file"
}

persist_openpath_whitelist_url() {
    local whitelist_url="$1"

    if ! is_http_url "$whitelist_url"; then
        return 1
    fi

    write_openpath_config_file "$WHITELIST_URL_CONF" "$whitelist_url" 640
}

persist_openpath_health_api_config() {
    local health_api_url="${1:-}"
    local health_api_secret="${2:-}"

    if [ -n "$health_api_url" ] && ! is_http_url "$health_api_url"; then
        return 1
    fi

    if [ -n "$health_api_url" ] && ! write_openpath_config_file "$HEALTH_API_URL_CONF" "$health_api_url" 640; then
        return 1
    fi

    if [ -n "$health_api_secret" ] && ! write_openpath_config_file "$HEALTH_API_SECRET_CONF" "$health_api_secret" 600; then
        return 1
    fi
}

persist_openpath_classroom_runtime_config() {
    local api_url="$1"
    local classroom_name="${2:-}"
    local classroom_id="${3:-}"

    if ! is_http_url "$api_url"; then
        return 1
    fi

    if ! write_openpath_config_file "$ETC_CONFIG_DIR/api-url.conf" "$api_url" 640; then
        return 1
    fi

    if [ -n "$classroom_name" ] && ! write_openpath_config_file "$ETC_CONFIG_DIR/classroom.conf" "$classroom_name" 640; then
        return 1
    fi

    if [ -n "$classroom_id" ] && ! write_openpath_config_file "$ETC_CONFIG_DIR/classroom-id.conf" "$classroom_id" 640; then
        return 1
    fi
}

persist_openpath_enrollment_state() {
    local api_url="$1"
    local classroom_name="${2:-}"
    local classroom_id="${3:-}"
    local whitelist_url="$4"

    if ! is_http_url "$api_url"; then
        return 1
    fi

    if ! is_tokenized_whitelist_url "$whitelist_url"; then
        return 1
    fi

    if ! persist_openpath_classroom_runtime_config "$api_url" "$classroom_name" "$classroom_id"; then
        return 1
    fi

    persist_openpath_whitelist_url "$whitelist_url"
}
