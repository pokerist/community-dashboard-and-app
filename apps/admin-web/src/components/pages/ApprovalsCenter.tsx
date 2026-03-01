import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
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

type ReviewStatus = "ALL" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

type ProfileChangeRequestRow = {
  id: string;
  userId: string;
  status: string;
  requestedFields?: Record<string, unknown> | null;
  previousSnapshot?: Record<string, unknown> | null;
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
  user?: {
    id?: string;
    nameEN?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

type HouseholdFamilyRow = {
  id: string;
  status: string;
  fullName: string;
  relationship?: string | null;
  email?: string | null;
  phone?: string | null;
  nationality?: string | null;
  unit?: { unitNumber?: string | null; projectName?: string | null } | null;
  owner?: { nameEN?: string | null; email?: string | null } | null;
  rejectionReason?: string | null;
  createdAt?: string;
};

type HouseholdAuthorizedRow = {
  id: string;
  status: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  feeMode?: string | null;
  feeAmount?: string | number | null;
  unit?: { unitNumber?: string | null; projectName?: string | null } | null;
  owner?: { nameEN?: string | null; email?: string | null } | null;
  rejectionReason?: string | null;
  createdAt?: string;
};

type HouseholdStaffRow = {
  id: string;
  status: string;
  fullName: string;
  phone?: string | null;
  staffType?: string | null;
  isLiveIn?: boolean;
  unit?: { unitNumber?: string | null; projectName?: string | null } | null;
  owner?: { nameEN?: string | null; email?: string | null } | null;
  rejectionReason?: string | null;
  createdAt?: string;
};

type HouseholdRequestsResponse = {
  family: HouseholdFamilyRow[];
  authorized: HouseholdAuthorizedRow[];
  homeStaff: HouseholdStaffRow[];
};

function statusBadgeClass(status?: string | null) {
  const normalized = String(status ?? "").toUpperCase();
  if (normalized === "APPROVED" || normalized === "ACTIVE") return "bg-[#DCFCE7] text-[#166534]";
  if (normalized === "REJECTED" || normalized === "CANCELLED") return "bg-[#FEE2E2] text-[#B91C1C]";
  if (normalized === "PENDING") return "bg-[#FEF9C3] text-[#A16207]";
  return "bg-[#E2E8F0] text-[#334155]";
}

function unitLabel(unit?: { unitNumber?: string | null; projectName?: string | null } | null) {
  if (!unit) return "—";
  return [unit.projectName, unit.unitNumber].filter(Boolean).join(" • ") || "—";
}

function jsonDiffLabel(previous?: Record<string, unknown> | null, next?: Record<string, unknown> | null) {
  const prev = previous ?? {};
  const nxt = next ?? {};
  const keys = Array.from(new Set([...Object.keys(prev), ...Object.keys(nxt)]));
  if (keys.length === 0) return "No field changes";
  return keys
    .map((key) => {
      const oldValue = prev[key] == null ? "—" : String(prev[key]);
      const newValue = nxt[key] == null ? "—" : String(nxt[key]);
      if (oldValue === newValue) return null;
      return `${key}: ${oldValue} → ${newValue}`;
    })
    .filter(Boolean)
    .join(" | ");
}

export function ApprovalsCenter() {
  const [statusFilter, setStatusFilter] = useState<ReviewStatus>("PENDING");
  const [isLoading, setIsLoading] = useState(false);
  const [profileRows, setProfileRows] = useState<ProfileChangeRequestRow[]>([]);
  const [householdRows, setHouseholdRows] = useState<HouseholdRequestsResponse>({
    family: [],
    authorized: [],
    homeStaff: [],
  });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [profileRes, householdRes] = await Promise.all([
        apiClient.get<ProfileChangeRequestRow[]>("/auth/admin/profile-change-requests", {
          params: { status: statusFilter },
        }),
        apiClient.get<HouseholdRequestsResponse>("/household/admin/requests", {
          params: { status: statusFilter },
        }),
      ]);

      setProfileRows(Array.isArray(profileRes.data) ? profileRes.data : []);
      setHouseholdRows({
        family: Array.isArray(householdRes.data?.family) ? householdRes.data.family : [],
        authorized: Array.isArray(householdRes.data?.authorized) ? householdRes.data.authorized : [],
        homeStaff: Array.isArray(householdRes.data?.homeStaff) ? householdRes.data.homeStaff : [],
      });
    } catch (error) {
      toast.error("Failed to load approvals", { description: errorMessage(error) });
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const pendingCounts = useMemo(() => {
    const profile = profileRows.filter((row) => String(row.status).toUpperCase() === "PENDING").length;
    const family = householdRows.family.filter((row) => String(row.status).toUpperCase() === "PENDING").length;
    const authorized = householdRows.authorized.filter((row) => String(row.status).toUpperCase() === "PENDING").length;
    const homeStaff = householdRows.homeStaff.filter((row) => String(row.status).toUpperCase() === "PENDING").length;
    return { profile, family, authorized, homeStaff };
  }, [householdRows, profileRows]);

  const reviewProfile = async (id: string, action: "approve" | "reject") => {
    setBusyKey(`profile-${id}-${action}`);
    try {
      if (action === "approve") {
        await apiClient.patch(`/auth/admin/profile-change-requests/${id}/approve`, {});
      } else {
        await apiClient.patch(`/auth/admin/profile-change-requests/${id}/reject`, {
          rejectionReason: rejectionReason.trim() || undefined,
        });
      }
      toast.success(`Profile request ${action}d`);
      setRejectionReason("");
      await loadData();
    } catch (error) {
      toast.error(`Failed to ${action} profile request`, { description: errorMessage(error) });
    } finally {
      setBusyKey(null);
    }
  };

  const reviewHousehold = async (
    type: "family" | "authorized" | "home-staff",
    id: string,
    status: "APPROVED" | "REJECTED",
  ) => {
    setBusyKey(`household-${type}-${id}-${status}`);
    try {
      const endpoint =
        type === "family"
          ? `/household/admin/family-requests/${id}/review`
          : type === "authorized"
            ? `/household/admin/authorized-requests/${id}/review`
            : `/household/admin/home-staff/${id}/review`;

      await apiClient.patch(endpoint, {
        status,
        rejectionReason: status === "REJECTED" ? rejectionReason.trim() || undefined : undefined,
      });
      toast.success(`Request ${status === "APPROVED" ? "approved" : "rejected"}`);
      setRejectionReason("");
      await loadData();
    } catch (error) {
      toast.error("Failed to review request", { description: errorMessage(error) });
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-[#1E293B]">Approvals Center</h1>
          <p className="text-sm text-[#64748B] mt-1">
            Review profile updates and household access requests from one queue.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED"] as ReviewStatus[]).map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(status)}
            >
              {humanizeEnum(status)}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      <Card className="p-4 border border-[#E2E8F0]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-[#E2E8F0] p-3 bg-white">
            <p className="text-xs text-[#64748B]">Profile Pending</p>
            <p className="text-xl text-[#0F172A] mt-1">{pendingCounts.profile}</p>
          </div>
          <div className="rounded-lg border border-[#E2E8F0] p-3 bg-white">
            <p className="text-xs text-[#64748B]">Family Pending</p>
            <p className="text-xl text-[#0F172A] mt-1">{pendingCounts.family}</p>
          </div>
          <div className="rounded-lg border border-[#E2E8F0] p-3 bg-white">
            <p className="text-xs text-[#64748B]">Authorized Pending</p>
            <p className="text-xl text-[#0F172A] mt-1">{pendingCounts.authorized}</p>
          </div>
          <div className="rounded-lg border border-[#E2E8F0] p-3 bg-white">
            <p className="text-xs text-[#64748B]">Home Staff Pending</p>
            <p className="text-xl text-[#0F172A] mt-1">{pendingCounts.homeStaff}</p>
          </div>
        </div>
      </Card>

      <Card className="shadow-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <h3 className="text-[#1E293B]">Profile Change Requests</h3>
          <Input
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Optional rejection reason"
            className="max-w-sm"
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F9FAFB]">
              <TableHead>User</TableHead>
              <TableHead>Requested Changes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profileRows.map((row) => {
              const isPending = String(row.status).toUpperCase() === "PENDING";
              return (
                <TableRow key={row.id} className="hover:bg-[#F9FAFB]">
                  <TableCell>
                    <p className="font-medium text-[#1E293B]">{row.user?.nameEN || row.user?.email || row.userId}</p>
                    <p className="text-xs text-[#64748B]">{row.user?.phone || "—"}</p>
                  </TableCell>
                  <TableCell className="text-[#334155] text-xs">
                    {jsonDiffLabel(row.previousSnapshot, row.requestedFields)}
                    {row.rejectionReason ? (
                      <p className="text-[#B91C1C] mt-1">Reason: {row.rejectionReason}</p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusBadgeClass(row.status)}>{humanizeEnum(row.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-[#64748B]">{formatDateTime(row.createdAt)}</TableCell>
                  <TableCell>
                    {isPending ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => void reviewProfile(row.id, "approve")}
                          disabled={busyKey === `profile-${row.id}-approve`}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void reviewProfile(row.id, "reject")}
                          disabled={busyKey === `profile-${row.id}-reject`}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-[#64748B]">Reviewed</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {!isLoading && profileRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-[#64748B]">
                  No profile change requests found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>

      <Card className="shadow-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#E5E7EB]">
          <h3 className="text-[#1E293B]">Household Requests</h3>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <h4 className="text-sm text-[#0F172A] mb-2">Family</h4>
            <div className="space-y-2">
              {householdRows.family.map((row) => {
                const isPending = String(row.status).toUpperCase() === "PENDING";
                return (
                  <div key={row.id} className="rounded-lg border border-[#E2E8F0] p-3 bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-[#0F172A]">{row.fullName}</p>
                        <p className="text-xs text-[#64748B]">
                          {humanizeEnum(row.relationship || "FAMILY")} • {unitLabel(row.unit)} • Owner: {row.owner?.nameEN || row.owner?.email || "—"}
                        </p>
                        <p className="text-xs text-[#64748B]">{row.email || "—"} • {row.phone || "—"}</p>
                      </div>
                      <Badge className={statusBadgeClass(row.status)}>{humanizeEnum(row.status)}</Badge>
                    </div>
                    {row.rejectionReason ? <p className="text-xs text-[#B91C1C] mt-2">Reason: {row.rejectionReason}</p> : null}
                    {isPending ? (
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" onClick={() => void reviewHousehold("family", row.id, "APPROVED")}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => void reviewHousehold("family", row.id, "REJECTED")}>Reject</Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {householdRows.family.length === 0 ? <p className="text-xs text-[#64748B]">No family requests.</p> : null}
            </div>
          </div>

          <div>
            <h4 className="text-sm text-[#0F172A] mb-2">Authorized</h4>
            <div className="space-y-2">
              {householdRows.authorized.map((row) => {
                const isPending = String(row.status).toUpperCase() === "PENDING";
                return (
                  <div key={row.id} className="rounded-lg border border-[#E2E8F0] p-3 bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-[#0F172A]">{row.fullName}</p>
                        <p className="text-xs text-[#64748B]">
                          {unitLabel(row.unit)} • Owner: {row.owner?.nameEN || row.owner?.email || "—"}
                        </p>
                        <p className="text-xs text-[#64748B]">
                          {formatDateTime(row.validFrom)} → {formatDateTime(row.validTo)} • Fee: {humanizeEnum(row.feeMode || "NO_FEE")}
                          {row.feeAmount ? ` (${row.feeAmount})` : ""}
                        </p>
                      </div>
                      <Badge className={statusBadgeClass(row.status)}>{humanizeEnum(row.status)}</Badge>
                    </div>
                    {row.rejectionReason ? <p className="text-xs text-[#B91C1C] mt-2">Reason: {row.rejectionReason}</p> : null}
                    {isPending ? (
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" onClick={() => void reviewHousehold("authorized", row.id, "APPROVED")}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => void reviewHousehold("authorized", row.id, "REJECTED")}>Reject</Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {householdRows.authorized.length === 0 ? <p className="text-xs text-[#64748B]">No authorized requests.</p> : null}
            </div>
          </div>

          <div>
            <h4 className="text-sm text-[#0F172A] mb-2">Home Staff</h4>
            <div className="space-y-2">
              {householdRows.homeStaff.map((row) => {
                const isPending = String(row.status).toUpperCase() === "PENDING";
                return (
                  <div key={row.id} className="rounded-lg border border-[#E2E8F0] p-3 bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-[#0F172A]">{row.fullName}</p>
                        <p className="text-xs text-[#64748B]">
                          {humanizeEnum(row.staffType || "OTHER")} • {row.isLiveIn ? "Live-in" : "Non live-in"} • {unitLabel(row.unit)}
                        </p>
                        <p className="text-xs text-[#64748B]">{row.phone || "—"}</p>
                      </div>
                      <Badge className={statusBadgeClass(row.status)}>{humanizeEnum(row.status)}</Badge>
                    </div>
                    {row.rejectionReason ? <p className="text-xs text-[#B91C1C] mt-2">Reason: {row.rejectionReason}</p> : null}
                    {isPending ? (
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" onClick={() => void reviewHousehold("home-staff", row.id, "APPROVED")}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => void reviewHousehold("home-staff", row.id, "REJECTED")}>Reject</Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {householdRows.homeStaff.length === 0 ? <p className="text-xs text-[#64748B]">No home staff requests.</p> : null}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

