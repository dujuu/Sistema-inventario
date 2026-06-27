import { IsNumber, IsOptional, Min } from 'class-validator';

export class SetReorderPointDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderPoint?: number | null;
}
