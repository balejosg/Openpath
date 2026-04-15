#!/bin/bash

# Validate domain name format to prevent injection attacks
# Enhanced validation matching shared/src/schemas/index.ts DomainSchema
# Returns 0 if valid, 1 if invalid
validate_domain() {
    local domain="$1"
    local check_domain="$domain"

    # Empty domain is invalid
    [ -z "$domain" ] && return 1

    # Min length 4 characters (a.bc)
    [ ${#domain} -lt 4 ] && return 1

    # Max length 253 characters (DNS limit)
    [ ${#domain} -gt 253 ] && return 1

    # Support wildcard prefix for whitelist patterns
    if [[ "$domain" == \*.* ]]; then
        check_domain="${domain:2}"
    fi

    # Reject bare wildcards (*.  without domain)
    if [[ "$domain" == "*." ]] || [[ "$domain" == "*" ]]; then
        return 1
    fi

    # Reject .local TLD (mDNS conflicts cause local network issues)
    if [[ "$domain" =~ \.local$ ]]; then
        return 1
    fi

    # Cannot have consecutive dots
    [[ "$check_domain" =~ \.\. ]] && return 1

    # Validate each label
    IFS='.' read -ra labels <<< "$check_domain"
    local num_labels=${#labels[@]}

    # Must have at least 2 labels (domain.tld)
    [ "$num_labels" -lt 2 ] && return 1

    for i in "${!labels[@]}"; do
        local label="${labels[$i]}"
        local is_tld=$((i == num_labels - 1))

        # Each label max 63 chars
        [ ${#label} -gt 63 ] && return 1
        [ ${#label} -lt 1 ] && return 1

        # Cannot start or end with hyphen
        [[ "$label" == -* ]] && return 1
        [[ "$label" == *- ]] && return 1

        if [ "$is_tld" -eq 1 ]; then
            # TLD: letters only, 2-63 chars
            [ ${#label} -lt 2 ] && return 1
            [[ ! "$label" =~ ^[a-zA-Z]+$ ]] && return 1
        else
            # Regular label: alphanumeric and hyphens
            [[ ! "$label" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$ ]] && return 1
        fi
    done

    return 0
}

# Sanitize domain - remove any potentially dangerous characters
# This is a defense-in-depth measure
sanitize_domain() {
    local domain="$1"
    # Remove any character that isn't alphanumeric, dot, or hyphen
    echo "$domain" | tr -cd 'a-zA-Z0-9.-'
}
