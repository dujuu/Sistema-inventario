import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { StockAlertsService } from './stock-alerts.service';

@Processor('stock-alerts')
export class StockAlertsProcessor extends WorkerHost {
  constructor(private readonly stockAlerts: StockAlertsService) {
    super();
  }

  async process(job: Job<{ productId: string; warehouseId: string }>) {
    if (job.name === 'check') {
      await this.stockAlerts.checkAndUpsert(
        job.data.productId,
        job.data.warehouseId,
      );
    }
  }
}
