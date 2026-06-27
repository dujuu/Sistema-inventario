import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../../generated/prisma';
import { CycleCountsService } from './cycle-counts.service';
import { CreateCycleCountDto } from './dto/create-cycle-count.dto';
import { UpdateLineDto } from './dto/update-line.dto';
import { ResolveCountDto } from './dto/resolve-count.dto';

@ApiTags('cycle-counts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cycle-counts')
export class CycleCountsController {
  constructor(private readonly cycleCounts: CycleCountsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  create(
    @Body() dto: CreateCycleCountDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.cycleCounts.create(dto, req.user.userId);
  }

  @Get()
  findAll() {
    return this.cycleCounts.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cycleCounts.findOne(id);
  }

  @Patch(':id/lines/:lineId')
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  updateLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateLineDto,
  ) {
    return this.cycleCounts.updateLine(id, lineId, dto);
  }

  @Post(':id/commit')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  commit(
    @Param('id') id: string,
    @Body() dto: ResolveCountDto,
    @Req() req: { user: { userId: string } },
  ) {
    void dto; // warehouseId consumed by RolesGuard
    return this.cycleCounts.commit(id, req.user.userId);
  }

  @Post(':id/cancel')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  cancel(@Param('id') id: string, @Body() dto: ResolveCountDto) {
    void dto;
    return this.cycleCounts.cancel(id);
  }
}
