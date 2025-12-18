import { ROLE_PERMISSION_MAP } from "./permission-cache"

export function resolveUserPermissions(roleNames: string[]) {
  const permissions = new Set<string>()

  for (const roleName of roleNames) {
    const rolePerms = ROLE_PERMISSION_MAP.get(roleName)
    if (!rolePerms) continue

    rolePerms.forEach((p) => permissions.add(p))
  }

  return permissions
}
