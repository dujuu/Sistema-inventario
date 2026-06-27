import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MovementType, Prisma } from '../../generated/prisma';
import { KardexQueryDto } from './dto/kardex-query.dto';
import { ValuationQueryDto } from './dto/valuation-query.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async stockValuation(dto: ValuationQueryDto) {
    const rows = await this.prisma.stock.findMany({
      where: dto.warehouseId ? { warehouseId: dto.warehouseId } : undefined,
      include: {
        product: { select: { id: true, sku: true, name: true, unit: true, cost: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ warehouseId: 'asc' }, { productId: 'asc' }],
    });

    let grandTotal = new Prisma.Decimal(0);
    const lines = rows.map((s) => {
      const value = s.quantityOnHand.mul(s.product.cost);
      grandTotal = grandTotal.plus(value);
      return {
        warehouseId: s.warehouseId,
        warehouseCode: s.warehouse.code,
        warehouseName: s.warehouse.name,
        productId: s.productId,
        productSku: s.product.sku,
        productName: s.product.name,
        unit: s.product.unit,
        unitCost: s.product.cost,
        quantityOnHand: s.quantityOnHand,
        quantityReserved: s.quantityReserved,
        value,
      };
    });

    return { lines, grandTotal };
  }

  async kardex(dto: KardexQueryDto) {
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        productId: dto.productId,
        ...(dto.warehouseId && { warehouseId: dto.warehouseId }),
        ...(dto.from || dto.to
          ? {
              createdAt: {
                ...(dto.from && { gte: new Date(dto.from) }),
                ...(dto.to && { lte: new Date(dto.to) }),
              },
            }
          : {}),
      },
      include: {
        warehouse: { select: { code: true, name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { sku: true, name: true, unit: true },
    });

    let balance = new Prisma.Decimal(0);
    const lines = movements.map((m) => {
      const qty = new Prisma.Decimal(m.quantity);
      const delta =
        m.type === MovementType.IN
          ? qty
          : m.type === MovementType.OUT
            ? qty.neg()
            : qty; // ADJUSTMENT can be positive or negative; stored as signed
      balance = balance.plus(delta);
      return {
        id: m.id,
        date: m.createdAt,
        type: m.type,
        warehouseCode: m.warehouse.code,
        warehouseName: m.warehouse.name,
        quantity: m.quantity,
        balance,
        reference: m.reference,
        createdBy: m.createdBy.name,
      };
    });

    return { product, lines };
  }
}
