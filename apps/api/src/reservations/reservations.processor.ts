import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ReservationStatus } from '../../generated/prisma';
import { ReservationsService } from './reservations.service';

@Processor('reservations')
export class ReservationsProcessor extends WorkerHost {
  constructor(private readonly reservations: ReservationsService) {
    super();
  }

  async process(job: Job<{ reservationId: string }>) {
    if (job.name === 'expire') {
      await this.reservations.release(
        job.data.reservationId,
        ReservationStatus.EXPIRED,
      );
    }
  }
}
