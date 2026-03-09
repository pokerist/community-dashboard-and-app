// permissions.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../../prisma/prisma.service';
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.get<string[]>(
      'permissions',
      context.getHandler(),
    );
    if (!required) return true;

    const { user } = context.switchToHttp().getRequest();

    // Allow SUPER_ADMIN role to bypass permission checks (case-insensitive)
    if (
      user?.roles?.some(
        (r: string) =>
          typeof r === 'string' && r.toUpperCase() === 'SUPER_ADMIN',
      )
    ) {
      return true;
    }

    // Fallback to checking explicit permissions on the user
    const userPerms = Array.isArray(user?.permissions) ? user.permissions : [];
    return required.some((p) => userPerms.includes(p));
  }
}
