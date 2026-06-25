import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Role } from '../../../generated/prisma';

export class WarehousePermissionDto {
  @IsString()
  warehouseId: string;

  @IsIn(['ADMIN', 'SUPERVISOR', 'OPERATOR', 'READONLY'])
  role: Role;
}

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WarehousePermissionDto)
  warehousePermissions: WarehousePermissionDto[];
}
