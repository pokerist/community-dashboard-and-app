// permission-cache.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class PermissionCacheService implements OnModuleInit {
  private cache = new Map<string, Set<string>>();
  private loading = false;

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.loadWithRetry();
  }

  private async loadWithRetry(maxRetries = 3, delayMs = 500) {
    if (this.loading) return; // prevent double-loading
    this.loading = true;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.load();
        console.log('✅ Permissions loaded successfully');
        return;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt === maxRetries) {
          console.error(
            '❌ Failed to load permissions after retries:',
            message,
          );
          return;
        }
        console.warn(
          `⚠️ Retry ${attempt}/${maxRetries} for permissions loading in ${delayMs * attempt}ms...`,
          message,
        );
        await new Promise((res) => setTimeout(res, delayMs * attempt));
      }
    }
  }

  private async load() {
    const roles = await this.prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
      },
    });

    this.cache.clear();
    for (const role of roles) {
      const perms = new Set(role.permissions.map((rp) => rp.permission.key));
      this.cache.set(role.name, perms);
    }
  }

  getPermissions(roleName: string): Set<string> {
    return this.cache.get(roleName) || new Set();
  }

  resolveUserPermissions(roleNames: string[]): Set<string> {
    const permissions = new Set<string>();
    for (const role of roleNames) {
      this.getPermissions(role).forEach((p) => permissions.add(p));
    }
    return permissions;
  }
}
