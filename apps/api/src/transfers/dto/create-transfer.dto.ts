import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateTransferDto {
  @IsString()
  productId: string;

  @IsString()
  fromWarehouseId: string;

  @IsString()
  toWarehouseId: string;

  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsString()
  idempotencyKey: string;
}
