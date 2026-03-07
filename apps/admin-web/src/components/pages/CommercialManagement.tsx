import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Pencil, Plus, RefreshCw, Trash2, UserCog, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { DataTable, type DataTableColumn } from "../DataTable";
import { Textarea } from "../ui/textarea";
import commercialService, {
  COMMERCIAL_MEMBER_ROLES,
  COMMERCIAL_PERMISSION_KEYS,
  CommercialEntity,
  CommercialEntityMember,
  CommercialMemberPermissions,
  CommercialMemberRole,
} from "../../lib/commercial-service";
import { errorMessage, formatDateTime, getStatusColorClass, humanizeEnum } from "../../lib/live-data";

type EntityFormState = {
  name: string;
  description: string;
  communityId: string;
  unitId: string;
  ownerUserId: string;
};

type MemberFormState = {
  userId: string;
  role: CommercialMemberRole;
  isActive: boolean;
  permissions: CommercialMemberPermissions;
};

type OptionRow = {
  id: string;
  label: string;
};

type UnitOptionRow = {
  id: string;
  label: string;
  communityId: string | null;
};

const EMPTY_PERMISSIONS: CommercialMemberPermissions = {
  can_work_orders: false,
  can_attendance: false,
  can_service_requests: false,
  can_tickets: false,
  can_photo_upload: false,
  can_task_reminders: false,
};

const FULL_PERMISSIONS: CommercialMemberPermissions = {
  can_work_orders: true,
  can_attendance: true,
  can_service_requests: true,
  can_tickets: true,
  can_photo_upload: true,
  can_task_reminders: true,
};

const PERMISSION_LABELS: Record<keyof CommercialMemberPermissions, string> = {
  can_work_orders: "Work orders",
  can_attendance: "Attendance",
  can_service_requests: "Service requests",
  can_tickets: "Ticket handling",
  can_photo_upload: "Photo uploads",
  can_task_reminders: "Task reminders",
};

const INITIAL_ENTITY_FORM: EntityFormState = {
  name: "",
  description: "",
  communityId: "",
  unitId: "",
  ownerUserId: "",
};

const INITIAL_MEMBER_FORM: MemberFormState = {
  userId: "",
  role: "STAFF",
  isActive: true,
  permissions: { ...EMPTY_PERMISSIONS },
};

function memberDefaultPermissions(role: CommercialMemberRole): CommercialMemberPermissions {
  if (role === "OWNER" || role === "HR") {
    return { ...FULL_PERMISSIONS };
  }
  return { ...EMPTY_PERMISSIONS };
}

function activePermissionLabels(permissions: CommercialMemberPermissions): string[] {
  return COMMERCIAL_PERMISSION_KEYS.filter((key) => permissions[key]).map((key) => PERMISSION_LABELS[key]);
}

function memberLabel(member: CommercialEntityMember, userLabel: string): string {
  return `${userLabel} (${humanizeEnum(member.role)})`;
}

type MemberListProps = {
  title: string;
  members: CommercialEntityMember[];
  usersById: Map<string, string>;
  onEdit: (member: CommercialEntityMember) => void;
  onArchive: (member: CommercialEntityMember) => void;
};

