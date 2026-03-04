import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import apiClient, { handleApiError } from "../../lib/api-client";

type CommunityRow = {
  id: string;
  name: string;
  code?: string | null;
  isActive: boolean;
  displayOrder: number;
};

export function CommunitiesManagement() {
  const [rows, setRows] = useState<CommunityRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CommunityRow | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);

  const resetForm = useCallback(() => {
    setEditing(null);
    setName("");
    setCode("");
    setDisplayOrder("0");
    setIsActive(true);
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get("/communities");
      const list = Array.isArray(response.data) ? response.data : [];
      setRows(list);
    } catch (error) {
      toast.error("Failed to load communities", { description: handleApiError(error) });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = useMemo(() => rows.filter((row) => row.isActive).length, [rows]);

  const openCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEdit = (row: CommunityRow) => {
    setEditing(row);
    setName(row.name || "");
    setCode(row.code || "");
    setDisplayOrder(String(row.displayOrder ?? 0));
    setIsActive(row.isActive !== false);
    setIsDialogOpen(true);
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error("Community name is required");
      return;
    }
    const payload = {
      name: name.trim(),
      code: code.trim() || undefined,
      displayOrder: Number.isFinite(Number(displayOrder)) ? Number(displayOrder) : 0,
      isActive,
    };

    try {
      if (editing) {
        await apiClient.patch(`/communities/${editing.id}`, payload);
        toast.success("Community updated");
      } else {
        await apiClient.post("/communities", payload);
        toast.success("Community created");
      }
      setIsDialogOpen(false);
      resetForm();
      await load();
    } catch (error) {
      toast.error("Failed to save community", { description: handleApiError(error) });
    }
  };

  const remove = async (row: CommunityRow) => {
    try {
      await apiClient.delete(`/communities/${row.id}`);
      toast.success("Community deleted");
      await load();
    } catch (error) {
      toast.error("Cannot delete community", { description: handleApiError(error) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#1E293B]">Communities</h1>
          <p className="text-[#64748B] mt-1">Manage project/community names used by units.</p>
          <div className="mt-2">
            <Badge className="bg-[#EEF2FF] text-[#3730A3] hover:bg-[#E0E7FF]">Active: {activeCount}</Badge>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white rounded-lg gap-2" onClick={openCreate}>
              <Plus className="w-4 h-4" />
              Add Community
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Community" : "Add Community"}</DialogTitle>
              <DialogDescription>These values appear as selectable options in Units.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Al Karma Gates" />
              </div>
              <div className="space-y-2">
                <Label>Code (optional)</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="AKG" />
              </div>
              <div className="space-y-2">
                <Label>Display Order</Label>
                <Input type="number" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#E2E8F0] p-3">
                <div>
                  <p className="text-sm text-[#1E293B] font-medium">Active</p>
                  <p className="text-xs text-[#64748B]">Inactive communities are hidden from new unit assignment.</p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white" onClick={() => void save()}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4 border border-[#E2E8F0] rounded-xl">
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between rounded-xl border border-[#E2E8F0] p-3">
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">{row.name}</p>
                <p className="text-xs text-[#64748B]">
                  Code: {row.code || "-"} • Order: {row.displayOrder}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={row.isActive ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#F1F5F9] text-[#475569]"}>
                  {row.isActive ? "Active" : "Inactive"}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => void remove(row)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          {!isLoading && rows.length === 0 ? (
            <p className="text-sm text-[#64748B]">No communities yet.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
