import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ReceivePurchaseOrderLineDto {
  @IsString()
  lineId: string;

  @IsNumber()
  quantity: number;
}

export class ReceivePurchaseOrderDto {
  @IsString()
  warehouseId: string;

  @IsString()
  idempotencyKey: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceivePurchaseOrderLineDto)
  lines: ReceivePurchaseOrderLineDto[];
}
