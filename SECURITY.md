# Security Policy

> Status: maintained
> Applies to: OpenPath repository
> Last verified: 2026-04-13
> Source of truth: `SECURITY.md`

## Reporting Vulnerabilities

Do not open a public issue for a suspected vulnerability. Use a GitHub private security advisory for this repository or contact the maintainers directly.

## Operational Security Baseline

- Set a strong `JWT_SECRET` outside test mode.
- Use explicit `CORS_ORIGINS` in production; the API rejects `*` in production.
- Treat registration and enrollment material as sensitive and rotate it when compromised:
  - `POST /api/setup/regenerate-token`
  - enrollment tickets under `/api/enroll/:classroomId/ticket`
- Use HTTPS for public API URLs that agents or browser delivery routes consume.
- Keep the APT signing key stable across releases. See [`docs/apt-signing-key.md`](docs/apt-signing-key.md).

## Useful Local Checks

```bash
npm run security:audit
npm run security:secrets
npm run verify:security
```

When touching auth or public request flows, also run targeted API tests from [`api/README.md`](api/README.md).

This file describes the current disclosure and hardening baseline. Historical release notes and ADRs should not be used as the primary incident-response guide.
