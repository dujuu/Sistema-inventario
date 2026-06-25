import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../../generated/prisma';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    interface ScopedRequest {
      user: { permissions: { warehouseId: string; role: Role }[] };
      params: Record<string, string>;
      query: Record<string, string>;
      body: Record<string, unknown>;
    }
    const request = context.switchToHttp().getRequest<ScopedRequest>();
    const { user } = request;
    const warehouseId =
      request.params?.warehouseId ??
      request.query?.warehouse ??
      (request.body?.warehouseId as string | undefined) ??
      (request.body?.fromWarehouseId as string | undefined) ??
      (request.body?.toWarehouseId as string | undefined);

    const matches = user.permissions.filter((p) =>
      requiredRoles.includes(p.role),
    );
    const authorized = warehouseId
      ? matches.some((p) => p.warehouseId === warehouseId)
      : matches.length > 0;

    if (!authorized) {
      throw new ForbiddenException(
        'No tienes permisos suficientes para esta bodega',
      );
    }
    return true;
  }
}
