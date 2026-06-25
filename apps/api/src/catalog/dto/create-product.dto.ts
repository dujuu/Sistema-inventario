import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateProductDto {
  @IsString()
  sku: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsString()
  name: string;

  @IsString()
  unit: string;

  @IsNumber()
  @Min(0)
  cost: number;
}
