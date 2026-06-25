import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login({ email, password }: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { warehousePermissions: true },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const permissions = user.warehousePermissions.map((p) => ({
      warehouseId: p.warehouseId,
      role: p.role,
    }));

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      permissions,
    });

    return {
      accessToken,
      user: { id: user.id, email: user.email, name: user.name, permissions },
    };
  }
}
