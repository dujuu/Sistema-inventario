# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Sistema de Inventario Multi-Bodega: a modular monolith (NestJS API + Next.js panel) for multi-warehouse inventory. Full architecture spec, data model, and roadmap (Fase 1/2/3) are in [`arquitectura-sistema-inventario.md`](./arquitectura-sistema-inventario.md) — read it before adding features outside Fase 1 scope.

Monorepo, no workspaces: `apps/api` and `apps/web` are independent npm projects with their own `node_modules`.

## Commands

```bash
docker compose up -d              # Postgres (5432) + Redis (6379) for local dev

# apps/api (NestJS, port 3000, prefix /api/v1, Swagger at /api/docs)
npx prisma migrate dev            # apply schema changes
npm run db:seed                   # creates admin@inventario.local / admin123 + warehouse WH-01
npm run start:dev
npm run build && npm test         # build runs `nest build`; test runs the default jest unit tests

# apps/web (Next.js, port 3001 — deliberately not 3000, to avoid clashing with the API)
npm run dev
```

## Required env vars

- `apps/api/.env`: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `WEB_ORIGIN` (CORS allow-origin, defaults to `http://localhost:3001`).
- `apps/web/.env.local`: `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3000/api/v1`).

## Gotchas

- **Prisma 7 requires an explicit driver adapter.** `new PrismaClient()` with no args throws (`PrismaClientConstructorValidationError`), and the engine type `"client"` requires `adapter` or `accelerateUrl`. Always construct with `new PrismaClient({ adapter: new PrismaPg({ connectionString: ... }) })` — see `src/prisma/prisma.service.ts` and `prisma/seed.ts`.
- **`tsconfig.build.json` must pin `rootDir: "./src"` and `include: ["src/**/*"]`.** Without it, tsc's inferred rootDir includes `prisma/` too, so `dist/` mirrors the full project path (`dist/src/...`) instead of being flat. That breaks the relative import from `src/prisma/prisma.service.ts` to the generated client at `apps/api/generated/prisma` (the path depth no longer matches after compilation), even though `tsc` type-checks fine.
- **Stock table columns are camelCase** (Prisma default — no `@map` was added per-field). Raw SQL in `movements.service.ts` (the `SELECT ... FOR UPDATE` lock) must quote identifiers exactly: `"productId"`, `"warehouseId"`, etc. — not `product_id`.
- **CORS** is enabled in `apps/api/src/main.ts` via `app.enableCors({ origin: process.env.WEB_ORIGIN })`. If the web app's port changes, update `WEB_ORIGIN`.
- Prisma client is generated to `apps/api/generated/prisma` (gitignored) — run `npx prisma generate` after pulling schema changes, before building.

## Architecture notes (Fase 1)

- Stock is never a loose mutable field: `stock_movements` is append-only (the ledger/audit trail), and `stock` is a transactional cache updated in the same DB transaction as the movement, using `SELECT ... FOR UPDATE` for row-level locking (`movements.service.ts`).
- Every movement requires an `idempotencyKey`; retrying the same key returns the existing movement instead of duplicating it (checked before the transaction, and again via unique-constraint catch for the race case).
- RBAC is warehouse-scoped: each `WarehousePermission` ties a user to a role (`ADMIN | SUPERVISOR | OPERATOR | READONLY`) for one specific warehouse. Permissions are embedded in the JWT at login time (not re-fetched from the DB per request) — `RolesGuard` reads them from `request.user.permissions`. Only endpoints decorated with `@Roles(...)` enforce this; catalog/users/warehouses endpoints currently only require a valid JWT (no role check), which is a known Fase 1 simplification.
- Redis is provisioned in `docker-compose.yml` for Fase 2 (reservations, low-stock alerts, BullMQ) but has no application code wired to it yet — Fase 1 doesn't need it.

## Repo conventions

- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, ...).
- Branches: `feature/<name>` or `fix/<name>`.
