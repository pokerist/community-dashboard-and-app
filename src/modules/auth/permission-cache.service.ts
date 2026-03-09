// permission-cache.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PERMISSION_KEYS } from './permission-constants';

@Injectable()
export class PermissionCacheService implements OnModuleInit {
  private cache = new Map<string, Set<string>>();
  private moduleAccessCache = new Map<string, Set<string>>(); // roleName → Set<moduleKey>
  private loading = false;

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedPermissions();
    await this.loadWithRetry();
  }

  /** Seed all permission keys from the constants file into the DB (idempotent). */
  private async seedPermissions() {
    try {
      const existing = await this.prisma.permission.findMany({
        select: { key: true },
      });
      const existingKeys = new Set(existing.map((p) => p.key));
      const toCreate = PERMISSION_KEYS.filter((k) => !existingKeys.has(k));
      if (toCreate.length > 0) {
        await this.prisma.permission.createMany({
          data: toCreate.map((key) => ({ key })),
          skipDuplicates: true,
        });
        console.log(`Seeded ${toCreate.length} new permission(s)`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('Warning: could not seed permissions:', message);
    }
  }

  private async loadWithRetry(maxRetries = 3, delayMs = 500) {
    if (this.loading) return; // prevent double-loading
    this.loading = true;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.load();
        console.log('Permissions loaded successfully');
        return;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt === maxRetries) {
          console.error(
            'Failed to load permissions after retries:',
            message,
          );
          return;
        }
        console.warn(
          `Retry ${attempt}/${maxRetries} for permissions loading in ${delayMs * attempt}ms...`,
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
        moduleAccess: true,
      },
    });

    this.cache.clear();
    this.moduleAccessCache.clear();
    for (const role of roles) {
      const perms = new Set(role.permissions.map((rp) => rp.permission.key));
      this.cache.set(role.name, perms);

      const modules = new Set(
        role.moduleAccess
          .filter((ma) => ma.canAccess)
          .map((ma) => ma.moduleKey),
      );
      this.moduleAccessCache.set(role.name, modules);
    }
  }

  getPermissions(roleName: string): Set<string> {
    return this.cache.get(roleName) || new Set();
  }

  getModuleAccess(roleName: string): Set<string> {
    return this.moduleAccessCache.get(roleName) || new Set();
  }

  async refresh() {
    this.loading = false;
    await this.loadWithRetry();
  }

  resolveUserPermissions(roleNames: string[]): Set<string> {
    const permissions = new Set<string>();
    for (const role of roleNames) {
      this.getPermissions(role).forEach((p) => permissions.add(p));
    }
    return permissions;
  }

  resolveUserModules(roleNames: string[]): Set<string> {
    const modules = new Set<string>();
    for (const role of roleNames) {
      this.getModuleAccess(role).forEach((m) => modules.add(m));
    }
    return modules;
  }
}
