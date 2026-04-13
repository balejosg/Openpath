# OpenPath Adoption Path

> Status: maintained
> Applies to: school IT teams and technical evaluators
> Last verified: 2026-04-13
> Source of truth: `docs/evaluation/adoption-path.md`

OpenPath is the right starting point when your team wants to evaluate the core technology directly:

- you need to understand how policy reaches Linux or Windows endpoints
- you want to inspect the admin UI, API surface, and browser integration before making a product decision
- your organization prefers to self-host or keep the option open
- you need an OSS foundation that remains separate from any downstream overlay

## What You Can Verify In This Repository

- **Security disclosure and baseline:** [`../../SECURITY.md`](../../SECURITY.md)
- **Operator hardening checklist:** [`../SECURITY-HARDENING.md`](../SECURITY-HARDENING.md)
- **Browser extension privacy posture:** [`../../firefox-extension/PRIVACY.md`](../../firefox-extension/PRIVACY.md)
- **Downstream integration boundary:** [`../adr/0010-public-spa-extension-surface.md`](../adr/0010-public-spa-extension-surface.md)
- **Platform-specific operational details:** [`../../linux/README.md`](../../linux/README.md) and [`../../windows/README.md`](../../windows/README.md)

## When To Choose OpenPath Directly

Choose OpenPath if your team wants to:

- operate the core service and endpoint agents itself
- customize workflows under `AGPL-3.0-or-later`
- integrate OpenPath into an existing infrastructure or internal support model
