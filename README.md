# Sistema de Inventario Multi-Bodega

Monolito modular para gestión de inventario en varias bodegas. La especificación completa de arquitectura está en [`arquitectura-sistema-inventario.md`](./arquitectura-sistema-inventario.md).

Este scaffold cubre **Fase 1 (MVP núcleo)**: Catálogo, Bodegas, Stock + Ledger de movimientos, Entradas/Salidas/Ajustes con bloqueo por fila, Usuarios + RBAC por bodega, y un panel básico.

## Estructura

```
apps/api    NestJS + TypeScript + Prisma + PostgreSQL
apps/web    Next.js (panel de administración)
```

## Requisitos

- Node.js 20+
- Docker (para Postgres y Redis en desarrollo)

## Quickstart

```bash
# 1. Levantar Postgres y Redis
docker compose up -d

# 2. Backend
cd apps/api
npm install
npx prisma migrate dev
npm run db:seed      # crea admin@inventario.local / admin123 y una bodega WH-01
npm run start:dev    # http://localhost:3000/api/v1 — Swagger en /api/docs

# 3. Frontend (en otra terminal)
cd apps/web
npm install
cp .env.local.example .env.local
npm run dev           # http://localhost:3001
```

## Notas de diseño

- El stock nunca se mantiene como un campo suelto: `stock_movements` es append-only (ledger/auditoría) y `stock` es una caché transaccional que se actualiza en la misma transacción que el movimiento, usando `SELECT ... FOR UPDATE` para bloqueo por fila.
- Cada movimiento requiere `idempotencyKey`; reintentar la misma clave devuelve el movimiento existente sin duplicar.
- RBAC con alcance por bodega: cada usuario tiene un rol (`ADMIN | SUPERVISOR | OPERATOR | READONLY`) por cada bodega en la que opera.
- Redis está provisto en `docker-compose.yml` para Fase 2 (reservas, alertas, BullMQ) pero todavía no tiene código de aplicación cableado — Fase 1 no lo necesita.
