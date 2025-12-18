import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// roleName -> Set(permissionKey)
export const ROLE_PERMISSION_MAP = new Map<string, Set<string>>()

export async function loadPermissionsIntoCache() {
  const roles = await prisma.role.findMany({
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
    },
  })

  ROLE_PERMISSION_MAP.clear()

  for (const role of roles) {
    const perms = new Set(
      role.permissions.map((rp) => rp.permission.key)
    )
    ROLE_PERMISSION_MAP.set(role.name, perms)
  }

  console.log("✅ Permissions cached in memory")
}
