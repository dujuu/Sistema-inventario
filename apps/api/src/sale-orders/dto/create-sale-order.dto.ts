import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SaleOrderLineDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreateSaleOrderDto {
  @IsString()
  warehouseId: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsString()
  idempotencyKey: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleOrderLineDto)
  lines: SaleOrderLineDto[];
}
