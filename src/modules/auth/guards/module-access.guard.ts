import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionCacheService } from '../permission-cache.service';

@Injectable()
export class ModuleAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionCache: PermissionCacheService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredModules = this.reflector.getAllAndOverride<string[]>(
      'requiredModules',
      [context.getHandler(), context.getClass()],
    );
    if (!requiredModules || requiredModules.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();

    // SUPER_ADMIN bypasses module access checks
    if (
      user?.roles?.some(
        (r: string) =>
          typeof r === 'string' && r.toUpperCase() === 'SUPER_ADMIN',
      )
    ) {
      return true;
    }

    const roleNames: string[] = Array.isArray(user?.roles) ? user.roles : [];
    const userModules = this.permissionCache.resolveUserModules(roleNames);

    const hasAccess = requiredModules.some((m) => userModules.has(m));
    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have access to this module',
      );
    }
    return true;
  }
}
