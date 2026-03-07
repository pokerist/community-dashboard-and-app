import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import { DataTable, type DataTableColumn } from "../DataTable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Search, Plus, FileText, Calendar, AlertCircle } from "lucide-react";
import apiClient from "../../lib/api-client";
import { errorMessage, formatCurrencyEGP, formatDate, getStatusColorClass, humanizeEnum } from "../../lib/live-data";

type OwnerOption = { id: string; label: string };
type UnitOption = { id: string; label: string };

type CreateLeaseForm = {
  unitId: string;
  ownerId: string;
  startDate: string;
  endDate: string;
  monthlyRent: string;
  securityDeposit: string;
  tenantEmail: string;
  tenantName: string;
  tenantPhone: string;
  tenantNationalId: string;
  contractFileId: string;
  nationalIdFileId: string;
  contractFile: File | null;
  nationalIdPhoto: File | null;
};

const defaultCreateLeaseForm: CreateLeaseForm = {
  unitId: "",
  ownerId: "",
  startDate: "",
  endDate: "",
  monthlyRent: "",
  securityDeposit: "",
  tenantEmail: "",
  tenantName: "",
  tenantPhone: "",
  tenantNationalId: "",
  contractFileId: "",
  nationalIdFileId: "",
  contractFile: null,
  nationalIdPhoto: null,
};

