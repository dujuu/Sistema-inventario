import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, MovementType } from '../../generated/prisma';
import { CreateMovementDto } from './dto/create-movement.dto';

@Injectable()
export class MovementsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('stock-alerts') private readonly alertsQueue: Queue,
  ) {}

  async create(dto: CreateMovementDto, userId: string) {
    const existing = await this.prisma.stockMovement.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) return existing;

    if (dto.type !== MovementType.ADJUSTMENT && dto.quantity <= 0) {
      throw new BadRequestException(
        'quantity debe ser mayor a 0 para entradas y salidas',
      );
    }
    if (dto.type === MovementType.ADJUSTMENT && dto.quantity === 0) {
      throw new BadRequestException('quantity no puede ser 0 en un ajuste');
    }

    let movement: Awaited<ReturnType<typeof this.prisma.stockMovement.create>>;
    try {
      movement = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO "stock" ("productId", "warehouseId", "quantityOnHand", "quantityReserved", "version")
          VALUES (${dto.productId}, ${dto.warehouseId}, 0, 0, 0)
          ON CONFLICT ("productId", "warehouseId") DO NOTHING
        `;
        await tx.$executeRaw`
          SELECT 1 FROM "stock" WHERE "productId" = ${dto.productId} AND "warehouseId" = ${dto.warehouseId} FOR UPDATE
        `;
        const stock = await tx.stock.findUniqueOrThrow({
          where: {
            productId_warehouseId: {
              productId: dto.productId,
              warehouseId: dto.warehouseId,
            },
          },
        });

        const delta =
          dto.type === MovementType.OUT
            ? new Prisma.Decimal(dto.quantity).neg()
            : new Prisma.Decimal(dto.quantity);
        const newOnHand = stock.quantityOnHand.plus(delta);

        if (
          dto.type === MovementType.OUT &&
          stock.quantityOnHand.minus(stock.quantityReserved).lt(dto.quantity)
        ) {
          throw new BadRequestException('Stock disponible insuficiente');
        }
        if (newOnHand.lt(0)) {
          throw new BadRequestException(
            'El ajuste dejaría el stock en negativo',
          );
        }

        await tx.stock.update({
          where: {
            productId_warehouseId: {
              productId: dto.productId,
              warehouseId: dto.warehouseId,
            },
          },
          data: { quantityOnHand: newOnHand, version: { increment: 1 } },
        });

        return tx.stockMovement.create({
          data: {
            productId: dto.productId,
            warehouseId: dto.warehouseId,
            type: dto.type,
            quantity: dto.quantity,
            reference: dto.reference,
            idempotencyKey: dto.idempotencyKey,
            createdById: userId,
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.prisma.stockMovement.findUniqueOrThrow({
          where: { idempotencyKey: dto.idempotencyKey },
        });
      }
      throw error;
    }

    // Fire-and-forget: deduplicated by jobId for rapid bursts on the same pair.
    void this.alertsQueue.add(
      'check',
      { productId: dto.productId, warehouseId: dto.warehouseId },
      { jobId: `check:${dto.productId}:${dto.warehouseId}`, removeOnComplete: true },
    );

    return movement;
  }
}
