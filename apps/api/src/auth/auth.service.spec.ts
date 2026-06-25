import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let prisma: { user: { findUnique: jest.Mock } };
  let jwt: { signAsync: jest.Mock };
  let service: AuthService;

  const dbUser = {
    id: 'user-1',
    email: 'admin@inventario.local',
    name: 'Admin',
    passwordHash: 'hashed',
    warehousePermissions: [{ warehouseId: 'wh-1', role: Role.ADMIN }],
  };

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    jwt = { signAsync: jest.fn().mockResolvedValue('signed-token') };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
    );
  });

  it('returns an access token and permissions for valid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(dbUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.login({
      email: dbUser.email,
      password: 'admin123',
    });

    expect(result.accessToken).toBe('signed-token');
    expect(result.user.permissions).toEqual([
      { warehouseId: 'wh-1', role: Role.ADMIN },
    ]);
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: dbUser.id,
      email: dbUser.email,
      permissions: [{ warehouseId: 'wh-1', role: Role.ADMIN }],
    });
  });

  it('throws for an unknown email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ email: 'nobody@x.local', password: 'whatever' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws for a wrong password', async () => {
    prisma.user.findUnique.mockResolvedValue(dbUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({ email: dbUser.email, password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
