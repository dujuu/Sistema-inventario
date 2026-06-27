import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MovementsController } from './movements.controller';
import { MovementsService } from './movements.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'stock-alerts' })],
  controllers: [MovementsController],
  providers: [MovementsService],
  exports: [MovementsService],
})
export class MovementsModule {}
