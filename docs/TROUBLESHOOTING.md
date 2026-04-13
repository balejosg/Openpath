# OpenPath Troubleshooting

> Status: maintained
> Applies to: OpenPath repository
> Last verified: 2026-04-13
> Source of truth: `docs/TROUBLESHOOTING.md`

## Choose the Right Surface

- Linux agent issues: [`../linux/TROUBLESHOOTING.md`](../linux/TROUBLESHOOTING.md)
- Windows agent issues: [`../windows/README.md`](../windows/README.md)
- API/runtime issues: [`../api/README.md`](../api/README.md)
- Extension distribution or AMO issues: [`../firefox-extension/README.md`](../firefox-extension/README.md)

## First Repo-Level Checks

```bash
npm run verify:docs
npm run format:check
npm run verify:quick
```

If the problem is specific to one package, run that package's targeted tests rather than the full repo by default.

## Documentation Drift Checks

This repo now verifies documentation with:

```bash
npm run verify:docs
```

That check validates relative Markdown links and ensures maintained docs remain indexed from [`INDEX.md`](INDEX.md).
It also guards the English-only/ASCII policy for operational docs and blocks language-specific duplicates such as `*.es.md`.

If a command, path, or workflow is only mentioned in a historical file such as [`../CHANGELOG.md`](../CHANGELOG.md), treat it as context and confirm the current maintained doc before acting on it.
