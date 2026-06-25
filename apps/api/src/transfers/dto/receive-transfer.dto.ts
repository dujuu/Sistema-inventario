import { IsString } from 'class-validator';

export class ReceiveTransferDto {
  @IsString()
  toWarehouseId: string;
}
