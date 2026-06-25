import { IsString } from 'class-validator';

export class CreateWarehouseDto {
  @IsString()
  code: string;

  @IsString()
  name: string;
}
