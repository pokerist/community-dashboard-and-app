import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import communityService, {
  type ClusterItem,
  type CommunityDetail,
  type CommunityListItem,
  type EntryRole,
  type GateItem,
  type GateRole,
} from "../../lib/community-service";
import { handleApiError } from "../../lib/api-client";
import { cn } from "../ui/utils";

const ENTRY_ROLE_OPTIONS: Array<{ value: EntryRole; label: string }> = [
  { value: "RESIDENT_OWNER", label: "Owner" },
  { value: "RESIDENT_FAMILY", label: "Family Member" },
  { value: "RESIDENT_TENANT", label: "Tenant" },
  { value: "VISITOR", label: "Visitor" },
  { value: "WORKER", label: "Worker" },
  { value: "STAFF", label: "Staff" },
];

const GATE_ROLE_OPTIONS: GateRole[] = [
  "RESIDENT",
  "VISITOR",
  "WORKER",
  "DELIVERY",
  "STAFF",
  "RIDESHARE",
];

const roleBadgeClass: Record<GateRole, string> = {
  RESIDENT: "bg-blue-100 text-blue-700 border-blue-200",
  VISITOR: "bg-emerald-100 text-emerald-700 border-emerald-200",
  WORKER: "bg-amber-100 text-amber-700 border-amber-200",
  DELIVERY: "bg-orange-100 text-orange-700 border-orange-200",
  STAFF: "bg-violet-100 text-violet-700 border-violet-200",
  RIDESHARE: "bg-teal-100 text-teal-700 border-teal-200",
};

type CommunityFormState = {
  name: string;
  code: string;
  displayOrder: string;
  isActive: boolean;
  allowedEntryRoles: EntryRole[];
};

type ClusterFormState = {
  name: string;
  code: string;
  displayOrder: string;
};

type GateFormState = {
  name: string;
  code: string;
  etaMinutes: string;
  allowedRoles: GateRole[];
};

const defaultCommunityForm: CommunityFormState = {
  name: "",
  code: "",
  displayOrder: "0",
  isActive: true,
  allowedEntryRoles: ["RESIDENT_OWNER", "VISITOR", "STAFF"],
};

const defaultClusterForm: ClusterFormState = {
  name: "",
  code: "",
  displayOrder: "0",
};

const defaultGateForm: GateFormState = {
  name: "",
  code: "",
  etaMinutes: "",
  allowedRoles: ["VISITOR"],
};

function entryRoleLabel(role: EntryRole): string {
  return ENTRY_ROLE_OPTIONS.find((item) => item.value === role)?.label ?? role;
}

