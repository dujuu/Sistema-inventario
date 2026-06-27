import { IsString } from 'class-validator';

export class ResolveReservationDto {
  @IsString()
  warehouseId: string;
}
