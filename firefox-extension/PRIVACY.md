# OpenPath Extension Privacy Policy

> Status: maintained
> Applies to: `firefox-extension/`
> Last verified: 2026-04-13
> Source of truth: `firefox-extension/PRIVACY.md`

## Overview

The OpenPath extension is designed to operate locally in the browser. It is used to detect blocked resources and help operators inspect whitelist-related failures.

## Data Handling

- no analytics or telemetry are sent to third-party services
- blocked-resource state is kept in browser-local runtime state
- clipboard access is used only when the user copies a blocked-domain list
- optional `nativeMessaging` communicates only with a local native host on the same machine

## Current Permissions

| Permission           | Purpose                                        |
| -------------------- | ---------------------------------------------- |
| `webRequest`         | Observe blocked-resource failures              |
| `webRequestBlocking` | Support blocking-related request handling      |
| `webNavigation`      | Reset tab state on navigation                  |
| `tabs`               | Scope badge/popup data to the active tab       |
| `clipboardWrite`     | Copy blocked-domain lists                      |
| `nativeMessaging`    | Optional local host integration                |
| `<all_urls>`         | Observe blocked resources regardless of origin |

Questions or changes to this policy should stay aligned with the source in this repository and the current extension manifest.
