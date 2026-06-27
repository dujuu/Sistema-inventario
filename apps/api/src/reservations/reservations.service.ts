import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  MovementType,
  Prisma,
  Reservation,
  ReservationStatus,
} from '../../generated/prisma';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ResolveReservationDto } from './dto/resolve-reservation.dto';

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('reservations') private readonly queue: Queue,
  ) {}

  async create(dto: CreateReservationDto, userId: string) {
    const existing = await this.prisma.reservation.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) return existing;

    let reservation: Reservation;
    try {
      reservation = await this.prisma.$transaction(async (tx) => {
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

        const available = stock.quantityOnHand.minus(stock.quantityReserved);
        if (available.lt(dto.quantity)) {
          throw new BadRequestException(
            'Stock disponible insuficiente para reservar',
          );
        }

        await tx.stock.update({
          where: {
            productId_warehouseId: {
              productId: dto.productId,
              warehouseId: dto.warehouseId,
            },
          },
          data: {
            quantityReserved: { increment: dto.quantity },
            version: { increment: 1 },
          },
        });

        return tx.reservation.create({
          data: {
            productId: dto.productId,
            warehouseId: dto.warehouseId,
            quantity: dto.quantity,
            reference: dto.reference,
            expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
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
        return this.prisma.reservation.findUniqueOrThrow({
          where: { idempotencyKey: dto.idempotencyKey },
        });
      }
      throw error;
    }

    if (dto.expiresAt) {
      const delay = Math.max(0, new Date(dto.expiresAt).getTime() - Date.now());
      await this.queue.add(
        'expire',
        { reservationId: reservation.id },
        { jobId: reservation.id, delay },
      );
    }

    return reservation;
  }

  async dispatch(id: string, dto: ResolveReservationDto, userId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
    });
    if (!reservation) {
      throw new NotFoundException('Reserva no encontrada');
    }
    if (dto.warehouseId !== reservation.warehouseId) {
      throw new BadRequestException('La bodega no coincide con la reserva');
    }
    if (reservation.status === ReservationStatus.DISPATCHED) {
      return reservation;
    }
    if (reservation.status !== ReservationStatus.ACTIVE) {
      throw new BadRequestException(
        'Solo se puede despachar una reserva activa',
      );
    }

    const movementKey = `reservation-dispatch:${id}`;
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          SELECT 1 FROM "stock" WHERE "productId" = ${reservation.productId} AND "warehouseId" = ${reservation.warehouseId} FOR UPDATE
        `;

        await tx.stock.update({
          where: {
            productId_warehouseId: {
              productId: reservation.productId,
              warehouseId: reservation.warehouseId,
            },
          },
          data: {
            quantityOnHand: { decrement: reservation.quantity },
            quantityReserved: { decrement: reservation.quantity },
            version: { increment: 1 },
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
            type: MovementType.OUT,
            quantity: reservation.quantity,
            reference: `reservation:${id}`,
            idempotencyKey: movementKey,
            createdById: userId,
          },
        });

        return tx.reservation.update({
          where: { id },
          data: {
            status: ReservationStatus.DISPATCHED,
            dispatchedById: userId,
            dispatchedAt: new Date(),
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.prisma.reservation.findUniqueOrThrow({ where: { id } });
      }
      throw error;
    }
  }

  async release(id: string, status: 'CANCELLED' | 'EXPIRED') {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
    });
    if (!reservation || reservation.status !== ReservationStatus.ACTIVE) {
      return reservation;
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT 1 FROM "stock" WHERE "productId" = ${reservation.productId} AND "warehouseId" = ${reservation.warehouseId} FOR UPDATE
      `;

      await tx.stock.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: {
          quantityReserved: { decrement: reservation.quantity },
          version: { increment: 1 },
        },
      });

      return tx.reservation.update({
        where: { id },
        data: { status, resolvedAt: new Date() },
      });
    });
  }

  async cancel(id: string, dto: ResolveReservationDto) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
    });
    if (!reservation) {
      throw new NotFoundException('Reserva no encontrada');
    }
    if (dto.warehouseId !== reservation.warehouseId) {
      throw new BadRequestException('La bodega no coincide con la reserva');
    }
    return this.release(id, ReservationStatus.CANCELLED);
  }

  findAll() {
    return this.prisma.reservation.findMany({
      include: { product: true, warehouse: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
