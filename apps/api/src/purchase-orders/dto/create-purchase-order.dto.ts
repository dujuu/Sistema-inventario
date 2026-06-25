import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CreatePurchaseOrderLineDto {
  @IsString()
  productId: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  unitCost: number;
}

export class CreatePurchaseOrderDto {
  @IsString()
  supplierId: string;

  @IsString()
  warehouseId: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsString()
  idempotencyKey: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderLineDto)
  lines: CreatePurchaseOrderLineDto[];
}
