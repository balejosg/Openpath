# OpenPath API

> Status: maintained
> Applies to: `@openpath/api`
> Last verified: 2026-04-13
> Source of truth: `api/README.md`

`@openpath/api` is the main OpenPath service. It combines:

- public REST routes for health, setup, public requests, enrollment/bootstrap, agent delivery, extension delivery, and exports
- authenticated tRPC routers consumed by the React SPA and the dashboard proxy
- PostgreSQL-backed persistence via Drizzle

## Service Shape

Current execution boundary:

```text
Express routes / tRPC routers -> services -> storage helpers -> PostgreSQL
```

Current high-signal invariants:

- multi-write service flows use explicit transaction boundaries
- external side effects run after commit
- group-linked request/classroom/schedule relationships are enforced at the schema level
- downstream SPA consumers should use the documented public React SPA entrypoints rather than deep imports

For the exact tRPC router inventory, use [`src/trpc/routers/index.ts`](src/trpc/routers/index.ts). For the exact REST route inventory, use the files under `src/routes/`.

## Local Development

From repo root:

```bash
npm install
npm run build --workspace=@openpath/shared
npm run dev --workspace=@openpath/api
```

Production build:

```bash
npm run build --workspace=@openpath/api
npm start --workspace=@openpath/api
```

## Configuration

Current core environment knobs:

- `JWT_SECRET`: required outside test mode
- `CORS_ORIGINS`: explicit origins required in production
- `DATABASE_URL` or `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`
- `GOOGLE_CLIENT_ID`: optional Google sign-in
- `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`: optional web push
- `SHARED_SECRET`: legacy/shared-secret machine-auth paths where enabled

The checked-in `.env.example` contains legacy/developer context; validate against [`src/config.ts`](src/config.ts) before changing deploy docs or environment contracts.

## Public HTTP Surface

Current REST endpoints include:

- health and config: `/health`, `/api/config`
- setup: `/api/setup/status`, `/api/setup/first-admin`, `/api/setup/registration-token`, `/api/setup/regenerate-token`, `/api/setup/validate-token`
- public requests: `/api/requests/auto`, `/api/requests/submit`
- enrollment/bootstrap: `/api/enroll/:classroomId`, `/api/enroll/:classroomId/ticket`, `/api/enroll/:classroomId/windows.ps1`
- agent delivery: `/api/agent/windows/bootstrap/manifest`, `/api/agent/windows/manifest`, `/api/agent/linux/manifest`, `/api/agent/linux/packages/:version`
- machine whitelist delivery: `/w/whitelist.txt`, `/w/:machineToken/whitelist.txt`
- extension delivery: `/api/extensions/firefox/openpath.xpi`, `/api/extensions/chromium/updates.xml`, `/api/extensions/chromium/openpath.crx`
- exports: `/export/:name.txt`
- Swagger/OpenAPI: `/api-docs`, `/api-docs.json`

Authenticated application flows are primarily exposed through `/trpc`.

## Verification

Useful commands:

```bash
npm test --workspace=@openpath/api
npm run test:auth --workspace=@openpath/api
npm run test:setup --workspace=@openpath/api
npm run test:security --workspace=@openpath/api
npm run test:token-delivery
npm run verify:migrations:metadata
```

See [`../docs/INDEX.md`](../docs/INDEX.md) for the surrounding architecture and operations docs.
