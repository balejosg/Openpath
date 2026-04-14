#!/bin/bash

################################################################################
# runtime-cli.sh - Runtime command helpers for the unified openpath CLI
################################################################################

read_prompt_value() {
    local __result_var="$1"
    local prompt="$2"
    local input=""

    if [ -t 0 ]; then
        read -r -p "$prompt" input || return 1
    elif [ -r /dev/tty ]; then
        read -r -p "$prompt" input < /dev/tty || return 1
    else
        return 1
    fi

    printf -v "$__result_var" '%s' "$input"
    return 0
}

read_prompt_secret() {
    local __result_var="$1"
    local prompt="$2"
    local input=""

    if [ -t 0 ]; then
        read -r -s -p "$prompt" input || return 1
        echo ""
    elif [ -r /dev/tty ]; then
        read -r -s -p "$prompt" input < /dev/tty || return 1
        echo ""
    else
        return 1
    fi

    printf -v "$__result_var" '%s' "$input"
    return 0
}
# shellcheck source=/usr/local/lib/openpath/lib/runtime-cli-system.sh
source "$INSTALL_DIR/lib/runtime-cli-system.sh"
# shellcheck source=/usr/local/lib/openpath/lib/runtime-cli-commands.sh
source "$INSTALL_DIR/lib/runtime-cli-commands.sh"
