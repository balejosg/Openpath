# OpenPath ADR Index

> Status: maintained
> Applies to: OpenPath repository
> Last verified: 2026-04-13
> Source of truth: `docs/ADR.md`

This file is the landing page for OpenPath architecture decisions. The canonical ADR records live in `docs/adr/*.md`.

ADR files are historical records. Some still describe current contracts, while others are mainly background context for how the repo evolved.

## Current High-Signal Contracts

- [`docs/adr/0009-transactional-service-writes.md`](adr/0009-transactional-service-writes.md)
- [`docs/adr/0010-public-spa-extension-surface.md`](adr/0010-public-spa-extension-surface.md)
- [`docs/adr/0005-full-postgres-persistence.md`](adr/0005-full-postgres-persistence.md)
- [`docs/adr/0002-jwt-authentication.md`](adr/0002-jwt-authentication.md)

## Historical And Background ADRs

- [`docs/adr/0001-dns-sinkhole-architecture.md`](adr/0001-dns-sinkhole-architecture.md)
- [`docs/adr/0001-use-dnsmasq-for-dns-filtering.md`](adr/0001-use-dnsmasq-for-dns-filtering.md)
- [`docs/adr/0003-github-as-source-of-truth.md`](adr/0003-github-as-source-of-truth.md)
- [`docs/adr/0003-multi-platform-design.md`](adr/0003-multi-platform-design.md)
- [`docs/adr/0008-dashboard-trpc-client-refactor.md`](adr/0008-dashboard-trpc-client-refactor.md)

## Read By Concern

- API write integrity: `0009`
- SPA downstream integration boundary: `0010`
- Persistence model: `0005`
- Auth/session model: `0002`
- DNS and platform architecture background: `0001`, `0003`
- Dashboard compatibility refactor background: `0008`

## Guidance

- Prefer reading the specific ADR that matches the change you are making.
- Treat this index as navigation only, not as the detailed architecture contract.
- Use package READMEs and [`INDEX.md`](INDEX.md) for current operational or contributor guidance.
- For current repo entrypoints and package-level guidance, start from [`docs/INDEX.md`](INDEX.md).
- ADR numbering is inherited and contains duplicates; navigate by title and link, not by assuming a gap-free sequence.
