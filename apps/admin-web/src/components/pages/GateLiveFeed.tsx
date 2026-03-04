import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
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
import apiClient from "../../lib/api-client";
import { errorMessage, formatDateTime, humanizeEnum } from "../../lib/live-data";

type GateFeedRow = {
  id: string;
  qrId: string;
  type: string;
  status: string;
  visitorName?: string | null;
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

      <Card className="shadow-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F9FAFB]">
              <TableHead>QR</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Visitor</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Check-In</TableHead>
              <TableHead>Check-Out</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-[#334155]">{row.qrId}</TableCell>
                <TableCell className="text-[#334155]">
                  {[row.forUnit?.projectName, row.forUnit?.block, row.forUnit?.unitNumber].filter(Boolean).join(" • ") || "—"}
                </TableCell>
                <TableCell className="text-[#334155]">{row.visitorName || "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="bg-[#EEF2FF] text-[#3730A3]">
                    {humanizeEnum(row.type)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={statusClass(row)}>
                    {row.checkedOutAt ? "Checked Out" : row.checkedInAt ? "Checked In" : humanizeEnum(row.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-[#64748B]">{formatDateTime(row.checkedInAt || row.createdAt)}</TableCell>
                <TableCell className="text-[#64748B]">{formatDateTime(row.checkedOutAt)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void checkIn(row.id)}
                      disabled={!!row.checkedInAt || busyId === row.id}
                    >
                      Arrived
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void checkOut(row.id)}
                      disabled={!row.checkedInAt || !!row.checkedOutAt || busyId === row.id}
                    >
                      Exit
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!loading && filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-[#64748B]">
                  No gate feed records found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
