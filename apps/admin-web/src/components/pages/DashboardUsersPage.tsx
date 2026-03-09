import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { DataTable, type DataTableColumn } from "../DataTable";
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
  description?: string | null;
  isSystem?: boolean;
  permissions?: Array<{ permission?: { key?: string } }>;
  statusPermissions?: Array<{ unitStatus?: string; permission?: { key?: string } }>;
  moduleAccess?: Array<{ moduleKey: string; canAccess: boolean }>;
  personas?: Array<{ persona?: { id?: string; key?: string; name?: string } }>;
  users?: Array<{ userId: string }>;
};

type PermissionRow = { id: string; key: string };
type PersonaRow = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  isSystem?: boolean;
  isActive?: boolean;
  roleCount?: number;
  userOverrideCount?: number;
  ruleCount?: number;
};

type ScreenRow = {
  id: string;
  key: string;
  title: string;
  section: string;
  moduleKey?: string | null;
  surface: "ADMIN_WEB" | "MOBILE_APP";
  isEnabled: boolean;
};

type RuleDraftItem = {
  personaKey: string;
  screenKey: string;
  surface: "ADMIN_WEB" | "MOBILE_APP";
  unitStatus: string;
  visible: boolean;
};

type PermissionGroup = {
  module: string;
  items: PermissionRow[];
};

type OverrideItem = {
  permissionKey: string;
  grant: boolean;
};

const UNIT_STATUSES = ["OFF_PLAN", "UNDER_CONSTRUCTION", "DELIVERED"] as const;
const STATUS_LABELS: Record<string, string> = {
  OFF_PLAN: "Off Plan",
  UNDER_CONSTRUCTION: "Under Construction",
  DELIVERED: "Delivered",
};

const DEFAULT_MODULE_KEYS = [
  "dashboard", "units", "communities", "amenities", "bookings",
  "payments", "complaints", "violations", "services", "gates",
  "permits", "rentals", "commercial", "reports", "news",
  "tickets", "profile", "users",
];

const MODULE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  units: "Units",
  communities: "Communities",
  amenities: "Amenities",
  bookings: "Bookings",
  payments: "Payments",
  complaints: "Complaints",
  violations: "Violations",
  services: "Services",
  gates: "Gates",
  permits: "Permits",
  rentals: "Rentals",
  commercial: "Commercial",
  reports: "Reports",
  news: "News & Announcements",
  tickets: "Tickets",
  profile: "Profile",
  users: "User Management",
};

function getPermissionModule(key: string) {
  const [prefix] = key.split(".");
  return prefix || "misc";
}

