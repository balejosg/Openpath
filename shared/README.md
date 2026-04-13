# OpenPath Shared

> Status: maintained
> Applies to: `@openpath/shared`
> Last verified: 2026-04-13
> Source of truth: `shared/README.md`

`@openpath/shared` holds the shared contracts used across the OpenPath monorepo.

## Exported Surface

The package root exports:

- Zod schemas and inferred types from `src/schemas/index.ts`
- normalization helpers from `src/utils.ts`
- classroom status contracts from `src/classroom-status.ts`
- schedule-time helpers
- domain/root-domain helpers from `src/domain.ts`
- rule validation helpers from `src/rules-validation.ts`
- role-related types from `src/roles.ts`
- slug helpers from `src/slug.ts`

It also exposes stable subpath exports for:

- `@openpath/shared/classroom-status`
- `@openpath/shared/domain`
- `@openpath/shared/rules-validation`
- `@openpath/shared/roles`
- `@openpath/shared/slug`

## Local Workflow

```bash
npm run build --workspace=@openpath/shared
npm run typecheck --workspace=@openpath/shared
npm run lint --workspace=@openpath/shared
npm test --workspace=@openpath/shared
```

Use this workspace for contracts that must remain consistent between API, dashboard, SPA, and other consumers.
Import from the documented package root or exported subpaths, not from private source files under `src/`.
