import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../../generated/prisma';
import { StockAlertsService } from './stock-alerts.service';
import { SetReorderPointDto } from './dto/set-reorder-point.dto';

@ApiTags('stock-alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class StockAlertsController {
  constructor(private readonly stockAlerts: StockAlertsService) {}

  @Get('stock-alerts')
  findAll() {
    return this.stockAlerts.findAll();
  }

  @Post('stock-alerts/:id/dismiss')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  dismiss(@Param('id') id: string) {
    return this.stockAlerts.dismiss(id);
  }

  @Patch('stock/:productId/:warehouseId/reorder-point')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  setReorderPoint(
    @Param('productId') productId: string,
    @Param('warehouseId') warehouseId: string,
    @Body() dto: SetReorderPointDto,
  ) {
    return this.stockAlerts.setReorderPoint(productId, warehouseId, dto);
  }
}
