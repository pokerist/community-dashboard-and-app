import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Label } from "../ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Search, Plus, MoreVertical, Trash2, Ban } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Avatar, AvatarFallback } from "../ui/avatar";
import apiClient from "../../lib/api-client";
import {
  errorMessage,
  formatDate,
  getStatusColorClass,
  humanizeEnum,
  maskNationalId,
  toInitials,
} from "../../lib/live-data";

type ResidentRow = {
  id: string;
  name: string;
  nameAr: string;
  nationalId: string;
  mobile: string;
  email: string;
  units: string[];
  status: string;
  registrationDate: string;
  avatar: string;
};

type UnitOption = {
  id: string;
  label: string;
};

type CreateResidentForm = {
  nameEN: string;
  nameAR: string;
  email: string;
  phone: string;
  password: string;
  nationalId: string;
  dateOfBirth: string;
  unitId: string;
  unitRole: "FAMILY" | "TENANT" | "OWNER";
};

const defaultCreateResidentForm: CreateResidentForm = {
  nameEN: "",
  nameAR: "",
  email: "",
  phone: "",
  password: "",
  nationalId: "",
  dateOfBirth: "",
  unitId: "",
  unitRole: "FAMILY",
};

export function ResidentManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreatingResident, setIsCreatingResident] = useState(false);
  const [rows, setRows] = useState<ResidentRow[]>([]);
  const [unitOptions, setUnitOptions] = useState<UnitOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createResidentForm, setCreateResidentForm] = useState<CreateResidentForm>(
    defaultCreateResidentForm,
  );

  const loadResidents = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [response, unitsResponse] = await Promise.all([
        apiClient.get("/admin/users", {
          params: { userType: "resident", take: 200, skip: 0 },
        }),
        apiClient.get("/units", {
          params: { page: 1, limit: 100 },
        }),
      ]);

      const users = Array.isArray(response.data) ? response.data : [];
      const mapped: ResidentRow[] = users.map((user: any) => {
        const unitLabels =
          user?.resident?.residentUnits?.map((ru: any) => {
            const unit = ru?.unit;
            if (!unit) return null;
            const block = unit.block ? `${unit.block}-` : "";
            return `${block}${unit.unitNumber}`;
          })?.filter(Boolean) ?? [];

        return {
          id: user.id,
          name: user.nameEN ?? "—",
          nameAr: user.nameAR ?? "—",
          nationalId: maskNationalId(user?.resident?.nationalId),
          mobile: user.phone ?? "—",
          email: user.email ?? "—",
          units: unitLabels.length > 0 ? unitLabels : ["—"],
          status: humanizeEnum(user.userStatus ?? "ACTIVE"),
          registrationDate: formatDate(user.createdAt),
          avatar: toInitials(user.nameEN),
        };
      });

      setRows(mapped);
      const rawUnits = Array.isArray(unitsResponse.data?.data)
        ? unitsResponse.data.data
        : Array.isArray(unitsResponse.data)
          ? unitsResponse.data
          : [];
      setUnitOptions(
        rawUnits
          .map((unit: any) => ({
            id: String(unit.id),
            label:
              [unit.projectName, unit.block ? `Block ${unit.block}` : null, unit.unitNumber ? `Unit ${unit.unitNumber}` : null]
                .filter(Boolean)
                .join(" - ") || String(unit.id),
          }))
          .filter((unit: UnitOption) => !!unit.id),
      );
    } catch (error) {
      const msg = errorMessage(error);
      setLoadError(msg);
      toast.error("Failed to load residents", { description: msg });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadResidents();
  }, [loadResidents]);

  const handleCreateResident = async () => {
    if (!createResidentForm.nameEN.trim()) {
      toast.error("Resident name is required");
      return;
    }

    if (!createResidentForm.email.trim() && !createResidentForm.phone.trim()) {
      toast.error("Provide at least email or phone");
      return;
    }

    setIsCreatingResident(true);
    let createdUserId: string | null = null;
    try {
      const userResponse = await apiClient.post("/admin/users", {
        nameEN: createResidentForm.nameEN.trim(),
        nameAR: createResidentForm.nameAR.trim() || undefined,
        email: createResidentForm.email.trim() || undefined,
        phone: createResidentForm.phone.trim() || undefined,
        password: createResidentForm.password.trim() || undefined,
        signupSource: "dashboard",
      });

      createdUserId = userResponse.data?.id;
      if (!createdUserId) {
        throw new Error("User creation did not return an id");
      }

      await apiClient.post("/admin/users/residents", {
        userId: createdUserId,
        nationalId: createResidentForm.nationalId.trim() || undefined,
        dateOfBirth: createResidentForm.dateOfBirth
          ? new Date(createResidentForm.dateOfBirth).toISOString()
          : undefined,
      });

      if (createResidentForm.unitId) {
        await apiClient.post(`/units/${createResidentForm.unitId}/assign-user`, {
          userId: createdUserId,
          role: createResidentForm.unitRole,
        });
      }

      toast.success("Resident created", {
        description: createResidentForm.unitId
          ? "User, resident profile, and unit assignment were created."
          : "User and resident profile were created.",
      });
      setCreateResidentForm(defaultCreateResidentForm);
      setIsCreateDialogOpen(false);
      await loadResidents();
    } catch (error) {
      const msg = errorMessage(error);
      toast.error("Failed to create resident", {
        description: createdUserId
          ? `User may have been created (ID: ${createdUserId}) but resident/profile assignment failed. ${msg}`
          : msg,
      });
    } finally {
      setIsCreatingResident(false);
    }
  };

  const handleDeleteResident = async (id: string, name: string) => {
    try {
      await apiClient.delete(`/admin/users/${id}`);
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success("Resident deactivated", {
        description: `${name} has been deactivated in the backend.`,
      });
    } catch (error) {
      toast.error("Failed to deactivate resident", { description: errorMessage(error) });
    }
  };

  const handleToggleSuspend = async (id: string, name: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const nextStatus = row.status.toUpperCase() === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    try {
      await apiClient.patch(`/admin/users/${id}`, { userStatus: nextStatus });
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: humanizeEnum(nextStatus) } : r)),
      );
      toast.success(`Resident ${nextStatus === "SUSPENDED" ? "suspended" : "activated"}`, {
        description: `${name} status updated in backend.`,
      });
    } catch (error) {
      toast.error("Failed to update status", { description: errorMessage(error) });
    }
  };

  const filteredRows = useMemo(() => {
    return rows.filter((resident) => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !q ||
        resident.name.toLowerCase().includes(q) ||
        resident.email.toLowerCase().includes(q) ||
        resident.mobile.toLowerCase().includes(q) ||
        resident.units.some((u) => u.toLowerCase().includes(q));
      const matchesStatus =
        statusFilter === "all" || resident.status.toUpperCase() === statusFilter.toUpperCase();
      return matchesSearch && matchesStatus;
    });
  }, [rows, searchTerm, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[#1E293B]">Resident Management</h1>
          <p className="text-[#64748B] mt-1">Live resident records from the backend (no mock data).</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadResidents()} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white rounded-lg gap-2">
                <Plus className="w-4 h-4" />
                Add Resident
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Resident</DialogTitle>
                <DialogDescription>
                  Creates base user, resident profile, and optional unit assignment.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name (EN)</Label>
                  <Input
                    value={createResidentForm.nameEN}
                    onChange={(e) => setCreateResidentForm((p) => ({ ...p, nameEN: e.target.value }))}
                    placeholder="Ahmed Ali"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Name (AR)</Label>
                  <Input
                    value={createResidentForm.nameAR}
                    onChange={(e) => setCreateResidentForm((p) => ({ ...p, nameAR: e.target.value }))}
                    placeholder="أحمد علي"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={createResidentForm.email}
                    onChange={(e) => setCreateResidentForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="resident@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={createResidentForm.phone}
                    onChange={(e) => setCreateResidentForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="+201000000000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password (optional)</Label>
                  <Input
                    type="password"
                    value={createResidentForm.password}
                    onChange={(e) => setCreateResidentForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Leave empty if not needed"
                  />
                </div>
                <div className="space-y-2">
                  <Label>National ID (optional)</Label>
                  <Input
                    value={createResidentForm.nationalId}
                    onChange={(e) => setCreateResidentForm((p) => ({ ...p, nationalId: e.target.value }))}
                    placeholder="2980***********"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth (optional)</Label>
                  <Input
                    type="date"
                    value={createResidentForm.dateOfBirth}
                    onChange={(e) => setCreateResidentForm((p) => ({ ...p, dateOfBirth: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Assign Unit (optional)</Label>
                  <Select
                    value={createResidentForm.unitId || "none"}
                    onValueChange={(value) =>
                      setCreateResidentForm((p) => ({ ...p, unitId: value === "none" ? "" : value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No unit assignment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No unit assignment</SelectItem>
                      {unitOptions.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Unit Assignment Role</Label>
                  <Select
                    value={createResidentForm.unitRole}
                    onValueChange={(value) =>
                      setCreateResidentForm((p) => ({
                        ...p,
                        unitRole: value as CreateResidentForm["unitRole"],
                      }))
                    }
                    disabled={!createResidentForm.unitId}
                  >
                    <SelectTrigger className={!createResidentForm.unitId ? "opacity-60" : ""}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FAMILY">Family</SelectItem>
                      <SelectItem value="TENANT">Tenant</SelectItem>
                      <SelectItem value="OWNER">Owner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isCreatingResident}>
                  Cancel
                </Button>
                <Button
                  className="bg-[#00B386] hover:bg-[#00B386]/90 text-white"
                  onClick={() => void handleCreateResident()}
                  disabled={isCreatingResident}
                >
                  {isCreatingResident ? "Creating..." : "Create Resident"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loadError ? (
        <Card className="p-4 border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] rounded-xl">{loadError}</Card>
      ) : null}

      <Card className="p-4 shadow-card rounded-xl">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <Input
              placeholder="Search by name, email, unit, or mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-lg"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[180px] rounded-lg">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
              <SelectItem value="invited">Invited</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="shadow-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F9FAFB]">
              <TableHead>Resident</TableHead>
              <TableHead>National ID</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Unit(s)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Registration Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((resident) => (
              <TableRow key={resident.id} className="hover:bg-[#F9FAFB]">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-[#0B5FFF] text-white">{resident.avatar}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-[#1E293B]">{resident.name}</div>
                      <div className="text-xs text-[#64748B]">{resident.nameAr}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-[#64748B]">{resident.nationalId}</TableCell>
                <TableCell>
                  <div className="text-sm">
                    <div className="text-[#1E293B]">{resident.mobile}</div>
                    <div className="text-xs text-[#64748B]">{resident.email}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {resident.units.map((unit) => (
                      <Badge key={`${resident.id}-${unit}`} variant="secondary" className="bg-[#F3F4F6] text-[#1E293B]">
                        {unit}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={getStatusColorClass(resident.status)}>{resident.status}</Badge>
                </TableCell>
                <TableCell className="text-[#64748B]">{resident.registrationDate}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => void handleToggleSuspend(resident.id, resident.name)}>
                        <Ban className="w-4 h-4 mr-2" />
                        {resident.status.toUpperCase() === "SUSPENDED" ? "Activate" : "Suspend"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => void handleDeleteResident(resident.id, resident.name)}
                        className="text-[#EF4444]"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Deactivate User
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-[#64748B]">
                  No residents found for the current filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
