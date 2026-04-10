#!/bin/bash
# Shared progress rendering helpers for OpenPath installers.

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
