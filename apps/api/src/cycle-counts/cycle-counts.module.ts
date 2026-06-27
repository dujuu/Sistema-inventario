import { Module } from '@nestjs/common';
import { CycleCountsController } from './cycle-counts.controller';
import { CycleCountsService } from './cycle-counts.service';
import { MovementsModule } from '../movements/movements.module';

@Module({
  imports: [MovementsModule],
  controllers: [CycleCountsController],
  providers: [CycleCountsService],
})
export class CycleCountsModule {}
