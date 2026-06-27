import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateCycleCountDto {
  @IsString()
  warehouseId: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];
}