export function LeaseManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [leasesData, setLeasesData] = useState<any[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<OwnerOption[]>([]);
  const [unitOptions, setUnitOptions] = useState<UnitOption[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingLease, setIsCreatingLease] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createLeaseForm, setCreateLeaseForm] = useState<CreateLeaseForm>(defaultCreateLeaseForm);

  const loadLeases = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [response, ownersResponse, unitsResponse] = await Promise.all([
        apiClient.get("/leases"),
        apiClient.get("/admin/users", { params: { userType: "owner", take: 500, skip: 0 } }),
        apiClient.get("/units", { params: { page: 1, limit: 100 } }),
      ]);
      setLeasesData(Array.isArray(response.data) ? response.data : []);

      const owners = (Array.isArray(ownersResponse.data) ? ownersResponse.data : []).map((ownerUser: any) => ({
        id: String(ownerUser.id),
        label: ownerUser.nameEN ?? ownerUser.email ?? ownerUser.phone ?? String(ownerUser.id),
      }));
      setOwnerOptions(owners);

      const units = Array.isArray(unitsResponse.data?.data)
        ? unitsResponse.data.data
        : Array.isArray(unitsResponse.data)
          ? unitsResponse.data
          : [];
      setUnitOptions(
        units.map((unit: any) => ({
          id: String(unit.id),
          label:
            [unit.projectName, unit.block ? `Block ${unit.block}` : null, unit.unitNumber ? `Unit ${unit.unitNumber}` : null]
              .filter(Boolean)
              .join(" - ") || String(unit.id),
        })),
      );
    } catch (error) {
      const msg = errorMessage(error);
      setLoadError(msg);
      toast.error("Failed to load leases", { description: msg });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeases();
  }, [loadLeases]);

  const handleCreateLease = async () => {
    const required = [
      createLeaseForm.unitId,
      createLeaseForm.ownerId,
      createLeaseForm.startDate,
      createLeaseForm.endDate,
      createLeaseForm.monthlyRent,
      createLeaseForm.tenantEmail,
    ];
    if (required.some((v) => !String(v).trim())) {
      toast.error("Please fill all required lease fields");
      return;
    }

    const usingFiles = !!createLeaseForm.contractFile || !!createLeaseForm.nationalIdPhoto;
    const usingIds =
      !!createLeaseForm.contractFileId.trim() && !!createLeaseForm.nationalIdFileId.trim();

    if (!usingFiles && !usingIds) {
      toast.error("Provide contract/national ID files or existing file IDs");
      return;
    }

    if (!usingFiles && (!createLeaseForm.tenantName || !createLeaseForm.tenantPhone || !createLeaseForm.tenantNationalId)) {
      toast.error("For new tenant onboarding, provide tenant name, phone, and national ID");
      return;
    }

    setIsCreatingLease(true);
    try {
      const formData = new FormData();
      formData.append("unitId", createLeaseForm.unitId);
      formData.append("ownerId", createLeaseForm.ownerId);
      formData.append("startDate", new Date(createLeaseForm.startDate).toISOString());
      formData.append("endDate", new Date(createLeaseForm.endDate).toISOString());
      formData.append("monthlyRent", String(Number(createLeaseForm.monthlyRent)));
      if (createLeaseForm.securityDeposit) {
        formData.append("securityDeposit", String(Number(createLeaseForm.securityDeposit)));
      }
      formData.append("tenantEmail", createLeaseForm.tenantEmail.trim());
      if (createLeaseForm.tenantName.trim()) formData.append("tenantName", createLeaseForm.tenantName.trim());
      if (createLeaseForm.tenantPhone.trim()) formData.append("tenantPhone", createLeaseForm.tenantPhone.trim());
      if (createLeaseForm.tenantNationalId.trim()) formData.append("tenantNationalId", createLeaseForm.tenantNationalId.trim());

      if (createLeaseForm.contractFileId.trim()) formData.append("contractFileId", createLeaseForm.contractFileId.trim());
      if (createLeaseForm.nationalIdFileId.trim()) formData.append("nationalIdFileId", createLeaseForm.nationalIdFileId.trim());
      if (createLeaseForm.contractFile) formData.append("contractFile", createLeaseForm.contractFile);
      if (createLeaseForm.nationalIdPhoto) formData.append("nationalIdPhoto", createLeaseForm.nationalIdPhoto);

      await apiClient.post("/leases", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Lease created");
      setIsCreateDialogOpen(false);
      setCreateLeaseForm(defaultCreateLeaseForm);
      await loadLeases();
    } catch (error) {
      toast.error("Failed to create lease", { description: errorMessage(error) });
    } finally {
      setIsCreatingLease(false);
    }
  };

  const filteredLeases = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return leasesData.filter((lease) => {
      if (!q) return true;
      return [
        lease.leaseNumber,
        lease.id,
        lease.unit?.unitNumber,
        lease.owner?.nameEN,
        lease.tenant?.nameEN,
        lease.tenantEmail,
        lease.status,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [leasesData, searchTerm]);

  const activeLeases = leasesData.filter((l) => String(l.status || "").toUpperCase() === "ACTIVE");
  const expiringSoon = leasesData.filter((l) => {
    const endDate = new Date(l.endDate ?? 0);
    if (Number.isNaN(endDate.getTime())) return false;
    const diffDays = (endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 30;
  });
  const overduePayments = leasesData.filter((l) =>
    ["OVERDUE", "LATE"].includes(String(l.paymentStatus || "").toUpperCase()),
  );
  const totalRent = leasesData.reduce((sum, l) => sum + Number(l.monthlyRent ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#1E293B]">Lease & Rental Management</h1>
          <p className="text-[#64748B] mt-1">Live lease contracts and tenant data from backend</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadLeases()} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white rounded-lg gap-2">
                <Plus className="w-4 h-4" />
                Create Lease
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Lease</DialogTitle>
                <DialogDescription>
                  Create a lease with tenant onboarding. You can upload files (local dev storage fallback supported) or provide existing file IDs.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Select
                      value={createLeaseForm.unitId || "none"}
                      onValueChange={(value) =>
                        setCreateLeaseForm((p) => ({ ...p, unitId: value === "none" ? "" : value }))
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
                    <Label>Owner</Label>
                    <Select
                      value={createLeaseForm.ownerId || "none"}
                      onValueChange={(value) =>
                        setCreateLeaseForm((p) => ({ ...p, ownerId: value === "none" ? "" : value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select owner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select owner</SelectItem>
                        {ownerOptions.map((owner) => (
                          <SelectItem key={owner.id} value={owner.id}>
                            {owner.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={createLeaseForm.startDate}
                      onChange={(e) => setCreateLeaseForm((p) => ({ ...p, startDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={createLeaseForm.endDate}
                      onChange={(e) => setCreateLeaseForm((p) => ({ ...p, endDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Monthly Rent</Label>
                    <Input
                      type="number"
                      value={createLeaseForm.monthlyRent}
                      onChange={(e) => setCreateLeaseForm((p) => ({ ...p, monthlyRent: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Security Deposit (optional)</Label>
                    <Input
                      type="number"
                      value={createLeaseForm.securityDeposit}
                      onChange={(e) => setCreateLeaseForm((p) => ({ ...p, securityDeposit: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="border rounded-lg p-4 space-y-4">
                  <h4 className="text-sm font-medium text-[#1E293B]">Tenant Onboarding</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tenant Email</Label>
                      <Input
                        type="email"
                        value={createLeaseForm.tenantEmail}
                        onChange={(e) => setCreateLeaseForm((p) => ({ ...p, tenantEmail: e.target.value }))}
                        placeholder="tenant@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tenant Name (new tenant)</Label>
                      <Input
                        value={createLeaseForm.tenantName}
                        onChange={(e) => setCreateLeaseForm((p) => ({ ...p, tenantName: e.target.value }))}
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tenant Phone (new tenant)</Label>
                      <Input
                        value={createLeaseForm.tenantPhone}
                        onChange={(e) => setCreateLeaseForm((p) => ({ ...p, tenantPhone: e.target.value }))}
                        placeholder="+201234567890"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tenant National ID (new tenant)</Label>
                      <Input
                        value={createLeaseForm.tenantNationalId}
                        onChange={(e) => setCreateLeaseForm((p) => ({ ...p, tenantNationalId: e.target.value }))}
                        placeholder="2980***********"
                      />
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4 space-y-4">
                  <h4 className="text-sm font-medium text-[#1E293B]">Lease Files</h4>
                  <p className="text-xs text-[#64748B]">
                    Option A: upload files here. Option B: provide existing file IDs if already uploaded.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Contract File Upload (PDF/Image)</Label>
                      <Input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) =>
                          setCreateLeaseForm((p) => ({
                            ...p,
                            contractFile: e.target.files?.[0] ?? null,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>National ID Upload (PDF/Image)</Label>
                      <Input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) =>
                          setCreateLeaseForm((p) => ({
                            ...p,
                            nationalIdPhoto: e.target.files?.[0] ?? null,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Contract File ID (optional)</Label>
                      <Input
                        value={createLeaseForm.contractFileId}
                        onChange={(e) => setCreateLeaseForm((p) => ({ ...p, contractFileId: e.target.value }))}
                        placeholder="Existing contract file UUID"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>National ID File ID (optional)</Label>
                      <Input
                        value={createLeaseForm.nationalIdFileId}
                        onChange={(e) => setCreateLeaseForm((p) => ({ ...p, nationalIdFileId: e.target.value }))}
                        placeholder="Existing national ID file UUID"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isCreatingLease}>
                  Cancel
                </Button>
                <Button
                  className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white"
                  onClick={() => void handleCreateLease()}
                  disabled={isCreatingLease}
                >
                  {isCreatingLease ? "Creating..." : "Create Lease"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loadError ? (
        <Card className="p-4 border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] rounded-xl">{loadError}</Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6 shadow-card rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#64748B] mb-2">Active Leases</p>
              <h3 className="text-[#1E293B]">{activeLeases.length}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-[#10B981]" />
            </div>
          </div>
        </Card>
        <Card className="p-6 shadow-card rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#64748B] mb-2">Expiring Soon</p>
              <h3 className="text-[#1E293B]">{expiringSoon.length}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-[#F59E0B]" />
            </div>
          </div>
        </Card>
        <Card className="p-6 shadow-card rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#64748B] mb-2">Overdue Payments</p>
              <h3 className="text-[#1E293B]">{overduePayments.length}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#EF4444]/10 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-[#EF4444]" />
            </div>
          </div>
        </Card>
        <Card className="p-6 shadow-card rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#64748B] mb-2">Total Monthly Rent</p>
              <h3 className="text-[#1E293B]">{formatCurrencyEGP(totalRent)}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#0B5FFF]/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-[#0B5FFF]" />
            </div>
          </div>
        </Card>
      </div>

      <Card className="shadow-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#E5E7EB]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <Input
              placeholder="Search by unit, owner, or tenant..."
              className="pl-10 rounded-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        {(() => {
          const cols: DataTableColumn<any>[] = [
            { key: "id", header: "Lease ID", render: (l) => <span className="font-medium text-[#1E293B]">{l.leaseNumber ?? l.id}</span> },
            { key: "unit", header: "Unit", render: (l) => <Badge variant="secondary" className="bg-[#F3F4F6] text-[#1E293B]">{l.unit?.unitNumber ?? l.unitId ?? "—"}</Badge> },
            { key: "owner", header: "Owner", render: (l) => <span className="text-[#64748B]">{l.owner?.nameEN ?? l.owner?.email ?? l.ownerId ?? "—"}</span> },
            { key: "tenant", header: "Tenant", render: (l) => <span className="text-[#1E293B]">{l.tenant?.nameEN ?? l.tenantEmail ?? l.tenantId ?? "—"}</span> },
            { key: "period", header: "Lease Period", render: (l) => <div className="text-[#64748B] text-sm"><div>{formatDate(l.startDate)}</div><div className="text-xs">to {formatDate(l.endDate)}</div></div> },
            { key: "rent", header: "Monthly Rent", render: (l) => <span className="text-[#1E293B]">{formatCurrencyEGP(l.monthlyRent)}</span> },
            { key: "status", header: "Status", render: (l) => <Badge className={getStatusColorClass(l.status)}>{humanizeEnum(l.status)}</Badge> },
            { key: "payStatus", header: "Payment Status", render: (l) => <Badge className={getStatusColorClass(l.paymentStatus ?? "UNKNOWN")}>{humanizeEnum(l.paymentStatus ?? "Unknown")}</Badge> },
          ];
          return <DataTable columns={cols} rows={filteredLeases} rowKey={(l) => l.id} loading={isLoading} emptyTitle="No leases found" />;
        })()}
      </Card>
    </div>
  );
}
