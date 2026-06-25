import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MovementsService } from '../movements/movements.service';
import { MovementType, Prisma, TransferStatus } from '../../generated/prisma';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { ReceiveTransferDto } from './dto/receive-transfer.dto';

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movements: MovementsService,
  ) {}

  async create(dto: CreateTransferDto, userId: string) {
    const existing = await this.prisma.transfer.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) return existing;

    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException(
        'La bodega de origen y destino no pueden ser la misma',
      );
    }

    await this.movements.create(
      {
        productId: dto.productId,
        warehouseId: dto.fromWarehouseId,
        type: MovementType.OUT,
        quantity: dto.quantity,
        reference: `transfer-out:${dto.idempotencyKey}`,
        idempotencyKey: `transfer-out:${dto.idempotencyKey}`,
      },
      userId,
    );

    try {
      return await this.prisma.transfer.create({
        data: {
          productId: dto.productId,
          fromWarehouseId: dto.fromWarehouseId,
          toWarehouseId: dto.toWarehouseId,
          quantity: dto.quantity,
          reference: dto.reference,
          idempotencyKey: dto.idempotencyKey,
          createdById: userId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.prisma.transfer.findUniqueOrThrow({
          where: { idempotencyKey: dto.idempotencyKey },
        });
      }
      throw error;
    }
  }

  async receive(id: string, dto: ReceiveTransferDto, userId: string) {
    const transfer = await this.prisma.transfer.findUnique({ where: { id } });
    if (!transfer) {
      throw new NotFoundException('Transferencia no encontrada');
    }
    if (dto.toWarehouseId !== transfer.toWarehouseId) {
      throw new BadRequestException(
        'La bodega de destino no coincide con la transferencia',
      );
    }
    if (transfer.status === TransferStatus.RECEIVED) {
      return transfer;
    }

    await this.movements.create(
      {
        productId: transfer.productId,
        warehouseId: transfer.toWarehouseId,
        type: MovementType.IN,
        quantity: Number(transfer.quantity),
        reference: `transfer-in:${transfer.id}`,
        idempotencyKey: `transfer-in:${transfer.id}`,
      },
      userId,
    );

    return this.prisma.transfer.update({
      where: { id },
      data: {
        status: TransferStatus.RECEIVED,
        receivedById: userId,
        receivedAt: new Date(),
      },
    });
  }

  findAll() {
    return this.prisma.transfer.findMany({
      include: { product: true, fromWarehouse: true, toWarehouse: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