function humanize(key: string) {
  return key.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const ROLE_STEPS = ["Details", "Module Access", "Permissions", "Review"] as const;
type RoleStep = (typeof ROLE_STEPS)[number];

export function DashboardUsersPage() {
  const [users, setUsers] = useState<DashboardUserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [personas, setPersonas] = useState<PersonaRow[]>([]);
  const [screens, setScreens] = useState<ScreenRow[]>([]);
  const [ruleDrafts, setRuleDrafts] = useState<RuleDraftItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"users" | "roles" | "matrix" | "governance">("users");
  const [ruleStatusFilter, setRuleStatusFilter] = useState<string>("DELIVERED");
  const activeTabLabel =
    activeTab === "users"
      ? "Dashboard Users"
      : activeTab === "roles"
        ? "Roles & Permissions"
        : activeTab === "matrix"
          ? "Permission Matrix"
          : "Screen Governance";

  // Create user dialog
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  // Edit user roles dialog
  const [isEditRolesOpen, setIsEditRolesOpen] = useState(false);
  const [editRolesUserId, setEditRolesUserId] = useState<string | null>(null);
  const [editRolesUserName, setEditRolesUserName] = useState("");
  const [editRoleIds, setEditRoleIds] = useState<string[]>([]);

  // Multi-step role dialog (create/edit)
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleStep, setRoleStep] = useState<RoleStep>("Details");
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [selectedModuleKeys, setSelectedModuleKeys] = useState<string[]>([]);
  const [selectedPersonaKeys, setSelectedPersonaKeys] = useState<string[]>([]);
  const [selectedPermissionKeys, setSelectedPermissionKeys] = useState<string[]>([]);
  const [permissionSearch, setPermissionSearch] = useState("");
  const [expandedModules, setExpandedModules] = useState<string[]>([]);

  // Governance quick create
  const [newPersonaKey, setNewPersonaKey] = useState("");
  const [newPersonaName, setNewPersonaName] = useState("");
  const [newPersonaDescription, setNewPersonaDescription] = useState("");
  const [newScreenKey, setNewScreenKey] = useState("");
  const [newScreenTitle, setNewScreenTitle] = useState("");
  const [newScreenSection, setNewScreenSection] = useState("");
  const [newScreenModule, setNewScreenModule] = useState("");

  // Status permissions within role dialog
  const [roleStatusPerms, setRoleStatusPerms] = useState<Record<string, string[]>>({
    OFF_PLAN: [],
    UNDER_CONSTRUCTION: [],
    DELIVERED: [],
  });
  const [activeStatusTab, setActiveStatusTab] = useState<string>(UNIT_STATUSES[0]);
  const [statusPermSearch, setStatusPermSearch] = useState("");

  // User overrides dialog
  const [isOverridesOpen, setIsOverridesOpen] = useState(false);
  const [overridesUserId, setOverridesUserId] = useState<string | null>(null);
  const [overridesUserName, setOverridesUserName] = useState("");
  const [userOverrides, setUserOverrides] = useState<OverrideItem[]>([]);
  const [overrideSearch, setOverrideSearch] = useState("");
  const [isPersonaOverrideOpen, setIsPersonaOverrideOpen] = useState(false);
  const [personaOverrideUserId, setPersonaOverrideUserId] = useState<string | null>(null);
  const [personaOverrideUserName, setPersonaOverrideUserName] = useState("");
  const [personaOverrideKeys, setPersonaOverrideKeys] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes, permsRes, personasRes, screensRes, rulesRes] = await Promise.all([
        apiClient.get<DashboardUserRow[]>("/admin/users/dashboard"),
        apiClient.get<RoleRow[]>("/admin/users/roles"),
        apiClient.get<PermissionRow[]>("/admin/users/permissions"),
        apiClient.get<PersonaRow[]>("/admin/users/personas"),
        apiClient.get<ScreenRow[]>("/admin/users/screens?surface=ADMIN_WEB"),
        apiClient.get<Array<{
          persona?: { key?: string };
          screen?: { key?: string };
          surface?: "ADMIN_WEB" | "MOBILE_APP";
          unitStatus?: string;
          visible?: boolean;
        }>>("/admin/users/screen-visibility-rules?surface=ADMIN_WEB"),
      ]);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      setRoles(Array.isArray(rolesRes.data) ? rolesRes.data : []);
      setPermissions(Array.isArray(permsRes.data) ? permsRes.data : []);
      setPersonas(Array.isArray(personasRes.data) ? personasRes.data : []);
      setScreens(Array.isArray(screensRes.data) ? screensRes.data : []);
      const normalizedRules = (Array.isArray(rulesRes.data) ? rulesRes.data : [])
        .map((row) => ({
          personaKey: String(row.persona?.key ?? "").toUpperCase(),
          screenKey: String(row.screen?.key ?? "").toLowerCase(),
          surface: row.surface === "MOBILE_APP" ? "MOBILE_APP" : "ADMIN_WEB",
          unitStatus: String(row.unitStatus ?? "DELIVERED"),
          visible: row.visible !== false,
        }))
        .filter((row) => row.personaKey && row.screenKey);
      setRuleDrafts(normalizedRules);
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

  const permissionModules = useMemo(
    () => Array.from(new Set(permissions.map((perm) => getPermissionModule(perm.key)))).sort(),
    [permissions],
  );

  // Permissions grouped by module, filtered by search
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
      .map(([module, items]) => ({ module, items: [...items].sort((a, b) => a.key.localeCompare(b.key)) }))
      .sort((a, b) => a.module.localeCompare(b.module));
  }, [permissionSearch, permissions]);

  // Status tab permissions (filtered for role dialog step 3)
  const statusGroupedPermissions = useMemo<PermissionGroup[]>(() => {
    // Only show permissions from enabled modules
    const enabledModules = new Set(selectedModuleKeys);
    const q = statusPermSearch.trim().toLowerCase();
    const filtered = permissions.filter((perm) => {
      const mod = getPermissionModule(perm.key);
      if (!enabledModules.has(mod)) return false;
      if (q && !perm.key.toLowerCase().includes(q)) return false;
      return true;
    });
    const map = new Map<string, PermissionRow[]>();
    for (const perm of filtered) {
      const moduleName = getPermissionModule(perm.key);
      const group = map.get(moduleName) ?? [];
      group.push(perm);
      map.set(moduleName, group);
    }
    return Array.from(map.entries())
      .map(([module, items]) => ({ module, items: [...items].sort((a, b) => a.key.localeCompare(b.key)) }))
      .sort((a, b) => a.module.localeCompare(b.module));
  }, [statusPermSearch, permissions, selectedModuleKeys]);

  const allFilteredPermissionKeys = useMemo(
    () => groupedPermissions.flatMap((g) => g.items.map((i) => i.key)),
    [groupedPermissions],
  );

  // Override helpers
  const overrideGroupedPermissions = useMemo<PermissionGroup[]>(() => {
    const q = overrideSearch.trim().toLowerCase();
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
      .map(([module, items]) => ({ module, items: [...items].sort((a, b) => a.key.localeCompare(b.key)) }))
      .sort((a, b) => a.module.localeCompare(b.module));
  }, [overrideSearch, permissions]);

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
      return { roleId: role.id, roleName: role.name, total: keys.size, byModule };
    });
  }, [permissionModules, roles]);

  // ─── Actions ─────────────────────────────────

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
      setNewUserEmail(""); setNewUserName(""); setNewUserPhone(""); setNewUserPassword(""); setSelectedRoleIds([]);
      await load();
    } catch (error) {
      toast.error("Failed to create dashboard user", { description: errorMessage(error) });
    }
  };

  const openEditRoles = (user: DashboardUserRow) => {
    setEditRolesUserId(user.id);
    setEditRolesUserName(user.nameEN || user.email || "User");
    setEditRoleIds((user.roles ?? []).map((r) => r.role?.id).filter(Boolean) as string[]);
    setIsEditRolesOpen(true);
  };

  const saveUserRoles = async () => {
    if (!editRolesUserId || editRoleIds.length === 0) {
      toast.error("Select at least one role");
      return;
    }
    try {
      await apiClient.patch(`/admin/users/dashboard/${editRolesUserId}/roles`, { roleIds: editRoleIds });
      toast.success("User roles updated");
      setIsEditRolesOpen(false);
      await load();
    } catch (error) {
      toast.error("Failed to update roles", { description: errorMessage(error) });
    }
  };

  const openOverrides = async (user: DashboardUserRow) => {
    setOverridesUserId(user.id);
    setOverridesUserName(user.nameEN || user.email || "User");
    setOverrideSearch("");
    try {
      const res = await apiClient.get<OverrideItem[]>(`/admin/users/${user.id}/permission-overrides`);
      setUserOverrides(Array.isArray(res.data) ? res.data : []);
    } catch {
      setUserOverrides([]);
    }
    setIsOverridesOpen(true);
  };

  const openPersonaOverride = async (user: DashboardUserRow) => {
    setPersonaOverrideUserId(user.id);
    setPersonaOverrideUserName(user.nameEN || user.email || "User");
    try {
      const res = await apiClient.get<{ personaKeys?: string[] }>(`/admin/users/${user.id}/persona-override`);
      const keys = Array.isArray(res.data?.personaKeys)
        ? res.data.personaKeys.map((value) => String(value).toUpperCase())
        : [];
      setPersonaOverrideKeys(keys);
    } catch {
      setPersonaOverrideKeys([]);
    }
    setIsPersonaOverrideOpen(true);
  };

  const toggleOverride = (permKey: string) => {
    setUserOverrides((prev) => {
      const existing = prev.find((o) => o.permissionKey === permKey);
      if (!existing) return [...prev, { permissionKey: permKey, grant: true }];
      if (existing.grant) return prev.map((o) => (o.permissionKey === permKey ? { ...o, grant: false } : o));
      return prev.filter((o) => o.permissionKey !== permKey);
    });
  };

  const getOverrideState = (permKey: string): "none" | "grant" | "deny" => {
    const item = userOverrides.find((o) => o.permissionKey === permKey);
    if (!item) return "none";
    return item.grant ? "grant" : "deny";
  };

  const togglePersonaOverrideKey = (key: string) => {
    setPersonaOverrideKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  };

  const saveOverrides = async () => {
    if (!overridesUserId) return;
    try {
      await apiClient.put(`/admin/users/${overridesUserId}/permission-overrides`, { overrides: userOverrides });
      toast.success("Permission overrides saved");
      setIsOverridesOpen(false);
    } catch (error) {
      toast.error("Failed to save overrides", { description: errorMessage(error) });
    }
  };

  // ─── Role dialog (multi-step) ──────────────

  const openCreateRole = () => {
    setEditingRoleId(null);
    setRoleName("");
    setRoleDescription("");
    setSelectedModuleKeys([]);
    setSelectedPersonaKeys([]);
    setSelectedPermissionKeys([]);
    setRoleStatusPerms({ OFF_PLAN: [], UNDER_CONSTRUCTION: [], DELIVERED: [] });
    setPermissionSearch("");
    setStatusPermSearch("");
    setActiveStatusTab(UNIT_STATUSES[0]);
    setExpandedModules([]);
    setRoleStep("Details");
    setIsRoleDialogOpen(true);
  };

  const openEditRole = (row: RoleRow) => {
    setEditingRoleId(row.id);
    setRoleName(row.name);
    setRoleDescription(row.description || "");
    setSelectedModuleKeys(
      (row.moduleAccess ?? []).filter((ma) => ma.canAccess).map((ma) => ma.moduleKey),
    );
    setSelectedPersonaKeys(
      (row.personas ?? []).map((rp) => rp.persona?.key || "").filter(Boolean) as string[],
    );
    setSelectedPermissionKeys(
      (row.permissions ?? []).map((rp) => rp.permission?.key || "").filter(Boolean),
    );
    // Build status perm map from existing data
    const sp: Record<string, string[]> = { OFF_PLAN: [], UNDER_CONSTRUCTION: [], DELIVERED: [] };
    for (const entry of row.statusPermissions ?? []) {
      const status = entry.unitStatus || "";
      const key = entry.permission?.key || "";
      if (status && key) {
        if (!sp[status]) sp[status] = [];
        sp[status].push(key);
      }
    }
    setRoleStatusPerms(sp);
    setPermissionSearch("");
    setStatusPermSearch("");
    setActiveStatusTab(UNIT_STATUSES[0]);
    setExpandedModules([]);
    setRoleStep("Details");
    setIsRoleDialogOpen(true);
  };

  const upsertRole = async () => {
    if (!roleName.trim()) {
      toast.error("Role name is required");
      return;
    }
    const payload = {
      name: roleName.trim(),
      description: roleDescription.trim() || undefined,
      permissionKeys: selectedPermissionKeys,
      moduleKeys: selectedModuleKeys,
      personaKeys: selectedPersonaKeys,
      statusPermissions: roleStatusPerms,
    };
    try {
      if (editingRoleId) {
        await apiClient.patch(`/admin/users/roles/${editingRoleId}`, payload);
        toast.success("Role updated");
      } else {
        await apiClient.post("/admin/users/roles", payload);
        toast.success("Role created");
      }
      setIsRoleDialogOpen(false);
      await load();
    } catch (error) {
      toast.error("Failed to save role", { description: errorMessage(error) });
    }
  };

  const deleteRole = async (roleId: string) => {
    if (!confirm("Are you sure you want to delete this role?")) return;
    try {
      await apiClient.delete(`/admin/users/roles/${roleId}`);
      toast.success("Role deleted");
      await load();
    } catch (error) {
      toast.error("Failed to delete role", { description: errorMessage(error) });
    }
  };

  const togglePermissionKey = (key: string) => {
    setSelectedPermissionKeys((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  };

  const toggleModuleKey = (key: string) => {
    setSelectedModuleKeys((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key],
    );
  };

  const togglePersonaKey = (key: string) => {
    setSelectedPersonaKeys((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  };

  const toggleRoleId = (id: string) => {
    setSelectedRoleIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleEditRoleId = (id: string) => {
    setEditRoleIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleModule = (moduleName: string) => {
    setExpandedModules((prev) =>
      prev.includes(moduleName) ? prev.filter((item) => item !== moduleName) : [...prev, moduleName],
    );
  };

  const selectAllFiltered = () => {
    setSelectedPermissionKeys((prev) => Array.from(new Set([...prev, ...allFilteredPermissionKeys])));
  };

  const clearFiltered = () => {
    const filteredSet = new Set(allFilteredPermissionKeys);
    setSelectedPermissionKeys((prev) => prev.filter((key) => !filteredSet.has(key)));
  };

  // Status perm toggles in role dialog
  const toggleStatusPerm = (permKey: string) => {
    setRoleStatusPerms((prev) => {
      const current = prev[activeStatusTab] ?? [];
      const next = current.includes(permKey)
        ? current.filter((k) => k !== permKey)
        : [...current, permKey];
      return { ...prev, [activeStatusTab]: next };
    });
  };

  const selectAllStatusPerms = () => {
    const allKeys = statusGroupedPermissions.flatMap((g) => g.items.map((i) => i.key));
    setRoleStatusPerms((prev) => ({
      ...prev,
      [activeStatusTab]: Array.from(new Set([...(prev[activeStatusTab] ?? []), ...allKeys])),
    }));
  };

  const clearAllStatusPerms = () => {
    setRoleStatusPerms((prev) => ({
      ...prev,
      [activeStatusTab]: [],
    }));
  };

  const seedAppPages = async () => {
    try {
      await apiClient.post("/admin/users/permissions/seed-app-pages");
      toast.success("App page permissions seeded");
      await load();
    } catch (error) {
      toast.error("Failed to seed app permissions", { description: errorMessage(error) });
    }
  };

  // Governance actions
  const createPersona = async () => {
    if (!newPersonaKey.trim() || !newPersonaName.trim()) {
      toast.error("Persona key and name are required");
      return;
    }
    try {
      await apiClient.post("/admin/users/personas", {
        key: newPersonaKey.trim().toUpperCase(),
        name: newPersonaName.trim(),
        description: newPersonaDescription.trim() || undefined,
      });
      toast.success("Persona created");
      setNewPersonaKey("");
      setNewPersonaName("");
      setNewPersonaDescription("");
      await load();
    } catch (error) {
      toast.error("Failed to create persona", { description: errorMessage(error) });
    }
  };

  const savePersonaOverride = async () => {
    if (!personaOverrideUserId) return;
    try {
      await apiClient.patch(`/admin/users/${personaOverrideUserId}/persona-override`, {
        personaKeys: personaOverrideKeys,
      });
      toast.success("Persona override saved");
      setIsPersonaOverrideOpen(false);
    } catch (error) {
      toast.error("Failed to save persona override", { description: errorMessage(error) });
    }
  };

  const createScreen = async () => {
    if (!newScreenKey.trim() || !newScreenTitle.trim() || !newScreenSection.trim()) {
      toast.error("Screen key, title and section are required");
      return;
    }
    try {
      await apiClient.post("/admin/users/screens", {
        key: newScreenKey.trim().toLowerCase(),
        title: newScreenTitle.trim(),
        section: newScreenSection.trim().toLowerCase(),
        moduleKey: newScreenModule.trim() || undefined,
        surface: "ADMIN_WEB",
        isEnabled: true,
      });
      toast.success("Screen created");
      setNewScreenKey("");
      setNewScreenTitle("");
      setNewScreenSection("");
      setNewScreenModule("");
      await load();
    } catch (error) {
      toast.error("Failed to create screen", { description: errorMessage(error) });
    }
  };

  const isRuleVisible = (personaKey: string, screenKey: string, unitStatus: string) => {
    const row = ruleDrafts.find(
      (rule) =>
        rule.surface === "ADMIN_WEB" &&
        rule.personaKey === personaKey &&
        rule.screenKey === screenKey &&
        rule.unitStatus === unitStatus,
    );
    return row?.visible === true;
  };

  const toggleRule = (personaKey: string, screenKey: string, unitStatus: string) => {
    setRuleDrafts((prev) => {
      const idx = prev.findIndex(
        (rule) =>
          rule.surface === "ADMIN_WEB" &&
          rule.personaKey === personaKey &&
          rule.screenKey === screenKey &&
          rule.unitStatus === unitStatus,
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], visible: !next[idx].visible };
        return next;
      }
      return [
        ...prev,
        {
          personaKey,
          screenKey,
          surface: "ADMIN_WEB",
          unitStatus,
          visible: true,
        },
      ];
    });
  };

  const saveRules = async () => {
    try {
      await apiClient.put("/admin/users/screen-visibility-rules", {
        surface: "ADMIN_WEB",
        rules: ruleDrafts
          .filter((rule) => rule.surface === "ADMIN_WEB")
          .map((rule) => ({
            personaKey: rule.personaKey,
            screenKey: rule.screenKey,
            surface: "ADMIN_WEB",
            unitStatus: rule.unitStatus,
            visible: rule.visible,
          })),
      });
      toast.success("Screen visibility rules saved");
      await load();
    } catch (error) {
      toast.error("Failed to save screen rules", { description: errorMessage(error) });
    }
  };

  // ─── Step navigation ──────────────────────────
  const currentStepIndex = ROLE_STEPS.indexOf(roleStep);
  const canGoNext = () => {
    if (roleStep === "Details") return roleName.trim().length > 0;
    return true;
  };
  const goNext = () => {
    if (currentStepIndex < ROLE_STEPS.length - 1) {
      setRoleStep(ROLE_STEPS[currentStepIndex + 1]);
      if (ROLE_STEPS[currentStepIndex + 1] === "Permissions") {
        setExpandedModules(permissionModules);
      }
    }
  };
  const goBack = () => {
    if (currentStepIndex > 0) setRoleStep(ROLE_STEPS[currentStepIndex - 1]);
  };

  // ─── Review summary ──────────────────────────
  const reviewSummary = useMemo(() => {
    const totalStatusPerms = Object.values(roleStatusPerms).reduce((s, arr) => s + arr.length, 0);
    return {
      name: roleName.trim(),
      description: roleDescription.trim(),
      personas: selectedPersonaKeys,
      modules: selectedModuleKeys.map((k) => MODULE_LABELS[k] || k),
      permissionCount: selectedPermissionKeys.length,
      statusPermCount: totalStatusPerms,
    };
  }, [roleName, roleDescription, selectedPersonaKeys, selectedModuleKeys, selectedPermissionKeys, roleStatusPerms]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[#1E293B]">Dashboard Users & RBAC</h1>
          <p className="text-[#64748B] mt-1">Manage dashboard accounts, dynamic roles, and permission matrix.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void seedAppPages()}>
            Seed App Pages
          </Button>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "users" | "roles" | "matrix" | "governance")} className="space-y-4">
        <TabsList className="inline-flex h-auto w-full max-w-[720px] flex-wrap items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white p-2">
          <TabsTrigger
            value="users"
            className={`rounded-lg px-4 py-2 text-sm transition-all ${
              activeTab === "users"
                ? "bg-[#0B5FFF] text-white shadow-sm ring-2 ring-[#0B5FFF]/20"
                : "text-[#475569] hover:bg-[#F8FAFC]"
            }`}
          >
            <span className={`mr-2 inline-block h-2 w-2 rounded-full ${activeTab === "users" ? "bg-white" : "bg-transparent"}`} />
            Dashboard Users
          </TabsTrigger>
          <TabsTrigger
            value="roles"
            className={`rounded-lg px-4 py-2 text-sm transition-all ${
              activeTab === "roles"
                ? "bg-[#0B5FFF] text-white shadow-sm ring-2 ring-[#0B5FFF]/20"
                : "text-[#475569] hover:bg-[#F8FAFC]"
            }`}
          >
            <span className={`mr-2 inline-block h-2 w-2 rounded-full ${activeTab === "roles" ? "bg-white" : "bg-transparent"}`} />
            Roles & Permissions
          </TabsTrigger>
          <TabsTrigger
            value="matrix"
            className={`rounded-lg px-4 py-2 text-sm transition-all ${
              activeTab === "matrix"
                ? "bg-[#0B5FFF] text-white shadow-sm ring-2 ring-[#0B5FFF]/20"
                : "text-[#475569] hover:bg-[#F8FAFC]"
            }`}
          >
            <span className={`mr-2 inline-block h-2 w-2 rounded-full ${activeTab === "matrix" ? "bg-white" : "bg-transparent"}`} />
            Permission Matrix
          </TabsTrigger>
          <TabsTrigger
            value="governance"
            className={`rounded-lg px-4 py-2 text-sm transition-all ${
              activeTab === "governance"
                ? "bg-[#0B5FFF] text-white shadow-sm ring-2 ring-[#0B5FFF]/20"
                : "text-[#475569] hover:bg-[#F8FAFC]"
            }`}
          >
            <span className={`mr-2 inline-block h-2 w-2 rounded-full ${activeTab === "governance" ? "bg-white" : "bg-transparent"}`} />
            Screen Governance
          </TabsTrigger>
        </TabsList>
        <div className="mt-1 inline-flex items-center gap-2 rounded-md bg-[#EFF6FF] px-3 py-1 text-xs font-medium text-[#1D4ED8]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#1D4ED8]" />
          Active tab: {activeTabLabel}
        </div>

        {/* ========== USERS TAB ========== */}
        <TabsContent value="users" className="space-y-4">
          <Card className="p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(320px,460px)_auto] sm:items-end sm:justify-between">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-[#64748B]">Search Users</Label>
                <Input
                  placeholder="Search by name, email, or role"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white"
                />
              </div>
              <div className="sm:justify-self-end">
                <Button className="w-full bg-[#0B5FFF] text-white hover:bg-[#0B5FFF]/90 sm:w-auto" onClick={() => setIsUserDialogOpen(true)}>
                  Add Dashboard User
                </Button>
              </div>
            </div>
          </Card>

          {(() => {
            const cols: DataTableColumn<DashboardUserRow>[] = [
              { key: "name", header: "Name", render: (u) => <span className="text-[#1E293B]">{u.nameEN || "\u2014"}</span> },
              { key: "email", header: "Email", render: (u) => <span className="text-[#334155]">{u.email || "\u2014"}</span> },
              { key: "phone", header: "Phone", render: (u) => <span className="text-[#64748B]">{u.phone || "\u2014"}</span> },
              { key: "status", header: "Status", render: (u) => <Badge className="bg-[#E2E8F0] text-[#334155]">{u.userStatus || "\u2014"}</Badge> },
              { key: "roles", header: "Roles", render: (u) => (
                <div className="flex flex-wrap gap-1">
                  {(u.roles ?? []).map((r) => (
                    <Badge key={`${u.id}-${r.role?.id}`} className="bg-[#DBEAFE] text-[#1D4ED8]">{r.role?.name || "\u2014"}</Badge>
                  ))}
                </div>
              )},
              { key: "actions", header: "Actions", render: (u) => (
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => openEditRoles(u)}>Roles</Button>
                  <Button variant="outline" size="sm" onClick={() => void openPersonaOverride(u)}>Personas</Button>
                  <Button variant="outline" size="sm" onClick={() => void openOverrides(u)}>Overrides</Button>
                </div>
              )},
            ];
            return (
              <Card className="shadow-card rounded-xl overflow-hidden">
                <DataTable columns={cols} rows={filteredUsers} rowKey={(u) => u.id} loading={loading} emptyTitle="No dashboard users found" />
              </Card>
            );
          })()}
        </TabsContent>

        {/* ========== ROLES TAB ========== */}
        <TabsContent value="roles" className="space-y-4">
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-[#334155]">Dynamic roles control dashboard access. Permissions are enforced by backend guards.</p>
            </div>
            <Button className="bg-[#00B386] hover:bg-[#00B386]/90 text-white" onClick={openCreateRole}>
              Add Role
            </Button>
          </Card>

          {(() => {
            const roleCols: DataTableColumn<RoleRow>[] = [
              { key: "name", header: "Role", render: (r) => (
                <div>
                  <span className="text-[#1E293B] font-medium">{r.name}</span>
                  {r.isSystem && <Badge className="ml-2 bg-[#FEF3C7] text-[#92400E]">System</Badge>}
                  {r.description && <p className="text-xs text-[#64748B] mt-0.5">{r.description}</p>}
                </div>
              )},
              { key: "modules", header: "Modules", render: (r) => (
                <div className="flex flex-wrap gap-1">
                  {(r.moduleAccess ?? []).filter((ma) => ma.canAccess).slice(0, 4).map((ma) => (
                    <Badge key={`${r.id}-${ma.moduleKey}`} className="bg-[#F0F9FF] text-[#0369A1]">
                      {MODULE_LABELS[ma.moduleKey] || ma.moduleKey}
                    </Badge>
                  ))}
                  {((r.moduleAccess ?? []).filter((ma) => ma.canAccess).length > 4) && (
                    <Badge className="bg-[#E2E8F0] text-[#475569]">
                      +{(r.moduleAccess ?? []).filter((ma) => ma.canAccess).length - 4}
                    </Badge>
                  )}
                </div>
              )},
              { key: "personas", header: "Personas", render: (r) => (
                <div className="flex flex-wrap gap-1">
                  {(r.personas ?? []).slice(0, 3).map((rp) => (
                    <Badge key={`${r.id}-${rp.persona?.id || rp.persona?.key}`} className="bg-[#F5F3FF] text-[#6D28D9]">
                      {rp.persona?.key || rp.persona?.name || "\u2014"}
                    </Badge>
                  ))}
                  {(r.personas?.length ?? 0) > 3 && (
                    <Badge className="bg-[#E2E8F0] text-[#475569]">+{(r.personas?.length ?? 0) - 3}</Badge>
                  )}
                </div>
              )},
              { key: "users", header: "Users", render: (r) => <span className="text-[#334155]">{r.users?.length || 0}</span> },
              { key: "permissions", header: "Permissions", render: (r) => (
                <span className="text-[#334155]">{r.permissions?.length || 0} base</span>
              )},
              { key: "actions", header: "Actions", render: (r) => (
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => openEditRole(r)}>Edit</Button>
                  {!r.isSystem && (
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => void deleteRole(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )},
            ];
            return (
              <Card className="shadow-card rounded-xl overflow-hidden">
                <DataTable columns={roleCols} rows={roles} rowKey={(r) => r.id} loading={loading} emptyTitle="No roles found" />
              </Card>
            );
          })()}
        </TabsContent>

        {/* ========== PERMISSION MATRIX TAB ========== */}
        <TabsContent value="matrix" className="space-y-4">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[#1E293B]">Permission Matrix Preview</h3>
              <p className="text-xs text-[#64748B]">Scroll horizontally to view all modules</p>
            </div>
            {(() => {
              type MatrixRow = { roleId: string; roleName: string; total: number; byModule: Map<string, number> };
              const matrixMinWidth = Math.max(980, 280 + permissionModules.length * 120);
              return (
                <div className="rounded-md border border-[#E2E8F0] bg-white">
                  <div className="overflow-x-auto overflow-y-hidden pb-2">
                    <table
                      className="w-max min-w-full border-collapse text-sm"
                      style={{ minWidth: matrixMinWidth }}
                    >
                      <thead>
                        <tr className="bg-[#F8FAFC]">
                          <th className="sticky left-0 z-20 min-w-[240px] border-b border-r border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                            Role
                          </th>
                          <th className="sticky left-[240px] z-20 min-w-[90px] border-b border-r border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                            Total
                          </th>
                          {permissionModules.map((mod) => (
                            <th
                              key={mod}
                              className="min-w-[110px] border-b border-r border-[#E2E8F0] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#64748B]"
                            >
                              {mod}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rolePermissionMatrix.map((row, idx) => (
                          <tr key={row.roleId} className={idx % 2 === 0 ? "bg-white" : "bg-[#FCFDFE]"}>
                            <td className="sticky left-0 z-10 border-b border-r border-[#EEF2F7] bg-inherit px-4 py-2 font-medium text-[#1E293B]">
                              {row.roleName}
                            </td>
                            <td className="sticky left-[240px] z-10 border-b border-r border-[#EEF2F7] bg-inherit px-3 py-2 text-[#334155]">
                              {row.total}
                            </td>
                            {permissionModules.map((mod) => (
                              <td key={`${row.roleId}-${mod}`} className="border-b border-r border-[#EEF2F7] px-3 py-2 text-[#334155]">
                                {row.byModule.get(mod) ?? 0}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </Card>
        </TabsContent>

        {/* ========== GOVERNANCE TAB ========== */}
        <TabsContent value="governance" className="space-y-4">
          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-[#1E293B]">Personas</h3>
            <p className="text-xs text-[#64748B]">
              Define dynamic account personas used by roles and screen visibility rules.
            </p>
            <div className="grid gap-2 md:grid-cols-3">
              <Input value={newPersonaKey} onChange={(e) => setNewPersonaKey(e.target.value)} placeholder="OWNER_FAMILY" />
              <Input value={newPersonaName} onChange={(e) => setNewPersonaName(e.target.value)} placeholder="Owner Family" />
              <Input value={newPersonaDescription} onChange={(e) => setNewPersonaDescription(e.target.value)} placeholder="Optional description" />
            </div>
            <div className="flex justify-end">
              <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white" onClick={() => void createPersona()}>
                Add Persona
              </Button>
            </div>
            <div className="rounded-md border border-[#E2E8F0]">
              <div className="max-h-52 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#F8FAFC]">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs text-[#64748B]">Key</th>
                      <th className="px-3 py-2 text-left text-xs text-[#64748B]">Name</th>
                      <th className="px-3 py-2 text-left text-xs text-[#64748B]">Rules</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personas.map((persona) => (
                      <tr key={persona.id} className="border-t border-[#EEF2F7]">
                        <td className="px-3 py-2 font-medium text-[#1E293B]">{persona.key}</td>
                        <td className="px-3 py-2 text-[#334155]">{persona.name}</td>
                        <td className="px-3 py-2 text-[#64748B]">{persona.ruleCount || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-[#1E293B]">Screen Catalog (Admin Web)</h3>
            <div className="grid gap-2 md:grid-cols-4">
              <Input value={newScreenKey} onChange={(e) => setNewScreenKey(e.target.value)} placeholder="services_home" />
              <Input value={newScreenTitle} onChange={(e) => setNewScreenTitle(e.target.value)} placeholder="Services Home" />
              <Input value={newScreenSection} onChange={(e) => setNewScreenSection(e.target.value)} placeholder="services" />
              <Input value={newScreenModule} onChange={(e) => setNewScreenModule(e.target.value)} placeholder="services module key" />
            </div>
            <div className="flex justify-end">
              <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white" onClick={() => void createScreen()}>
                Add Screen
              </Button>
            </div>
            <div className="rounded-md border border-[#E2E8F0]">
              <div className="max-h-52 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#F8FAFC]">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs text-[#64748B]">Key</th>
                      <th className="px-3 py-2 text-left text-xs text-[#64748B]">Section</th>
                      <th className="px-3 py-2 text-left text-xs text-[#64748B]">Module</th>
                    </tr>
                  </thead>
                  <tbody>
                    {screens.map((screen) => (
                      <tr key={screen.id} className="border-t border-[#EEF2F7]">
                        <td className="px-3 py-2 font-medium text-[#1E293B]">{screen.key}</td>
                        <td className="px-3 py-2 text-[#334155]">{screen.section}</td>
                        <td className="px-3 py-2 text-[#64748B]">{screen.moduleKey || "\u2014"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[#1E293B]">Visibility Matrix</h3>
                <p className="text-xs text-[#64748B]">
                  Toggle per persona and section for selected unit status.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-[#64748B]">Unit Status</Label>
                <select
                  className="rounded-md border border-[#CBD5E1] bg-white px-2 py-1 text-sm text-[#334155]"
                  value={ruleStatusFilter}
                  onChange={(e) => setRuleStatusFilter(e.target.value)}
                >
                  {UNIT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status] || status}
                    </option>
                  ))}
                </select>
                <Button variant="outline" onClick={() => void saveRules()}>
                  Save Rules
                </Button>
              </div>
            </div>
            <div className="rounded-md border border-[#E2E8F0] bg-white">
              <div className="overflow-x-auto overflow-y-hidden pb-2">
                <table className="w-max min-w-full border-collapse text-sm" style={{ minWidth: Math.max(820, 250 + screens.length * 120) }}>
                  <thead>
                    <tr className="bg-[#F8FAFC]">
                      <th className="sticky left-0 z-20 min-w-[220px] border-b border-r border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                        Persona
                      </th>
                      {screens.map((screen) => (
                        <th key={screen.id} className="min-w-[110px] border-b border-r border-[#E2E8F0] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                          {screen.section}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {personas.map((persona, idx) => (
                      <tr key={persona.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#FCFDFE]"}>
                        <td className="sticky left-0 z-10 border-b border-r border-[#EEF2F7] bg-inherit px-3 py-2 font-medium text-[#1E293B]">
                          {persona.key}
                        </td>
                        {screens.map((screen) => {
                          const checked = isRuleVisible(persona.key, screen.key, ruleStatusFilter);
                          return (
                            <td key={`${persona.id}-${screen.id}`} className="border-b border-r border-[#EEF2F7] px-3 py-2">
                              <label className="inline-flex items-center gap-2 text-xs text-[#334155]">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleRule(persona.key, screen.key, ruleStatusFilter)}
                                />
                                {checked ? "Visible" : "Hidden"}
                              </label>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ========== CREATE USER DIALOG ========== */}
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

      {/* ========== EDIT USER ROLES DIALOG ========== */}
      <Dialog open={isEditRolesOpen} onOpenChange={setIsEditRolesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Roles &mdash; {editRolesUserName}</DialogTitle>
            <DialogDescription>Select roles for this user.</DialogDescription>
          </DialogHeader>
          <div className="max-h-60 overflow-y-auto rounded-md border border-[#E2E8F0] p-2 space-y-2">
            {roles.map((role) => (
              <label key={role.id} className="flex items-center gap-2 text-sm text-[#334155]">
                <input type="checkbox" checked={editRoleIds.includes(role.id)} onChange={() => toggleEditRoleId(role.id)} />
                <span>{role.name}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditRolesOpen(false)}>Cancel</Button>
            <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white" onClick={() => void saveUserRoles()}>
              Save Roles
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== USER PERSONA OVERRIDE DIALOG ========== */}
      <Dialog open={isPersonaOverrideOpen} onOpenChange={setIsPersonaOverrideOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Persona Override &mdash; {personaOverrideUserName}</DialogTitle>
            <DialogDescription>
              Choose explicit personas for this user. These overrides are merged with role-derived personas.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-60 overflow-y-auto rounded-md border border-[#E2E8F0] p-2 space-y-2">
            {personas.map((persona) => (
              <label key={persona.id} className="flex items-center gap-2 text-sm text-[#334155]">
                <input
                  type="checkbox"
                  checked={personaOverrideKeys.includes(persona.key)}
                  onChange={() => togglePersonaOverrideKey(persona.key)}
                />
                <span>{persona.key}</span>
              </label>
            ))}
            {personas.length === 0 && (
              <p className="px-1 py-2 text-xs text-[#64748B]">
                No personas available. Create personas from Screen Governance tab.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPersonaOverrideOpen(false)}>Cancel</Button>
            <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white" onClick={() => void savePersonaOverride()}>
              Save Personas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== USER PERMISSION OVERRIDES DIALOG ========== */}
      <Dialog open={isOverridesOpen} onOpenChange={setIsOverridesOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Permission Overrides &mdash; {overridesUserName}</DialogTitle>
            <DialogDescription>
              Click a permission to cycle: none &rarr; grant (green) &rarr; deny (red) &rarr; none.
              Overrides take priority over role-based permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
            <div className="flex items-center justify-between gap-2">
              <Input value={overrideSearch} onChange={(e) => setOverrideSearch(e.target.value)} placeholder="Search permissions..." className="max-w-sm" />
              <Badge className="bg-[#E2E8F0] text-[#334155]">
                {userOverrides.length} override{userOverrides.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            <div className="rounded-md border border-[#E2E8F0] p-2 space-y-2 max-h-[50vh] overflow-y-auto">
              {overrideGroupedPermissions.map((group) => (
                <div key={group.module} className="space-y-1">
                  <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider px-1 pt-1">
                    {group.module}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {group.items.map((perm) => {
                      const state = getOverrideState(perm.key);
                      const bg = state === "grant"
                        ? "bg-[#DCFCE7] border-[#86EFAC]"
                        : state === "deny"
                        ? "bg-[#FEE2E2] border-[#FCA5A5]"
                        : "bg-white border-[#E2E8F0]";
                      const label = state === "grant" ? "GRANT" : state === "deny" ? "DENY" : "";
                      return (
                        <button key={perm.id} type="button" onClick={() => toggleOverride(perm.key)}
                          className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm text-left transition-colors ${bg}`}>
                          <span className="text-[#334155]">{perm.key}</span>
                          {label && (
                            <span className={`text-xs font-semibold ${state === "grant" ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                              {label}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {overrideGroupedPermissions.length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-[#64748B]">No permissions match.</div>
              )}
            </div>
          </div>
          <DialogFooter className="border-t border-[#E2E8F0] pt-3">
            <Button variant="outline" onClick={() => setIsOverridesOpen(false)}>Cancel</Button>
            <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white" onClick={() => void saveOverrides()}>
              Save Overrides
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== MULTI-STEP ROLE DIALOG (CREATE/EDIT) ========== */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingRoleId ? "Edit Role" : "Create Role"}</DialogTitle>
            <DialogDescription>
              Step {currentStepIndex + 1} of {ROLE_STEPS.length}: {roleStep}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicators */}
          <div className="flex items-center gap-1 px-1">
            {ROLE_STEPS.map((step, i) => (
              <button
                key={step}
                type="button"
                onClick={() => {
                  if (i <= currentStepIndex || canGoNext()) setRoleStep(step);
                }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  i === currentStepIndex
                    ? "bg-[#0B5FFF] text-white"
                    : i < currentStepIndex
                    ? "bg-[#DBEAFE] text-[#1D4ED8]"
                    : "bg-[#F1F5F9] text-[#64748B]"
                }`}
              >
                {step}
              </button>
            ))}
          </div>

          {/* Step content */}
          <div className="flex-1 overflow-y-auto py-3 pr-1 space-y-4 min-h-0">
            {/* STEP 1: Details */}
            {roleStep === "Details" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Role Name *</Label>
                  <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="e.g. Gate Supervisor" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={roleDescription} onChange={(e) => setRoleDescription(e.target.value)} placeholder="What this role is for..." />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Personas</Label>
                    <Badge className="bg-[#E2E8F0] text-[#334155]">
                      {selectedPersonaKeys.length} selected
                    </Badge>
                  </div>
                  <p className="text-xs text-[#64748B]">
                    Personas link this role to screen visibility rules (web/mobile).
                  </p>
                  <div className="max-h-44 overflow-y-auto rounded-md border border-[#E2E8F0] p-2">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {personas.map((persona) => (
                        <label key={persona.id} className="flex items-center gap-2 text-sm text-[#334155]">
                          <input
                            type="checkbox"
                            checked={selectedPersonaKeys.includes(persona.key)}
                            onChange={() => togglePersonaKey(persona.key)}
                          />
                          <span>{persona.key}</span>
                        </label>
                      ))}
                    </div>
                    {personas.length === 0 && (
                      <p className="px-1 py-2 text-xs text-[#64748B]">
                        No personas found. Create personas in Screen Governance tab first.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Module Access */}
            {roleStep === "Module Access" && (
              <div className="space-y-3">
                <p className="text-sm text-[#64748B]">
                  Toggle which modules/pages this role can access. This controls navigation visibility and route-level access.
                </p>
                <div className="flex gap-2 mb-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setSelectedModuleKeys([...DEFAULT_MODULE_KEYS])}>
                    Select All
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setSelectedModuleKeys([])}>
                    Clear All
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {DEFAULT_MODULE_KEYS.map((moduleKey) => {
                    const isOn = selectedModuleKeys.includes(moduleKey);
                    return (
                      <button
                        key={moduleKey}
                        type="button"
                        onClick={() => toggleModuleKey(moduleKey)}
                        className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                          isOn
                            ? "bg-[#EFF6FF] border-[#3B82F6] text-[#1D4ED8]"
                            : "bg-white border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]"
                        }`}
                      >
                        <div className={`h-4 w-4 rounded border-2 flex items-center justify-center ${
                          isOn ? "border-[#3B82F6] bg-[#3B82F6]" : "border-[#CBD5E1]"
                        }`}>
                          {isOn && <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        {MODULE_LABELS[moduleKey] || moduleKey}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 3: Permissions (Base + Status) */}
            {roleStep === "Permissions" && (
              <div className="space-y-4">
                <Tabs defaultValue="base" className="space-y-3">
                  <TabsList className="grid w-full grid-cols-4 max-w-[500px]">
                    <TabsTrigger value="base">Base</TabsTrigger>
                    {UNIT_STATUSES.map((s) => (
                      <TabsTrigger key={s} value={s}>{STATUS_LABELS[s]}</TabsTrigger>
                    ))}
                  </TabsList>

                  {/* Base permissions */}
                  <TabsContent value="base" className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-[#64748B]">Base permissions apply regardless of unit status.</p>
                      <Badge className="bg-[#E2E8F0] text-[#334155]">{selectedPermissionKeys.length} selected</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Input value={permissionSearch} onChange={(e) => setPermissionSearch(e.target.value)} placeholder="Search..." className="max-w-sm" />
                      <Button type="button" variant="outline" size="sm" onClick={selectAllFiltered}>Select All</Button>
                      <Button type="button" variant="outline" size="sm" onClick={clearFiltered}>Clear</Button>
                    </div>
                    <div className="rounded-md border border-[#E2E8F0] p-2 space-y-2 max-h-[40vh] overflow-y-auto">
                      {groupedPermissions.map((group) => {
                        const isExpanded = expandedModules.includes(group.module);
                        return (
                          <div key={group.module} className="rounded-md border border-[#E2E8F0] bg-white">
                            <button type="button" onClick={() => toggleModule(group.module)} className="w-full flex items-center justify-between px-3 py-2 text-left">
                              <span className="inline-flex items-center gap-2 text-sm font-medium text-[#1E293B]">
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                {group.module}
                              </span>
                              <Badge className="bg-[#F1F5F9] text-[#334155]">{group.items.length}</Badge>
                            </button>
                            {isExpanded && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 px-3 pb-3">
                                {group.items.map((perm) => (
                                  <label key={perm.id} className="flex items-center gap-2 text-sm text-[#334155]">
                                    <input type="checkbox" checked={selectedPermissionKeys.includes(perm.key)} onChange={() => togglePermissionKey(perm.key)} />
                                    <span>{perm.key}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {groupedPermissions.length === 0 && (
                        <div className="px-3 py-6 text-center text-sm text-[#64748B]">No permissions match.</div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Status-specific permissions */}
                  {UNIT_STATUSES.map((status) => (
                    <TabsContent key={status} value={status} className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-[#64748B]">
                          Permissions that apply only when user's unit is <strong>{STATUS_LABELS[status]}</strong>.
                          These are merged with base permissions.
                        </p>
                        <Badge className="bg-[#E2E8F0] text-[#334155]">{(roleStatusPerms[status] ?? []).length} selected</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Input value={activeStatusTab === status ? statusPermSearch : ""} onChange={(e) => { setActiveStatusTab(status); setStatusPermSearch(e.target.value); }} onFocus={() => setActiveStatusTab(status)} placeholder="Search..." className="max-w-sm" />
                        <Button type="button" variant="outline" size="sm" onClick={() => { setActiveStatusTab(status); selectAllStatusPerms(); }}>Select All</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => { setActiveStatusTab(status); clearAllStatusPerms(); }}>Clear</Button>
                      </div>
                      <div className="rounded-md border border-[#E2E8F0] p-2 space-y-2 max-h-[40vh] overflow-y-auto">
                        {statusGroupedPermissions.map((group) => (
                          <div key={group.module} className="rounded-md border border-[#E2E8F0] bg-white">
                            <div className="px-3 py-2 text-sm font-medium text-[#1E293B]">{group.module}</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 px-3 pb-3">
                              {group.items.map((perm) => (
                                <label key={perm.id} className="flex items-center gap-2 text-sm text-[#334155]" onClick={() => setActiveStatusTab(status)}>
                                  <input type="checkbox" checked={(roleStatusPerms[status] ?? []).includes(perm.key)} onChange={() => { setActiveStatusTab(status); toggleStatusPerm(perm.key); }} />
                                  <span>{humanize(perm.key)}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                        {statusGroupedPermissions.length === 0 && (
                          <div className="px-3 py-6 text-center text-sm text-[#64748B]">
                            Enable modules in Step 2 to see permissions here.
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            )}

            {/* STEP 4: Review */}
            {roleStep === "Review" && (
              <div className="space-y-4">
                <Card className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                    <div>
                      <span className="text-[#64748B]">Role Name</span>
                      <p className="font-medium text-[#1E293B]">{reviewSummary.name || "—"}</p>
                    </div>
                    <div>
                      <span className="text-[#64748B]">Description</span>
                      <p className="font-medium text-[#1E293B]">{reviewSummary.description || "—"}</p>
                    </div>
                    <div>
                      <span className="text-[#64748B]">Base Permissions</span>
                      <p className="font-medium text-[#1E293B]">{reviewSummary.permissionCount}</p>
                    </div>
                    <div>
                      <span className="text-[#64748B]">Status Permissions</span>
                      <p className="font-medium text-[#1E293B]">{reviewSummary.statusPermCount}</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-[#1E293B]">Module Access</h4>
                  <div className="flex flex-wrap gap-1">
                    {reviewSummary.modules.length > 0 ? reviewSummary.modules.map((m) => (
                      <Badge key={m} className="bg-[#DBEAFE] text-[#1D4ED8]">{m}</Badge>
                    )) : <span className="text-sm text-[#64748B]">No modules selected</span>}
                  </div>
                </Card>
                <Card className="p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-[#1E293B]">Personas</h4>
                  <div className="flex flex-wrap gap-1">
                    {reviewSummary.personas.length > 0 ? reviewSummary.personas.map((key) => (
                      <Badge key={key} className="bg-[#F5F3FF] text-[#6D28D9]">{key}</Badge>
                    )) : <span className="text-sm text-[#64748B]">No personas linked</span>}
                  </div>
                </Card>
                <Card className="p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-[#1E293B]">Base Permission Keys</h4>
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                    {selectedPermissionKeys.length > 0 ? selectedPermissionKeys.map((k) => (
                      <Badge key={k} className="bg-[#F1F5F9] text-[#334155]">{k}</Badge>
                    )) : <span className="text-sm text-[#64748B]">None</span>}
                  </div>
                </Card>
                {Object.entries(roleStatusPerms).some(([, v]) => v.length > 0) && (
                  <Card className="p-4 space-y-2">
                    <h4 className="text-sm font-semibold text-[#1E293B]">Status-Specific Permissions</h4>
                    {UNIT_STATUSES.map((s) => {
                      const keys = roleStatusPerms[s] ?? [];
                      if (keys.length === 0) return null;
                      return (
                        <div key={s}>
                          <p className="text-xs font-semibold text-[#64748B] uppercase">{STATUS_LABELS[s]} ({keys.length})</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {keys.map((k) => (
                              <Badge key={k} className="bg-[#F1F5F9] text-[#334155]">{k}</Badge>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </Card>
                )}
              </div>
            )}
          </div>

          {/* Footer with step navigation */}
          <DialogFooter className="border-t border-[#E2E8F0] pt-3 flex justify-between">
            <div className="flex gap-2">
              {currentStepIndex > 0 && (
                <Button variant="outline" onClick={goBack}>Back</Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>Cancel</Button>
              {roleStep === "Review" ? (
                <Button className="bg-[#00B386] hover:bg-[#00B386]/90 text-white" onClick={() => void upsertRole()}>
                  {editingRoleId ? "Save Role" : "Create Role"}
                </Button>
              ) : (
                <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white" disabled={!canGoNext()} onClick={goNext}>
                  Next
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
