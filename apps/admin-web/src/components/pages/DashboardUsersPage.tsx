import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import apiClient from "../../lib/api-client";
import { errorMessage } from "../../lib/live-data";
import { toast } from "sonner";

type DashboardUserRow = {
  id: string;
  email?: string | null;
  nameEN?: string | null;
  phone?: string | null;
  userStatus?: string | null;
  roles?: Array<{ role?: { id?: string; name?: string } }>;
};

type RoleRow = {
  id: string;
  name: string;
  permissions?: Array<{ permission?: { key?: string } }>;
  users?: Array<{ userId: string }>;
};

type PermissionRow = { id: string; key: string };

type PermissionGroup = {
  module: string;
  items: PermissionRow[];
};

function getPermissionModule(key: string) {
  const [prefix] = key.split(".");
  return prefix || "misc";
}

export function DashboardUsersPage() {
  const [users, setUsers] = useState<DashboardUserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleName, setRoleName] = useState("");
  const [selectedPermissionKeys, setSelectedPermissionKeys] = useState<string[]>([]);
  const [permissionSearch, setPermissionSearch] = useState("");
  const [expandedModules, setExpandedModules] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes, permsRes] = await Promise.all([
        apiClient.get<DashboardUserRow[]>("/admin/users/dashboard"),
        apiClient.get<RoleRow[]>("/admin/users/roles"),
        apiClient.get<PermissionRow[]>("/admin/users/permissions"),
      ]);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      setRoles(Array.isArray(rolesRes.data) ? rolesRes.data : []);
      setPermissions(Array.isArray(permsRes.data) ? permsRes.data : []);
    } catch (error) {
      toast.error("Failed to load dashboard users data", { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.nameEN, u.email, u.phone, ...(u.roles ?? []).map((r) => r.role?.name)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [search, users]);

  const groupedPermissions = useMemo<PermissionGroup[]>(() => {
    const q = permissionSearch.trim().toLowerCase();
    const filtered = q
      ? permissions.filter((perm) => perm.key.toLowerCase().includes(q))
      : permissions;

    const map = new Map<string, PermissionRow[]>();
    for (const perm of filtered) {
      const moduleName = getPermissionModule(perm.key);
      const group = map.get(moduleName) ?? [];
      group.push(perm);
      map.set(moduleName, group);
    }

    return Array.from(map.entries())
      .map(([module, items]) => ({
        module,
        items: [...items].sort((a, b) => a.key.localeCompare(b.key)),
      }))
      .sort((a, b) => a.module.localeCompare(b.module));
  }, [permissionSearch, permissions]);

  const allFilteredPermissionKeys = useMemo(
    () => groupedPermissions.flatMap((group) => group.items.map((item) => item.key)),
    [groupedPermissions],
  );

  const permissionModules = useMemo(
    () => Array.from(new Set(permissions.map((perm) => getPermissionModule(perm.key)))).sort((a, b) => a.localeCompare(b)),
    [permissions],
  );

  useEffect(() => {
    if (!isRoleDialogOpen) return;
    if (expandedModules.length > 0) return;
    if (permissionModules.length === 0) return;
    setExpandedModules(permissionModules);
  }, [expandedModules.length, isRoleDialogOpen, permissionModules]);

  const rolePermissionMatrix = useMemo(() => {
    return roles.map((role) => {
      const keys = new Set((role.permissions ?? []).map((row) => row.permission?.key || "").filter(Boolean));
      const byModule = new Map<string, number>();
      for (const moduleName of permissionModules) {
        byModule.set(moduleName, 0);
      }
      keys.forEach((key) => {
        const moduleName = getPermissionModule(key);
        byModule.set(moduleName, (byModule.get(moduleName) ?? 0) + 1);
      });
      return {
        roleId: role.id,
        roleName: role.name,
        total: keys.size,
        byModule,
      };
    });
  }, [permissionModules, roles]);

  const createDashboardUser = async () => {
    if (!newUserEmail.trim() || !newUserName.trim() || !newUserPassword.trim()) {
      toast.error("Name, email and password are required");
      return;
    }
    try {
      await apiClient.post("/admin/users/dashboard", {
        email: newUserEmail.trim().toLowerCase(),
        nameEN: newUserName.trim(),
        phone: newUserPhone.trim() || undefined,
        password: newUserPassword,
        roleIds: selectedRoleIds,
      });
      toast.success("Dashboard user created");
      setIsUserDialogOpen(false);
      setNewUserEmail("");
      setNewUserName("");
      setNewUserPhone("");
      setNewUserPassword("");
      setSelectedRoleIds([]);
      await load();
    } catch (error) {
      toast.error("Failed to create dashboard user", { description: errorMessage(error) });
    }
  };

  const openCreateRole = () => {
    setEditingRoleId(null);
    setRoleName("");
    setSelectedPermissionKeys([]);
    setPermissionSearch("");
    setExpandedModules(permissionModules);
    setIsRoleDialogOpen(true);
  };

  const openEditRole = (row: RoleRow) => {
    setEditingRoleId(row.id);
    setRoleName(row.name);
    setSelectedPermissionKeys((row.permissions ?? []).map((rp) => rp.permission?.key || "").filter(Boolean));
    setPermissionSearch("");
    setExpandedModules(permissionModules);
    setIsRoleDialogOpen(true);
  };

  const upsertRole = async () => {
    if (!roleName.trim()) {
      toast.error("Role name is required");
      return;
    }
    try {
      if (editingRoleId) {
        await apiClient.patch(`/admin/users/roles/${editingRoleId}`, {
          name: roleName.trim(),
          permissionKeys: selectedPermissionKeys,
        });
        toast.success("Role updated");
      } else {
        await apiClient.post("/admin/users/roles", {
          name: roleName.trim(),
          permissionKeys: selectedPermissionKeys,
        });
        toast.success("Role created");
      }
      setIsRoleDialogOpen(false);
      await load();
    } catch (error) {
      toast.error("Failed to save role", { description: errorMessage(error) });
    }
  };

  const togglePermissionKey = (key: string) => {
    setSelectedPermissionKeys((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  };

  const toggleRoleId = (id: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleModule = (moduleName: string) => {
    setExpandedModules((prev) =>
      prev.includes(moduleName)
        ? prev.filter((item) => item !== moduleName)
        : [...prev, moduleName],
    );
  };

  const selectAllFiltered = () => {
    setSelectedPermissionKeys((prev) =>
      Array.from(new Set([...prev, ...allFilteredPermissionKeys])),
    );
  };

  const clearFiltered = () => {
    const filteredSet = new Set(allFilteredPermissionKeys);
    setSelectedPermissionKeys((prev) => prev.filter((key) => !filteredSet.has(key)));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#1E293B]">Dashboard Users & RBAC</h1>
          <p className="text-[#64748B] mt-1">Manage dashboard accounts, dynamic roles, and permission matrix.</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full max-w-[420px] grid-cols-2">
          <TabsTrigger value="users">Dashboard Users</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card className="p-4 flex items-center justify-between gap-3">
            <Input
              placeholder="Search by name/email/role"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
            <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white" onClick={() => setIsUserDialogOpen(true)}>
              Add Dashboard User
            </Button>
          </Card>

          <Card className="shadow-card rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#F9FAFB]">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Roles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="text-[#1E293B]">{u.nameEN || "—"}</TableCell>
                    <TableCell className="text-[#334155]">{u.email || "—"}</TableCell>
                    <TableCell className="text-[#64748B]">{u.phone || "—"}</TableCell>
                    <TableCell>
                      <Badge className="bg-[#E2E8F0] text-[#334155]">{u.userStatus || "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(u.roles ?? []).map((r) => (
                          <Badge key={`${u.id}-${r.role?.id}`} className="bg-[#DBEAFE] text-[#1D4ED8]">
                            {r.role?.name || "—"}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-[#64748B]">
                      No dashboard users found.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-[#334155]">Dynamic roles control dashboard access. Permissions are enforced by guards.</p>
            </div>
            <Button className="bg-[#00B386] hover:bg-[#00B386]/90 text-white" onClick={openCreateRole}>
              Create Role
            </Button>
          </Card>

          <Card className="shadow-card rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#F9FAFB]">
                  <TableHead>Role</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-[#1E293B]">{r.name}</TableCell>
                    <TableCell className="text-[#334155]">{r.users?.length || 0}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(r.permissions ?? []).slice(0, 6).map((p) => (
                          <Badge key={`${r.id}-${p.permission?.key}`} className="bg-[#F1F5F9] text-[#334155]">
                            {p.permission?.key}
                          </Badge>
                        ))}
                        {(r.permissions?.length || 0) > 6 ? (
                          <Badge className="bg-[#E2E8F0] text-[#475569]">+{(r.permissions?.length || 0) - 6}</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => openEditRole(r)}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && roles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-[#64748B]">No roles found.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Card>

          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-[#1E293B]">Permission Matrix Preview</h3>
            <div className="overflow-auto rounded-md border border-[#E2E8F0]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F8FAFC]">
                    <TableHead className="min-w-[180px]">Role</TableHead>
                    <TableHead>Total</TableHead>
                    {permissionModules.map((moduleName) => (
                      <TableHead key={moduleName}>{moduleName}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rolePermissionMatrix.map((row) => (
                    <TableRow key={`matrix-${row.roleId}`}>
                      <TableCell className="font-medium text-[#1E293B]">{row.roleName}</TableCell>
                      <TableCell>{row.total}</TableCell>
                      {permissionModules.map((moduleName) => (
                        <TableCell key={`${row.roleId}-${moduleName}`}>{row.byModule.get(moduleName) ?? 0}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Create Dashboard User</DialogTitle>
            <DialogDescription>Create admin/staff user and assign dynamic roles.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="Gatekeeper Ahmed" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="gatekeeper@alkarma.com" />
            </div>
            <div className="space-y-2">
              <Label>Phone (optional)</Label>
              <Input value={newUserPhone} onChange={(e) => setNewUserPhone(e.target.value)} placeholder="+2010..." />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Minimum 8 chars" />
            </div>
            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="max-h-40 overflow-y-auto rounded-md border border-[#E2E8F0] p-2 space-y-2">
                {roles.map((role) => (
                  <label key={role.id} className="flex items-center gap-2 text-sm text-[#334155]">
                    <input type="checkbox" checked={selectedRoleIds.includes(role.id)} onChange={() => toggleRoleId(role.id)} />
                    <span>{role.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUserDialogOpen(false)}>Cancel</Button>
            <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white" onClick={() => void createDashboardUser()}>
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editingRoleId ? "Edit Role" : "Create Role"}</DialogTitle>
            <DialogDescription>Assign permission keys to this role.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            <div className="space-y-2">
              <Label>Role Name</Label>
              <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="Gatekeeper" />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Permissions</Label>
                <Badge className="bg-[#E2E8F0] text-[#334155]">
                  {selectedPermissionKeys.length} selected
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Input
                  value={permissionSearch}
                  onChange={(event) => setPermissionSearch(event.target.value)}
                  placeholder="Search permissions..."
                  className="max-w-sm"
                />
                <Button type="button" variant="outline" size="sm" onClick={selectAllFiltered}>
                  Select all filtered
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={clearFiltered}>
                  Clear filtered
                </Button>
              </div>
              <div className="rounded-md border border-[#E2E8F0] p-2 space-y-2">
                {groupedPermissions.map((group) => {
                  const isExpanded = expandedModules.includes(group.module);
                  return (
                    <div key={group.module} className="rounded-md border border-[#E2E8F0] bg-white">
                      <button
                        type="button"
                        onClick={() => toggleModule(group.module)}
                        className="w-full flex items-center justify-between px-3 py-2 text-left"
                      >
                        <span className="inline-flex items-center gap-2 text-sm font-medium text-[#1E293B]">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          {group.module}
                        </span>
                        <Badge className="bg-[#F1F5F9] text-[#334155]">{group.items.length}</Badge>
                      </button>
                      {isExpanded ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 px-3 pb-3">
                          {group.items.map((perm) => (
                            <label key={perm.id} className="flex items-center gap-2 text-sm text-[#334155]">
                              <input
                                type="checkbox"
                                checked={selectedPermissionKeys.includes(perm.key)}
                                onChange={() => togglePermissionKey(perm.key)}
                              />
                              <span>{perm.key}</span>
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {groupedPermissions.length === 0 ? (
                  <div className="rounded-md border border-dashed border-[#CBD5E1] px-3 py-6 text-center text-sm text-[#64748B]">
                    No permissions match this search.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-[#E2E8F0] pt-3">
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>Cancel</Button>
            <Button className="bg-[#00B386] hover:bg-[#00B386]/90 text-white" onClick={() => void upsertRole()}>
              {editingRoleId ? "Save Role" : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
