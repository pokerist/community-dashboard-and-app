import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Plus, Power, RotateCcw } from "lucide-react";
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
import { DataTable, type DataTableColumn } from "../DataTable";
import communityService, { type ClusterItem, type CommunityListItem, type GateItem } from "../../lib/community-service";
import { handleApiError } from "../../lib/api-client";
import unitService, {
  type CreateUnitPayload,
  type GateAccessMode,
  type UnitDetail,
  type UnitDisplayStatus,
  type UnitListItem,
  type UnitStatus,
  type UnitType,
} from "../../lib/unit-service";

const UNIT_TYPES: UnitType[] = ["APARTMENT", "VILLA", "PENTHOUSE", "DUPLEX", "TOWNHOUSE"];
const UNIT_STATUSES: UnitStatus[] = ["AVAILABLE", "HELD", "UNRELEASED", "NOT_DELIVERED", "DELIVERED", "OCCUPIED", "LEASED", "RENTED"];
const DISPLAY_STATUSES: UnitDisplayStatus[] = ["OFF_PLAN", "UNDER_CONSTRUCTION", "DELIVERED", "OCCUPIED"];

type UnitForm = {
  communityId: string;
  clusterId: string;
  unitNumber: string;
  block: string;
  type: UnitType;
  status: UnitStatus;
  isDelivered: boolean;
  bedrooms: string;
  sizeSqm: string;
  price: string;
  gateAccessMode: GateAccessMode;
  allowedGateIds: string[];
};

const defaultForm: UnitForm = {
  communityId: "",
  clusterId: "",
  unitNumber: "",
  block: "",
  type: "APARTMENT",
  status: "AVAILABLE",
  isDelivered: false,
  bedrooms: "",
  sizeSqm: "",
  price: "",
  gateAccessMode: "ALL_GATES",
  allowedGateIds: [],
};

function displayStatusClass(status: UnitDisplayStatus): string {
  if (status === "OFF_PLAN") return "bg-slate-100 text-slate-700";
  if (status === "UNDER_CONSTRUCTION") return "bg-amber-100 text-amber-700";
  if (status === "DELIVERED") return "bg-blue-100 text-blue-700";
  return "bg-emerald-100 text-emerald-700";
}