function MemberList(props: MemberListProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-[#0F172A]">{props.title}</h4>
      {props.members.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#CBD5E1] p-3 text-xs text-[#64748B]">No records</p>
      ) : (
        props.members.map((member) => {
          const userLabel = props.usersById.get(member.userId) ?? member.userId;
          const permissionLabels = activePermissionLabels(member.permissions);

          return (
            <div key={member.id} className="rounded-lg border border-[#E2E8F0] bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-[#0F172A]">{memberLabel(member, userLabel)}</p>
                <div className="flex items-center gap-2">
                  <Badge className={member.isActive ? getStatusColorClass("ACTIVE") : getStatusColorClass("INACTIVE")}>
                    {member.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => props.onEdit(member)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => props.onArchive(member)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="mt-1 text-xs text-[#64748B]">Updated {formatDateTime(member.updatedAt)}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {permissionLabels.length > 0 ? (
                  permissionLabels.map((label) => (
                    <Badge key={`${member.id}-${label}`} className="bg-[#F1F5F9] text-[#334155]">
                      {label}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-[#94A3B8]">No permission flags enabled</span>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export function CommercialManagement() {
  const [entities, setEntities] = useState<CommercialEntity[]>([]);
  const [members, setMembers] = useState<CommercialEntityMember[]>([]);

  const [communityOptions, setCommunityOptions] = useState<OptionRow[]>([]);
  const [unitOptions, setUnitOptions] = useState<UnitOptionRow[]>([]);
  const [userOptions, setUserOptions] = useState<OptionRow[]>([]);

  const [communityFilterId, setCommunityFilterId] = useState("all");
  const [unitFilterId, setUnitFilterId] = useState("all");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [search, setSearch] = useState("");

  const [selectedEntityId, setSelectedEntityId] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [entityDialogOpen, setEntityDialogOpen] = useState(false);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [entityForm, setEntityForm] = useState<EntityFormState>(INITIAL_ENTITY_FORM);

  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState<MemberFormState>(INITIAL_MEMBER_FORM);

  const usersById = useMemo(() => {
    const map = new Map<string, string>();
    userOptions.forEach((row) => map.set(row.id, row.label));
    return map;
  }, [userOptions]);

  const communityById = useMemo(() => {
    const map = new Map<string, string>();
    communityOptions.forEach((row) => map.set(row.id, row.label));
    return map;
  }, [communityOptions]);

  const unitById = useMemo(() => {
    const map = new Map<string, string>();
    unitOptions.forEach((row) => map.set(row.id, row.label));
    return map;
  }, [unitOptions]);

  const selectedEntity = useMemo(
    () => entities.find((entity) => entity.id === selectedEntityId) ?? null,
    [entities, selectedEntityId],
  );

  const activeEntities = useMemo(
    () => entities.filter((entity) => entity.isActive),
    [entities],
  );

  const filteredEntities = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return entities;
    }

    return entities.filter((entity) => {
      const ownerName = entity.owner?.userId ? usersById.get(entity.owner.userId) ?? entity.owner.userId : "";
      const haystack = [
        entity.name,
        entity.description ?? "",
        communityById.get(entity.communityId) ?? entity.communityId,
        unitById.get(entity.unitId) ?? entity.unitId,
        ownerName,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [communityById, entities, search, unitById, usersById]);

  const ownerMembers = useMemo(
    () => members.filter((member) => member.role === "OWNER"),
    [members],
  );

  const hrMembers = useMemo(
    () => members.filter((member) => member.role === "HR"),
    [members],
  );

  const staffMembers = useMemo(
    () => members.filter((member) => member.role === "STAFF"),
    [members],
  );

  const availableUnitsForForm = useMemo(() => {
    if (!entityForm.communityId) {
      return unitOptions;
    }
    return unitOptions.filter((unit) => unit.communityId === entityForm.communityId);
  }, [entityForm.communityId, unitOptions]);

  const loadOptions = useCallback(async () => {
    const [communities, units, users] = await Promise.all([
      commercialService.listCommunityOptions(),
      commercialService.listUnitOptions(),
      commercialService.listUserOptions(),
    ]);

    setCommunityOptions(communities);
    setUnitOptions(units);
    setUserOptions(users);
  }, []);

  const loadEntities = useCallback(
    async (opts?: { preserveSelection?: boolean }) => {
      setLoading(true);
      try {
        const rows = await commercialService.listEntities({
          communityId: communityFilterId !== "all" ? communityFilterId : undefined,
          unitId: unitFilterId !== "all" ? unitFilterId : undefined,
          includeInactive,
        });

        setEntities(rows);

        if (rows.length === 0) {
          setSelectedEntityId("");
          return;
        }

        if (opts?.preserveSelection && rows.some((row) => row.id === selectedEntityId)) {
          return;
        }

        setSelectedEntityId(rows[0].id);
      } catch (error) {
        toast.error("Failed to load commercial entities", {
          description: errorMessage(error),
        });
      } finally {
        setLoading(false);
      }
    },
    [communityFilterId, includeInactive, selectedEntityId, unitFilterId],
  );

  const loadMembers = useCallback(async (entityId: string) => {
    if (!entityId) {
      setMembers([]);
      return;
    }

    setMembersLoading(true);
    try {
      const rows = await commercialService.listMembers(entityId);
      setMembers(rows);
    } catch (error) {
      toast.error("Failed to load entity members", {
        description: errorMessage(error),
      });
    } finally {
      setMembersLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await loadOptions();
      await loadEntities();
    } finally {
      setLoading(false);
    }
  }, [loadEntities, loadOptions]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    void loadEntities({ preserveSelection: true });
  }, [communityFilterId, includeInactive, unitFilterId, loadEntities]);

  useEffect(() => {
    void loadMembers(selectedEntityId);
  }, [loadMembers, selectedEntityId]);

  const openCreateEntity = () => {
    setEditingEntityId(null);
    setEntityForm(INITIAL_ENTITY_FORM);
    setEntityDialogOpen(true);
  };

  const openEditEntity = (entity: CommercialEntity) => {
    setEditingEntityId(entity.id);
    setEntityForm({
      name: entity.name,
      description: entity.description ?? "",
      communityId: entity.communityId,
      unitId: entity.unitId,
      ownerUserId: entity.owner?.userId ?? "",
    });
    setEntityDialogOpen(true);
  };

  const saveEntity = async () => {
    if (!entityForm.name.trim() || !entityForm.communityId || !entityForm.unitId) {
      toast.error("Entity name, community, and unit are required");
      return;
    }

    if (!editingEntityId && !entityForm.ownerUserId) {
      toast.error("Owner user is required for new entities");
      return;
    }

    setSaving(true);
    try {
      if (editingEntityId) {
        await commercialService.updateEntity(editingEntityId, {
          name: entityForm.name.trim(),
          description: entityForm.description.trim() || undefined,
          communityId: entityForm.communityId,
          unitId: entityForm.unitId,
        });
        toast.success("Commercial entity updated");
      } else {
        const created = await commercialService.createEntity({
          name: entityForm.name.trim(),
          description: entityForm.description.trim() || undefined,
          communityId: entityForm.communityId,
          unitId: entityForm.unitId,
          ownerUserId: entityForm.ownerUserId,
        });
        setSelectedEntityId(created.id);
        toast.success("Commercial entity created");
      }

      setEntityDialogOpen(false);
      await loadEntities({ preserveSelection: true });
      await loadMembers(selectedEntityId);
    } catch (error) {
      toast.error("Failed to save commercial entity", {
        description: errorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const removeEntity = async (entity: CommercialEntity) => {
    const confirmed = window.confirm(`Archive entity "${entity.name}"?`);
    if (!confirmed) return;

    try {
      await commercialService.removeEntity(entity.id);
      toast.success("Commercial entity archived");
      await loadEntities();
      setMembers([]);
    } catch (error) {
      toast.error("Failed to archive entity", {
        description: errorMessage(error),
      });
    }
  };

  const openAddMember = (role: CommercialMemberRole) => {
    if (!selectedEntityId) {
      toast.error("Select an entity first");
      return;
    }

    setEditingMemberId(null);
    setMemberForm({
      userId: "",
      role,
      isActive: true,
      permissions: memberDefaultPermissions(role),
    });
    setMemberDialogOpen(true);
  };

  const openEditMember = (member: CommercialEntityMember) => {
    setEditingMemberId(member.id);
    setMemberForm({
      userId: member.userId,
      role: member.role,
      isActive: member.isActive,
      permissions: { ...member.permissions },
    });
    setMemberDialogOpen(true);
  };

  const setMemberRole = (role: CommercialMemberRole) => {
    setMemberForm((prev) => ({
      ...prev,
      role,
      permissions: memberDefaultPermissions(role),
    }));
  };

  const togglePermission = (key: keyof CommercialMemberPermissions) => {
    setMemberForm((prev) => {
      if (prev.role !== "STAFF") {
        return prev;
      }
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [key]: !prev.permissions[key],
        },
      };
    });
  };

  const saveMember = async () => {
    if (!memberForm.userId && !editingMemberId) {
      toast.error("Select a user");
      return;
    }

    const permissions =
      memberForm.role === "STAFF" ? memberForm.permissions : memberDefaultPermissions(memberForm.role);

    setSaving(true);
    try {
      if (editingMemberId) {
        await commercialService.updateMember(editingMemberId, {
          role: memberForm.role,
          isActive: memberForm.isActive,
          permissions,
        });
        toast.success("Member updated");
      } else {
        if (!selectedEntityId) {
          toast.error("Select an entity first");
          return;
        }

        await commercialService.addMember(selectedEntityId, {
          userId: memberForm.userId,
          role: memberForm.role,
          permissions,
        });
        toast.success("Member added");
      }

      setMemberDialogOpen(false);
      await loadMembers(selectedEntityId);
      await loadEntities({ preserveSelection: true });
    } catch (error) {
      toast.error("Failed to save member", {
        description: errorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (member: CommercialEntityMember) => {
    const label = usersById.get(member.userId) ?? member.userId;
    const confirmed = window.confirm(`Archive member "${label}"?`);
    if (!confirmed) return;

    try {
      await commercialService.removeMember(member.id);
      toast.success("Member archived");
      await loadMembers(selectedEntityId);
      await loadEntities({ preserveSelection: true });
    } catch (error) {
      toast.error("Failed to archive member", {
        description: errorMessage(error),
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl text-[#0F172A]">Commercial Module</h1>
            <p className="text-sm text-[#64748B]">
              Manage commercial entities and member hierarchy (Owner, HR, Staff).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void refreshAll()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={openCreateEntity}>
              <Plus className="mr-2 h-4 w-4" />
              Create Entity
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-[#E2E8F0] p-3">
            <p className="text-xs text-[#64748B]">Entities</p>
            <p className="text-lg text-[#0F172A]">{entities.length}</p>
          </div>
          <div className="rounded-lg border border-[#E2E8F0] p-3">
            <p className="text-xs text-[#64748B]">Active entities</p>
            <p className="text-lg text-[#0F172A]">{activeEntities.length}</p>
          </div>
          <div className="rounded-lg border border-[#E2E8F0] p-3">
            <p className="text-xs text-[#64748B]">Selected entity members</p>
            <p className="text-lg text-[#0F172A]">{selectedEntity?.memberCount ?? 0}</p>
          </div>
          <div className="rounded-lg border border-[#E2E8F0] p-3">
            <p className="text-xs text-[#64748B]">Hierarchy level</p>
            <p className="text-lg text-[#0F172A]">Owner - HR - Staff</p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Select value={communityFilterId} onValueChange={setCommunityFilterId}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by community" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All communities</SelectItem>
              {communityOptions.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={unitFilterId} onValueChange={setUnitFilterId}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All units</SelectItem>
              {unitOptions.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, owner, community, unit"
          />

          <label className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] px-3 text-sm text-[#334155]">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
            />
            Include inactive
          </label>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] p-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#0B5FFF]" />
              <h3 className="text-[#0F172A]">Commercial Entities</h3>
            </div>
            {loading ? <span className="text-xs text-[#64748B]">Loading...</span> : null}
          </div>

          {(() => {
            const cols: DataTableColumn<CommercialEntity>[] = [
              { key: "name", header: "Name", render: (e) => <span className="font-medium text-[#0F172A]">{e.name}</span> },
              { key: "community", header: "Community", render: (e) => <span>{communityById.get(e.communityId) ?? e.communityId}</span> },
              { key: "owner", header: "Owner", render: (e) => <span>{e.owner ? usersById.get(e.owner.userId) ?? e.owner.userId : "No owner"}</span> },
              { key: "status", header: "Status", render: (e) => <Badge className={getStatusColorClass(e.isActive ? "ACTIVE" : "INACTIVE")}>{e.isActive ? "Active" : "Inactive"}</Badge> },
              { key: "actions", header: "Actions", render: (e) => (
                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={(ev: React.MouseEvent) => { ev.stopPropagation(); openEditEntity(e); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="outline" size="sm" onClick={(ev: React.MouseEvent) => { ev.stopPropagation(); void removeEntity(e); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              )},
            ];
            return (
              <DataTable
                columns={cols}
                rows={filteredEntities}
                rowKey={(e) => e.id}
                loading={loading}
                emptyTitle="No commercial entities found"
                rowClassName={(e) => selectedEntityId === e.id ? "bg-[#EFF6FF]" : ""}
                onRowClick={(e) => setSelectedEntityId(e.id)}
              />
            );
          })()}
        </Card>

        <Card className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-[#0F172A]">Hierarchy View</h3>
              <p className="text-xs text-[#64748B]">Owner - HR - Staff</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => openAddMember("HR")}>
                <UserCog className="mr-1 h-4 w-4" />
                Add HR
              </Button>
              <Button variant="outline" size="sm" onClick={() => openAddMember("STAFF")}>
                <Users className="mr-1 h-4 w-4" />
                Add Staff
              </Button>
            </div>
          </div>

          {!selectedEntity ? (
            <p className="rounded-lg border border-dashed border-[#CBD5E1] p-4 text-sm text-[#64748B]">
              Select a commercial entity to view its hierarchy.
            </p>
          ) : (
            <>
              <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <p className="text-sm font-medium text-[#0F172A]">{selectedEntity.name}</p>
                <p className="text-xs text-[#64748B]">{selectedEntity.description || "No description"}</p>
                <p className="mt-2 text-xs text-[#64748B]">
                  Community: {communityById.get(selectedEntity.communityId) ?? selectedEntity.communityId}
                </p>
                <p className="text-xs text-[#64748B]">
                  Unit: {unitById.get(selectedEntity.unitId) ?? selectedEntity.unitId}
                </p>
                <p className="text-xs text-[#64748B]">Updated {formatDateTime(selectedEntity.updatedAt)}</p>
              </div>

              {membersLoading ? <p className="text-sm text-[#64748B]">Loading members...</p> : null}

              <MemberList
                title="Owner"
                members={ownerMembers}
                usersById={usersById}
                onEdit={openEditMember}
                onArchive={(member) => void removeMember(member)}
              />
              <MemberList
                title="HR"
                members={hrMembers}
                usersById={usersById}
                onEdit={openEditMember}
                onArchive={(member) => void removeMember(member)}
              />
              <MemberList
                title="Staff"
                members={staffMembers}
                usersById={usersById}
                onEdit={openEditMember}
                onArchive={(member) => void removeMember(member)}
              />
            </>
          )}
        </Card>
      </div>

      <Dialog open={entityDialogOpen} onOpenChange={setEntityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEntityId ? "Edit Commercial Entity" : "Create Commercial Entity"}</DialogTitle>
            <DialogDescription>
              Entity is the business record linked to one community and one commercial unit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={entityForm.name}
                onChange={(event) => setEntityForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Downtown Pharmacy"
              />
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={entityForm.description}
                onChange={(event) =>
                  setEntityForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="24/7 medical and healthcare retail"
              />
            </div>

            <div className="space-y-2">
              <Label>Community</Label>
              <Select
                value={entityForm.communityId || "none"}
                onValueChange={(value) =>
                  setEntityForm((prev) => ({
                    ...prev,
                    communityId: value === "none" ? "" : value,
                    unitId: "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select community" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select community</SelectItem>
                  {communityOptions.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Unit</Label>
              <Select
                value={entityForm.unitId || "none"}
                onValueChange={(value) =>
                  setEntityForm((prev) => ({
                    ...prev,
                    unitId: value === "none" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select unit</SelectItem>
                  {availableUnitsForForm.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!editingEntityId ? (
              <div className="space-y-2">
                <Label>Commercial Owner User</Label>
                <Select
                  value={entityForm.ownerUserId || "none"}
                  onValueChange={(value) =>
                    setEntityForm((prev) => ({
                      ...prev,
                      ownerUserId: value === "none" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select owner user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select owner user</SelectItem>
                    {userOptions.map((row) => (
                      <SelectItem key={row.id} value={row.id}>
                        {row.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="text-xs text-[#64748B]">
                Owner is managed via member assignments in hierarchy view.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEntityDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void saveEntity()} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingMemberId ? "Edit Member" : "Add Member"}</DialogTitle>
            <DialogDescription>
              Assign user role and permission flags for this commercial entity.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>User</Label>
                <Select
                  value={memberForm.userId || "none"}
                  onValueChange={(value) =>
                    setMemberForm((prev) => ({
                      ...prev,
                      userId: value === "none" ? "" : value,
                    }))
                  }
                  disabled={Boolean(editingMemberId)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select user</SelectItem>
                    {userOptions.map((row) => (
                      <SelectItem key={row.id} value={row.id}>
                        {row.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={memberForm.role} onValueChange={(value) => setMemberRole(value as CommercialMemberRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMERCIAL_MEMBER_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {humanizeEnum(role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {editingMemberId ? (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={memberForm.isActive ? "active" : "inactive"}
                  onValueChange={(value) =>
                    setMemberForm((prev) => ({
                      ...prev,
                      isActive: value === "active",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Permission Flags</Label>
              <div className="grid grid-cols-1 gap-2 rounded-lg border border-[#E2E8F0] p-3 md:grid-cols-2">
                {COMMERCIAL_PERMISSION_KEYS.map((key) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-[#334155]">
                    <input
                      type="checkbox"
                      checked={memberForm.permissions[key]}
                      onChange={() => togglePermission(key)}
                      disabled={memberForm.role !== "STAFF"}
                    />
                    <span>{PERMISSION_LABELS[key]}</span>
                  </label>
                ))}
              </div>
              {memberForm.role !== "STAFF" ? (
                <p className="text-xs text-[#64748B]">
                  Owner and HR members receive full permissions by default.
                </p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void saveMember()} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
