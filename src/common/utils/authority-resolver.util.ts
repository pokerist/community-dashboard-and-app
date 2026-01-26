import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LeaseStatus } from '@prisma/client';

@Injectable()
export class AuthorityResolver {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve the current authority for a unit based on active leases
   *
   * This is the single source of truth for permission checks.
   * Unit.status is a cache, not a source of truth.
   * Lease table is the source of truth.
   *
   * @param unitId - Unit ID to resolve authority for
   * @returns 'OWNER' if no active lease, 'TENANT' if active lease exists
   */
  async resolveUnitAuthority(unitId: string): Promise<'OWNER' | 'TENANT'> {
    const activeLease = await this.prisma.lease.findFirst({
      where: {
        unitId,
        status: LeaseStatus.ACTIVE,
      },
      select: { id: true },
    });

    return activeLease ? 'TENANT' : 'OWNER';
  }

  /**
   * Get the current resident (owner or tenant) for a unit
   *
   * @param unitId - Unit ID to get resident for
   * @returns Resident information or null if no resident
   */
  async getCurrentResident(unitId: string) {
    // First check for active lease
    const activeLease = await this.prisma.lease.findFirst({
      where: {
        unitId,
        status: LeaseStatus.ACTIVE,
      },
      include: {
        tenant: true,
      },
    });

    if (activeLease && activeLease.tenantId) {
      const tenantUser = await this.prisma.user.findUnique({
        where: { id: activeLease.tenantId },
        include: {
          resident: true,
        },
      });

      if (tenantUser) {
        return {
          type: 'TENANT' as const,
          resident: tenantUser.resident,
          user: tenantUser,
          leaseId: activeLease.id,
        };
      }
    }

    // Fall back to owner
    const ownerResidentUnit = await this.prisma.residentUnit.findFirst({
      where: {
        unitId,
        isPrimary: true,
      },
      include: {
        resident: {
          include: {
            user: true,
          },
        },
      },
    });

    if (ownerResidentUnit) {
      return {
        type: 'OWNER' as const,
        resident: ownerResidentUnit.resident,
        user: ownerResidentUnit.resident.user,
        leaseId: null,
      };
    }

    return null;
  }

  /**
   * Check if a user has authority to perform family operations on a unit
   *
   * @param userId - User ID to check authority for
   * @param unitId - Unit ID to check authority on
   * @returns true if user has authority, false otherwise
   */
  async hasFamilyAuthority(userId: string, unitId: string): Promise<boolean> {
    const authority = await this.resolveUnitAuthority(unitId);

    if (authority === 'OWNER') {
      // Owner can add family if they have OWNER access to the unit
      const ownerAccess = await this.prisma.unitAccess.findFirst({
        where: {
          userId,
          unitId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      });
      return !!ownerAccess;
    } else {
      // Tenant can add family if they have TENANT access to the unit
      const tenantAccess = await this.prisma.unitAccess.findFirst({
        where: {
          userId,
          unitId,
          role: 'TENANT',
          status: 'ACTIVE',
        },
      });
      return !!tenantAccess;
    }
  }

  /**
   * Get all active units for a resident
   *
   * @param residentId - Resident ID to get active units for
   * @returns Array of active unit IDs
   */
  async getResidentActiveUnits(residentId: string): Promise<string[]> {
    const activeUnits = await this.prisma.residentUnit.findMany({
      where: {
        residentId,
        // Note: We don't filter by active leases here because
        // resident units represent the resident's relationship to units
        // regardless of lease status
      },
      select: { unitId: true },
    });

    return activeUnits.map((unit) => unit.unitId);
  }

  /**
   * Check if a resident has any active units (for deactivation logic)
   *
   * @param residentId - Resident ID to check
   * @returns true if resident has active units, false otherwise
   */
  async residentHasActiveUnits(residentId: string): Promise<boolean> {
    const activeUnits = await this.getResidentActiveUnits(residentId);
    return activeUnits.length > 0;
  }
}
