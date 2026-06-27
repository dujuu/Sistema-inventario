import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MovementsService } from '../movements/movements.service';
import { CycleCountStatus, MovementType, Prisma } from '../../generated/prisma';
import { CreateCycleCountDto } from './dto/create-cycle-count.dto';
import { UpdateLineDto } from './dto/update-line.dto';

@Injectable()
export class CycleCountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movements: MovementsService,
  ) {}

  async create(dto: CreateCycleCountDto, userId: string) {
    // Resolve which products to count
    const stockRows = await this.prisma.stock.findMany({
      where: {
        warehouseId: dto.warehouseId,
        ...(dto.productIds?.length ? { productId: { in: dto.productIds } } : {}),
      },
    });

    if (stockRows.length === 0) {
      throw new BadRequestException(
        'No hay stock registrado para los productos y bodega seleccionados',
      );
    }

    return this.prisma.cycleCount.create({
      data: {
        warehouseId: dto.warehouseId,
        reference: dto.reference,
        createdById: userId,
        lines: {
          create: stockRows.map((s) => ({
            productId: s.productId,
            systemQuantity: s.quantityOnHand,
          })),
        },
      },
      include: {
        warehouse: true,
        lines: { include: { product: true } },
      },
    });
  }

  findAll() {
    return this.prisma.cycleCount.findMany({
      include: {
        warehouse: { select: { code: true, name: true } },
        createdBy: { select: { name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const count = await this.prisma.cycleCount.findUnique({
      where: { id },
      include: {
        warehouse: true,
        createdBy: { select: { name: true } },
        committedBy: { select: { name: true } },
        lines: {
          include: { product: { select: { sku: true, name: true, unit: true } } },
          orderBy: { product: { sku: 'asc' } },
        },
      },
    });
    if (!count) throw new NotFoundException('Conteo no encontrado');
    return count;
  }

  async updateLine(countId: string, lineId: string, dto: UpdateLineDto) {
    const count = await this.prisma.cycleCount.findUnique({ where: { id: countId } });
    if (!count) throw new NotFoundException('Conteo no encontrado');
    if (count.status !== CycleCountStatus.DRAFT) {
      throw new BadRequestException('Solo se pueden editar conteos en estado DRAFT');
    }

    const line = await this.prisma.cycleCountLine.findFirst({
      where: { id: lineId, cycleCountId: countId },
    });
    if (!line) throw new NotFoundException('Línea no encontrada');

    return this.prisma.cycleCountLine.update({
      where: { id: lineId },
      data: { countedQuantity: dto.countedQuantity },
    });
  }

  async commit(id: string, userId: string) {
    const count = await this.prisma.cycleCount.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!count) throw new NotFoundException('Conteo no encontrado');
    if (count.status !== CycleCountStatus.DRAFT) {
      throw new BadRequestException('Solo se puede confirmar un conteo en DRAFT');
    }

    const linesToAdjust = count.lines.filter(
      (l) => l.countedQuantity !== null,
    );

    for (const line of linesToAdjust) {
      const stock = await this.prisma.stock.findUnique({
        where: {
          productId_warehouseId: {
            productId: line.productId,
            warehouseId: count.warehouseId,
          },
        },
      });
      const currentOnHand = stock?.quantityOnHand ?? new Prisma.Decimal(0);
      const delta = new Prisma.Decimal(line.countedQuantity!).minus(currentOnHand);

      if (!delta.isZero()) {
        await this.movements.create(
          {
            productId: line.productId,
            warehouseId: count.warehouseId,
            type: MovementType.ADJUSTMENT,
            quantity: delta.toNumber(),
            reference: `cycle-count:${id}`,
            idempotencyKey: `cycle-count-adj:${id}:${line.id}`,
          },
          userId,
        );
      }

      // Store the difference vs the original snapshot for audit
      await this.prisma.cycleCountLine.update({
        where: { id: line.id },
        data: {
          difference: new Prisma.Decimal(line.countedQuantity!).minus(
            line.systemQuantity,
          ),
        },
      });
    }

    return this.prisma.cycleCount.update({
      where: { id },
      data: {
        status: CycleCountStatus.COMMITTED,
        committedById: userId,
        committedAt: new Date(),
      },
      include: {
        lines: { include: { product: { select: { sku: true, name: true } } } },
      },
    });
  }

  async cancel(id: string) {
    const count = await this.prisma.cycleCount.findUnique({ where: { id } });
    if (!count) throw new NotFoundException('Conteo no encontrado');
    if (count.status !== CycleCountStatus.DRAFT) {
      throw new BadRequestException('Solo se puede cancelar un conteo en DRAFT');
    }
    return this.prisma.cycleCount.update({
      where: { id },
      data: { status: CycleCountStatus.CANCELLED },
    });
  }
}