export function UnitsManagement() {
  const [units, setUnits] = useState<UnitListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [communities, setCommunities] = useState<CommunityListItem[]>([]);
  const [clusters, setClusters] = useState<ClusterItem[]>([]);
  const [search, setSearch] = useState("");
  const [communityFilter, setCommunityFilter] = useState("all");
  const [clusterFilter, setClusterFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [displayStatusFilter, setDisplayStatusFilter] = useState("all");
  const [showInactive, setShowInactive] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitListItem | null>(null);
  const [form, setForm] = useState<UnitForm>(defaultForm);
  const [formClusters, setFormClusters] = useState<ClusterItem[]>([]);
  const [formGates, setFormGates] = useState<GateItem[]>([]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [unitToDeactivate, setUnitToDeactivate] = useState<UnitListItem | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<UnitDetail | null>(null);
  const [detailMode, setDetailMode] = useState<GateAccessMode>("ALL_GATES");
  const [detailGateIds, setDetailGateIds] = useState<string[]>([]);
  const [detailGates, setDetailGates] = useState<GateItem[]>([]);

  const loadCommunities = useCallback(async () => {
    try {
      setCommunities(await communityService.listCommunities());
    } catch (error) {
      toast.error("Failed to load communities", { description: handleApiError(error) });
    }
  }, []);

  const loadClustersForFilter = useCallback(async () => {
    if (communityFilter === "all") {
      setClusters([]);
      setClusterFilter("all");
      return;
    }
    try {
      const rows = await communityService.listClusters(communityFilter);
      setClusters(rows);
      if (clusterFilter !== "all" && !rows.some((row) => row.id === clusterFilter)) {
        setClusterFilter("all");
      }
    } catch {
      setClusters([]);
      setClusterFilter("all");
    }
  }, [clusterFilter, communityFilter]);

  const loadUnits = useCallback(async () => {
    setLoading(true);
    try {
      const response = await unitService.listUnits({
        page: 1,
        limit: 100,
        search: search.trim() || undefined,
        communityId: communityFilter !== "all" ? communityFilter : undefined,
        clusterId: clusterFilter !== "all" ? clusterFilter : undefined,
        status: statusFilter !== "all" ? (statusFilter as UnitStatus) : undefined,
        displayStatus: displayStatusFilter !== "all" ? (displayStatusFilter as UnitDisplayStatus) : undefined,
        includeInactive: showInactive,
      });
      setUnits(response.data);
    } catch (error) {
      toast.error("Failed to load units", { description: handleApiError(error) });
      setUnits([]);
    } finally {
      setLoading(false);
    }
  }, [clusterFilter, communityFilter, displayStatusFilter, search, showInactive, statusFilter]);

  useEffect(() => {
    void loadCommunities();
  }, [loadCommunities]);

  useEffect(() => {
    void loadClustersForFilter();
  }, [loadClustersForFilter]);

  useEffect(() => {
    void loadUnits();
  }, [loadUnits]);

  const loadFormDeps = useCallback(async (communityId: string) => {
    if (!communityId) {
      setFormClusters([]);
      setFormGates([]);
      return;
    }
    const [clusterRows, gateRows] = await Promise.all([
      communityService.listClusters(communityId).catch(() => []),
      communityService.listGates(communityId).catch(() => []),
    ]);
    setFormClusters(clusterRows);
    setFormGates(gateRows);
  }, []);

  const openCreate = async () => {
    const communityId = communities[0]?.id ?? "";
    setEditingUnit(null);
    setForm({ ...defaultForm, communityId });
    await loadFormDeps(communityId);
    setFormOpen(true);
  };

  const openEdit = async (unit: UnitListItem) => {
    setEditingUnit(unit);
    setForm({
      ...defaultForm,
      communityId: unit.communityId ?? "",
      clusterId: unit.clusterId ?? "",
      unitNumber: unit.unitNumber,
      block: unit.block ?? "",
      type: unit.type,
      status: unit.status,
      isDelivered: unit.isDelivered,
      bedrooms: unit.bedrooms !== null ? String(unit.bedrooms) : "",
      sizeSqm: unit.sizeSqm !== null ? String(unit.sizeSqm) : "",
      price: unit.price !== null ? String(unit.price) : "",
    });
    await loadFormDeps(unit.communityId ?? "");
    try {
      const gateAccess = await unitService.getUnitGateAccess(unit.id);
      setForm((prev) => ({
        ...prev,
        gateAccessMode: gateAccess.mode,
        allowedGateIds: gateAccess.gates.map((gate) => gate.id),
      }));
    } catch {
      // ignore gate access load errors in form mode
    }
    setFormOpen(true);
  };

  const saveForm = async () => {
    if (!form.communityId || !form.unitNumber.trim()) {
      toast.error("Community and unit number are required");
      return;
    }
    if (form.gateAccessMode === "SELECTED_GATES" && form.allowedGateIds.length === 0) {
      toast.error("Select at least one gate for selected-gates mode");
      return;
    }

    const payload: CreateUnitPayload = {
      communityId: form.communityId,
      clusterId: form.clusterId || undefined,
      unitNumber: form.unitNumber.trim(),
      block: form.block.trim() || undefined,
      type: form.type,
      status: form.status,
      isDelivered: form.isDelivered,
      bedrooms: form.bedrooms ? Number(form.bedrooms) : undefined,
      sizeSqm: form.sizeSqm ? Number(form.sizeSqm) : undefined,
      price: form.price ? Number(form.price) : undefined,
      gateAccessMode: form.gateAccessMode,
      allowedGateIds: form.gateAccessMode === "SELECTED_GATES" ? form.allowedGateIds : [],
    };

    try {
      if (editingUnit) {
        await unitService.updateUnit(editingUnit.id, payload);
        toast.success("Unit updated");
      } else {
        await unitService.createUnit(payload);
        toast.success("Unit created");
      }
      setFormOpen(false);
      await loadUnits();
    } catch (error) {
      toast.error("Failed to save unit", { description: handleApiError(error) });
    }
  };

  const askDeactivate = (unit: UnitListItem) => {
    setUnitToDeactivate(unit);
    setConfirmOpen(true);
  };

  const confirmDeactivate = async () => {
    if (!unitToDeactivate) return;
    try {
      await unitService.deactivateUnit(unitToDeactivate.id, "Deactivated by admin");
      toast.success("Unit deactivated");
      setConfirmOpen(false);
      setUnitToDeactivate(null);
      await loadUnits();
    } catch (error) {
      toast.error("Failed to deactivate unit", { description: handleApiError(error) });
    }
  };

  const reactivate = async (unit: UnitListItem) => {
    try {
      await unitService.reactivateUnit(unit.id);
      toast.success("Unit reactivated");
      await loadUnits();
    } catch (error) {
      toast.error("Failed to reactivate unit", { description: handleApiError(error) });
    }
  };

  const openDetail = async (unit: UnitListItem) => {
    try {
      const response = await unitService.getUnit(unit.id);
      setDetail(response);
      setDetailMode(response.gateAccess.mode);
      setDetailGateIds(response.gateAccess.gates.map((gate) => gate.id));
      const gates = response.communityId ? await communityService.listGates(response.communityId) : [];
      setDetailGates(gates);
      setDetailOpen(true);
    } catch (error) {
      toast.error("Failed to load unit detail", { description: handleApiError(error) });
    }
  };

  const saveDetailGateAccess = async () => {
    if (!detail) return;
    if (detailMode === "SELECTED_GATES" && detailGateIds.length === 0) {
      toast.error("Select at least one gate");
      return;
    }
    try {
      const updated = await unitService.updateUnitGateAccess(detail.id, {
        mode: detailMode,
        allowedGateIds: detailMode === "SELECTED_GATES" ? detailGateIds : [],
      });
      setDetail((prev) => (prev ? { ...prev, gateAccess: updated } : prev));
      toast.success("Gate access updated");
      await loadUnits();
    } catch (error) {
      toast.error("Failed to update gate access", { description: handleApiError(error) });
    }
  };

  const inactiveCount = useMemo(() => units.filter((unit) => !unit.isActive).length, [units]);

  return (
    <div className="space-y-6">
      <Card className="rounded-md border border-[#D6DEE8] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-[22px] font-semibold text-[#0F172A]">Units Management</h1>
            <p className="mt-1 text-sm text-[#64748B]">
              Deactivate units safely, manage cluster assignment, and configure gate access.
            </p>
            <p className="mt-2 text-xs text-[#64748B]">Inactive in current list: {inactiveCount}</p>
          </div>
          <Button className="gap-2 bg-[#0B5FFF] text-white hover:bg-[#0A56E8]" onClick={() => void openCreate()}>
            <Plus className="h-4 w-4" />
            Add Unit
          </Button>
        </div>
      </Card>

      <Card className="rounded-md border border-[#D6DEE8] p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Input placeholder="Search units" value={search} onChange={(event) => setSearch(event.target.value)} className="xl:col-span-2" />
          <select className="h-10 rounded-md border border-[#CBD5E1] px-3 text-sm" value={communityFilter} onChange={(event) => setCommunityFilter(event.target.value)}>
            <option value="all">All communities</option>
            {communities.map((community) => (
              <option key={community.id} value={community.id}>{community.name}</option>
            ))}
          </select>
          <select className="h-10 rounded-md border border-[#CBD5E1] px-3 text-sm" value={clusterFilter} onChange={(event) => setClusterFilter(event.target.value)} disabled={communityFilter === "all"}>
            <option value="all">All clusters</option>
            {clusters.map((cluster) => (
              <option key={cluster.id} value={cluster.id}>{cluster.name}</option>
            ))}
          </select>
          <select className="h-10 rounded-md border border-[#CBD5E1] px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All status</option>
            {UNIT_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <select className="h-10 rounded-md border border-[#CBD5E1] px-3 text-sm" value={displayStatusFilter} onChange={(event) => setDisplayStatusFilter(event.target.value)}>
            <option value="all">All display status</option>
            {DISPLAY_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <input id="showInactiveUnits" type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
          <label htmlFor="showInactiveUnits">Show inactive units</label>
        </div>
      </Card>

      {(() => {
        const cols: DataTableColumn<UnitListItem>[] = [
          { key: "unit", header: "Unit", render: (u) => <span className="font-medium text-[#0F172A]">{u.unitNumber}</span> },
          { key: "community", header: "Community", render: (u) => <span>{u.communityName}</span> },
          { key: "cluster", header: "Cluster", render: (u) => <span>{u.clusterName ?? "-"}</span> },
          { key: "type", header: "Type", render: (u) => <span>{u.type}</span> },
          { key: "displayStatus", header: "Display Status", render: (u) => <Badge className={displayStatusClass(u.displayStatus)}>{u.displayStatus}</Badge> },
          { key: "size", header: "Size", render: (u) => <span>{u.sizeSqm ?? "-"}</span> },
          { key: "price", header: "Price", render: (u) => <span>{u.price !== null ? `EGP ${u.price.toLocaleString()}` : "-"}</span> },
          { key: "status", header: "Status", render: (u) => (
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline">{u.status}</Badge>
              {!u.isActive ? <Badge className="bg-slate-200 text-slate-700">Inactive</Badge> : null}
            </div>
          )},
          { key: "actions", header: "Actions", render: (u) => (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void openDetail(u)}><Eye className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => void openEdit(u)}><Pencil className="h-4 w-4" /></Button>
              {u.isActive ? (
                <Button variant="outline" size="sm" className="text-red-600" onClick={() => askDeactivate(u)}><Power className="h-4 w-4" /></Button>
              ) : (
                <Button variant="outline" size="sm" className="text-emerald-600" onClick={() => void reactivate(u)}><RotateCcw className="h-4 w-4" /></Button>
              )}
            </div>
          )},
        ];
        return <DataTable columns={cols} rows={units} rowKey={(u) => u.id} loading={loading} emptyTitle="No units found" />;
      })()}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingUnit ? "Edit Unit" : "Create Unit"}</DialogTitle>
            <DialogDescription>Add cluster and gate access configuration as part of unit setup.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2"><Label>Community</Label><select className="h-10 w-full rounded-md border border-[#CBD5E1] px-3 text-sm" value={form.communityId} onChange={(event) => { const communityId = event.target.value; setForm((prev) => ({ ...prev, communityId, clusterId: "", allowedGateIds: [] })); void loadFormDeps(communityId); }}><option value="">Select community</option>{communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="space-y-2"><Label>Cluster</Label><select className="h-10 w-full rounded-md border border-[#CBD5E1] px-3 text-sm" value={form.clusterId} onChange={(event) => setForm((prev) => ({ ...prev, clusterId: event.target.value }))}><option value="">No cluster</option>{formClusters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="space-y-2"><Label>Unit Number</Label><Input value={form.unitNumber} onChange={(event) => setForm((prev) => ({ ...prev, unitNumber: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Block</Label><Input value={form.block} onChange={(event) => setForm((prev) => ({ ...prev, block: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Type</Label><select className="h-10 w-full rounded-md border border-[#CBD5E1] px-3 text-sm" value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as UnitType }))}>{UNIT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
            <div className="space-y-2"><Label>Status</Label><select className="h-10 w-full rounded-md border border-[#CBD5E1] px-3 text-sm" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as UnitStatus }))}>{UNIT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
            <div className="space-y-2"><Label>Bedrooms</Label><Input type="number" value={form.bedrooms} onChange={(event) => setForm((prev) => ({ ...prev, bedrooms: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Size (sqm)</Label><Input type="number" value={form.sizeSqm} onChange={(event) => setForm((prev) => ({ ...prev, sizeSqm: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Price</Label><Input type="number" value={form.price} onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))} /></div>
            <div className="flex items-center gap-2 pt-7"><input id="isDeliveredField" type="checkbox" checked={form.isDelivered} onChange={(event) => setForm((prev) => ({ ...prev, isDelivered: event.target.checked }))} /><Label htmlFor="isDeliveredField">Delivered</Label></div>
          </div>

          <div className="rounded-md border border-[#E2E8F0] p-3">
            <h4 className="text-sm font-semibold text-[#0F172A]">Gate Access Configuration</h4>
            <div className="mt-2 flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="radio" name="unitGateMode" checked={form.gateAccessMode === "ALL_GATES"} onChange={() => setForm((prev) => ({ ...prev, gateAccessMode: "ALL_GATES", allowedGateIds: [] }))} />All Gates</label>
              <label className="flex items-center gap-2"><input type="radio" name="unitGateMode" checked={form.gateAccessMode === "SELECTED_GATES"} onChange={() => setForm((prev) => ({ ...prev, gateAccessMode: "SELECTED_GATES" }))} />Selected Gates Only</label>
            </div>
            {form.gateAccessMode === "SELECTED_GATES" ? (
              <div className="mt-2 space-y-2">
                {!form.communityId ? <p className="text-sm text-[#64748B]">Select a community first</p> : null}
                {form.communityId && formGates.length === 0 ? <p className="text-sm text-[#64748B]">No active gates for this community.</p> : null}
                {formGates.map((gate) => (
                  <label key={gate.id} className="flex items-center gap-2 rounded-md border border-[#E2E8F0] p-2 text-sm">
                    <input type="checkbox" checked={form.allowedGateIds.includes(gate.id)} onChange={(event) => { const checked = event.target.checked; setForm((prev) => ({ ...prev, allowedGateIds: checked ? [...prev.allowedGateIds, gate.id] : prev.allowedGateIds.filter((id) => id !== gate.id) })); }} />
                    <span>{gate.name}</span>
                    <span className="text-xs text-[#64748B]">({gate.allowedRoles.join(", ")})</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button className="bg-[#0B5FFF] text-white hover:bg-[#0A56E8]" onClick={() => void saveForm()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Unit</DialogTitle>
            <DialogDescription>This unit will be marked inactive. It cannot be permanently deleted.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button className="bg-red-600 text-white hover:bg-red-700" onClick={() => void confirmDeactivate()}>Deactivate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Unit Detail</DialogTitle>
            <DialogDescription>Gate access configuration and summary.</DialogDescription>
          </DialogHeader>
          {detail ? (
            <div className="space-y-4">
              <div className="rounded-md border border-[#E2E8F0] p-3">
                <p className="font-semibold text-[#0F172A]">{detail.unitNumber}</p>
                <p className="text-sm text-[#64748B]">{detail.communityName} | {detail.clusterName ?? "No cluster"}</p>
              </div>

              <div className="rounded-md border border-[#E2E8F0] p-3">
                <h4 className="text-sm font-semibold text-[#0F172A]">Gate Access</h4>
                <div className="mt-2 flex gap-4 text-sm">
                  <label className="flex items-center gap-2"><input type="radio" checked={detailMode === "ALL_GATES"} onChange={() => setDetailMode("ALL_GATES")} />All Gates</label>
                  <label className="flex items-center gap-2"><input type="radio" checked={detailMode === "SELECTED_GATES"} onChange={() => setDetailMode("SELECTED_GATES")} />Selected Gates</label>
                </div>
                {detailMode === "SELECTED_GATES" ? (
                  <div className="mt-2 space-y-2">
                    {detailGates.map((gate) => (
                      <label key={gate.id} className="flex items-center gap-2 rounded-md border border-[#E2E8F0] p-2 text-sm">
                        <input type="checkbox" checked={detailGateIds.includes(gate.id)} onChange={(event) => { const checked = event.target.checked; setDetailGateIds((prev) => checked ? [...prev, gate.id] : prev.filter((id) => id !== gate.id)); }} />
                        <span>{gate.name}</span>
                        <span className="text-xs text-[#64748B]">({gate.allowedRoles.join(", ")})</span>
                      </label>
                    ))}
                  </div>
                ) : null}
                <Button className="mt-3 bg-[#0B5FFF] text-white hover:bg-[#0A56E8]" onClick={() => void saveDetailGateAccess()}>Save Gate Access</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#64748B]">Loading detail...</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

