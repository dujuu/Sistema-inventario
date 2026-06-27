import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';
import { KardexQueryDto } from './dto/kardex-query.dto';
import { ValuationQueryDto } from './dto/valuation-query.dto';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('stock-valuation')
  stockValuation(@Query() dto: ValuationQueryDto) {
    return this.reports.stockValuation(dto);
  }

  @Get('kardex')
  kardex(@Query() dto: KardexQueryDto) {
    return this.reports.kardex(dto);
  }
}
