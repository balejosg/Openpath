# Firefox Add-ons Submission Notes

> Status: maintained
> Applies to: `firefox-extension/`
> Last verified: 2026-04-13
> Source of truth: `firefox-extension/AMO.md`

This document captures the current AMO-facing notes for the OpenPath extension.

## Current Submission Facts

- extension ID: `monitor-bloqueos@openpath`
- manifest: `v3`
- package/license source of truth: [`package.json`](package.json)
- privacy policy source: [`PRIVACY.md`](PRIVACY.md)

## Permission Rationale

- `<all_urls>`: required to detect blocked third-party resources regardless of origin
- `webRequest` and `webRequestBlocking`: required to detect blocked-resource failures and path-blocking behavior
- `webNavigation`: clears per-tab state when navigation changes
- `tabs`: updates the tab badge and popup context
- `clipboardWrite`: copies blocked-domain lists for operator workflows
- `nativeMessaging`: optional local-only integration with the native host

## Release Workflow

Use the package scripts documented in [`README.md`](README.md):

```bash
npm run build:firefox-release --workspace=@openpath/firefox-extension -- --signed-xpi /path/to/signed.xpi
npm run sign:firefox-release --workspace=@openpath/firefox-extension
```

Keep AMO listing text and screenshots aligned with the current extension behavior before publishing.
