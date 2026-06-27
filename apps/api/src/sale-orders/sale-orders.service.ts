import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MovementsService } from '../movements/movements.service';
import { MovementType, Prisma, SaleOrderStatus } from '../../generated/prisma';
import { CreateSaleOrderDto } from './dto/create-sale-order.dto';

@Injectable()
export class SaleOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movements: MovementsService,
  ) {}

  async create(dto: CreateSaleOrderDto, userId: string) {
    const existing = await this.prisma.saleOrder.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) return existing;

    if (!dto.lines.length) {
      throw new BadRequestException('El pedido debe tener al menos una línea');
    }

    try {
      return await this.prisma.saleOrder.create({
        data: {
          warehouseId: dto.warehouseId,
          reference: dto.reference,
          customerName: dto.customerName,
          idempotencyKey: dto.idempotencyKey,
          createdById: userId,
          lines: {
            create: dto.lines.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
            })),
          },
        },
        include: {
          warehouse: true,
          lines: { include: { product: true } },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.prisma.saleOrder.findUniqueOrThrow({
          where: { idempotencyKey: dto.idempotencyKey },
        });
      }
      throw error;
    }
  }

  findAll() {
    return this.prisma.saleOrder.findMany({
      include: {
        warehouse: { select: { code: true, name: true } },
        createdBy: { select: { name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.saleOrder.findUnique({
      where: { id },
      include: {
        warehouse: true,
        createdBy: { select: { name: true } },
        dispatchedBy: { select: { name: true } },
        lines: {
          include: { product: { select: { sku: true, name: true, unit: true } } },
        },
      },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    return order;
  }

  async dispatch(id: string, userId: string) {
    const order = await this.prisma.saleOrder.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.status === SaleOrderStatus.DISPATCHED) return this.findOne(id);
    if (order.status === SaleOrderStatus.CANCELLED) {
      throw new BadRequestException('No se puede despachar un pedido cancelado');
    }

    for (const line of order.lines) {
      await this.movements.create(
        {
          productId: line.productId,
          warehouseId: order.warehouseId,
          type: MovementType.OUT,
          quantity: line.quantity.toNumber(),
          reference: `sale-order:${id}`,
          idempotencyKey: `sale-dispatch:${id}:${line.id}`,
        },
        userId,
      );
    }

    return this.prisma.saleOrder.update({
      where: { id },
      data: {
        status: SaleOrderStatus.DISPATCHED,
        dispatchedById: userId,
        dispatchedAt: new Date(),
      },
      include: {
        warehouse: true,
        lines: { include: { product: { select: { sku: true, name: true, unit: true } } } },
        dispatchedBy: { select: { name: true } },
      },
    });
  }

  async cancel(id: string) {
    const order = await this.prisma.saleOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.status === SaleOrderStatus.DISPATCHED) {
      throw new BadRequestException('No se puede cancelar un pedido ya despachado');
    }
    if (order.status === SaleOrderStatus.CANCELLED) return order;
    return this.prisma.saleOrder.update({
      where: { id },
      data: { status: SaleOrderStatus.CANCELLED },
    });
  }
}
