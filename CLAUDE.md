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

- `apps/api/.env`: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `WEB_ORIGIN` (CORS allow-origin, defaults to `http://localhost:3001`), `REDIS_HOST`/`REDIS_PORT` (BullMQ connection, default `localhost`/`6379` — matches the Redis service in `docker-compose.yml`).
- `apps/web/.env.local`: `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3000/api/v1`).

## Gotchas

- **Prisma 7 requires an explicit driver adapter.** `new PrismaClient()` with no args throws (`PrismaClientConstructorValidationError`), and the engine type `"client"` requires `adapter` or `accelerateUrl`. Always construct with `new PrismaClient({ adapter: new PrismaPg({ connectionString: ... }) })` — see `src/prisma/prisma.service.ts` and `prisma/seed.ts`.
- **`tsconfig.build.json` must pin `rootDir: "./src"` and `include: ["src/**/*"]`.** Without it, tsc's inferred rootDir includes `prisma/` too, so `dist/` mirrors the full project path (`dist/src/...`) instead of being flat. That breaks the relative import from `src/prisma/prisma.service.ts` to the generated client at `apps/api/generated/prisma` (the path depth no longer matches after compilation), even though `tsc` type-checks fine.
- **Stock table columns are camelCase** (Prisma default — no `@map` was added per-field). Raw SQL in `movements.service.ts` (the `SELECT ... FOR UPDATE` lock) must quote identifiers exactly: `"productId"`, `"warehouseId"`, etc. — not `product_id`.
- **CORS** is enabled in `apps/api/src/main.ts` via `app.enableCors({ origin: process.env.WEB_ORIGIN })`. If the web app's port changes, update `WEB_ORIGIN`.
- **Every DTO field needs a `class-validator` decorator**, even ones with no real constraint (use `@IsString()` etc.) — `main.ts`'s global `ValidationPipe` has `whitelist: true`, which *silently drops* any property without at least one decorator instead of erroring. Hit this with `WarehousePermissionDto.role` (no decorator → dropped → Prisma threw "Argument `role` is missing" on `POST /users`). Fixed by adding `@IsIn([...])`.
- Prisma client is generated to `apps/api/generated/prisma` (gitignored) — run `npx prisma generate` after pulling schema changes, before building.
- **Rate limiting**: global default is 100 req/min per IP (`@nestjs/throttler`, configured in `app.module.ts`); `POST /auth/login` is overridden to 5 req/min via `@Throttle(...)` to slow down credential stuffing. A 429 includes a `Retry-After` header.
- **Logging** is structured JSON via `nestjs-pino` (pretty-printed in non-production via `pino-pretty`); `Authorization` headers are redacted. Nest's standard `Logger` is wired through it (`app.useLogger(app.get(Logger))` in `main.ts`) — just use `new Logger(ClassName)` as usual, don't reach for `PinoLogger` directly unless you need pino-specific methods.
- **`RolesGuard`'s warehouse resolution is a fallback chain**, not just `body.warehouseId`: `params.warehouseId ?? query.warehouse ?? body.warehouseId ?? body.fromWarehouseId ?? body.toWarehouseId` (see `src/common/guards/roles.guard.ts`). Any new warehouse-scoped DTO whose field isn't named one of these won't be authorized correctly — either name the field to match or extend the chain.

## Architecture notes (Fase 1)