export function CommunitiesManagement() {
  const [communities, setCommunities] = useState<CommunityListItem[]>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  const [selectedCommunityDetail, setSelectedCommunityDetail] = useState<CommunityDetail | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [search, setSearch] = useState("");

  const [communityDialogOpen, setCommunityDialogOpen] = useState(false);
  const [editingCommunity, setEditingCommunity] = useState<CommunityListItem | null>(null);
  const [communityForm, setCommunityForm] = useState<CommunityFormState>(defaultCommunityForm);

  const [clusterDialogOpen, setClusterDialogOpen] = useState(false);
  const [editingCluster, setEditingCluster] = useState<ClusterItem | null>(null);
  const [clusterForm, setClusterForm] = useState<ClusterFormState>(defaultClusterForm);

  const [gateDialogOpen, setGateDialogOpen] = useState(false);
  const [editingGate, setEditingGate] = useState<GateItem | null>(null);
  const [gateForm, setGateForm] = useState<GateFormState>(defaultGateForm);

  const loadCommunities = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const rows = await communityService.listCommunities();
      setCommunities(rows);
      if (!selectedCommunityId && rows.length > 0) {
        setSelectedCommunityId(rows[0].id);
      }
      if (selectedCommunityId && !rows.some((row) => row.id === selectedCommunityId)) {
        setSelectedCommunityId(rows[0]?.id ?? null);
      }
    } catch (error) {
      toast.error("Failed to load communities", { description: handleApiError(error) });
    } finally {
      setIsLoadingList(false);
    }
  }, [selectedCommunityId]);

  const loadCommunityDetail = useCallback(async (communityId: string) => {
    setIsLoadingDetail(true);
    try {
      const detail = await communityService.getCommunityDetail(communityId);
      setSelectedCommunityDetail(detail);
    } catch (error) {
      toast.error("Failed to load community detail", { description: handleApiError(error) });
      setSelectedCommunityDetail(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    void loadCommunities();
  }, [loadCommunities]);

  useEffect(() => {
    if (!selectedCommunityId) {
      setSelectedCommunityDetail(null);
      return;
    }
    void loadCommunityDetail(selectedCommunityId);
  }, [loadCommunityDetail, selectedCommunityId]);

  const filteredCommunities = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return communities;
    return communities.filter((community) => {
      const code = community.code ?? "";
      return (
        community.name.toLowerCase().includes(term) ||
        code.toLowerCase().includes(term)
      );
    });
  }, [communities, search]);

  const openCreateCommunity = () => {
    setEditingCommunity(null);
    setCommunityForm(defaultCommunityForm);
    setCommunityDialogOpen(true);
  };

  const openEditCommunity = (community: CommunityListItem) => {
    setEditingCommunity(community);
    setCommunityForm({
      name: community.name,
      code: community.code ?? "",
      displayOrder: String(community.displayOrder ?? 0),
      isActive: community.isActive !== false,
      allowedEntryRoles: community.allowedEntryRoles?.length
        ? community.allowedEntryRoles
        : defaultCommunityForm.allowedEntryRoles,
    });
    setCommunityDialogOpen(true);
  };

  const toggleEntryRole = (role: EntryRole) => {
    setCommunityForm((prev) => {
      const hasRole = prev.allowedEntryRoles.includes(role);
      return {
        ...prev,
        allowedEntryRoles: hasRole
          ? prev.allowedEntryRoles.filter((item) => item !== role)
          : [...prev.allowedEntryRoles, role],
      };
    });
  };

  const saveCommunity = async () => {
    if (!communityForm.name.trim()) {
      toast.error("Community name is required");
      return;
    }
    if (communityForm.allowedEntryRoles.length === 0) {
      toast.error("Select at least one allowed entry role");
      return;
    }

    const payload = {
      name: communityForm.name.trim(),
      code: communityForm.code.trim() || undefined,
      displayOrder: Number.isFinite(Number(communityForm.displayOrder))
        ? Number(communityForm.displayOrder)
        : 0,
      isActive: communityForm.isActive,
      allowedEntryRoles: communityForm.allowedEntryRoles,
    };

    try {
      if (editingCommunity) {
        await communityService.updateCommunity(editingCommunity.id, payload);
        toast.success("Community updated");
      } else {
        const created = await communityService.createCommunity(payload);
        setSelectedCommunityId(created.id);
        toast.success("Community created");
      }
      setCommunityDialogOpen(false);
      await loadCommunities();
    } catch (error) {
      toast.error("Failed to save community", { description: handleApiError(error) });
    }
  };

  const removeCommunity = async (community: CommunityListItem) => {
    try {
      await communityService.deleteCommunity(community.id);
      toast.success("Community deleted");
      if (selectedCommunityId === community.id) {
        setSelectedCommunityId(null);
      }
      await loadCommunities();
    } catch (error) {
      toast.error("Cannot delete community", { description: handleApiError(error) });
    }
  };

  const openCreateCluster = () => {
    setEditingCluster(null);
    setClusterForm(defaultClusterForm);
    setClusterDialogOpen(true);
  };

  const openEditCluster = (cluster: ClusterItem) => {
    setEditingCluster(cluster);
    setClusterForm({
      name: cluster.name,
      code: cluster.code ?? "",
      displayOrder: String(cluster.displayOrder ?? 0),
    });
    setClusterDialogOpen(true);
  };

  const saveCluster = async () => {
    if (!selectedCommunityId) return;
    if (!clusterForm.name.trim()) {
      toast.error("Cluster name is required");
      return;
    }

    const payload = {
      name: clusterForm.name.trim(),
      code: clusterForm.code.trim() || undefined,
      displayOrder: Number.isFinite(Number(clusterForm.displayOrder))
        ? Number(clusterForm.displayOrder)
        : 0,
    };

    try {
      if (editingCluster) {
        await communityService.updateCluster(editingCluster.id, payload);
        toast.success("Cluster updated");
      } else {
        await communityService.createCluster(selectedCommunityId, payload);
        toast.success("Cluster created");
      }
      setClusterDialogOpen(false);
      await loadCommunityDetail(selectedCommunityId);
      await loadCommunities();
    } catch (error) {
      toast.error("Failed to save cluster", { description: handleApiError(error) });
    }
  };

  const removeCluster = async (cluster: ClusterItem) => {
    if (!selectedCommunityId) return;
    if (cluster.unitCount > 0) {
      toast.error("Cannot delete cluster with assigned units");
      return;
    }
    try {
      await communityService.deleteCluster(cluster.id);
      toast.success("Cluster deactivated");
      await loadCommunityDetail(selectedCommunityId);
      await loadCommunities();
    } catch (error) {
      toast.error("Failed to delete cluster", { description: handleApiError(error) });
    }
  };

  const reorderCluster = async (clusterId: string, direction: "up" | "down") => {
    if (!selectedCommunityId || !selectedCommunityDetail) return;
    const items = [...selectedCommunityDetail.clusters];
    const index = items.findIndex((item) => item.id === clusterId);
    if (index < 0) return;
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= items.length) return;
    const temp = items[index];
    items[index] = items[swapIndex];
    items[swapIndex] = temp;

    try {
      await communityService.reorderClusters(
        selectedCommunityId,
        items.map((item) => item.id),
      );
      await loadCommunityDetail(selectedCommunityId);
      toast.success("Cluster order updated");
    } catch (error) {
      toast.error("Failed to reorder clusters", { description: handleApiError(error) });
    }
  };

  const openCreateGate = () => {
    setEditingGate(null);
    setGateForm(defaultGateForm);
    setGateDialogOpen(true);
  };

  const openEditGate = (gate: GateItem) => {
    setEditingGate(gate);
    setGateForm({
      name: gate.name,
      code: gate.code ?? "",
      etaMinutes: gate.etaMinutes ? String(gate.etaMinutes) : "",
      allowedRoles: gate.allowedRoles.length ? gate.allowedRoles : ["VISITOR"],
    });
    setGateDialogOpen(true);
  };

  const toggleGateRole = (role: GateRole) => {
    setGateForm((prev) => {
      const hasRole = prev.allowedRoles.includes(role);
      return {
        ...prev,
        allowedRoles: hasRole
          ? prev.allowedRoles.filter((item) => item !== role)
          : [...prev.allowedRoles, role],
      };
    });
  };

  const saveGate = async () => {
    if (!selectedCommunityId) return;
    if (!gateForm.name.trim()) {
      toast.error("Gate name is required");
      return;
    }
    if (gateForm.allowedRoles.length === 0) {
      toast.error("Select at least one gate role");
      return;
    }

    const payload = {
      name: gateForm.name.trim(),
      code: gateForm.code.trim() || undefined,
      etaMinutes:
        gateForm.etaMinutes.trim().length > 0
          ? Number(gateForm.etaMinutes)
          : undefined,
      allowedRoles: gateForm.allowedRoles,
    };

    try {
      if (editingGate) {
        await communityService.updateGate(editingGate.id, payload);
        await communityService.updateGateRoles(editingGate.id, gateForm.allowedRoles);
        toast.success("Gate updated");
      } else {
        await communityService.createGate(selectedCommunityId, payload);
        toast.success("Gate created");
      }
      setGateDialogOpen(false);
      await loadCommunityDetail(selectedCommunityId);
      await loadCommunities();
    } catch (error) {
      toast.error("Failed to save gate", { description: handleApiError(error) });
    }
  };

  const removeGate = async (gate: GateItem) => {
    if (!selectedCommunityId) return;
    try {
      await communityService.deleteGate(gate.id);
      toast.success("Gate deactivated");
      await loadCommunityDetail(selectedCommunityId);
      await loadCommunities();
    } catch (error) {
      toast.error("Failed to delete gate", { description: handleApiError(error) });
    }
  };

  const selectedCommunity = communities.find((item) => item.id === selectedCommunityId) ?? null;

  return (
    <div className="space-y-6">
      <Card className="rounded-md border border-[#D6DEE8] p-5 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.9)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-[22px] font-semibold text-[#0F172A]">Communities</h1>
            <p className="mt-1 text-sm text-[#64748B]">
              Manage projects, entry roles, clusters, and gates from one workspace.
            </p>
          </div>
          <div className="flex w-full gap-2 lg:w-auto">
            <Input
              placeholder="Search community by name or code"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 lg:w-[320px]"
            />
            <Button className="h-10 gap-2 bg-[#0B5FFF] text-white hover:bg-[#0A56E8]" onClick={openCreateCommunity}>
              <Plus className="h-4 w-4" />
              Add Community
            </Button>
          </div>
        </div>
      </Card>

      <Card className="rounded-md border border-[#D6DEE8] p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F8FAFC]">
                <TableHead>Community</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Clusters</TableHead>
                <TableHead>Gates</TableHead>
                <TableHead>Entry Roles</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[150px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingList ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-[#64748B]">
                    Loading communities...
                  </TableCell>
                </TableRow>
              ) : null}
              {!isLoadingList && filteredCommunities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-[#64748B]">
                    No communities found.
                  </TableCell>
                </TableRow>
              ) : null}
              {filteredCommunities.map((community) => (
                <TableRow
                  key={community.id}
                  className={cn(
                    "cursor-pointer",
                    selectedCommunityId === community.id ? "bg-[#F1F5FF]" : "",
                  )}
                  onClick={() => setSelectedCommunityId(community.id)}
                >
                  <TableCell className="font-medium text-[#0F172A]">{community.name}</TableCell>
                  <TableCell>{community.code ?? "-"}</TableCell>
                  <TableCell>{community._count?.clusters ?? 0}</TableCell>
                  <TableCell>{community._count?.gates ?? 0}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(community.allowedEntryRoles ?? []).map((role) => (
                        <Badge key={role} variant="outline" className="rounded-sm border-[#CBD5E1] text-[#334155]">
                          {entryRoleLabel(role)}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={community.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}>
                      {community.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditCommunity(community);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600"
                        onClick={(event) => {
                          event.stopPropagation();
                          void removeCommunity(community);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="rounded-md border border-[#D6DEE8] p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-[#0F172A]">
            {selectedCommunity ? `${selectedCommunity.name} Workspace` : "Community Workspace"}
          </h2>
          <p className="text-sm text-[#64748B]">
            {selectedCommunity
              ? "Manage clusters and gates for the selected community."
              : "Select a community to manage clusters and gates."}
          </p>
        </div>

        {selectedCommunityId && selectedCommunityDetail ? (
          <Tabs defaultValue="clusters">
            <TabsList className="mb-4">
              <TabsTrigger value="clusters">Clusters</TabsTrigger>
              <TabsTrigger value="gates">Gates</TabsTrigger>
            </TabsList>

            <TabsContent value="clusters" className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#64748B]">
                  {selectedCommunityDetail.clusters.length} active clusters
                </p>
                <Button className="gap-2 bg-[#0B5FFF] text-white hover:bg-[#0A56E8]" onClick={openCreateCluster}>
                  <Plus className="h-4 w-4" />
                  Add Cluster
                </Button>
              </div>

              <div className="space-y-2">
                {selectedCommunityDetail.clusters.map((cluster, index) => (
                  <div key={cluster.id} className="flex items-center justify-between rounded-md border border-[#E2E8F0] p-3">
                    <div>
                      <p className="font-medium text-[#0F172A]">{cluster.name}</p>
                      <p className="text-xs text-[#64748B]">
                        Code: {cluster.code ?? "-"} | Units: {cluster.unitCount} | Order: {cluster.displayOrder}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={index === 0}
                        onClick={() => void reorderCluster(cluster.id, "up")}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={index === selectedCommunityDetail.clusters.length - 1}
                        onClick={() => void reorderCluster(cluster.id, "down")}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEditCluster(cluster)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600"
                        disabled={cluster.unitCount > 0}
                        title={cluster.unitCount > 0 ? "Cannot delete while units are assigned" : "Delete cluster"}
                        onClick={() => void removeCluster(cluster)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {selectedCommunityDetail.clusters.length === 0 ? (
                  <p className="text-sm text-[#64748B]">No clusters yet.</p>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="gates" className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#64748B]">
                  {selectedCommunityDetail.gates.length} active gates
                </p>
                <Button className="gap-2 bg-[#0B5FFF] text-white hover:bg-[#0A56E8]" onClick={openCreateGate}>
                  <Plus className="h-4 w-4" />
                  Add Gate
                </Button>
              </div>

              <div className="space-y-2">
                {selectedCommunityDetail.gates.map((gate) => (
                  <div key={gate.id} className="flex items-center justify-between rounded-md border border-[#E2E8F0] p-3">
                    <div>
                      <p className="font-medium text-[#0F172A]">{gate.name}</p>
                      <p className="text-xs text-[#64748B]">
                        ETA: {gate.etaMinutes ?? "-"} min
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {gate.allowedRoles.map((role) => (
                          <Badge key={role} className={cn("rounded-sm border", roleBadgeClass[role])}>
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEditGate(gate)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600"
                        onClick={() => void removeGate(gate)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {selectedCommunityDetail.gates.length === 0 ? (
                  <p className="text-sm text-[#64748B]">No gates yet.</p>
                ) : null}
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <p className="text-sm text-[#64748B]">
            {isLoadingDetail ? "Loading workspace..." : "Select a community to continue."}
          </p>
        )}
      </Card>

      <Dialog open={communityDialogOpen} onOpenChange={setCommunityDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingCommunity ? "Edit Community" : "Add Community"}</DialogTitle>
            <DialogDescription>
              Configure base information and allowed entry roles.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={communityForm.name}
                  onChange={(event) => setCommunityForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Al Karma Gates"
                />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={communityForm.code}
                  onChange={(event) => setCommunityForm((prev) => ({ ...prev, code: event.target.value }))}
                  placeholder="AKG"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={communityForm.displayOrder}
                  onChange={(event) => setCommunityForm((prev) => ({ ...prev, displayOrder: event.target.value }))}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border border-[#E2E8F0] p-3">
                <div>
                  <p className="text-sm font-medium text-[#0F172A]">Active</p>
                  <p className="text-xs text-[#64748B]">Inactive communities are hidden from new assignments.</p>
                </div>
                <input
                  type="checkbox"
                  checked={communityForm.isActive}
                  onChange={(event) => setCommunityForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Allowed Entry Roles</Label>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {ENTRY_ROLE_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 rounded-md border border-[#E2E8F0] p-2 text-sm">
                    <input
                      type="checkbox"
                      checked={communityForm.allowedEntryRoles.includes(option.value)}
                      onChange={() => toggleEntryRole(option.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommunityDialogOpen(false)}>Cancel</Button>
            <Button className="bg-[#0B5FFF] text-white hover:bg-[#0A56E8]" onClick={() => void saveCommunity()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={clusterDialogOpen} onOpenChange={setClusterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCluster ? "Edit Cluster" : "Add Cluster"}</DialogTitle>
            <DialogDescription>Clusters are used to organize units within the community.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={clusterForm.name}
                onChange={(event) => setClusterForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Code</Label>
              <Input
                value={clusterForm.code}
                onChange={(event) => setClusterForm((prev) => ({ ...prev, code: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Display Order</Label>
              <Input
                type="number"
                value={clusterForm.displayOrder}
                onChange={(event) => setClusterForm((prev) => ({ ...prev, displayOrder: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClusterDialogOpen(false)}>Cancel</Button>
            <Button className="bg-[#0B5FFF] text-white hover:bg-[#0A56E8]" onClick={() => void saveCluster()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={gateDialogOpen} onOpenChange={setGateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingGate ? "Edit Gate" : "Add Gate"}</DialogTitle>
            <DialogDescription>Define gate roles and expected queue ETA.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={gateForm.name}
                  onChange={(event) => setGateForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={gateForm.code}
                  onChange={(event) => setGateForm((prev) => ({ ...prev, code: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>ETA Minutes</Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={gateForm.etaMinutes}
                onChange={(event) => setGateForm((prev) => ({ ...prev, etaMinutes: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Allowed Roles</Label>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {GATE_ROLE_OPTIONS.map((role) => (
                  <label key={role} className="flex items-center gap-2 rounded-md border border-[#E2E8F0] p-2 text-sm">
                    <input
                      type="checkbox"
                      checked={gateForm.allowedRoles.includes(role)}
                      onChange={() => toggleGateRole(role)}
                    />
                    {role}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGateDialogOpen(false)}>Cancel</Button>
            <Button className="bg-[#0B5FFF] text-white hover:bg-[#0A56E8]" onClick={() => void saveGate()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
