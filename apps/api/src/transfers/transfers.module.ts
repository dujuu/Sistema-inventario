import { Module } from '@nestjs/common';
import { MovementsModule } from '../movements/movements.module';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';

@Module({
  imports: [MovementsModule],
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}
