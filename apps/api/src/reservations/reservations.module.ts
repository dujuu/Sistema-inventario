import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { ReservationsProcessor } from './reservations.processor';

@Module({
  imports: [BullModule.registerQueue({ name: 'reservations' })],
  controllers: [ReservationsController],
  providers: [ReservationsService, ReservationsProcessor],
})
export class ReservationsModule {}
