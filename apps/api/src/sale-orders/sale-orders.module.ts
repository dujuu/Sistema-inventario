import { Module } from '@nestjs/common';
import { SaleOrdersController } from './sale-orders.controller';
import { SaleOrdersService } from './sale-orders.service';
import { MovementsModule } from '../movements/movements.module';

@Module({
  imports: [MovementsModule],
  controllers: [SaleOrdersController],
  providers: [SaleOrdersService],
})
export class SaleOrdersModule {}
