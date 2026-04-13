# OpenPath Security Hardening

> Status: maintained
> Applies to: OpenPath operators
> Last verified: 2026-04-13
> Source of truth: `docs/SECURITY-HARDENING.md`

## API

- set a strong `JWT_SECRET`
- set explicit `CORS_ORIGINS` in production
- publish public agent/extension endpoints over HTTPS
- rotate registration or enrollment material when compromised

## Linux Agents

- restrict root access
- verify `dnsmasq`, watchdog, SSE, and update services after install
- protect `/etc/openpath` and monitor `/var/log/openpath.log`
- keep package/upgrade trust anchored to the persistent APT signing key

## Windows Agents

- run installers as Administrator only from trusted sources
- verify scheduled tasks and firewall rules after bootstrap
- protect `C:\OpenPath\data\config.json` and staged browser-extension artifacts

## Repo Checks

```bash
npm run security:audit
npm run security:secrets
npm run verify:security
```

Use [`../SECURITY.md`](../SECURITY.md) for disclosure workflow; this file is the operator hardening checklist.
