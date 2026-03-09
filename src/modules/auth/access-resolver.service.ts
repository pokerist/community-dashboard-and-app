import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ScreenSurface, UnitStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PermissionCacheService } from './permission-cache.service';

type ResolveAccessOptions = {
  surface?: ScreenSurface;
  unitId?: string;
};

type ScreenCapability = {
  section: string;
  requiredPermissions: string[];
  missingPermissions: string[];
  allowed: boolean;
};

type EffectiveAccessPayload = {
  userId: string;
  surface: ScreenSurface;
  unitStatuses: UnitStatus[];
  effectivePermissions: string[];
  effectiveModules: string[];
  effectivePersonas: string[];
  visibleScreens: string[];
  screenCapabilities: ScreenCapability[];
};

const ALL_UNIT_STATUSES: UnitStatus[] = [
  UnitStatus.OFF_PLAN,
  UnitStatus.UNDER_CONSTRUCTION,
  UnitStatus.DELIVERED,
];

@Injectable()
export class AccessResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionCache: PermissionCacheService,
  ) {}

  private deriveBuiltInPersonas(
    user: Prisma.UserGetPayload<{
      include: {
        roles: {
          include: {
            role: {
              include: {
                personas: {
                  include: {
                    persona: true;
                  };
                };
              };
            };
          };
        };
        admin: true;
        owner: true;
        tenant: true;
        resident: true;
        unitAccesses: {
          include: {
            unit: {
              select: { status: true };
            };
          };
        };
        commercialEntityMemberships: true;
      };
    }>,
  ): Set<string> {
    const personas = new Set<string>();

    for (const userRole of user.roles) {
      const roleName = userRole.role.name?.trim();
      if (!roleName) continue;
      personas.add(`ROLE_${roleName.toUpperCase()}`);

      if (roleName.toUpperCase() === 'SUPER_ADMIN') {
        personas.add('SUPER_ADMIN');
      }
      if (roleName.toUpperCase().includes('ADMIN')) {
        personas.add('ADMIN');
      }
      if (
        roleName.toUpperCase().includes('MANAGER') ||
        roleName.toUpperCase().includes('STAFF')
      ) {
        personas.add('STAFF');
      }
    }

    if (user.owner) personas.add('OWNER');
    if (user.tenant) personas.add('TENANT');
    if (user.resident) personas.add('RESIDENT');

    for (const access of user.unitAccesses) {
      personas.add(String(access.role).toUpperCase());
    }

    for (const member of user.commercialEntityMemberships) {
      personas.add(`COMMERCIAL_${String(member.role).toUpperCase()}`);
    }

    return personas;
  }

  private async resolveEffectivePersonas(
    user: Prisma.UserGetPayload<{
      include: {
        roles: {
          include: {
            role: {
              include: {
                personas: {
                  include: {
                    persona: true;
                  };
                };
              };
            };
          };
        };
        admin: true;
        owner: true;
        tenant: true;
        resident: true;
        unitAccesses: {
          include: {
            unit: {
              select: { status: true };
            };
          };
        };
        commercialEntityMemberships: true;
        personaOverrides: {
          include: {
            persona: true;
          };
        };
      };
    }>,
  ): Promise<{ keys: string[]; ids: string[] }> {
    const personas = this.deriveBuiltInPersonas(user);

    for (const userRole of user.roles) {
      for (const rp of userRole.role.personas) {
        if (rp.persona?.key) {
          personas.add(rp.persona.key);
        }
      }
    }

    for (const override of user.personaOverrides) {
      if (!override.persona?.key) continue;
      if (override.grant) {
        personas.add(override.persona.key);
      } else {
        personas.delete(override.persona.key);
      }
    }

    const personaRows = await this.prisma.persona.findMany({
      where: { key: { in: Array.from(personas) } },
      select: { id: true, key: true },
    });

    const known = new Set(personaRows.map((row) => row.key));
    for (const key of known) {
      personas.add(key);
    }

    return {
      keys: Array.from(personas).sort(),
      ids: personaRows.map((row) => row.id),
    };
  }

  private async resolveUnitStatuses(
    user: Prisma.UserGetPayload<{
      include: {
        unitAccesses: {
          include: {
            unit: {
              select: { status: true };
            };
          };
        };
      };
    }>,
    unitId?: string,
  ): Promise<UnitStatus[]> {
    if (unitId) {
      const unit = await this.prisma.unit.findUnique({
        where: { id: unitId },
        select: { status: true },
      });
      if (unit?.status) {
        return [unit.status];
      }
      return ALL_UNIT_STATUSES;
    }

    const statuses = new Set<UnitStatus>();
    for (const access of user.unitAccesses) {
      if (access.unit?.status) {
        statuses.add(access.unit.status);
      }
    }

    if (statuses.size === 0) {
      return ALL_UNIT_STATUSES;
    }

    return Array.from(statuses);
  }

  private async resolveEffectivePermissions(
    user: Prisma.UserGetPayload<{
      include: {
        roles: { include: { role: true } };
        permissionOverrides: {
          include: { permission: { select: { key: true } } };
        };
      };
    }>,
    unitStatuses: UnitStatus[],
  ): Promise<Set<string>> {
    const roleNames = user.roles.map((ur) => ur.role.name);
    const roleIds = user.roles.map((ur) => ur.roleId);
    const merged = this.permissionCache.resolveUserPermissions(roleNames);

    if (roleIds.length > 0 && unitStatuses.length > 0) {
      const statusPermissions = await this.prisma.roleStatusPermission.findMany({
        where: {
          roleId: { in: roleIds },
          unitStatus: { in: unitStatuses },
        },
        include: { permission: { select: { key: true } } },
      });
      for (const row of statusPermissions) {
        merged.add(row.permission.key);
      }
    }

    for (const override of user.permissionOverrides) {
      if (override.grant) {
        merged.add(override.permission.key);
      } else {
        merged.delete(override.permission.key);
      }
    }

    return merged;
  }

  private async resolveVisibleScreens(params: {
    isSuperAdmin: boolean;
    surface: ScreenSurface;
    unitStatuses: UnitStatus[];
    personaIds: string[];
    moduleSet: Set<string>;
  }): Promise<{
    screens: Array<{ id: string; key: string; section: string; moduleKey: string | null }>;
    visibleSections: string[];
  }> {
    const { isSuperAdmin, surface, unitStatuses, personaIds, moduleSet } = params;

    const screens = await this.prisma.screenDefinition.findMany({
      where: { isEnabled: true, surface },
      orderBy: [{ section: 'asc' }, { key: 'asc' }],
      select: {
        id: true,
        key: true,
        section: true,
        moduleKey: true,
      },
    });

    if (isSuperAdmin) {
      return {
        screens,
        visibleSections: screens.map((screen) => screen.section).sort(),
      };
    }

    const rules =
      personaIds.length > 0
        ? await this.prisma.screenVisibilityRule.findMany({
            where: {
              surface,
              personaId: { in: personaIds },
              unitStatus: { in: unitStatuses },
            },
            select: {
              screenId: true,
              visible: true,
            },
          })
        : [];

    const ruleMap = new Map<string, boolean[]>();
    for (const rule of rules) {
      const current = ruleMap.get(rule.screenId) ?? [];
      current.push(rule.visible);
      ruleMap.set(rule.screenId, current);
    }

    const visibleSections = new Set<string>();
    for (const screen of screens) {
      const decisions = ruleMap.get(screen.id) ?? [];
      let visible: boolean;

      if (decisions.length > 0) {
        visible = decisions.some((decision) => decision === true);
      } else if (screen.section === 'my-account') {
        visible = true;
      } else if (screen.moduleKey) {
        visible = moduleSet.has(screen.moduleKey);
      } else {
        visible = false;
      }

      if (visible) {
        visibleSections.add(screen.section);
      }
    }

    return {
      screens,
      visibleSections: Array.from(visibleSections).sort(),
    };
  }

  private async resolveScreenCapabilities(params: {
    surface: ScreenSurface;
    roleIds: string[];
    isSuperAdmin: boolean;
    permissions: Set<string>;
    visibleSections: string[];
  }): Promise<ScreenCapability[]> {
    const { surface, roleIds, isSuperAdmin, permissions, visibleSections } = params;

    const screens = await this.prisma.screenDefinition.findMany({
      where: { surface, isEnabled: true },
      orderBy: [{ section: 'asc' }, { key: 'asc' }],
      include: {
        bundles: {
          include: {
            items: {
              include: {
                permission: { select: { key: true } },
              },
            },
          },
        },
      },
    });

    const visibilitySet = new Set(visibleSections);

    const screenIds = screens.map((screen) => screen.id);
    const overrides =
      roleIds.length > 0 && screenIds.length > 0
        ? await this.prisma.roleScreenBundleOverride.findMany({
            where: {
              roleId: { in: roleIds },
              screenId: { in: screenIds },
            },
            include: {
              permission: { select: { key: true } },
            },
          })
        : [];

    const overrideMap = new Map<string, boolean[]>();
    for (const row of overrides) {
      const key = `${row.screenId}::${row.permission.key}`;
      const current = overrideMap.get(key) ?? [];
      current.push(row.grant);
      overrideMap.set(key, current);
    }

    const bySection = new Map<string, ScreenCapability>();

    for (const screen of screens) {
      const required = new Set<string>();
      for (const bundle of screen.bundles) {
        for (const item of bundle.items) {
          if (item.required) {
            required.add(item.permission.key);
          }
        }
      }

      const requiredPermissions = Array.from(required).sort();
      const missingPermissions: string[] = [];

      if (!isSuperAdmin) {
        for (const permissionKey of requiredPermissions) {
          const decisions = overrideMap.get(`${screen.id}::${permissionKey}`) ?? [];
          const grantedByOverride = decisions.includes(true);
          const deniedByOverride = decisions.includes(false);
          const granted = grantedByOverride || (!deniedByOverride && permissions.has(permissionKey));
          if (!granted) {
            missingPermissions.push(permissionKey);
          }
        }
      }

      const sectionVisible = isSuperAdmin || visibilitySet.has(screen.section);
      const capability: ScreenCapability = {
        section: screen.section,
        requiredPermissions,
        missingPermissions,
        allowed: sectionVisible && (isSuperAdmin || missingPermissions.length === 0),
      };

      const existing = bySection.get(screen.section);
      if (!existing) {
        bySection.set(screen.section, capability);
        continue;
      }

      const preferred =
        capability.allowed && !existing.allowed
          ? capability
          : existing.allowed === capability.allowed &&
              capability.missingPermissions.length < existing.missingPermissions.length
            ? capability
            : existing;
      bySection.set(screen.section, preferred);
    }

    return Array.from(bySection.values()).sort((a, b) =>
      a.section.localeCompare(b.section),
    );
  }

  async resolveUserAccess(
    userId: string,
    options?: ResolveAccessOptions,
  ): Promise<EffectiveAccessPayload> {
    const surface = options?.surface ?? ScreenSurface.ADMIN_WEB;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                personas: {
                  include: {
                    persona: true,
                  },
                },
              },
            },
          },
        },
        admin: true,
        owner: true,
        tenant: true,
        resident: true,
        unitAccesses: {
          where: { status: 'ACTIVE' },
          include: {
            unit: {
              select: { status: true },
            },
          },
        },
        commercialEntityMemberships: {
          where: { isActive: true, deletedAt: null },
        },
        permissionOverrides: {
          include: {
            permission: {
              select: { key: true },
            },
          },
        },
        personaOverrides: {
          include: { persona: true },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const roleNames = user.roles.map((row) => row.role.name);
    const roleIds = user.roles.map((row) => row.roleId);
    const isSuperAdmin = roleNames.some(
      (name) => name.toUpperCase() === 'SUPER_ADMIN',
    );

    const unitStatuses = await this.resolveUnitStatuses(user, options?.unitId);
    const permissions = await this.resolveEffectivePermissions(user, unitStatuses);
    const modules = this.permissionCache.resolveUserModules(roleNames);
    const personaResolution = await this.resolveEffectivePersonas(user);
    const visibleResolution = await this.resolveVisibleScreens({
      isSuperAdmin,
      surface,
      unitStatuses,
      personaIds: personaResolution.ids,
      moduleSet: modules,
    });
    const screenCapabilities = await this.resolveScreenCapabilities({
      surface,
      roleIds,
      isSuperAdmin,
      permissions,
      visibleSections: visibleResolution.visibleSections,
    });

    return {
      userId,
      surface,
      unitStatuses,
      effectivePermissions: Array.from(permissions).sort(),
      effectiveModules: Array.from(modules).sort(),
      effectivePersonas: personaResolution.keys,
      visibleScreens: visibleResolution.visibleSections,
      screenCapabilities,
    };
  }
}
