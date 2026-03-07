import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import { DataTable, type DataTableColumn } from "../DataTable";
import apiClient from "../../lib/api-client";
import { errorMessage, formatDateTime, humanizeEnum } from "../../lib/live-data";

type GateFeedRow = {
  id: string;
  qrId: string;
  type: string;
  status: string;
  visitorName?: string | null;
  requesterNameSnapshot?: string | null;
  requesterPhoneSnapshot?: string | null;
  createdAt?: string | null;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  overdueExitAt?: string | null;
  forUnit?: { unitNumber?: string | null; block?: string | null; projectName?: string | null } | null;
};

function statusClass(row: GateFeedRow) {
  if (row.checkedOutAt) return "bg-[#DCFCE7] text-[#166534]";
  if (row.overdueExitAt && !row.checkedOutAt) return "bg-[#FEE2E2] text-[#B91C1C]";
  if (row.checkedInAt) return "bg-[#FEF3C7] text-[#92400E]";
  return "bg-[#E2E8F0] text-[#334155]";
}

export function GateLiveFeed() {
  const [rows, setRows] = useState<GateFeedRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<GateFeedRow[]>("/access-qrcodes/gate-feed/live", {
        params: { unitNumber: search || undefined },
      });
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      toast.error("Failed to load gate feed", { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [
        row.qrId,
        row.visitorName,
        row.forUnit?.unitNumber,
        row.forUnit?.projectName,
        row.forUnit?.block,
        row.requesterNameSnapshot,
        row.requesterPhoneSnapshot,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, search]);

  const checkIn = async (id: string) => {
    setBusyId(id);
    try {
      await apiClient.patch(`/access-qrcodes/${id}/check-in`, {});
      toast.success("Marked as arrived");
      await load();
    } catch (error) {
      toast.error("Failed to check in", { description: errorMessage(error) });
    } finally {
      setBusyId(null);
    }
  };

  const checkOut = async (id: string) => {
    setBusyId(id);
    try {
      await apiClient.patch(`/access-qrcodes/${id}/check-out`, {});
      toast.success("Marked as exited");
      await load();
    } catch (error) {
      toast.error("Failed to check out", { description: errorMessage(error) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#1E293B]">Gate Live Feed</h1>
          <p className="text-[#64748B] mt-1">Track QR arrivals/departures and security gate operations.</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <Card className="p-4 border border-[#E2E8F0]">
        <div className="flex gap-3">
          <Input
            placeholder="Search by unit number / visitor / QR"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button variant="outline" onClick={() => void load()}>
            Search
          </Button>
        </div>
      </Card>

      {(() => {
        const cols: DataTableColumn<GateFeedRow>[] = [
          { key: "qr", header: "QR", render: (r) => <span className="text-[#334155]">{r.qrId}</span> },
          { key: "unit", header: "Unit", render: (r) => <span className="text-[#334155]">{[r.forUnit?.projectName, r.forUnit?.block, r.forUnit?.unitNumber].filter(Boolean).join(" • ") || "—"}</span> },
          { key: "visitor", header: "Visitor", render: (r) => <span className="text-[#334155]">{r.visitorName || "—"}</span> },
          { key: "requester", header: "Requester", render: (r) => <div className="text-[#334155]">{r.requesterNameSnapshot || "—"}{r.requesterPhoneSnapshot ? <div className="text-xs text-[#64748B]">{r.requesterPhoneSnapshot}</div> : null}</div> },
          { key: "type", header: "Type", render: (r) => <Badge variant="secondary" className="bg-[#EEF2FF] text-[#3730A3]">{humanizeEnum(r.type)}</Badge> },
          { key: "status", header: "Status", render: (r) => <Badge className={statusClass(r)}>{r.checkedOutAt ? "Checked Out" : r.checkedInAt ? "Checked In" : humanizeEnum(r.status)}</Badge> },
          { key: "checkin", header: "Check-In", render: (r) => <span className="text-[#64748B]">{formatDateTime(r.checkedInAt || r.createdAt)}</span> },
          { key: "checkout", header: "Check-Out", render: (r) => <span className="text-[#64748B]">{formatDateTime(r.checkedOutAt)}</span> },
          { key: "actions", header: "Actions", render: (r) => (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => void checkIn(r.id)} disabled={!!r.checkedInAt || busyId === r.id}>Arrived</Button>
              <Button size="sm" variant="outline" onClick={() => void checkOut(r.id)} disabled={!r.checkedInAt || !!r.checkedOutAt || busyId === r.id}>Exit</Button>
            </div>
          )},
        ];
        return <DataTable columns={cols} rows={filtered} rowKey={(r) => r.id} loading={loading} emptyTitle="No gate feed records found" />;
      })()}
    </div>
  );
}