- Stock is never a loose mutable field: `stock_movements` is append-only (the ledger/audit trail), and `stock` is a transactional cache updated in the same DB transaction as the movement, using `SELECT ... FOR UPDATE` for row-level locking (`movements.service.ts`).
- Every movement requires an `idempotencyKey`; retrying the same key returns the existing movement instead of duplicating it (checked before the transaction, and again via unique-constraint catch for the race case).
- RBAC is warehouse-scoped: each `WarehousePermission` ties a user to a role (`ADMIN | SUPERVISOR | OPERATOR | READONLY`) for one specific warehouse. Permissions are embedded in the JWT at login time (not re-fetched from the DB per request) — `RolesGuard` reads them from `request.user.permissions`. Only endpoints decorated with `@Roles(...)` enforce this. `/users` requires `ADMIN` in any warehouse (not warehouse-scoped itself — see `RolesGuard`'s "no `warehouseId` in the request" branch). `catalog`/`warehouses` endpoints currently only require a valid JWT (no role check), which is a known Fase 1 simplification.
- Redis is provisioned in `docker-compose.yml` for Fase 2 (reservations, low-stock alerts, BullMQ) — wired up starting with Reservations, below.

## Architecture notes (Fase 2)

- **Transfers** (`src/transfers/`) are the first Fase 2 feature: a 2-phase move between warehouses. `POST /transfers` immediately creates an `OUT` movement at `fromWarehouseId` (stock leaves right away) and a `Transfer` row (`IN_TRANSIT`); `POST /transfers/:id/receive` creates the matching `IN` movement at `toWarehouseId` and marks it `RECEIVED`. Stock is never credited at the destination until receipt — there's an intentional window where the quantity is "in transit" and isn't counted at either warehouse's `Stock` row.
- `TransfersService` reuses `MovementsService.create()` for both legs instead of duplicating the row-lock/idempotency logic — `MovementsModule` exports `MovementsService` for this. The movement idempotency keys are derived deterministically from the transfer's own idempotency key (`transfer-out:<key>`) or its id (`transfer-in:<id>`), not a freshly generated UUID — using a random id per call would break idempotency on retry (the second attempt would generate a different movement key and double-deduct stock). If you add another feature that wraps `MovementsService.create()`, follow the same deterministic-key pattern.
- Receiving an already-`RECEIVED` transfer is a no-op (returns the existing row) rather than erroring — this, plus the transfer's own `idempotencyKey` check on creation, makes both endpoints safe to retry.
- **Purchase orders** (`src/purchase-orders/`, `src/suppliers/`) are multi-line: one `PurchaseOrder` (supplier + destination warehouse) has several `PurchaseOrderLine`s (product, `quantityOrdered`, `quantityReceived`, `unitCost`). Creating a PO never touches stock (`PENDING`, just an intent to buy); `POST /purchase-orders/:id/receive` takes a *subset* of lines with arbitrary quantities (partial receiving is normal — a shipment rarely arrives all at once), creates one `IN` movement per line via `MovementsService.create()`, increments that line's `quantityReceived`, and recomputes the PO's status (`RECEIVED` once every line is fully received, `PARTIALLY_RECEIVED` if only some are).
- **Idempotency gotcha specific to partial receiving**: unlike `Transfer.status` (a single boolean-ish gate that's safe to check once per call), a PO's "already processed" state has to be tracked *per line*, because a single `receive` call only ever touches the lines named in its request body — a retried call can't be gated by the PO's overall status. `PurchaseOrdersService.receive()` therefore checks for an existing `StockMovement` by that line's deterministic key (`po-receipt:<idempotencyKey>:<lineId>`) **before** validating `quantityReceived` against `quantityOrdered`, and skips the line entirely if found. Validating the over-receipt limit before the idempotency check (the initial, buggy ordering — caught by the "repeated identical receive" e2e test) makes a verbatim retry fail with 400, because the previous call's `quantityReceived` increment makes the same quantity look like an over-receipt the second time around. If you write another partial/incremental receiving flow, check idempotency before any quantity validation, not after.
- Both `ReceiveTransferDto` and `ReceivePurchaseOrderDto` carry a `warehouseId` field that's redundant with data already on the parent record — it exists solely so `RolesGuard` (which only reads the request body, not the loaded entity) can authorize the warehouse before the service runs. The service still re-validates it matches the parent record's actual warehouse.
- **Reservations** (`src/reservations/`) are the project's first real use of Redis/BullMQ (`@nestjs/bullmq`, queue name `reservations`, wired globally via `BullModule.forRoot(...)` in `app.module.ts`). A `Reservation` holds `Stock.quantityReserved` for a product/warehouse without moving anything yet; it resolves one of three ways: `dispatch` (real `OUT`, decrements both `quantityOnHand` and `quantityReserved`), `cancel` (releases the hold, no movement), or automatic expiry. Creating a reservation with `expiresAt` enqueues a delayed BullMQ job (`jobId = reservation.id`, so a retried create via the idempotency check never double-enqueues) that calls the same `release()` method `cancel()` uses, but only if the reservation is still `ACTIVE` when the job fires — manually resolving it first makes the eventual job a no-op.
- **Why `ReservationsService` doesn't reuse `MovementsService.create()`** (unlike Transfers/POs, which delegate every stock change to it): dispatching a reservation has to decrement **both** `quantityOnHand` and `quantityReserved` **in the same transaction** as the `OUT` movement insert, but `MovementsService.create()` only ever touches `quantityOnHand`. Splitting that into "call `MovementsService.create()`, then separately decrement `quantityReserved`" would leave a window between two transactions where the row lock isn't held continuously — a real correctness gap, not just a style preference. So `ReservationsService.dispatch()`/`create()`/`release()` each open their own `$transaction`, copying the row-lock shape from `movements.service.ts` (`INSERT ... ON CONFLICT DO NOTHING` then `SELECT ... FOR UPDATE`) but applying it to whichever `Stock` columns that operation actually needs.
- Running the full e2e suite together can print `A worker process has failed to exit gracefully` after the reservations BullMQ test — this is Jest force-exiting lingering ioredis connections from bootstrapping multiple full `AppModule`s (one per e2e file) in the same process, not a test failure (exit code is still 0, all assertions pass). Harmless; ignore it.

## Repo conventions

- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, ...).
- Branches: `feature/<name>` or `fix/<name>`.
