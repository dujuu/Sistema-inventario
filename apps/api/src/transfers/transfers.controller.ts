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
import { CreateTransferDto } from './dto/create-transfer.dto';
import { ReceiveTransferDto } from './dto/receive-transfer.dto';
import { TransfersService } from './transfers.service';

@ApiTags('transfers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  @Get()
  findAll() {
    return this.transfers.findAll();
  }

  @Post()
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  create(
    @Body() dto: CreateTransferDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.transfers.create(dto, req.user.userId);
  }

  @Post(':id/receive')
  @Roles(Role.ADMIN, Role.SUPERVISOR, Role.OPERATOR)
  receive(
    @Param('id') id: string,
    @Body() dto: ReceiveTransferDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.transfers.receive(id, dto, req.user.userId);
  }
}
