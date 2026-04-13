# OpenPath Self-Hosted Prerequisites

> Status: maintained
> Applies to: technical teams evaluating self-hosted OpenPath
> Last verified: 2026-04-13
> Source of truth: `docs/evaluation/self-hosted-prerequisites.md`

Use this checklist before treating OpenPath as a self-hosted candidate.

## Team And Operational Ownership

Your team should be ready to own:

- API deployment and PostgreSQL operations
- Linux and Windows endpoint rollout
- browser policy distribution where needed
- secret management, backups, and upgrade planning
- incident handling and operator troubleshooting

If those responsibilities are not clearly owned, do not treat the stack as ready for production use.

## Platform Prerequisites

At minimum, evaluate whether you can support:

- a Node.js and PostgreSQL service environment for the API
- Debian or Ubuntu-style Linux endpoints if Linux agent coverage is required
- Windows endpoints with PowerShell, Acrylic DNS Proxy, Windows Firewall, and scheduled task support if Windows coverage is required
- managed browser rollout workflows if browser-level diagnosis or extension delivery is part of the rollout

See:

- [`../../api/README.md`](../../api/README.md)
- [`../../linux/README.md`](../../linux/README.md)
- [`../../windows/README.md`](../../windows/README.md)
- [`../../firefox-extension/README.md`](../../firefox-extension/README.md)

## Security And Change Control

Before rollout, confirm that your team can maintain:

- HTTPS on public service endpoints
- a strong `JWT_SECRET`
- explicit production CORS configuration
- package and artifact trust for updates
- restricted access to endpoint configuration and local logs

References:

- [`../../SECURITY.md`](../../SECURITY.md)
- [`../SECURITY-HARDENING.md`](../SECURITY-HARDENING.md)

## Evaluation Questions

Answer these before moving beyond technical review:

- Which endpoint platforms are in scope first?
- Who approves policy changes?
- How will blocked-resource incidents be investigated?
- How will upgrades be staged and verified?
- What internal evidence is required before broader rollout?
