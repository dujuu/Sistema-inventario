import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MovementsService } from '../movements/movements.service';
import {
  MovementType,
  Prisma,
  PurchaseOrderStatus,
} from '../../generated/prisma';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';

const include = {
  supplier: true,
  warehouse: true,
  lines: { include: { product: true } },
};

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movements: MovementsService,
  ) {}

  async create(dto: CreatePurchaseOrderDto, userId: string) {
    const existing = await this.prisma.purchaseOrder.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      include,
    });
    if (existing) return existing;

    try {
      return await this.prisma.purchaseOrder.create({
        data: {
          supplierId: dto.supplierId,
          warehouseId: dto.warehouseId,
          reference: dto.reference,
          idempotencyKey: dto.idempotencyKey,
          createdById: userId,
          lines: {
            create: dto.lines.map((line) => ({
              productId: line.productId,
              quantityOrdered: line.quantity,
              unitCost: line.unitCost,
            })),
          },
        },
        include,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.prisma.purchaseOrder.findUniqueOrThrow({
          where: { idempotencyKey: dto.idempotencyKey },
          include,
        });
      }
      throw error;
    }
  }

  async receive(id: string, dto: ReceivePurchaseOrderDto, userId: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include,
    });
    if (!po) {
      throw new NotFoundException('Orden de compra no encontrada');
    }
    if (dto.warehouseId !== po.warehouseId) {
      throw new BadRequestException(
        'La bodega no coincide con la orden de compra',
      );
    }
    if (po.status === PurchaseOrderStatus.CANCELLED) {
      throw new BadRequestException('La orden de compra está cancelada');
    }

    for (const item of dto.lines) {
      const line = po.lines.find((l) => l.id === item.lineId);
      if (!line) {
        throw new BadRequestException(
          `La línea ${item.lineId} no pertenece a esta orden de compra`,
        );
      }
      if (item.quantity <= 0) {
        throw new BadRequestException(
          'La cantidad a recibir debe ser mayor a 0',
        );
      }

      const movementKey = `po-receipt:${dto.idempotencyKey}:${item.lineId}`;
      const existingMovement = await this.prisma.stockMovement.findUnique({
        where: { idempotencyKey: movementKey },
      });
      if (existingMovement) continue;

      if (line.quantityReceived.plus(item.quantity).gt(line.quantityOrdered)) {
        throw new BadRequestException(
          `La línea ${item.lineId} excede la cantidad ordenada`,
        );
      }

      await this.movements.create(
        {
          productId: line.productId,
          warehouseId: po.warehouseId,
          type: MovementType.IN,
          quantity: item.quantity,
          reference: `po:${po.id}`,
          idempotencyKey: movementKey,
        },
        userId,
      );

      await this.prisma.purchaseOrderLine.update({
        where: { id: line.id },
        data: { quantityReceived: { increment: item.quantity } },
      });
    }

    const updatedLines = await this.prisma.purchaseOrderLine.findMany({
      where: { purchaseOrderId: id },
    });
    const allReceived = updatedLines.every((l) =>
      l.quantityReceived.gte(l.quantityOrdered),
    );
    const anyReceived = updatedLines.some((l) => l.quantityReceived.gt(0));
    const status = allReceived
      ? PurchaseOrderStatus.RECEIVED
      : anyReceived
        ? PurchaseOrderStatus.PARTIALLY_RECEIVED
        : po.status;

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status },
      include,
    });
  }

  findAll() {
    return this.prisma.purchaseOrder.findMany({
      include,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include,
    });
    if (!po) {
      throw new NotFoundException('Orden de compra no encontrada');
    }
    return po;
  }
}
