# OpenPath Dashboard Proxy

> Status: maintained
> Applies to: `@openpath/dashboard`
> Last verified: 2026-04-13
> Source of truth: `dashboard/README.md`

`@openpath/dashboard` is a stateless Express service that keeps legacy REST-style clients working by proxying to the API's tRPC surface.

## Current Responsibility

- auth compatibility routes backed by API tRPC auth procedures
- groups/rules/system-status REST compatibility routes
- export redirect helpers

The dashboard does not own business logic or direct database access.

## Current HTTP Surface

Implemented routes include:

- auth: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/check`, `POST /api/auth/change-password`
- groups: `GET/POST /api/groups`, `GET/PUT/DELETE /api/groups/:id`
- rules: `GET/POST /api/groups/:groupId/rules`, `POST /api/groups/:groupId/rules/bulk`, `DELETE /api/rules/:id`
- system: `GET /api/stats`, `GET /api/system/status`, `POST /api/system/toggle`
- exports: `GET /export/:name.txt`

## Local Workflow

```bash
npm run dev --workspace=@openpath/dashboard
npm run build --workspace=@openpath/dashboard
npm test --workspace=@openpath/dashboard
```

Use the dashboard only for compatibility layers that still need a REST facade. New primary product flows should be added in the API and consumed from `/trpc`.
