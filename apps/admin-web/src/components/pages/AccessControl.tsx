import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../ui/dialog";
import { QrCode, Plus, Download, Ban, CheckCheck, Clock3, ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import apiClient from "../../lib/api-client";
import { errorMessage, formatDateTime, getStatusColorClass, humanizeEnum } from "../../lib/live-data";

export function AccessControl() {
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [accessRows, setAccessRows] = useState<any[]>([]);
  const [unitOptions, setUnitOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [actionRowId, setActionRowId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [generateForm, setGenerateForm] = useState({
    unitId: "",
    type: "VISITOR",
    visitorName: "",
    validFrom: "",
    validTo: "",
    notes: "",
  });

  const loadAccessQrs = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [response, unitsResponse] = await Promise.all([
        apiClient.get("/access-qrcodes", { params: { includeInactive: true } }),
        apiClient.get("/units", { params: { page: 1, limit: 100 } }),
      ]);
      setAccessRows(Array.isArray(response.data) ? response.data : []);
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
      toast.error("Failed to load access QR codes", { description: msg });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccessQrs();
  }, [loadAccessQrs]);

  const handleGenerateQr = async () => {
    if (!generateForm.unitId) {
      toast.error("Unit is required");
      return;
    }
    if (generateForm.type === "VISITOR" && !generateForm.visitorName.trim()) {
      toast.error("Visitor name is required for visitor QR");
      return;
    }

    setIsGenerating(true);
    try {
      const payload: any = {
        unitId: generateForm.unitId,
        type: generateForm.type,
        visitorName: generateForm.visitorName.trim() || undefined,
        notes: generateForm.notes.trim() || undefined,
      };
      if (generateForm.validFrom) payload.validFrom = new Date(generateForm.validFrom).toISOString();
      if (generateForm.validTo) payload.validTo = new Date(generateForm.validTo).toISOString();

      const response = await apiClient.post("/access-qrcodes", payload);
      const qrId = response.data?.qrCode?.qrId ?? response.data?.qrCode?.id;
      toast.success("QR code generated", {
        description: qrId ? `QR created: ${qrId}` : "Access QR created successfully.",
      });
      setIsGenerateDialogOpen(false);
      setGenerateForm({
        unitId: "",
        type: "VISITOR",
        visitorName: "",
        validFrom: "",
        validTo: "",
        notes: "",
      });
      await loadAccessQrs();
    } catch (error) {
      toast.error("Failed to generate QR", { description: errorMessage(error) });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevokeQr = async (id: string) => {
    setActionRowId(id);
    try {
      await apiClient.patch(`/access-qrcodes/${id}/revoke`);
      toast.success("QR code revoked");
      await loadAccessQrs();
    } catch (error) {
      toast.error("Failed to revoke QR", { description: errorMessage(error) });
    } finally {
      setActionRowId(null);
    }
  };

  const handleApproveWorkerQr = async (id: string) => {
    setActionRowId(id);
    try {
      const response = await apiClient.patch(`/access-qrcodes/${id}/approve`);
      const qrId = response.data?.qrCode?.qrId ?? response.data?.qrCode?.id;
      toast.success("Worker permit approved", {
        description: qrId ? `QR ready: ${qrId}` : "Permit approved successfully.",
      });
      await loadAccessQrs();
    } catch (error) {
      toast.error("Failed to approve worker permit", { description: errorMessage(error) });
    } finally {
      setActionRowId(null);
    }
  };

  const handleRejectWorkerQr = async (id: string) => {
    const reason = window.prompt("Optional rejection reason", "") ?? "";
    setActionRowId(id);
    try {
      await apiClient.patch(`/access-qrcodes/${id}/reject`, {
        reason: reason.trim() || undefined,
      });
      toast.success("Worker permit rejected");
      await loadAccessQrs();
    } catch (error) {
      toast.error("Failed to reject worker permit", { description: errorMessage(error) });
    } finally {
      setActionRowId(null);
    }
  };

  const handleMarkQrUsed = async (id: string) => {
    const gateName = window.prompt("Gate name (optional)", "");
    if (gateName === null) return;
    setActionRowId(id);
    try {
      await apiClient.patch(`/access-qrcodes/${id}/mark-used`, {
        gateName: gateName.trim() || undefined,
      });
      toast.success("QR marked as used", {
        description: "Arrival notification sent to owner.",
      });
      await loadAccessQrs();
    } catch (error) {
      toast.error("Failed to mark QR as used", { description: errorMessage(error) });
    } finally {
      setActionRowId(null);
    }
  };

  const stats = useMemo(() => {
    const active = accessRows.filter((r) => String(r.status || "").toUpperCase() === "ACTIVE").length;
    const visitors = accessRows.filter((r) => String(r.type || "").toUpperCase() === "VISITOR").length;
    const workers = accessRows.filter((r) => String(r.type || "").toUpperCase() === "WORKER").length;
    const deliveries = accessRows.filter((r) => String(r.type || "").toUpperCase() === "DELIVERY").length;
    const pendingWorkers = accessRows.filter(
      (r) =>
        String(r.status || "").toUpperCase() === "PENDING" &&
        String(r.type || "").toUpperCase() === "WORKER",
    ).length;
    return { active, visitors, workers, deliveries, pendingWorkers };
  }, [accessRows]);

  const pendingWorkerRows = useMemo(
    () =>
      accessRows.filter(
        (row) =>
          String(row.status || "").toUpperCase() === "PENDING" &&
          String(row.type || "").toUpperCase() === "WORKER",
      ),
    [accessRows],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#1E293B]">Access Control & QR Management</h1>
          <p className="text-[#64748B] mt-1">Live QR access records from backend</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadAccessQrs()} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
          <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white rounded-lg gap-2">
                <Plus className="w-4 h-4" />
                Generate QR Code
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Generate Access QR Code</DialogTitle>
                <DialogDescription>
                  Generate a QR code for visitor, delivery, worker, or other access types.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Select
                    value={generateForm.unitId || "none"}
                    onValueChange={(value) =>
                      setGenerateForm((p) => ({ ...p, unitId: value === "none" ? "" : value }))
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
                  <Label>QR Type</Label>
                  <Select
                    value={generateForm.type}
                    onValueChange={(value) => setGenerateForm((p) => ({ ...p, type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["VISITOR", "DELIVERY", "WORKER", "SERVICE_PROVIDER", "RIDESHARE", "SELF"].map((type) => (
                        <SelectItem key={type} value={type}>
                          {humanizeEnum(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Visitor / Person Name {(generateForm.type === "VISITOR") ? "(Required)" : "(Optional)"}</Label>
                  <Input
                    value={generateForm.visitorName}
                    onChange={(e) => setGenerateForm((p) => ({ ...p, visitorName: e.target.value }))}
                    placeholder="John Visitor"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valid From (optional)</Label>
                    <Input
                      type="datetime-local"
                      value={generateForm.validFrom}
                      onChange={(e) => setGenerateForm((p) => ({ ...p, validFrom: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valid To (optional)</Label>
                    <Input
                      type="datetime-local"
                      value={generateForm.validTo}
                      onChange={(e) => setGenerateForm((p) => ({ ...p, validTo: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Input
                    value={generateForm.notes}
                    onChange={(e) => setGenerateForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Delivery driver - order #1234"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsGenerateDialogOpen(false)} disabled={isGenerating}>
                  Cancel
                </Button>
                <Button
                  className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white"
                  onClick={() => void handleGenerateQr()}
                  disabled={isGenerating}
                >
                  {isGenerating ? "Generating..." : "Generate"}
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
        {[
          { label: "Active QR Codes", value: stats.active, color: "#0B5FFF" },
          { label: "Visitors", value: stats.visitors, color: "#00B386" },
          { label: "Workers", value: stats.workers, color: "#3B82F6" },
          { label: "Deliveries", value: stats.deliveries, color: "#F59E0B" },
        ].map((card) => (
          <Card key={card.label} className="p-6 shadow-card rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#64748B] mb-1">{card.label}</p>
                <h3 className="text-[#1E293B]">{card.value}</h3>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${card.color}1A` }}>
                <QrCode className="w-6 h-6" style={{ color: card.color }} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="shadow-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#0B5FFF]" />
            <h3 className="text-[#1E293B]">Pending Worker Permits</h3>
            <Badge className="bg-[#EEF2FF] text-[#3730A3]">{stats.pendingWorkers}</Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => setActiveTab("pending-workers")}
          >
            View in table
          </Button>
        </div>
        <div className="p-4 space-y-3">
          {pendingWorkerRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#CBD5E1] p-4 text-sm text-[#64748B]">
              No pending worker permits right now.
            </div>
          ) : (
            pendingWorkerRows.slice(0, 6).map((row) => (
              <div
                key={row.id}
                className="rounded-lg border border-[#E5E7EB] p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[#1E293B] font-medium">{row.visitorName || "Worker permit request"}</p>
                    <Badge variant="secondary" className="bg-[#F8FAFC] text-[#334155]">
                      Unit {row.unit?.unitNumber ?? row.unitId ?? "—"}
                    </Badge>
                  </div>
                  <div className="text-xs text-[#64748B] flex items-center gap-1">
                    <Clock3 className="w-3 h-3" />
                    {row.validFrom ? formatDateTime(row.validFrom) : "—"} to{" "}
                    {row.validTo ? formatDateTime(row.validTo) : "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleRejectWorkerQr(row.id)}
                    disabled={actionRowId === row.id}
                  >
                    {actionRowId === row.id ? "Working..." : "Reject"}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white"
                    onClick={() => void handleApproveWorkerQr(row.id)}
                    disabled={actionRowId === row.id}
                  >
                    {actionRowId === row.id ? "Working..." : "Approve"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="shadow-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <h3 className="text-[#1E293B]">Access QR Logs</h3>
          <Button variant="outline" size="sm" className="gap-2 rounded-lg" onClick={() => void loadAccessQrs()}>
            <Download className="w-4 h-4" />
            Reload
          </Button>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start border-b border-[#E5E7EB] rounded-none h-12 bg-transparent px-4">
            <TabsTrigger value="all" className="rounded-lg">All</TabsTrigger>
            <TabsTrigger value="active" className="rounded-lg">Active</TabsTrigger>
            <TabsTrigger value="pending" className="rounded-lg">Pending</TabsTrigger>
            <TabsTrigger value="pending-workers" className="rounded-lg">
              Pending Workers ({stats.pendingWorkers})
            </TabsTrigger>
            <TabsTrigger value="expired" className="rounded-lg">Expired</TabsTrigger>
            <TabsTrigger value="used" className="rounded-lg">Used</TabsTrigger>
          </TabsList>

          {["all", "active", "pending", "pending-workers", "expired", "used"].map((tab) => {
            const tabRows = accessRows.filter((row) => {
              if (tab === "all") return true;
              const status = String(row.status || "").toUpperCase();
              if (tab === "active") return status === "ACTIVE";
              if (tab === "pending") return status === "PENDING";
              if (tab === "pending-workers") {
                return status === "PENDING" && String(row.type || "").toUpperCase() === "WORKER";
              }
              if (tab === "expired") return status === "EXPIRED";
              if (tab === "used") return status === "USED";
              return true;
            });
            return (
              <TabsContent key={tab} value={tab} className="m-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F9FAFB]">
                      <TableHead>QR Code ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Generated By</TableHead>
                      <TableHead>For</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Valid Period</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tabRows.map((row) => (
                      <TableRow key={row.id} className="hover:bg-[#F9FAFB]">
                        <TableCell className="font-medium text-[#1E293B]">
                          {row.qrId ?? row.code ?? row.qrCode ?? row.id}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-[#F3F4F6] text-[#1E293B]">
                            {humanizeEnum(row.type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[#64748B]">
                          {row.creator?.nameEN ?? row.createdBy?.nameEN ?? row.generatedById ?? "—"}
                        </TableCell>
                        <TableCell className="text-[#1E293B]">
                          {row.visitorName ?? row.worker?.name ?? row.serviceProviderName ?? "—"}
                        </TableCell>
                        <TableCell className="text-[#64748B]">
                          {row.unit?.unitNumber ?? row.unitId ?? "—"}
                        </TableCell>
                        <TableCell className="text-[#64748B] text-sm">
                          <div>{row.validFrom ? formatDateTime(row.validFrom) : "—"}</div>
                          <div className="text-xs">to {row.validTo ? formatDateTime(row.validTo) : "—"}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColorClass(row.status)}>{humanizeEnum(row.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {String(row.status || "").toUpperCase() === "ACTIVE" ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => void handleMarkQrUsed(row.id)}
                                disabled={actionRowId === row.id}
                              >
                                <CheckCheck className="w-4 h-4" />
                                {actionRowId === row.id ? "Working..." : "Mark Used"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => void handleRevokeQr(row.id)}
                                disabled={actionRowId === row.id}
                              >
                                <Ban className="w-4 h-4" />
                                {actionRowId === row.id ? "Working..." : "Revoke"}
                              </Button>
                            </div>
                          ) : String(row.status || "").toUpperCase() === "PENDING" &&
                            String(row.type || "").toUpperCase() === "WORKER" ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleRejectWorkerQr(row.id)}
                                disabled={actionRowId === row.id}
                              >
                                {actionRowId === row.id ? "Working..." : "Reject"}
                              </Button>
                              <Button
                                size="sm"
                                className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white"
                                onClick={() => void handleApproveWorkerQr(row.id)}
                                disabled={actionRowId === row.id}
                              >
                                {actionRowId === row.id ? "Working..." : "Approve"}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-[#64748B]">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!isLoading && tabRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10 text-[#64748B]">
                          No access QR records in this tab.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </TabsContent>
            );
          })}
        </Tabs>
      </Card>
    </div>
  );
}
