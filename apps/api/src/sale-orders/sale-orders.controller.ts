import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../../generated/prisma';
import { SaleOrdersService } from './sale-orders.service';
import { CreateSaleOrderDto } from './dto/create-sale-order.dto';
import { DispatchSaleOrderDto } from './dto/dispatch-sale-order.dto';

@ApiTags('sale-orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sale-orders')
export class SaleOrdersController {
  constructor(private readonly saleOrders: SaleOrdersService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  create(
    @Body() dto: CreateSaleOrderDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.saleOrders.create(dto, req.user.userId);
  }

  @Get()
  findAll() {
    return this.saleOrders.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.saleOrders.findOne(id);
  }

  @Post(':id/dispatch')
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  dispatch(
    @Param('id') id: string,
    @Body() dto: DispatchSaleOrderDto,
    @Req() req: { user: { userId: string } },
  ) {
    void dto;
    return this.saleOrders.dispatch(id, req.user.userId);
  }

  @Post(':id/cancel')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  cancel(@Param('id') id: string, @Body() dto: DispatchSaleOrderDto) {
    void dto;
    return this.saleOrders.cancel(id);
  }
}
