import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { MovementType } from '../../../generated/prisma';

export class CreateMovementDto {
  @IsString()
  productId: string;

  @IsString()
  warehouseId: string;

  @IsIn(['IN', 'OUT', 'ADJUSTMENT'])
  type: MovementType;

  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsString()
  idempotencyKey: string;
}
