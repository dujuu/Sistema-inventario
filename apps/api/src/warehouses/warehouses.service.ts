import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateWarehouseDto) {
    return this.prisma.warehouse.create({ data: dto });
  }

  findAll() {
    return this.prisma.warehouse.findMany();
  }
}
