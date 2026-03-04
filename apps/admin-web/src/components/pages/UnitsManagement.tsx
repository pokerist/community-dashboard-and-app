import { useEffect, useMemo, useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Search, LayoutGrid, List, Plus, Pencil, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
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
import apiClient, { handleApiError, isAuthenticated } from "../../lib/api-client";

type CommunityOption = {
  id: string;
  name: string;
  isActive?: boolean;
};

export function UnitsManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [unitsData, setUnitsData] = useState<any[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [backendMode, setBackendMode] = useState(false);
  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [unitFormData, setUnitFormData] = useState({
    unitNumber: "",
    projectName: "Al Karma Residence",
    communityId: "",
    block: "",
    type: "",
    bedrooms: "",
    bathrooms: "",
    size: "",
    price: "",
    floor: "",
  });
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<string>("AVAILABLE");

  const formatStatusLabel = (status?: string) => {
    if (!status) return "Unknown";
    const normalized = String(status).toUpperCase();
    switch (normalized) {
      case "AVAILABLE":
        return "Available";
      case "HELD":
        return "Held";
      case "UNRELEASED":
        return "Unreleased";
      case "NOT_DELIVERED":
        return "Not Delivered";
      case "DELIVERED":
        return "Delivered";
      case "OCCUPIED":
        return "Occupied";
      case "LEASED":
        return "Rented";
      default:
        return status;
    }
  };

  const formatUnitTypeLabel = (type?: string) =>
    type ? String(type).replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : "—";

  const mapBackendUnitToView = (unit: any) => {
    const activeLease = Array.isArray(unit.leases)
      ? unit.leases.find((l: any) => l.status === "ACTIVE") || unit.leases[0]
      : null;
    return {
      id: unit.id,
      unitNumber: unit.unitNumber,
      block: unit.block ?? "",
      type: formatUnitTypeLabel(unit.type),
      bedrooms: unit.bedrooms ?? "—",
      bathrooms: unit.bathrooms ?? "—",
      size: unit.sizeSqm ? `${unit.sizeSqm} m²` : "—",
      price:
        unit.price !== null && unit.price !== undefined
          ? `EGP ${Number(unit.price).toLocaleString()}`
          : "—",
      status: formatStatusLabel(unit.status),
      statusRaw: unit.status,
      floor: unit.floors ?? "—",
      project: unit.projectName ?? "—",
      communityId: unit.communityId ?? "",
      building: unit.block ? `Block ${unit.block}` : "—",
      owner:
        Array.isArray(unit.residents) && unit.residents.some((r: any) => r.isPrimary)
          ? "Primary Owner Assigned"
          : null,
      tenant: activeLease?.tenantEmail || null,
      occupiedSince: activeLease?.startDate || null,
      lastUpdated: unit.updatedAt
        ? new Date(unit.updatedAt).toLocaleString()
        : "—",
    };
  };

  const loadUnitsFromBackend = async () => {
    if (!isAuthenticated()) {
      setBackendMode(false);
      setUnitsData([]);
      return;
    }
    setIsLoadingUnits(true);
    try {
      const response = await apiClient.get("/units", {
        params: { page: 1, limit: 100 },
      });
      const rows = Array.isArray(response.data?.data) ? response.data.data : [];
      setUnitsData(rows.map(mapBackendUnitToView));
      setBackendMode(true);
    } catch (error) {
      setBackendMode(false);
      toast.error("Failed to load units from backend", {
        description: handleApiError(error),
      });
    } finally {
      setIsLoadingUnits(false);
    }
  };

  const loadCommunities = async () => {
    if (!isAuthenticated()) {
      setCommunities([]);
      return;
    }
    try {
      const response = await apiClient.get("/communities");
      const rows = Array.isArray(response.data) ? response.data : [];
      setCommunities(
        rows.map((row: any) => ({
          id: row.id,
          name: row.name,
          isActive: row.isActive !== false,
        })),
      );
    } catch {
      setCommunities([]);
    }
  };

  useEffect(() => {
    void loadUnitsFromBackend();
    void loadCommunities();

    const onUnauthorized = () => {
      setBackendMode(false);
      setUnitsData([]);
    };
    window.addEventListener("auth:unauthorized", onUnauthorized as EventListener);
    return () => {
      window.removeEventListener("auth:unauthorized", onUnauthorized as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!communities.length) return;
    if (unitFormData.communityId) return;
    const firstActive = communities.find((community) => community.isActive !== false) ?? communities[0];
    if (!firstActive) return;
    setUnitFormData((prev) => ({
      ...prev,
      communityId: firstActive.id,
      projectName: firstActive.name,
    }));
  }, [communities, unitFormData.communityId]);

  const backendAvailable = useMemo(() => backendMode && isAuthenticated(), [backendMode]);

  const handleAddUnit = async () => {
    if (!unitFormData.unitNumber || !unitFormData.communityId || !unitFormData.type || !unitFormData.size) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!backendAvailable) {
      toast.error("Backend not connected", {
        description: "Sign in and sync units before creating records.",
      });
      return;
    }

    try {
      await apiClient.post("/units", {
        unitNumber: unitFormData.unitNumber,
        projectName: unitFormData.projectName,
        communityId: unitFormData.communityId,
        block: unitFormData.block || undefined,
        type: unitFormData.type.toUpperCase(),
        floors: unitFormData.floor ? Number(unitFormData.floor) : undefined,
        bedrooms: unitFormData.bedrooms ? Number(unitFormData.bedrooms) : undefined,
        bathrooms: unitFormData.bathrooms ? Number(unitFormData.bathrooms) : undefined,
        sizeSqm: Number(unitFormData.size),
        price: unitFormData.price ? Number(unitFormData.price) : undefined,
      });
      await loadUnitsFromBackend();
      setIsAddDialogOpen(false);
      setUnitFormData({
        unitNumber: "",
        projectName: unitFormData.projectName,
        communityId: unitFormData.communityId,
        block: "",
        type: "",
        bedrooms: "",
        bathrooms: "",
        size: "",
        price: "",
        floor: "",
      });
      toast.success("Unit created in backend");
    } catch (error) {
      toast.error("Failed to create unit", { description: handleApiError(error) });
    }
  };

  const handleDeleteUnit = async (id: string | number, unitNumber: string) => {
    if (!(backendAvailable && typeof id === "string")) {
      toast.error("Backend not connected", { description: "Cannot delete unit in offline mode." });
      return;
    }

    try {
      await apiClient.delete(`/units/${id}`);
      await loadUnitsFromBackend();
      toast.success("Unit deleted from backend", {
        description: `${unitNumber} has been removed from the system.`,
      });
    } catch (error) {
      toast.error("Failed to delete unit", { description: handleApiError(error) });
    }
  };

  const openEditDialog = (unit: any) => {
    if (typeof unit.id !== "string") return;
    setEditingUnitId(unit.id);
    setUnitFormData({
      unitNumber: unit.unitNumber ?? "",
      projectName: unit.project ?? "Al Karma Residence",
      communityId: unit.communityId ?? "",
      block: unit.block ?? "",
      type: String(unit.type ?? "").toUpperCase().replace(/ /g, "_"),
      bedrooms: unit.bedrooms && unit.bedrooms !== "—" ? String(unit.bedrooms) : "",
      bathrooms: unit.bathrooms && unit.bathrooms !== "—" ? String(unit.bathrooms) : "",
      size:
        typeof unit.size === "string" ? unit.size.replace(" m²", "").trim() : "",
      price:
        typeof unit.price === "string"
          ? unit.price.replace("EGP", "").replace(/,/g, "").trim()
          : "",
      floor: unit.floor && unit.floor !== "—" ? String(unit.floor) : "",
    });
    setEditingStatus(String(unit.statusRaw ?? "AVAILABLE"));
    setIsEditDialogOpen(true);
  };

  const handleEditUnit = async () => {
    if (!editingUnitId) return;
    if (!unitFormData.unitNumber || !unitFormData.communityId || !unitFormData.type || !unitFormData.size) {
      toast.error("Please fill in all required fields");
      return;
    }
    try {
      await apiClient.patch(`/units/${editingUnitId}`, {
        unitNumber: unitFormData.unitNumber,
        projectName: unitFormData.projectName,
        communityId: unitFormData.communityId,
        block: unitFormData.block || undefined,
        type: unitFormData.type.toUpperCase(),
        floors: unitFormData.floor ? Number(unitFormData.floor) : undefined,
        bedrooms: unitFormData.bedrooms ? Number(unitFormData.bedrooms) : undefined,
        bathrooms: unitFormData.bathrooms ? Number(unitFormData.bathrooms) : undefined,
        sizeSqm: Number(unitFormData.size),
        price: unitFormData.price ? Number(unitFormData.price) : undefined,
        status: editingStatus,
      });
      toast.success("Unit updated");
      setIsEditDialogOpen(false);
      setEditingUnitId(null);
      await loadUnitsFromBackend();
    } catch (error) {
      toast.error("Failed to update unit", { description: handleApiError(error) });
    }
  };

  const filteredUnits = unitsData.filter((unit) => {
    const matchesSearch =
      unit.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      unit.building.toLowerCase().includes(searchTerm.toLowerCase()) ||
      unit.project.toLowerCase().includes(searchTerm.toLowerCase());
    const unitStatusKey = String(unit.statusRaw || unit.status || "").toUpperCase();
    const matchesStatus =
      statusFilter === "all" || unitStatusKey === statusFilter.toUpperCase();
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (String(status).toUpperCase()) {
      case "OCCUPIED":
      case "Occupied":
        return "bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20";
      case "LEASED":
      case "DELIVERED":
        return "bg-[#00B386]/10 text-[#00B386] hover:bg-[#00B386]/20";
      case "AVAILABLE":
      case "Available":
        return "bg-[#3B82F6]/10 text-[#3B82F6] hover:bg-[#3B82F6]/20";
      case "HELD":
        return "bg-[#F59E0B]/10 text-[#F59E0B] hover:bg-[#F59E0B]/20";
      case "NOT_DELIVERED":
      case "UNRELEASED":
        return "bg-[#64748B]/10 text-[#64748B] hover:bg-[#64748B]/20";
      default:
        return "bg-[#F3F4F6] text-[#1E293B]";
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#1E293B]">Units Management</h1>
          <p className="text-[#64748B] mt-1">
            Manage all properties across Al Karma projects
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Badge
              className={
                backendAvailable
                  ? "bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20"
                  : "bg-[#F59E0B]/10 text-[#F59E0B] hover:bg-[#F59E0B]/20"
              }
            >
              {backendAvailable ? "Backend Mode" : "Disconnected"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadUnitsFromBackend()}
              disabled={isLoadingUnits}
            >
              {isLoadingUnits ? "Syncing..." : "Sync Units"}
            </Button>
          </div>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white rounded-lg gap-2">
              <Plus className="w-4 h-4" />
              Add Unit
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Unit</DialogTitle>
              <DialogDescription>
                Enter the details for the new residential unit
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="communityId">Community</Label>
                <Select
                  value={unitFormData.communityId}
                  onValueChange={(value) => {
                    const selected = communities.find((community) => community.id === value);
                    setUnitFormData({
                      ...unitFormData,
                      communityId: value,
                      projectName: selected?.name ?? unitFormData.projectName,
                    });
                  }}
                >
                  <SelectTrigger id="communityId">
                    <SelectValue placeholder="Select community" />
                  </SelectTrigger>
                  <SelectContent>
                    {communities.map((community) => (
                      <SelectItem key={community.id} value={community.id}>
                        {community.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="block">Block</Label>
                <Select value={unitFormData.block} onValueChange={(value) => setUnitFormData({...unitFormData, block: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select block" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Block A</SelectItem>
                    <SelectItem value="B">Block B</SelectItem>
                    <SelectItem value="C">Block C</SelectItem>
                    <SelectItem value="D">Block D</SelectItem>
                    <SelectItem value="E">Block E</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitNumber">Unit Number</Label>
                <Input 
                  id="unitNumber" 
                  placeholder="205" 
                  value={unitFormData.unitNumber}
                  onChange={(e) => setUnitFormData({...unitFormData, unitNumber: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Unit Type</Label>
                <Select value={unitFormData.type} onValueChange={(value) => setUnitFormData({...unitFormData, type: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="APARTMENT">Apartment</SelectItem>
                    <SelectItem value="VILLA">Villa</SelectItem>
                    <SelectItem value="PENTHOUSE">Penthouse</SelectItem>
                    <SelectItem value="DUPLEX">Duplex</SelectItem>
                    <SelectItem value="TOWNHOUSE">Townhouse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="floor">Floor</Label>
                <Input 
                  id="floor" 
                  placeholder="2" 
                  type="number"
                  value={unitFormData.floor}
                  onChange={(e) => setUnitFormData({...unitFormData, floor: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bedrooms">Bedrooms</Label>
                <Input 
                  id="bedrooms" 
                  placeholder="3" 
                  type="number"
                  value={unitFormData.bedrooms}
                  onChange={(e) => setUnitFormData({...unitFormData, bedrooms: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bathrooms">Bathrooms</Label>
                <Input 
                  id="bathrooms" 
                  placeholder="2" 
                  type="number"
                  value={unitFormData.bathrooms}
                  onChange={(e) => setUnitFormData({...unitFormData, bathrooms: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="size">Size (m²)</Label>
                <Input 
                  id="size" 
                  placeholder="150" 
                  type="number"
                  value={unitFormData.size}
                  onChange={(e) => setUnitFormData({...unitFormData, size: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price (EGP)</Label>
                <Input 
                  id="price" 
                  placeholder="2500000" 
                  type="number"
                  value={unitFormData.price}
                  onChange={(e) => setUnitFormData({...unitFormData, price: e.target.value})}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white"
                onClick={handleAddUnit}
              >
                Add Unit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Unit</DialogTitle>
              <DialogDescription>Update unit details and availability status.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2 col-span-2">
                <Label>Community</Label>
                <Select
                  value={unitFormData.communityId}
                  onValueChange={(value) => {
                    const selected = communities.find((community) => community.id === value);
                    setUnitFormData({
                      ...unitFormData,
                      communityId: value,
                      projectName: selected?.name ?? unitFormData.projectName,
                    });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select community" /></SelectTrigger>
                  <SelectContent>
                    {communities.map((community) => (
                      <SelectItem key={community.id} value={community.id}>
                        {community.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Block</Label>
                <Input value={unitFormData.block} onChange={(e) => setUnitFormData({ ...unitFormData, block: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Unit Number</Label>
                <Input value={unitFormData.unitNumber} onChange={(e) => setUnitFormData({ ...unitFormData, unitNumber: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Unit Type</Label>
                <Select value={unitFormData.type} onValueChange={(value) => setUnitFormData({ ...unitFormData, type: value })}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="APARTMENT">Apartment</SelectItem>
                    <SelectItem value="VILLA">Villa</SelectItem>
                    <SelectItem value="PENTHOUSE">Penthouse</SelectItem>
                    <SelectItem value="DUPLEX">Duplex</SelectItem>
                    <SelectItem value="TOWNHOUSE">Townhouse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editingStatus} onValueChange={setEditingStatus}>
                  <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AVAILABLE">Available</SelectItem>
                    <SelectItem value="HELD">Held</SelectItem>
                    <SelectItem value="UNRELEASED">Unreleased</SelectItem>
                    <SelectItem value="NOT_DELIVERED">Not Delivered</SelectItem>
                    <SelectItem value="DELIVERED">Delivered</SelectItem>
                    <SelectItem value="OCCUPIED">Occupied</SelectItem>
                    <SelectItem value="LEASED">Leased</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Floor</Label>
                <Input type="number" value={unitFormData.floor} onChange={(e) => setUnitFormData({ ...unitFormData, floor: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Bedrooms</Label>
                <Input type="number" value={unitFormData.bedrooms} onChange={(e) => setUnitFormData({ ...unitFormData, bedrooms: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Bathrooms</Label>
                <Input type="number" value={unitFormData.bathrooms} onChange={(e) => setUnitFormData({ ...unitFormData, bathrooms: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Size (m²)</Label>
                <Input type="number" value={unitFormData.size} onChange={(e) => setUnitFormData({ ...unitFormData, size: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Price (EGP)</Label>
                <Input type="number" value={unitFormData.price} onChange={(e) => setUnitFormData({ ...unitFormData, price: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white" onClick={() => void handleEditUnit()}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters and View Toggle */}
      <Card className="p-4 shadow-card rounded-xl">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <Input
              placeholder="Search by unit number, building, or project..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-lg"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[200px] rounded-lg">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="AVAILABLE">Available</SelectItem>
              <SelectItem value="HELD">Held</SelectItem>
              <SelectItem value="UNRELEASED">Unreleased</SelectItem>
              <SelectItem value="NOT_DELIVERED">Not Delivered</SelectItem>
              <SelectItem value="DELIVERED">Delivered</SelectItem>
              <SelectItem value="OCCUPIED">Occupied</SelectItem>
              <SelectItem value="LEASED">Rented</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2 border border-[#E5E7EB] rounded-lg p-1">
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className={viewMode === "table" ? "bg-[#0B5FFF] text-white" : ""}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className={viewMode === "grid" ? "bg-[#0B5FFF] text-white" : ""}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Table View */}
      {viewMode === "table" && (
        <Card className="shadow-card rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F9FAFB]">
                <TableHead>Unit Number</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Building</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUnits.map((unit) => (
                <TableRow key={unit.id} className="hover:bg-[#F9FAFB] cursor-pointer">
                  <TableCell className="font-medium text-[#1E293B]">
                    {unit.unitNumber}
                  </TableCell>
                  <TableCell className="text-[#64748B]">{unit.project}</TableCell>
                  <TableCell className="text-[#64748B]">{unit.building}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-[#F3F4F6] text-[#1E293B]">
                      {unit.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[#64748B]">{unit.size}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(unit.statusRaw || unit.status)}>{unit.status}</Badge>
                  </TableCell>
                  <TableCell className="text-[#1E293B]">
                    {unit.owner || <span className="text-[#64748B]">—</span>}
                  </TableCell>
                  <TableCell className="text-[#1E293B]">
                    {unit.tenant || <span className="text-[#64748B]">—</span>}
                  </TableCell>
                  <TableCell className="text-[#64748B]">{unit.lastUpdated}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(unit)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
                        onClick={() => void handleDeleteUnit(unit.id, unit.unitNumber)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUnits.map((unit) => (
            <Card
              key={unit.id}
              className="p-6 shadow-card hover:shadow-hover transition-shadow cursor-pointer rounded-xl group"
              onDoubleClick={() => handleDeleteUnit(unit.id, unit.unitNumber)}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-[#1E293B]">{unit.unitNumber}</h3>
                  <p className="text-sm text-[#64748B] mt-1">{unit.building}</p>
                </div>
                <Badge className={getStatusColor(unit.statusRaw || unit.status)}>{unit.status}</Badge>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#64748B]">Project</span>
                  <span className="text-sm text-[#1E293B]">{unit.project}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#64748B]">Type</span>
                  <Badge variant="secondary" className="bg-[#F3F4F6] text-[#1E293B]">
                    {unit.type}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#64748B]">Size</span>
                  <span className="text-sm text-[#1E293B]">{unit.size}</span>
                </div>
                
                {unit.owner && (
                  <div className="pt-3 border-t border-[#E5E7EB]">
                    <span className="text-xs text-[#64748B]">Owner</span>
                    <p className="text-sm text-[#1E293B] mt-1">{unit.owner}</p>
                  </div>
                )}
                
                {unit.tenant && (
                  <div className="pt-3 border-t border-[#E5E7EB]">
                    <span className="text-xs text-[#64748B]">Tenant</span>
                    <p className="text-sm text-[#1E293B] mt-1">{unit.tenant}</p>
                  </div>
                )}
                
                <div className="pt-3 border-t border-[#E5E7EB] text-xs text-[#64748B]">
                  Updated: {unit.lastUpdated}
                </div>
                <div className="pt-2 flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEditDialog(unit)}>
                    <Pencil className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[#EF4444] border-[#FECACA] hover:bg-[#FEE2E2]"
                    onClick={() => void handleDeleteUnit(unit.id, unit.unitNumber)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
