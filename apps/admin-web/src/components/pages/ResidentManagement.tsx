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
import { Search, Plus, Trash2, Ban, User } from "lucide-react";
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
  rawStatus: string;
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

type OwnerPaymentMode = "CASH" | "INSTALLMENT";

type OwnerInstallmentDraft = {
  dueDate: string;
  amount: string;
  referencePageIndex: string;
  referenceFile: File | null;
};

type OwnerUnitDraft = {
  unitId: string;
  paymentMode: OwnerPaymentMode;
  contractSignedAt: string;
  contractFile: File | null;
  notes: string;
  installments: OwnerInstallmentDraft[];
};

type CreateOwnerForm = {
  nameEN: string;
  nameAR: string;
  email: string;
  phone: string;
  nationalId: string;
  nationalIdPhotoFile: File | null;
  units: OwnerUnitDraft[];
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

const createDefaultInstallmentDraft = (): OwnerInstallmentDraft => ({
  dueDate: "",
  amount: "",
  referencePageIndex: "",
  referenceFile: null,
});

const createDefaultOwnerUnitDraft = (): OwnerUnitDraft => ({
  unitId: "",
  paymentMode: "CASH",
  contractSignedAt: "",
  contractFile: null,
  notes: "",
  installments: [],
});

const defaultCreateOwnerForm: CreateOwnerForm = {
  nameEN: "",
  nameAR: "",
  email: "",
  phone: "",
  nationalId: "",
  nationalIdPhotoFile: null,
  units: [createDefaultOwnerUnitDraft()],
};

type ResidentManagementProps = {
  onNavigateToCreate?: () => void;
};

export function ResidentManagement({ onNavigateToCreate }: ResidentManagementProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreateOwnerDialogOpen, setIsCreateOwnerDialogOpen] = useState(false);
  const [isCreatingResident, setIsCreatingResident] = useState(false);
  const [isCreatingOwner, setIsCreatingOwner] = useState(false);
  const [rows, setRows] = useState<ResidentRow[]>([]);
  const [unitOptions, setUnitOptions] = useState<UnitOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createResidentForm, setCreateResidentForm] = useState<CreateResidentForm>(
    defaultCreateResidentForm,
  );
  const [createOwnerForm, setCreateOwnerForm] = useState<CreateOwnerForm>(
    defaultCreateOwnerForm,
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
          rawStatus: String(user.userStatus ?? "ACTIVE").toUpperCase(),
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

  const uploadFile = useCallback(
    async (endpoint: string, file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await apiClient.post(endpoint, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      });
      const fileId = response.data?.id as string | undefined;
      if (!fileId) throw new Error("Upload did not return file id");
      return fileId;
    },
    [],
  );

  const updateOwnerUnit = useCallback(
    (index: number, updater: (prev: OwnerUnitDraft) => OwnerUnitDraft) => {
      setCreateOwnerForm((prev) => ({
        ...prev,
        units: prev.units.map((unit, unitIndex) =>
          unitIndex === index ? updater(unit) : unit,
        ),
      }));
    },
    [],
  );

  const handleCreateOwner = async () => {
    if (!createOwnerForm.nameEN.trim()) {
      toast.error("Resident English name is required");
      return;
    }
    if (!createOwnerForm.phone.trim()) {
      toast.error("Resident phone is required");
      return;
    }
    if (!createOwnerForm.nationalIdPhotoFile) {
      toast.error("National ID image is required");
      return;
    }
    if (!createOwnerForm.units.length || !createOwnerForm.units[0].unitId) {
      toast.error("At least one unit assignment is required");
      return;
    }

    setIsCreatingOwner(true);
    try {
      const nationalIdPhotoId = await uploadFile(
        "/files/upload/national-id",
        createOwnerForm.nationalIdPhotoFile,
      );

      const mappedUnits = [];
      for (let index = 0; index < createOwnerForm.units.length; index++) {
        const unitDraft = createOwnerForm.units[index];
        if (!unitDraft.unitId) {
          throw new Error(`Unit is required in assignment #${index + 1}`);
        }
        if (
          unitDraft.paymentMode === "INSTALLMENT" &&
          unitDraft.installments.length === 0
        ) {
          throw new Error(
            `Installments are required for installment mode (assignment #${index + 1})`,
          );
        }

        const contractFileId = unitDraft.contractFile
          ? await uploadFile("/files/upload/contract", unitDraft.contractFile)
          : undefined;

        const installments = [];
        for (let installmentIndex = 0; installmentIndex < unitDraft.installments.length; installmentIndex++) {
          const installment = unitDraft.installments[installmentIndex];
          if (!installment.dueDate) {
            throw new Error(
              `Due date is required for installment #${installmentIndex + 1} in assignment #${index + 1}`,
            );
          }
          const amountNumber = Number(installment.amount);
          if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
            throw new Error(
              `Amount is invalid for installment #${installmentIndex + 1} in assignment #${index + 1}`,
            );
          }

          const referenceFileId = installment.referenceFile
            ? await uploadFile("/files/upload/contract", installment.referenceFile)
            : undefined;

          installments.push({
            dueDate: new Date(installment.dueDate).toISOString(),
            amount: amountNumber,
            referenceFileId,
            referencePageIndex: installment.referencePageIndex
              ? Number(installment.referencePageIndex)
              : undefined,
          });
        }

        mappedUnits.push({
          unitId: unitDraft.unitId,
          paymentMode: unitDraft.paymentMode,
          contractSignedAt: unitDraft.contractSignedAt
            ? new Date(unitDraft.contractSignedAt).toISOString()
            : undefined,
          contractFileId,
          notes: unitDraft.notes.trim() || undefined,
          installments,
        });
      }

      const response = await apiClient.post("/owners/create-with-unit", {
        nameEN: createOwnerForm.nameEN.trim(),
        nameAR: createOwnerForm.nameAR.trim() || undefined,
        email: createOwnerForm.email.trim() || undefined,
        phone: createOwnerForm.phone.trim(),
        nationalId: createOwnerForm.nationalId.trim() || undefined,
        nationalIdPhotoId,
        units: mappedUnits,
      });

      toast.success("Resident created", {
        description: response.data?.userEmail
          ? "Resident account and unit payment plans were created. Login credentials email was queued."
          : "Resident account and unit payment plans were created.",
      });
      setCreateOwnerForm(defaultCreateOwnerForm);
      setIsCreateOwnerDialogOpen(false);
      await loadResidents();
    } catch (error) {
      toast.error("Failed to create resident", { description: errorMessage(error) });
    } finally {
      setIsCreatingOwner(false);
    }
  };

  const handleDeleteResident = async (id: string, name: string) => {
    try {
      await apiClient.delete(`/admin/users/${id}`);
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, rawStatus: "DISABLED", status: humanizeEnum("DISABLED") }
            : r,
        ),
      );
      toast.success("Resident deactivated", {
        description: `${name} has been deactivated in the backend.`,
      });
    } catch (error) {
      toast.error("Failed to deactivate resident", { description: errorMessage(error) });
    }
  };

  const handleHardDeleteResident = async (id: string, name: string) => {
    const confirmed = window.confirm(
      `Delete ${name} permanently and purge unit links/leases?\nThis will reset affected units to AVAILABLE.`,
    );
    if (!confirmed) return;

    try {
      await apiClient.delete(`/admin/users/${id}/hard?purge=true`);
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success("Resident deleted", {
        description: `${name} was permanently deleted from backend.`,
      });
    } catch (error) {
      toast.error("Failed to permanently delete resident", {
        description: errorMessage(error),
      });
    }
  };

  const handleToggleSuspend = async (id: string, name: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const current = row.rawStatus.toUpperCase();
    const nextStatus = current === "SUSPENDED" || current === "DISABLED" ? "ACTIVE" : "SUSPENDED";
    try {
      await apiClient.patch(`/admin/users/${id}`, { userStatus: nextStatus });
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, rawStatus: nextStatus, status: humanizeEnum(nextStatus) }
            : r,
        ),
      );
      toast.success(`Resident ${nextStatus === "SUSPENDED" ? "suspended" : "activated"}`, {
        description: `${name} status updated in backend.`,
      });
    } catch (error) {
      toast.error("Failed to update status", { description: errorMessage(error) });
    }
  };

  const canDeactivate = (status: string) =>
    status === "ACTIVE" || status === "SUSPENDED" || status === "INVITED";
  const canSuspend = (status: string) => status === "ACTIVE";
  const canActivate = (status: string) => status === "SUSPENDED" || status === "DISABLED";

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
        statusFilter === "all" || resident.rawStatus === statusFilter.toUpperCase();
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
          <Button
            className="rounded-lg gap-2 !bg-[#0F172A] hover:!bg-[#0F172A]/90 !text-white border border-[#0F172A]"
            onClick={() => {
              if (onNavigateToCreate) {
                onNavigateToCreate();
                return;
              }
              setIsCreateOwnerDialogOpen(true);
            }}
          >
            <User className="w-4 h-4" />
            Add Resident
          </Button>

          <div className="hidden">
          <Dialog open={isCreateOwnerDialogOpen} onOpenChange={setIsCreateOwnerDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-lg gap-2 !bg-[#0F172A] hover:!bg-[#0F172A]/90 !text-white">
                <Plus className="w-4 h-4" />
                Add Resident
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Resident (Multi-Unit + Payment Plan)</DialogTitle>
                <DialogDescription>
                  Creates resident account, links one or more units, stores contract documents, and configures unit payment plans.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Resident Name (EN)</Label>
                  <Input
                    value={createOwnerForm.nameEN}
                    onChange={(e) => setCreateOwnerForm((prev) => ({ ...prev, nameEN: e.target.value }))}
                    placeholder="Ahmed Hassan Mohamed"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Resident Name (AR)</Label>
                  <Input
                    value={createOwnerForm.nameAR}
                    onChange={(e) => setCreateOwnerForm((prev) => ({ ...prev, nameAR: e.target.value }))}
                    placeholder="أحمد حسن محمد"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={createOwnerForm.email}
                    onChange={(e) => setCreateOwnerForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="resident@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={createOwnerForm.phone}
                    onChange={(e) => setCreateOwnerForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="+2010xxxxxxxx"
                  />
                </div>
                <div className="space-y-2">
                  <Label>National ID</Label>
                  <Input
                    value={createOwnerForm.nationalId}
                    onChange={(e) => setCreateOwnerForm((prev) => ({ ...prev, nationalId: e.target.value }))}
                    placeholder="2980***********"
                  />
                </div>
                <div className="space-y-2">
                  <Label>National ID Photo (Required)</Label>
                  <Input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) =>
                      setCreateOwnerForm((prev) => ({
                        ...prev,
                        nationalIdPhotoFile: e.target.files?.[0] ?? null,
                      }))
                    }
                  />
                  <p className="text-xs text-[#64748B]">
                    {createOwnerForm.nationalIdPhotoFile?.name ?? "No file selected"}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#0F172A]">Unit Assignments & Payment Plans</h3>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setCreateOwnerForm((prev) => ({
                        ...prev,
                        units: [...prev.units, createDefaultOwnerUnitDraft()],
                      }))
                    }
                  >
                    Add Unit
                  </Button>
                </div>
                {createOwnerForm.units.map((unitDraft, unitIndex) => (
                  <Card key={`owner-unit-${unitIndex}`} className="p-4 border border-[#E2E8F0]">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-[#0F172A]">Assignment #{unitIndex + 1}</h4>
                      {createOwnerForm.units.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setCreateOwnerForm((prev) => ({
                              ...prev,
                              units: prev.units.filter((_, idx) => idx !== unitIndex),
                            }))
                          }
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Unit</Label>
                        <Select
                          value={unitDraft.unitId || "none"}
                          onValueChange={(value) =>
                            updateOwnerUnit(unitIndex, (prev) => ({
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
                            {unitOptions.map((unit) => (
                              <SelectItem key={unit.id} value={unit.id}>
                                {unit.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Payment Mode</Label>
                        <Select
                          value={unitDraft.paymentMode}
                          onValueChange={(value) =>
                            updateOwnerUnit(unitIndex, (prev) => ({
                              ...prev,
                              paymentMode: value as OwnerPaymentMode,
                              installments:
                                value === "INSTALLMENT" && prev.installments.length === 0
                                  ? [createDefaultInstallmentDraft()]
                                  : value === "CASH"
                                    ? []
                                    : prev.installments,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CASH">Cash</SelectItem>
                            <SelectItem value="INSTALLMENT">Installment</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Contract Signed Date</Label>
                        <Input
                          type="date"
                          value={unitDraft.contractSignedAt}
                          onChange={(e) =>
                            updateOwnerUnit(unitIndex, (prev) => ({
                              ...prev,
                              contractSignedAt: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Contract File (Image/PDF)</Label>
                        <Input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) =>
                            updateOwnerUnit(unitIndex, (prev) => ({
                              ...prev,
                              contractFile: e.target.files?.[0] ?? null,
                            }))
                          }
                        />
                        <p className="text-xs text-[#64748B]">
                          {unitDraft.contractFile?.name ?? "No contract file selected"}
                        </p>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Notes (Optional)</Label>
                        <Input
                          value={unitDraft.notes}
                          onChange={(e) =>
                            updateOwnerUnit(unitIndex, (prev) => ({ ...prev, notes: e.target.value }))
                          }
                          placeholder="Payment plan notes..."
                        />
                      </div>
                    </div>

                    {unitDraft.paymentMode === "INSTALLMENT" ? (
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-semibold text-[#334155]">Installments / Checks</h5>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              updateOwnerUnit(unitIndex, (prev) => ({
                                ...prev,
                                installments: [...prev.installments, createDefaultInstallmentDraft()],
                              }))
                            }
                          >
                            Add Installment
                          </Button>
                        </div>
                        {unitDraft.installments.map((installment, installmentIndex) => (
                          <div key={`inst-${unitIndex}-${installmentIndex}`} className="grid grid-cols-1 md:grid-cols-4 gap-2 border border-[#E2E8F0] rounded-lg p-3">
                            <div className="space-y-1">
                              <Label>Due Date</Label>
                              <Input
                                type="date"
                                value={installment.dueDate}
                                onChange={(e) =>
                                  updateOwnerUnit(unitIndex, (prev) => ({
                                    ...prev,
                                    installments: prev.installments.map((item, idx) =>
                                      idx === installmentIndex ? { ...item, dueDate: e.target.value } : item,
                                    ),
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Amount</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={installment.amount}
                                onChange={(e) =>
                                  updateOwnerUnit(unitIndex, (prev) => ({
                                    ...prev,
                                    installments: prev.installments.map((item, idx) =>
                                      idx === installmentIndex ? { ...item, amount: e.target.value } : item,
                                    ),
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Page Index (Optional)</Label>
                              <Input
                                type="number"
                                min={1}
                                value={installment.referencePageIndex}
                                onChange={(e) =>
                                  updateOwnerUnit(unitIndex, (prev) => ({
                                    ...prev,
                                    installments: prev.installments.map((item, idx) =>
                                      idx === installmentIndex
                                        ? { ...item, referencePageIndex: e.target.value }
                                        : item,
                                    ),
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Check Image/PDF</Label>
                              <Input
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={(e) =>
                                  updateOwnerUnit(unitIndex, (prev) => ({
                                    ...prev,
                                    installments: prev.installments.map((item, idx) =>
                                      idx === installmentIndex
                                        ? { ...item, referenceFile: e.target.files?.[0] ?? null }
                                        : item,
                                    ),
                                  }))
                                }
                              />
                            </div>
                            <div className="md:col-span-4 flex justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  updateOwnerUnit(unitIndex, (prev) => ({
                                    ...prev,
                                    installments: prev.installments.filter((_, idx) => idx !== installmentIndex),
                                  }))
                                }
                              >
                                Remove installment
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </Card>
                ))}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateOwnerDialogOpen(false)}
                  disabled={isCreatingOwner}
                >
                  Cancel
                </Button>
                <Button
                  className="!bg-[#0F172A] hover:!bg-[#0F172A]/90 !text-white"
                  onClick={() => void handleCreateOwner()}
                  disabled={isCreatingOwner}
                >
                  {isCreatingOwner ? "Creating Resident..." : "Create Resident"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="hidden rounded-lg gap-2">
                <Plus className="w-4 h-4" />
                Quick Resident
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Quick Resident</DialogTitle>
                <DialogDescription>
                  Lightweight flow: creates base user, resident profile, and optional unit assignment.
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
                  className="!bg-[#0F172A] hover:!bg-[#0F172A]/90 !text-white"
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
                  <div className="inline-flex items-center gap-2">
                    {canSuspend(resident.rawStatus) || canActivate(resident.rawStatus) ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="!text-[#0F172A] !border-[#CBD5E1] !bg-white hover:!bg-[#F8FAFC]"
                        onClick={() => void handleToggleSuspend(resident.id, resident.name)}
                      >
                        <Ban className="w-4 h-4 mr-1" />
                        {canActivate(resident.rawStatus) ? "Activate" : "Suspend"}
                      </Button>
                    ) : null}
                    {canDeactivate(resident.rawStatus) ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="!text-[#B91C1C] !border-[#FECACA] !bg-[#FEF2F2] hover:!bg-[#FEE2E2]"
                        onClick={() => void handleDeleteResident(resident.id, resident.name)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Deactivate
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      className="!bg-[#7F1D1D] hover:!bg-[#7F1D1D]/90 !text-white"
                      onClick={() => void handleHardDeleteResident(resident.id, resident.name)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete Permanently
                    </Button>
                  </div>
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
