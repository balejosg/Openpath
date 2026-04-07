#!/bin/bash

FIREFOX_MANAGED_EXTENSION_ID="${FIREFOX_MANAGED_EXTENSION_ID:-monitor-bloqueos@openpath}"

ensure_firefox_policies_dir() {
    mkdir -p "$(dirname "$FIREFOX_POLICIES")"
}

mutate_firefox_policies() {
    local action="$1"
    local ext_id="${2:-}"
    local install_entry="${3:-}"
    local install_url="${4:-}"

    ensure_firefox_policies_dir

    FIREFOX_POLICY_ACTION="$action" \
    FIREFOX_POLICY_EXTENSION_ID="$ext_id" \
    FIREFOX_POLICY_INSTALL_ENTRY="$install_entry" \
    FIREFOX_POLICY_INSTALL_URL="$install_url" \
    FIREFOX_POLICY_BLOCKED_PATHS="$(printf '%s\n' "${BLOCKED_PATHS[@]}")" \
    python3 << 'PYEOF'
import json
import os
import sys
from urllib.parse import unquote, urlparse

policies_file = os.environ["FIREFOX_POLICIES"]
action = os.environ["FIREFOX_POLICY_ACTION"]
ext_id = os.environ.get("FIREFOX_POLICY_EXTENSION_ID", "").strip()
install_entry = os.environ.get("FIREFOX_POLICY_INSTALL_ENTRY", "").strip()
install_url = os.environ.get("FIREFOX_POLICY_INSTALL_URL", "").strip()
blocked_paths = [
    line.strip()
    for line in os.environ.get("FIREFOX_POLICY_BLOCKED_PATHS", "").splitlines()
    if line.strip()
]


def load_policies():
    if os.path.exists(policies_file):
        try:
            with open(policies_file, "r", encoding="utf-8") as fh:
                policies = json.load(fh)
                if isinstance(policies, dict):
                    return policies
        except Exception as exc:
            print(f"Warning: Failed to read existing policies: {exc}", file=sys.stderr)
    return {"policies": {}}


def save_policies(policies):
    with open(policies_file, "w", encoding="utf-8") as fh:
        json.dump(policies, fh, indent=2)


def get_policy_root(policies):
    root = policies.get("policies")
    if not isinstance(root, dict):
        root = {}
        policies["policies"] = root
    return root


def normalize_path(path):
    clean = path
    for prefix in ["http://", "https://", "*://"]:
        if clean.startswith(prefix):
            clean = clean[len(prefix):]
            break

    if "/" not in clean and "." not in clean and "*" not in clean:
        clean = f"*{clean}*"
    elif not clean.endswith("*"):
        clean = f"{clean}*"

    if clean.startswith("*."):
        return f"*://{clean}"
    if clean.startswith("*/"):
        return f"*://*{clean[1:]}"
    if "." in clean and "/" in clean:
        return f"*://*.{clean}"
    return f"*://{clean}"


def set_dynamic_website_filter(policy_root):
    normalized_paths = [normalize_path(path) for path in blocked_paths]
    policy_root["WebsiteFilter"] = {"Block": normalized_paths}
    print(f"Firefox: {len(normalized_paths)} paths bloqueados")


def apply_dynamic_defaults(policy_root):
    policy_root["SearchEngines"] = {
        "Remove": ["Google", "Bing"],
        "Default": "DuckDuckGo",
        "Add": [
            {
                "Name": "DuckDuckGo",
                "Description": "Motor de búsqueda centrado en privacidad",
                "Alias": "ddg",
                "Method": "GET",
                "URLTemplate": "https://duckduckgo.com/?q={searchTerms}",
                "IconURL": "https://duckduckgo.com/favicon.ico",
                "SuggestURLTemplate": "https://ac.duckduckgo.com/ac/?q={searchTerms}&type=list",
            },
            {
                "Name": "Wikipedia (ES)",
                "Description": "Enciclopedia libre",
                "Alias": "wiki",
                "Method": "GET",
                "URLTemplate": "https://es.wikipedia.org/wiki/Special:Search?search={searchTerms}",
                "IconURL": "https://es.wikipedia.org/static/favicon/wikipedia.ico",
            },
        ],
    }

    website_filter = policy_root.setdefault("WebsiteFilter", {"Block": []})
    block_list = website_filter.setdefault("Block", [])
    google_blocks = [
        "*://www.google.com/search*",
        "*://www.google.es/search*",
        "*://google.com/search*",
        "*://google.es/search*",
    ]
    for block in google_blocks:
        if block not in block_list:
            block_list.append(block)

    print("SearchEngines y bloqueos de Google aplicados")

    policy_root["DNSOverHTTPS"] = {
        "Enabled": False,
        "Locked": True,
    }
    print("DoH bloqueado, SearchEngines y bloqueos de Google aplicados")


def clear_dynamic_restrictions(policy_root):
    for key in ("WebsiteFilter", "SearchEngines", "DNSOverHTTPS"):
        policy_root.pop(key, None)


def ensure_managed_extension(policy_root):
    if not ext_id or not install_url:
        raise SystemExit(1)

    extension_settings = policy_root.setdefault("ExtensionSettings", {})
    previous_entry = extension_settings.get(ext_id)
    extension_settings[ext_id] = {
        "installation_mode": "force_installed",
        "install_url": install_url,
    }

    extensions = policy_root.setdefault("Extensions", {})
    installs = extensions.setdefault("Install", [])
    install_targets = set()
    if isinstance(previous_entry, dict):
        previous_install_url = previous_entry.get("install_url")
        if isinstance(previous_install_url, str) and previous_install_url:
            install_targets.add(previous_install_url)

            parsed = urlparse(previous_install_url)
            if parsed.scheme == "file":
                try:
                    install_targets.add(unquote(parsed.path))
                except Exception:
                    pass

    if isinstance(installs, list) and install_targets:
        installs = [item for item in installs if item not in install_targets]
        extensions["Install"] = installs

    if install_entry and install_entry not in installs:
        installs.append(install_entry)

    locked = extensions.setdefault("Locked", [])
    if ext_id not in locked:
        locked.append(ext_id)

    print(f"Extensión {ext_id} añadida a políticas")


def remove_managed_extension(policy_root):
    extension_settings = policy_root.get("ExtensionSettings", {})
    managed_entry = extension_settings.pop(ext_id, None)
    if not extension_settings:
        policy_root.pop("ExtensionSettings", None)

    install_targets = set()
    if isinstance(managed_entry, dict):
        managed_url = managed_entry.get("install_url")
        if isinstance(managed_url, str) and managed_url:
            install_targets.add(managed_url)

    extensions = policy_root.get("Extensions")
    if not isinstance(extensions, dict):
        return

    installs = extensions.get("Install", [])
    if isinstance(installs, list):
        extensions["Install"] = [
            item for item in installs
            if item not in install_targets and item != ext_id and ext_id not in item
        ]
        if not extensions["Install"]:
            extensions.pop("Install", None)

    locked = extensions.get("Locked", [])
    if isinstance(locked, list):
        extensions["Locked"] = [item for item in locked if item != ext_id]
        if not extensions["Locked"]:
            extensions.pop("Locked", None)

    if not extensions:
        policy_root.pop("Extensions", None)


policies = load_policies()
policy_root = get_policy_root(policies)

if action == "set_dynamic_website_filter":
    set_dynamic_website_filter(policy_root)
elif action == "apply_dynamic_defaults":
    apply_dynamic_defaults(policy_root)
elif action == "clear_dynamic_restrictions":
    clear_dynamic_restrictions(policy_root)
elif action == "ensure_managed_extension":
    ensure_managed_extension(policy_root)
elif action == "remove_managed_extension":
    remove_managed_extension(policy_root)
else:
    raise SystemExit(f"Unsupported Firefox policy action: {action}")

save_policies(policies)
PYEOF
}

