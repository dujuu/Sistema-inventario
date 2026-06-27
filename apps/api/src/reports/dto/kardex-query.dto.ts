import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class KardexQueryDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
