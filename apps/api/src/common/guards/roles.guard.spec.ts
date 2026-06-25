import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../../generated/prisma';
import { RolesGuard } from './roles.guard';

function buildContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
    guard = new RolesGuard(reflector);
  });

  it('allows the request when no roles are required', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    const context = buildContext({ user: { permissions: [] } });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows when the user has the role in any warehouse and none is requested', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.ADMIN]);
    const context = buildContext({
      user: { permissions: [{ warehouseId: 'wh-1', role: Role.ADMIN }] },
      params: {},
      query: {},
      body: {},
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('forbids when the user has no matching role anywhere', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.ADMIN]);
    const context = buildContext({
      user: { permissions: [{ warehouseId: 'wh-1', role: Role.OPERATOR }] },
      params: {},
      query: {},
      body: {},
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows when the matching role is scoped to the requested warehouse', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.OPERATOR]);
    const context = buildContext({
      user: {
        permissions: [
          { warehouseId: 'wh-1', role: Role.OPERATOR },
          { warehouseId: 'wh-2', role: Role.READONLY },
        ],
      },
      params: {},
      query: {},
      body: { warehouseId: 'wh-1' },
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('forbids when the matching role is scoped to a different warehouse', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.OPERATOR]);
    const context = buildContext({
      user: { permissions: [{ warehouseId: 'wh-2', role: Role.OPERATOR }] },
      params: {},
      query: {},
      body: { warehouseId: 'wh-1' },
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
