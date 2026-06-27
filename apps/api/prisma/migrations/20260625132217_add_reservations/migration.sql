-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'DISPATCHED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "reference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "dispatchedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reservations_idempotencyKey_key" ON "reservations"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_dispatchedById_fkey" FOREIGN KEY ("dispatchedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
