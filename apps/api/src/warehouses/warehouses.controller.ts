import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { WarehousesService } from './warehouses.service';

@ApiTags('warehouses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly warehouses: WarehousesService) {}

  @Get()
  findAll() {
    return this.warehouses.findAll();
  }

  @Post()
  create(@Body() dto: CreateWarehouseDto) {
    return this.warehouses.create(dto);
  }
}
