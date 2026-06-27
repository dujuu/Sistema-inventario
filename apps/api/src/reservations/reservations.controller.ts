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
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ResolveReservationDto } from './dto/resolve-reservation.dto';
import { ReservationsService } from './reservations.service';

@ApiTags('reservations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Get()
  findAll() {
    return this.reservations.findAll();
  }

  @Post()
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  create(
    @Body() dto: CreateReservationDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.reservations.create(dto, req.user.userId);
  }

  @Post(':id/dispatch')
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  dispatch(
    @Param('id') id: string,
    @Body() dto: ResolveReservationDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.reservations.dispatch(id, dto, req.user.userId);
  }

  @Post(':id/cancel')
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  cancel(@Param('id') id: string, @Body() dto: ResolveReservationDto) {
    return this.reservations.cancel(id, dto);
  }
}
