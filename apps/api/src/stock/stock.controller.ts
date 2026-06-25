import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { StockService } from './stock.service';

@ApiTags('stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get()
  findAll(
    @Query('product') product?: string,
    @Query('warehouse') warehouse?: string,
  ) {
    return this.stock.findAll(product, warehouse);
  }
}
