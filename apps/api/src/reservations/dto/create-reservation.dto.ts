import { IsISO8601, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateReservationDto {
  @IsString()
  productId: string;

  @IsString()
  warehouseId: string;

  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @IsString()
  idempotencyKey: string;
}
