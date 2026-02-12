import { ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Helper function to get active unit access for a user and unit.
 * This is the single source of truth for checking user access to units.
 *
 * @param prisma - Prisma client instance
 * @param userId - User ID to check access for
 * @param unitId - Unit ID to check access to
 * @returns The active unit access record
 * @throws ForbiddenException if no active access found
 */
export async function getActiveUnitAccess(
  prisma: PrismaClient,
  userId: string,
  unitId: string,
) {
  const now = new Date();
  const access = await prisma.unitAccess.findFirst({
    where: {
      userId,
      unitId,
      status: 'ACTIVE',
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gte: now } }],
    },
  });

  if (!access) {
    throw new ForbiddenException('No active access to this unit');
  }

  return access;
}
