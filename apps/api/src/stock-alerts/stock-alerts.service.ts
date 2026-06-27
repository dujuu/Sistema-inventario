import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SetReorderPointDto } from './dto/set-reorder-point.dto';

@Injectable()
export class StockAlertsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.stockAlert.findMany({
      include: { product: true, warehouse: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async dismiss(id: string) {
    const alert = await this.prisma.stockAlert.findUnique({ where: { id } });
    if (!alert) throw new NotFoundException('Alerta no encontrada');
    return this.prisma.stockAlert.update({
      where: { id },
      data: { active: false, resolvedAt: new Date() },
    });
  }

  async setReorderPoint(
    productId: string,
    warehouseId: string,
    dto: SetReorderPointDto,
  ) {
    const reorderPoint =
      dto.reorderPoint != null ? dto.reorderPoint : null;

    await this.prisma.$executeRaw`
      INSERT INTO "stock" ("productId", "warehouseId", "quantityOnHand", "quantityReserved", "version")
      VALUES (${productId}, ${warehouseId}, 0, 0, 0)
      ON CONFLICT ("productId", "warehouseId") DO NOTHING
    `;

    const stock = await this.prisma.stock.update({
      where: { productId_warehouseId: { productId, warehouseId } },
      data: { reorderPoint },
    });

    // If threshold cleared, auto-resolve any active alert
    if (reorderPoint === null) {
      await this.prisma.stockAlert.updateMany({
        where: { productId, warehouseId, active: true },
        data: { active: false, resolvedAt: new Date() },
      });
    }

    return stock;
  }

  async checkAndUpsert(productId: string, warehouseId: string) {
    const stock = await this.prisma.stock.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
    });
    if (!stock || stock.reorderPoint === null) return;

    const isLow = stock.quantityOnHand.lte(stock.reorderPoint);

    if (isLow) {
      await this.prisma.stockAlert.upsert({
        where: { productId_warehouseId: { productId, warehouseId } },
        create: {
          productId,
          warehouseId,
          quantityOnHand: stock.quantityOnHand,
          reorderPoint: stock.reorderPoint,
          active: true,
        },
        update: {
          quantityOnHand: stock.quantityOnHand,
          reorderPoint: stock.reorderPoint,
          active: true,
          resolvedAt: null,
        },
      });
    } else {
      // Stock recovered above threshold — auto-resolve
      await this.prisma.stockAlert.updateMany({
        where: { productId, warehouseId, active: true },
        data: { active: false, resolvedAt: new Date() },
      });
    }
  }
}