get_policies_hash() {
    local hash=""
    if [ -f "$FIREFOX_POLICIES" ]; then
        hash="${hash}$(sha256sum "$FIREFOX_POLICIES" 2>/dev/null | cut -d' ' -f1)"
    fi
    hash="${hash}$(echo "${BLOCKED_PATHS[*]}" | sha256sum | cut -d' ' -f1)"
    echo "$hash"
}

generate_firefox_policies() {
    log "Generating Firefox policies..."
    mutate_firefox_policies "set_dynamic_website_filter"
    log "✓ Firefox policies generated"
}

apply_search_engine_policies() {
    log "Applying search engine policies..."
    mutate_firefox_policies "apply_dynamic_defaults"
    log "✓ Search engines configured"
}

cleanup_browser_policies() {
    log "Cleaning up browser policies..."

    if [ -f "$FIREFOX_POLICIES" ]; then
        mutate_firefox_policies "clear_dynamic_restrictions"
        log "✓ Firefox policies cleaned"
    fi

    local dirs=(
        "$CHROMIUM_POLICIES_BASE"
        "/etc/chromium-browser/policies/managed"
        "/etc/opt/chrome/policies/managed"
    )

    for dir in "${dirs[@]}"; do
        rm -f "$dir/openpath.json" 2>/dev/null || true
        rm -f "$dir/url-whitelist.json" 2>/dev/null || true
        rm -f "$dir/search-engines.json" 2>/dev/null || true
    done

    log "✓ Browser policies cleaned"
}

get_firefox_extensions_root() {
    echo "${FIREFOX_EXTENSIONS_ROOT:-/usr/share/mozilla/extensions}"
}

convert_openpath_file_url() {
    local install_target="$1"

    python3 << PYEOF
from pathlib import Path

print(Path("$install_target").resolve().as_uri())
PYEOF
}

add_extension_to_policies() {
    local ext_id="$1"
    local install_target="$2"
    local install_url="${3:-}"
    local install_entry="$install_target"

    if [ -z "$install_url" ]; then
        if [[ "$install_target" == *://* ]]; then
            install_url="$install_target"
        else
            install_url="$(convert_openpath_file_url "$install_target")"
        fi
    else
        install_entry="$install_url"
    fi

    mutate_firefox_policies "ensure_managed_extension" "$ext_id" "$install_entry" "$install_url"
    log "✓ Extension added to policies.json"
}
