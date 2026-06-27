import { IsString } from 'class-validator';

export class ResolveCountDto {
  @IsString()
  warehouseId: string;
}
