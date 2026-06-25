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
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { PurchaseOrdersService } from './purchase-orders.service';

@ApiTags('purchase-orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrders: PurchaseOrdersService) {}

  @Get()
  findAll() {
    return this.purchaseOrders.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.purchaseOrders.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  create(
    @Body() dto: CreatePurchaseOrderDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.purchaseOrders.create(dto, req.user.userId);
  }

  @Post(':id/receive')
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  receive(
    @Param('id') id: string,
    @Body() dto: ReceivePurchaseOrderDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.purchaseOrders.receive(id, dto, req.user.userId);
  }
}
