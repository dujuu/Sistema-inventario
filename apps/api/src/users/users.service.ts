import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

function omitPasswordHash<T extends { passwordHash: string }>(user: T) {
  return { ...user, passwordHash: undefined };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create({ email, password, name, warehousePermissions }: CreateUserDto) {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        warehousePermissions: { create: warehousePermissions },
      },
      include: { warehousePermissions: true },
    });
    return omitPasswordHash(user);
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      include: { warehousePermissions: true },
    });
    return users.map(omitPasswordHash);
  }
}
