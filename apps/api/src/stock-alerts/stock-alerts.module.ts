import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { StockAlertsController } from './stock-alerts.controller';
import { StockAlertsService } from './stock-alerts.service';
import { StockAlertsProcessor } from './stock-alerts.processor';

@Module({
  imports: [BullModule.registerQueue({ name: 'stock-alerts' })],
  controllers: [StockAlertsController],
  providers: [StockAlertsService, StockAlertsProcessor],
  exports: [BullModule],
})
export class StockAlertsModule {}
