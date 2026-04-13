# Contributing to OpenPath

> Status: maintained
> Applies to: OpenPath repository
> Last verified: 2026-04-13
> Source of truth: `CONTRIBUTING.md`

This guide covers the current contributor workflow for the OpenPath monorepo.

## Local Setup

Prerequisites:

- Node.js `>= 20`
- npm workspaces
- Bash tooling for Linux agent work
- PowerShell for Windows agent work

Install and build from repo root:

```bash
npm install
npm run build --workspaces --if-present
```

Typical development entrypoints:

```bash
npm run dev --workspace=@openpath/api
npm run dev --workspace=@openpath/react-spa
npm run dev --workspace=@openpath/dashboard
```

## Conventions

- Keep OpenPath agnostic of ClassroomPath and any downstream wrapper.
- Prefer tRPC for new authenticated API/SPA flows unless a REST surface is intentionally public or compatibility-driven.
- Use Conventional Commits.
- Keep docs aligned with repo truth; maintained docs should stay listed in [`docs/INDEX.md`](docs/INDEX.md).
- Maintained and process docs are English-only.
- Delete obsolete docs instead of leaving contradictory stubs behind.

Examples:

```text
feat(api): add machine asset delivery endpoint
fix(linux): harden updater rollback handling
docs(windows): refresh bootstrap and browser rollout guide
```

## Verification

Fast local checks:

```bash
npm run verify:agent
npm run verify:quick
npm run verify:docs
```

Targeted test examples:

```bash
npm test --workspace=@openpath/api
npm test --workspace=@openpath/dashboard
npm test --workspace=@openpath/react-spa
npm test --workspace=@openpath/firefox-extension
cd tests && bats *.bats
```

For docs-only work, run at minimum:

```bash
npm run verify:docs
npm run format:check
```

## Pull Requests

- Rebase onto `main` before opening or updating a PR.
- Keep PRs scoped to one coherent change.
- Include doc updates when behavior, public entrypoints, install flows, or operator commands change.
- If you add a maintained doc, link it from [`docs/INDEX.md`](docs/INDEX.md) in the same change.
- Do not bypass repo hooks or disable verification.

## Security and Secrets

- Never commit `.env` files, private keys, or generated secrets.
- Use `npm run security:secrets` and `npm run security:audit` when touching sensitive areas.
- Report vulnerabilities via the process described in [`SECURITY.md`](SECURITY.md), not a public issue.
- Check existing issues before creating new ones
- Use discussions for general questions
