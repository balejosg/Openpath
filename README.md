# OpenPath

> Status: maintained
> Applies to: OpenPath repository
> Last verified: 2026-04-13
> Source of truth: `README.md`

[![CI](https://github.com/balejosg/openpath/actions/workflows/ci.yml/badge.svg)](https://github.com/balejosg/openpath/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/balejosg/openpath/branch/main/graph/badge.svg)](https://codecov.io/gh/balejosg/openpath)

OpenPath is the standalone OSS core for strict internet access control in shared-device environments.
It combines:

- a Node.js/TypeScript API with tRPC and PostgreSQL
- a React SPA consumed directly and through downstream wrappers
- Linux and Windows endpoint agents
- a Firefox-focused browser extension with managed Firefox/Chromium distribution helpers

OpenPath stays agnostic of ClassroomPath and any other downstream wrapper.

Maintained repo documentation is English-only and indexed from [`docs/INDEX.md`](docs/INDEX.md). Historical records such as [`CHANGELOG.md`](CHANGELOG.md) and most ADR files are useful context, but they are not install or operations runbooks.

## What Ships Today

- [`api/`](api/README.md): Express + tRPC service, setup flow, public request endpoints, agent delivery endpoints, and exports
- [`react-spa/`](react-spa/README.md): OSS administration UI plus the supported downstream public entrypoints
- [`linux/`](linux/README.md): Debian/Ubuntu agent using `dnsmasq`, firewall rules, SSE updates, and self-update tooling
- [`windows/`](windows/README.md): PowerShell agent using Acrylic DNS Proxy, Windows Firewall, scheduled tasks, and browser policy rollout
- [`firefox-extension/`](firefox-extension/README.md): extension build/signing/distribution pipeline and optional native host
- [`shared/`](shared/README.md): shared Zod schemas, domain helpers, classroom status types, rule validation, and roles
- [`dashboard/`](dashboard/README.md): Express compatibility layer that proxies legacy REST-style flows to API tRPC routes

## Current Architecture

1. The API exposes REST endpoints for health, setup, public requests, enrollment/bootstrap, agent delivery, extension delivery, and group exports.
2. Authenticated admin and teacher flows run primarily through `/trpc`, consumed by the SPA and the dashboard proxy.
3. Linux and Windows agents fetch whitelist/export data, subscribe to update signals, and enforce policy locally.
4. The browser extension helps operators diagnose blocked resources and can be distributed by the Windows delivery pipeline.

Two current repo-level contracts are especially important:

- transactional multi-write service flows: [`docs/adr/0009-transactional-service-writes.md`](docs/adr/0009-transactional-service-writes.md)
- supported downstream SPA surface: [`docs/adr/0010-public-spa-extension-surface.md`](docs/adr/0010-public-spa-extension-surface.md)

## Local Development

From repo root:

```bash
npm install
npm run build --workspaces --if-present
```

Common entrypoints:

```bash
npm run dev --workspace=@openpath/api
npm run dev --workspace=@openpath/react-spa
npm run dev --workspace=@openpath/dashboard
```

Platform-specific agents:

- Linux installer/runtime: [`linux/README.md`](linux/README.md)
- Windows installer/runtime: [`windows/README.md`](windows/README.md)

## Verification

Recommended local checks:

```bash
npm run verify:agent
npm run verify:quick
npm run verify:docs
```

Targeted examples:

```bash
npm run test:api
npm run test:react-spa
npm run test:e2e:smoke
npm test --workspace=@openpath/firefox-extension
```

The full documentation map lives in [`docs/INDEX.md`](docs/INDEX.md). Contributor and agent workflow details live in [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`AGENTS.md`](AGENTS.md).

## License

OpenPath is licensed under `AGPL-3.0-or-later`. See [`LICENSING.md`](LICENSING.md).
