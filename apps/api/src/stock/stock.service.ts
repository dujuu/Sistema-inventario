import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(productId?: string, warehouseId?: string) {
    return this.prisma.stock.findMany({
      where: { productId, warehouseId },
      include: { product: true, warehouse: true },
    });
  }
}
