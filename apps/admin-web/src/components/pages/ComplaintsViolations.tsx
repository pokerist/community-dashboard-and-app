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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Search, AlertTriangle, Ban, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import apiClient from "../../lib/api-client";
import {
  errorMessage,
  extractRows,
  formatCurrencyEGP,
  formatDate,
  getPriorityColorClass,
  getStatusColorClass,
  humanizeEnum,
} from "../../lib/live-data";

export function ComplaintsViolations() {
  const [isCreateComplaintOpen, setIsCreateComplaintOpen] = useState(false);
  const [isCreateViolationOpen, setIsCreateViolationOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [complaintsData, setComplaintsData] = useState<any[]>([]);
  const [violationsData, setViolationsData] = useState<any[]>([]);
  const [residentOptions, setResidentOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [unitOptions, setUnitOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmittingComplaint, setIsSubmittingComplaint] = useState(false);
  const [isSubmittingViolation, setIsSubmittingViolation] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [complaintFormData, setComplaintFormData] = useState({
    reporterId: "",
    unitId: "",
    category: "",
    priority: "",
    description: "",
  });
  const [violationFormData, setViolationFormData] = useState({
    unitId: "",
    residentId: "",
    type: "",
    fineAmount: "",
    dueDate: "",
    description: "",
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [complaintsRes, violationsRes, residentsRes, unitsRes] = await Promise.all([
        apiClient.get("/complaints", { params: { page: 1, limit: 100 } }),
        apiClient.get("/violations", { params: { page: 1, limit: 100 } }),
        apiClient.get("/admin/users", { params: { userType: "resident", take: 500, skip: 0 } }),
        apiClient.get("/units", { params: { page: 1, limit: 100 } }),
      ]);
      setComplaintsData(extractRows(complaintsRes.data));
      setViolationsData(extractRows(violationsRes.data));

      const residents = extractRows(residentsRes.data).map((user: any) => ({
        id: String(user.id),
        label: user.nameEN ?? user.nameAR ?? user.email ?? user.phone ?? String(user.id),
      }));
      const units = extractRows(unitsRes.data).map((unit: any) => ({
        id: String(unit.id),
        label:
          [unit.projectName, unit.block ? `Block ${unit.block}` : null, unit.unitNumber ? `Unit ${unit.unitNumber}` : null]
            .filter(Boolean)
            .join(" - ") || String(unit.id),
      }));

      setResidentOptions(residents);
      setUnitOptions(units);
    } catch (error) {
      const msg = errorMessage(error);
      setLoadError(msg);
      toast.error("Failed to load complaints/violations", { description: msg });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateComplaint = async () => {
    if (!complaintFormData.reporterId || !complaintFormData.category || !complaintFormData.description) {
      toast.error("Reporter, category, and description are required");
      return;
    }

    setIsSubmittingComplaint(true);
    try {
      await apiClient.post("/complaints/admin/create", {
        reporterId: complaintFormData.reporterId,
        unitId: complaintFormData.unitId || undefined,
        category: complaintFormData.category,
        priority: complaintFormData.priority || undefined,
        description: complaintFormData.description,
      });

      toast.success("Complaint created");
      setIsCreateComplaintOpen(false);
      setComplaintFormData({
        reporterId: "",
        unitId: "",
        category: "",
        priority: "",
        description: "",
      });
      await loadData();
    } catch (error) {
      toast.error("Failed to create complaint", { description: errorMessage(error) });
    } finally {
      setIsSubmittingComplaint(false);
    }
  };

  const handleCreateViolation = async () => {
    if (!violationFormData.unitId || !violationFormData.type || !violationFormData.description) {
      toast.error("Unit, type, and description are required");
      return;
    }
    if (!violationFormData.dueDate) {
      toast.error("Due date is required");
      return;
    }

    setIsSubmittingViolation(true);
    try {
      await apiClient.post("/violations", {
        unitId: violationFormData.unitId,
        residentId: violationFormData.residentId || undefined,
        type: violationFormData.type,
        description: violationFormData.description,
        fineAmount: Number(violationFormData.fineAmount || 0),
        dueDate: new Date(violationFormData.dueDate).toISOString(),
      });

      toast.success("Violation created");
      setIsCreateViolationOpen(false);
      setViolationFormData({
        unitId: "",
        residentId: "",
        type: "",
        fineAmount: "",
        dueDate: "",
        description: "",
      });
      await loadData();
    } catch (error) {
      toast.error("Failed to create violation", { description: errorMessage(error) });
    } finally {
      setIsSubmittingViolation(false);
    }
  };

  const filteredComplaints = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return complaintsData.filter((c: any) => {
      if (!q) return true;
      return [
        c.complaintNumber,
        c.id,
        c.category,
        c.description,
        c.status,
        c.priority,
        c.reporter?.nameEN,
        c.reporter?.email,
        c.unit?.unitNumber,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [complaintsData, searchTerm]);

  const filteredViolations = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return violationsData.filter((v: any) => {
      if (!q) return true;
      return [
        v.violationNumber,
        v.id,
        v.type,
        v.description,
        v.status,
        v.resident?.nameEN,
        v.unit?.unitNumber,
      ]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q));
    });
  }, [violationsData, searchTerm]);

  const openComplaints = complaintsData.filter((c) =>
    ["NEW", "OPEN", "IN_PROGRESS", "PENDING"].includes(String(c.status || "").toUpperCase()),
  );
  const pendingViolations = violationsData.filter((v) =>
    ["PENDING", "PENDING_PAYMENT"].includes(String(v.status || "").toUpperCase()),
  );
  const finesCollected = violationsData
    .filter((v) => String(v.status || "").toUpperCase() === "PAID")
    .reduce((sum, v) => sum + Number(v.fineAmount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#1E293B]">Complaints & Violations</h1>
          <p className="text-[#64748B] mt-1">Live complaint and violation records from the backend</p>
        </div>
        <Button variant="outline" onClick={() => void loadData()} disabled={isLoading}>
          {isLoading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {loadError ? (
        <Card className="p-4 border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] rounded-xl">{loadError}</Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6 shadow-card rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#64748B] mb-2">Total Complaints</p>
              <h3 className="text-[#1E293B]">{complaintsData.length}</h3>
              <p className="text-xs text-[#64748B] mt-1">Live count</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#0B5FFF]/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-[#0B5FFF]" />
            </div>
          </div>
        </Card>
        <Card className="p-6 shadow-card rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#64748B] mb-2">Pending / Open</p>
              <h3 className="text-[#1E293B]">{openComplaints.length}</h3>
              <p className="text-xs text-[#F59E0B] mt-1">Requires attention</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-[#F59E0B]" />
            </div>
          </div>
        </Card>
        <Card className="p-6 shadow-card rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#64748B] mb-2">Total Violations</p>
              <h3 className="text-[#1E293B]">{violationsData.length}</h3>
              <p className="text-xs text-[#64748B] mt-1">{pendingViolations.length} pending</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#EF4444]/10 flex items-center justify-center">
              <Ban className="w-6 h-6 text-[#EF4444]" />
            </div>
          </div>
        </Card>
        <Card className="p-6 shadow-card rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#64748B] mb-2">Fines Collected</p>
              <h3 className="text-[#1E293B]">{formatCurrencyEGP(finesCollected)}</h3>
              <p className="text-xs text-[#10B981] mt-1">Paid violations only</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
              <Ban className="w-6 h-6 text-[#10B981]" />
            </div>
          </div>
        </Card>
      </div>

      <Card className="shadow-card rounded-xl overflow-hidden">
        <Tabs defaultValue="complaints" className="w-full">
          <TabsList className="w-full justify-start border-b border-[#E5E7EB] rounded-none h-12 bg-transparent px-4">
            <TabsTrigger value="complaints" className="rounded-lg">Complaints</TabsTrigger>
            <TabsTrigger value="violations" className="rounded-lg">Violations</TabsTrigger>
          </TabsList>

          <TabsContent value="complaints" className="m-0">
            <div className="p-4 border-b border-[#E5E7EB] flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                <Input
                  placeholder="Search complaints..."
                  className="pl-10 rounded-lg"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Dialog open={isCreateComplaintOpen} onOpenChange={setIsCreateComplaintOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white rounded-lg gap-2">
                    <Plus className="w-4 h-4" />
                    File Complaint
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>File New Complaint</DialogTitle>
                    <DialogDescription>
                      Admin create-on-behalf flow uses <code>/complaints/admin/create</code>.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="complaintReporter">Reporter (Resident User)</Label>
                      <Select
                        value={complaintFormData.reporterId || "none"}
                        onValueChange={(value) =>
                          setComplaintFormData((p) => ({
                            ...p,
                            reporterId: value === "none" ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger id="complaintReporter">
                          <SelectValue placeholder="Select resident" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Select resident</SelectItem>
                          {residentOptions.map((resident) => (
                            <SelectItem key={resident.id} value={resident.id}>
                              {resident.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="complaintUnit">Unit (optional)</Label>
                      <Select
                        value={complaintFormData.unitId || "none"}
                        onValueChange={(value) =>
                          setComplaintFormData((p) => ({
                            ...p,
                            unitId: value === "none" ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger id="complaintUnit">
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No unit</SelectItem>
                          {unitOptions.map((unit) => (
                            <SelectItem key={unit.id} value={unit.id}>
                              {unit.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Complaint Category</Label>
                      <Input
                        id="category"
                        placeholder="Noise / Parking / Maintenance..."
                        value={complaintFormData.category}
                        onChange={(e) => setComplaintFormData((p) => ({ ...p, category: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority</Label>
                      <Select
                        value={complaintFormData.priority}
                        onValueChange={(value) => setComplaintFormData((p) => ({ ...p, priority: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOW">Low</SelectItem>
                          <SelectItem value="MEDIUM">Medium</SelectItem>
                          <SelectItem value="HIGH">High</SelectItem>
                          <SelectItem value="CRITICAL">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        rows={4}
                        value={complaintFormData.description}
                        onChange={(e) => setComplaintFormData((p) => ({ ...p, description: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateComplaintOpen(false)} disabled={isSubmittingComplaint}>
                      Cancel
                    </Button>
                    <Button
                      className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white"
                      onClick={() => void handleCreateComplaint()}
                      disabled={isSubmittingComplaint}
                    >
                      {isSubmittingComplaint ? "Submitting..." : "Submit Complaint"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="bg-[#F9FAFB]">
                  <TableHead>Complaint ID</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredComplaints.map((complaint: any) => (
                  <TableRow key={complaint.id} className="hover:bg-[#F9FAFB]">
                    <TableCell className="font-medium text-[#1E293B]">
                      {complaint.complaintNumber ?? complaint.id}
                    </TableCell>
                    <TableCell className="text-[#64748B]">
                      {complaint.reporter?.nameEN ?? complaint.reporter?.email ?? complaint.reporterId ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-[#F3F4F6] text-[#1E293B]">
                        {complaint.unit?.unitNumber ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[#1E293B]">{complaint.category ?? "—"}</TableCell>
                    <TableCell className="text-[#64748B] max-w-xs truncate">
                      {complaint.description ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={getPriorityColorClass(complaint.priority)}>
                        {humanizeEnum(complaint.priority)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColorClass(complaint.status)}>
                        {humanizeEnum(complaint.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[#64748B]">
                      {complaint.assignedTo?.nameEN ?? complaint.assignedToId ?? "Unassigned"}
                    </TableCell>
                    <TableCell className="text-[#64748B]">{formatDate(complaint.createdAt)}</TableCell>
                  </TableRow>
                ))}
                {!isLoading && filteredComplaints.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-[#64748B]">
                      No complaints found.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="violations" className="m-0">
            <div className="p-4 border-b border-[#E5E7EB] flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                <Input
                  placeholder="Search violations..."
                  className="pl-10 rounded-lg"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Dialog open={isCreateViolationOpen} onOpenChange={setIsCreateViolationOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-[#EF4444] hover:bg-[#EF4444]/90 text-white rounded-lg gap-2">
                    <Plus className="w-4 h-4" />
                    Issue Violation
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Issue New Violation</DialogTitle>
                    <DialogDescription>
                      Creates a violation and auto-generates a fine invoice in the backend.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="vunit">Unit</Label>
                      <Select
                        value={violationFormData.unitId || "none"}
                        onValueChange={(value) =>
                          setViolationFormData((p) => ({
                            ...p,
                            unitId: value === "none" ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger id="vunit">
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
                      <Label htmlFor="vresident">Resident (optional)</Label>
                      <Select
                        value={violationFormData.residentId || "none"}
                        onValueChange={(value) =>
                          setViolationFormData((p) => ({
                            ...p,
                            residentId: value === "none" ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger id="vresident">
                          <SelectValue placeholder="Select resident" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No specific resident</SelectItem>
                          {residentOptions.map((resident) => (
                            <SelectItem key={resident.id} value={resident.id}>
                              {resident.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vtype">Type</Label>
                      <Input
                        id="vtype"
                        value={violationFormData.type}
                        onChange={(e) => setViolationFormData((p) => ({ ...p, type: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vfine">Fine Amount</Label>
                      <Input
                        id="vfine"
                        type="number"
                        value={violationFormData.fineAmount}
                        onChange={(e) => setViolationFormData((p) => ({ ...p, fineAmount: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vdueDate">Due Date</Label>
                      <Input
                        id="vdueDate"
                        type="date"
                        value={violationFormData.dueDate}
                        onChange={(e) => setViolationFormData((p) => ({ ...p, dueDate: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vdesc">Description</Label>
                      <Textarea
                        id="vdesc"
                        rows={4}
                        value={violationFormData.description}
                        onChange={(e) => setViolationFormData((p) => ({ ...p, description: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateViolationOpen(false)} disabled={isSubmittingViolation}>
                      Cancel
                    </Button>
                    <Button
                      className="bg-[#EF4444] hover:bg-[#EF4444]/90 text-white"
                      onClick={() => void handleCreateViolation()}
                      disabled={isSubmittingViolation}
                    >
                      {isSubmittingViolation ? "Creating..." : "Create Violation"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="bg-[#F9FAFB]">
                  <TableHead>Violation ID</TableHead>
                  <TableHead>Resident</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Fine Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issued Date</TableHead>
                  <TableHead>Paid Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredViolations.map((violation: any) => (
                  <TableRow key={violation.id} className="hover:bg-[#F9FAFB]">
                    <TableCell className="font-medium text-[#1E293B]">
                      {violation.violationNumber ?? violation.id}
                    </TableCell>
                    <TableCell className="text-[#64748B]">
                      {violation.resident?.nameEN ?? violation.resident?.email ?? violation.residentId ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-[#F3F4F6] text-[#1E293B]">
                        {violation.unit?.unitNumber ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[#1E293B]">{violation.type ?? "—"}</TableCell>
                    <TableCell className="text-[#64748B] max-w-xs truncate">
                      {violation.description ?? "—"}
                    </TableCell>
                    <TableCell className="text-[#1E293B]">{formatCurrencyEGP(violation.fineAmount)}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColorClass(violation.status)}>
                        {humanizeEnum(violation.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[#64748B]">{formatDate(violation.createdAt ?? violation.issuedAt)}</TableCell>
                    <TableCell className="text-[#64748B]">{formatDate(violation.paidDate)}</TableCell>
                  </TableRow>
                ))}
                {!isLoading && filteredViolations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-[#64748B]">
                      No violations found.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
