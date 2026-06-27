import { IsOptional, IsString } from 'class-validator';

export class ValuationQueryDto {
  @IsOptional()
  @IsString()
  warehouseId?: string;
}
