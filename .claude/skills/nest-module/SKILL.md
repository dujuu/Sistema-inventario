---
name: nest-module
description: Scaffold a new NestJS module in apps/api following this project's established pattern (DTO + service + controller + module, guards, Prisma). Use when adding a Fase 2/3 module (Transferencias, Compras, Ventas, Proveedores, Reportes, etc.) per arquitectura-sistema-inventario.md.
---

Add a new module under `apps/api/src/<module-name>/` matching the structure already used by `catalog`, `warehouses`, `stock`, and `movements`:

```
src/<module-name>/
  dto/create-<resource>.dto.ts   # class-validator decorators, no business logic
  <module-name>.service.ts       # injects PrismaService, all DB access here
  <module-name>.controller.ts    # @UseGuards(JwtAuthGuard) at minimum; add RolesGuard + @Roles(...) for warehouse-scoped mutations
  <module-name>.module.ts        # controllers + providers, no imports unless the module needs another module's exported provider
```

Register the new module in `src/app.module.ts`'s `imports` array.

## Conventions to follow

- **Auth**: every controller gets `@UseGuards(JwtAuthGuard)` and `@ApiBearerAuth()`. If an endpoint mutates stock or anything warehouse-scoped, add `RolesGuard` too and `@Roles(Role.ADMIN, ...)` — `RolesGuard` (in `src/common/guards/roles.guard.ts`) looks for a `warehouseId` in `params`, `query.warehouse`, or `body.warehouseId` to scope the check; make sure your DTO actually has one of those fields if you use it.
- **DTOs**: plain classes with `class-validator` decorators (`@IsString()`, `@IsNumber()`, etc.), validated globally via the `ValidationPipe` in `main.ts` (`whitelist: true, transform: true`).
- **Prisma access**: only in the `.service.ts`, via constructor-injected `PrismaService`. Never call Prisma directly from a controller.
- **Mutating stock**: if the new module touches `Stock` or creates a `StockMovement`, follow the pattern in `movements.service.ts` — `INSERT ... ON CONFLICT DO NOTHING` to guarantee the row exists, then `SELECT ... FOR UPDATE` (raw SQL, quoted camelCase column names) to lock it, then a typed Prisma read/update inside the same `$transaction`. Don't invent a different locking strategy.
- **Idempotency**: any mutating endpoint that could be retried by a client (movements, transfers, receipts) should accept an `idempotencyKey` and check for an existing record before doing work.
- **Swagger**: `@ApiTags('<resource>')` on the controller.

After scaffolding, run `cd apps/api && npm run build && npm run lint` (lint without `--fix` if checking before commit) to confirm it compiles cleanly, and update `arquitectura-sistema-inventario.md` / root `CLAUDE.md` if the change affects Fase boundaries or introduces a new gotcha.
