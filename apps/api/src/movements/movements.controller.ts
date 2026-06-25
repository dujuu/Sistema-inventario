import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../../generated/prisma';
import { CreateMovementDto } from './dto/create-movement.dto';
import { MovementsService } from './movements.service';

@ApiTags('movements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('movements')
export class MovementsController {
  constructor(private readonly movements: MovementsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  create(
    @Body() dto: CreateMovementDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.movements.create(dto, req.user.userId);
  }
}
