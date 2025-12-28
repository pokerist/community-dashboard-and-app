// permissions.guard.ts
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionCacheService } from "../permission-cache.service";
import { PrismaService } from "../../../../prisma/prisma.service";
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    private cache: PermissionCacheService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.get<string[]>('permissions', context.getHandler());
    if (!required) return true;

    const { user } = context.switchToHttp().getRequest();
    return required.every(p => user.permissions?.includes(p));
  }
}
