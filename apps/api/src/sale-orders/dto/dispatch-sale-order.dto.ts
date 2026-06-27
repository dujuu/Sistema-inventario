import { IsString } from 'class-validator';

export class DispatchSaleOrderDto {
  @IsString()
  warehouseId: string;
}
