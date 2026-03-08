import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, RefreshCw, Search, Settings, X } from "lucide-react";
import { DataTable, type DataTableColumn } from "../DataTable";
import { toast } from "sonner";
import { API_BASE_URL } from "../../lib/api-client";
import { errorMessage } from "../../lib/live-data";
import rentalService, {
  type LeaseDetail,
  type LeaseListItem,
  type LeaseStatus,
  type RentRequestListItem,
  type RentRequestStatus,
  type RentalSettings,
  type RentalStats,
} from "../../lib/rental-service";

type TabKey = "leases" | "requests";

const EMPTY_SETTINGS: RentalSettings = {
  leasingEnabled: true,
  suspensionReason: null,
  suspendedAt: null,
};

const EMPTY_STATS: RentalStats = {
  activeLeases: 0,
  expiringThisMonth: 0,
  expiredLeases: 0,
  pendingRentRequests: 0,
  totalMonthlyRevenue: 0,
  leasingEnabled: true,
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString();
}

function statusTone(value: string): string {
  const key = value.toUpperCase();
  if (key === "ACTIVE" || key === "APPROVED") return "bg-emerald-500/15 text-emerald-300";
  if (key === "PENDING" || key === "EXPIRING_SOON") return "bg-amber-500/15 text-amber-300";
  if (key === "REJECTED" || key === "TERMINATED" || key === "CANCELLED") return "bg-rose-500/15 text-rose-300";
  return "bg-gray-100 text-gray-700";
}

function daysTone(value: number | null): string {
  if (value === null) return "text-gray-400";
  if (value > 60) return "text-gray-500";
  if (value >= 30) return "text-amber-400";
  return "text-red-400 font-medium";
}

async function openSecureFile(fileId: string): Promise<void> {
  const token = localStorage.getItem("auth_token");
  if (!token) throw new Error("Missing token");
  const response = await fetch(`${API_BASE_URL}/files/${fileId}/stream`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`File fetch failed (${response.status})`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function RentalManagement() {
  const [tab, setTab] = useState<TabKey>("leases");
  const [settings, setSettings] = useState<RentalSettings>(EMPTY_SETTINGS);
  const [stats, setStats] = useState<RentalStats>(EMPTY_STATS);
  const [communities, setCommunities] = useState<Array<{ id: string; name: string }>>([]);
  const [leases, setLeases] = useState<LeaseListItem[]>([]);
  const [requests, setRequests] = useState<RentRequestListItem[]>([]);
  const [requestTotal, setRequestTotal] = useState(0);
  const [loadingLeases, setLoadingLeases] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsEnabledDraft, setSettingsEnabledDraft] = useState(true);
  const [settingsReasonDraft, setSettingsReasonDraft] = useState("");
  const [leaseFilterSearch, setLeaseFilterSearch] = useState("");
  const [leaseFilterStatus, setLeaseFilterStatus] = useState<"all" | LeaseStatus>("all");
  const [leaseFilterCommunity, setLeaseFilterCommunity] = useState("");
  const [leaseFilterExpiring, setLeaseFilterExpiring] = useState(false);
  const [requestFilterSearch, setRequestFilterSearch] = useState("");
  const [requestFilterStatus, setRequestFilterStatus] = useState<"all" | RentRequestStatus>("all");
  const [requestPage, setRequestPage] = useState(1);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [leaseDetail, setLeaseDetail] = useState<LeaseDetail | null>(null);
  const [renewStart, setRenewStart] = useState("");
  const [renewEnd, setRenewEnd] = useState("");
  const [renewRent, setRenewRent] = useState("");
  const [renewAuto, setRenewAuto] = useState(false);
  const [terminateReason, setTerminateReason] = useState("");
  const [mode, setMode] = useState<"view" | "renew" | "terminate">("view");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RentRequestListItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const requestPages = useMemo(() => Math.max(1, Math.ceil(requestTotal / 20)), [requestTotal]);

  const loadHeader = useCallback(async () => {
    const [nextSettings, nextStats, communityRows] = await Promise.all([
      rentalService.getSettings(),
      rentalService.getStats(),
      rentalService.listCommunities(),
    ]);
    setSettings(nextSettings);
    setStats(nextStats);
    setCommunities(communityRows);
    if (!leaseFilterCommunity && communityRows[0]) setLeaseFilterCommunity(communityRows[0].id);
    setSettingsEnabledDraft(nextSettings.leasingEnabled);
    setSettingsReasonDraft(nextSettings.suspensionReason ?? "");
  }, [leaseFilterCommunity]);

  const loadLeases = useCallback(async () => {
    setLoadingLeases(true);
    try {
      const rows = await rentalService.listLeases({
        search: leaseFilterSearch || undefined,
        status: leaseFilterStatus === "all" ? undefined : leaseFilterStatus,
        communityId: leaseFilterCommunity || undefined,
        expiringWithinDays: leaseFilterExpiring ? 30 : undefined,
      });
      setLeases(rows);
    } catch (error) {
      toast.error("Failed to load leases", { description: errorMessage(error) });
    } finally {
      setLoadingLeases(false);
    }
  }, [leaseFilterSearch, leaseFilterStatus, leaseFilterCommunity, leaseFilterExpiring]);

  const loadRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const response = await rentalService.listRequests({
        search: requestFilterSearch || undefined,
        status: requestFilterStatus === "all" ? undefined : requestFilterStatus,
        page: requestPage,
        limit: 20,
      });
      setRequests(response.data);
      setRequestTotal(response.total);
    } catch (error) {
      toast.error("Failed to load requests", { description: errorMessage(error) });
    } finally {
      setLoadingRequests(false);
    }
  }, [requestFilterSearch, requestFilterStatus, requestPage]);

  useEffect(() => {
    void loadHeader();
  }, [loadHeader]);

  useEffect(() => {
    void loadLeases();
  }, [loadLeases]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const refreshAll = async () => {
    await Promise.all([loadHeader(), loadLeases(), loadRequests()]);
  };

  const openLease = async (id: string, nextMode: "view" | "renew" | "terminate") => {
    setDetailOpen(true);
    setDetailLoading(true);
    setMode(nextMode);
    setTerminateReason("");
    try {
      const detail = await rentalService.getLeaseDetail(id);
      setLeaseDetail(detail);
      setRenewStart(detail.startDate.slice(0, 10));
      setRenewEnd(detail.endDate.slice(0, 10));
      setRenewRent(String(detail.monthlyRent));
      setRenewAuto(detail.autoRenew);
    } catch (error) {
      toast.error("Failed to load lease", { description: errorMessage(error) });
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settingsEnabledDraft && !settingsReasonDraft.trim()) {
      toast.error("Reason is required when disabling leasing");
      return;
    }
    try {
      await rentalService.toggleLeasing({
        enabled: settingsEnabledDraft,
        reason: settingsEnabledDraft ? undefined : settingsReasonDraft.trim(),
      });
      setSettingsOpen(false);
      await loadHeader();
      toast.success("Settings updated");
    } catch (error) {
      toast.error("Failed to save settings", { description: errorMessage(error) });
    }
  };

  const doRenew = async () => {
    if (!leaseDetail) return;
    const rent = Number(renewRent);
    if (!renewStart || !renewEnd || !Number.isFinite(rent) || rent <= 0) {
      toast.error("Invalid renewal values");
      return;
    }
    try {
      await rentalService.renewLease(leaseDetail.id, {
        startDate: new Date(`${renewStart}T00:00:00`).toISOString(),
        endDate: new Date(`${renewEnd}T00:00:00`).toISOString(),
        monthlyRent: rent,
        autoRenew: renewAuto,
      });
      toast.success("Lease renewed");
      setDetailOpen(false);
      await refreshAll();
    } catch (error) {
      toast.error("Failed to renew lease", { description: errorMessage(error) });
    }
  };

  const doTerminate = async () => {
    if (!leaseDetail || !terminateReason.trim()) {
      toast.error("Termination reason is required");
      return;
    }
    try {
      await rentalService.terminateLease(leaseDetail.id, { reason: terminateReason.trim() });
      toast.success("Lease terminated");
      setDetailOpen(false);
      await refreshAll();
    } catch (error) {
      toast.error("Failed to terminate lease", { description: errorMessage(error) });
    }
  };

  const approveRequest = async () => {
    if (!selectedRequest) return;
    try {
      await rentalService.approveRequest(selectedRequest.id);
      toast.success("Request approved");
      setReviewOpen(false);
      await refreshAll();
    } catch (error) {
      toast.error("Failed to approve request", { description: errorMessage(error) });
    }
  };

  const rejectRequest = async () => {
    if (!selectedRequest || !rejectReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    try {
      await rentalService.rejectRequest(selectedRequest.id, rejectReason.trim());
      toast.success("Request rejected");
      setReviewOpen(false);
      await refreshAll();
    } catch (error) {
      toast.error("Failed to reject request", { description: errorMessage(error) });
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Rental / Lease</h1>
          <p className="text-sm text-gray-500 mt-1">Leases, requests, and operations controls.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="bg-white/5 hover:bg-gray-100 border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2" onClick={() => void refreshAll()}><RefreshCw className="w-4 h-4" />Refresh</button>
          <button className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2" onClick={() => setSettingsOpen(true)}><Settings className="w-4 h-4" />Settings</button>
        </div>
      </div>

      {!settings.leasingEnabled ? (
        <div className="w-full rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 flex items-center justify-between">
          <p className="text-sm text-amber-200">Leasing operations are suspended — {settings.suspensionReason ?? "No reason"}</p>
          <button className="bg-amber-400 hover:bg-amber-300 text-[#201300] text-sm font-medium px-4 py-2 rounded-lg transition-colors" onClick={() => { setSettingsEnabledDraft(true); setSettingsOpen(true); }}>Re-enable</button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6"><p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active Leases</p><p className="text-3xl font-semibold text-gray-900 font-['DM_Mono'] mt-4">{stats.activeLeases}</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-6"><p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Expiring This Month</p><p className="text-3xl font-semibold text-gray-900 font-['DM_Mono'] mt-4">{stats.expiringThisMonth}</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-6"><p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Pending Requests</p><p className="text-3xl font-semibold text-gray-900 font-['DM_Mono'] mt-4">{stats.pendingRentRequests}</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-6"><p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly Revenue</p><p className="text-3xl font-semibold text-gray-900 font-['DM_Mono'] mt-4">{formatCurrency(stats.totalMonthlyRevenue)}</p></div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <button className={`px-4 py-2 rounded-lg text-sm ${tab === "leases" ? "bg-blue-600 text-white" : "bg-white/5 text-gray-700"}`} onClick={() => setTab("leases")}>Leases</button>
          <button className={`px-4 py-2 rounded-lg text-sm ${tab === "requests" ? "bg-blue-600 text-white" : "bg-white/5 text-gray-700"}`} onClick={() => setTab("requests")}>Rent Requests</button>
        </div>

        {tab === "leases" ? (
          <>
            <div className="p-4 border-b border-gray-200 flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-blue-500/50" placeholder="Search..." value={leaseFilterSearch} onChange={(event) => setLeaseFilterSearch(event.target.value)} />
              </div>
              <select className="w-44 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50 appearance-none" value={leaseFilterStatus} onChange={(event) => setLeaseFilterStatus(event.target.value as "all" | LeaseStatus)}>
                <option value="all">All Statuses</option><option value="ACTIVE">Active</option><option value="EXPIRING_SOON">Expiring Soon</option><option value="EXPIRED">Expired</option><option value="TERMINATED">Terminated</option>
              </select>
              <select className="w-44 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50 appearance-none" value={leaseFilterCommunity} onChange={(event) => setLeaseFilterCommunity(event.target.value)}>
                {communities.map((community) => (<option key={community.id} value={community.id}>{community.name}</option>))}
              </select>
              <button className={`px-3 py-1.5 rounded-full text-xs ${leaseFilterExpiring ? "bg-blue-600/20 text-blue-300" : "bg-white/5 text-gray-500"}`} onClick={() => setLeaseFilterExpiring((prev) => !prev)}>Expiring Soon</button>
            </div>
            {(() => {
              const leaseCols: DataTableColumn<LeaseListItem>[] = [
                { key: "unit", header: "Unit", render: (r) => <span className="text-sm text-gray-700">{r.unitNumber}</span> },
                { key: "community", header: "Community", render: (r) => <span className="text-sm text-gray-700">{r.communityName}</span> },
                { key: "owner", header: "Owner", render: (r) => <span className="text-sm text-gray-700">{r.ownerName}</span> },
                { key: "tenant", header: "Tenant", render: (r) => <span className="text-sm text-gray-700">{r.tenantName ?? "—"}</span> },
                { key: "rent", header: "Rent/mo", render: (r) => <span className="text-sm text-gray-700">{formatCurrency(r.monthlyRent)}</span> },
                { key: "period", header: "Period", render: (r) => <span className="text-sm text-gray-700">{formatDate(r.startDate)} - {formatDate(r.endDate)}</span> },
                { key: "days", header: "Days Left", render: (r) => <span className={`text-sm ${daysTone(r.daysUntilExpiry)}`}>{r.daysUntilExpiry ?? "—"}</span> },
                { key: "status", header: "Status", render: (r) => <span className={`px-2 py-1 rounded-md text-xs ${statusTone(r.status)}`}>{r.status}</span> },
                { key: "actions", header: "Actions", render: (r) => (
                  <div className="flex items-center gap-2">
                    <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-700" onClick={() => void openLease(r.id, "view")}><Eye className="w-4 h-4" /></button>
                    <button className="p-2 rounded-lg hover:bg-gray-100 text-blue-300" onClick={() => void openLease(r.id, "renew")}>R</button>
                    <button className="p-2 rounded-lg hover:bg-gray-100 text-rose-300" onClick={() => void openLease(r.id, "terminate")}>T</button>
                  </div>
                )},
              ];
              return <DataTable columns={leaseCols} rows={leases} rowKey={(r) => r.id} loading={loadingLeases} emptyTitle="No leases found" />;
            })()}
          </>
        ) : (
          <>
            <div className="p-4 border-b border-gray-200 flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-blue-500/50" placeholder="Search..." value={requestFilterSearch} onChange={(event) => { setRequestFilterSearch(event.target.value); setRequestPage(1); }} /></div>
              <select className="w-44 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50 appearance-none" value={requestFilterStatus} onChange={(event) => { setRequestFilterStatus(event.target.value as "all" | RentRequestStatus); setRequestPage(1); }}><option value="all">All Statuses</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="CANCELLED">Cancelled</option></select>
            </div>
            {(() => {
              const reqCols: DataTableColumn<RentRequestListItem>[] = [
                { key: "unit", header: "Unit", render: (r) => <span className="text-sm text-gray-700">{r.unitNumber}</span> },
                { key: "owner", header: "Owner", render: (r) => <span className="text-sm text-gray-700">{r.ownerName ?? "—"}</span> },
                { key: "tenant", header: "Tenant", render: (r) => <span className="text-sm text-gray-700">{r.tenantName}</span> },
                { key: "email", header: "Email", render: (r) => <span className="text-sm text-gray-700">{r.tenantEmail}</span> },
                { key: "requested", header: "Requested", render: (r) => <span className="text-sm text-gray-700">{formatDate(r.requestedAt)}</span> },
                { key: "nationality", header: "Nationality", render: (r) => <span className="text-sm text-gray-700">{r.tenantNationality}</span> },
                { key: "status", header: "Status", render: (r) => <span className={`px-2 py-1 rounded-md text-xs ${statusTone(r.status)}`}>{r.status}</span> },
                { key: "actions", header: "Actions", render: (r) => (
                  <button className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors" onClick={() => { setSelectedRequest(r); setRejectReason(""); setReviewOpen(true); }}>Review</button>
                )},
              ];
              return <DataTable columns={reqCols} rows={requests} rowKey={(r) => r.id} loading={loadingRequests} emptyTitle="No requests found" />;
            })()}
            <div className="flex items-center justify-end gap-2"><button className="bg-white/5 hover:bg-gray-100 border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors" disabled={requestPage <= 1} onClick={() => setRequestPage((prev) => Math.max(1, prev - 1))}>Previous</button><p className="text-sm text-gray-500">Page {requestPage} / {requestPages}</p><button className="bg-white/5 hover:bg-gray-100 border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors" disabled={requestPage >= requestPages} onClick={() => setRequestPage((prev) => Math.min(requestPages, prev + 1))}>Next</button></div>
          </>
        )}
      </div>

      {detailOpen ? (
        <div className="fixed inset-0 z-50 bg-black/60"><div className="fixed inset-y-0 right-0 w-[480px] bg-white border-l border-gray-200 flex flex-col z-50 shadow-2xl shadow-black/50"><div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between flex-shrink-0"><h2 className="text-base font-semibold text-gray-900">Lease Detail</h2><button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700" onClick={() => setDetailOpen(false)}><X className="w-4 h-4" /></button></div><div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">{detailLoading || !leaseDetail ? <p className="text-sm text-gray-500">Loading...</p> : (<><div className="bg-white rounded-xl border border-gray-200 p-6"><p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Unit & Parties</p><p className="text-sm text-gray-700">Unit: {leaseDetail.unit.unitNumber}</p><p className="text-sm text-gray-700">Owner: {leaseDetail.owner.name ?? "—"}</p><p className="text-sm text-gray-700">Tenant: {leaseDetail.tenant?.name ?? "—"}</p></div><div className="bg-white rounded-xl border border-gray-200 p-6"><p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Lease Terms</p><p className="text-sm text-gray-700">Period: {formatDate(leaseDetail.startDate)} - {formatDate(leaseDetail.endDate)}</p><p className="text-sm text-gray-700">Rent: {formatCurrency(leaseDetail.monthlyRent)}</p><p className="text-sm text-gray-700">Source: {leaseDetail.source}</p><p className="text-sm text-gray-700">Auto Renew: {leaseDetail.autoRenew ? "Enabled" : "Disabled"}</p></div><div className="bg-white rounded-xl border border-gray-200 p-6"><p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Renewal Chain</p>{leaseDetail.renewedFrom ? <p className="text-sm text-blue-300">Renewed from: {leaseDetail.renewedFrom.id}</p> : <p className="text-sm text-gray-400">No renewal links</p>}{leaseDetail.renewedTo ? <p className="text-sm text-blue-300 mt-1">Renewed to: {leaseDetail.renewedTo.id}</p> : null}</div>{mode === "renew" ? <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"><div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-medium text-gray-500 mb-1.5 block">Start</label><input type="date" className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-700" value={renewStart} onChange={(event) => setRenewStart(event.target.value)} /></div><div><label className="text-xs font-medium text-gray-500 mb-1.5 block">End</label><input type="date" className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-700" value={renewEnd} onChange={(event) => setRenewEnd(event.target.value)} /></div></div><div><label className="text-xs font-medium text-gray-500 mb-1.5 block">Rent</label><input type="number" className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-700" value={renewRent} onChange={(event) => setRenewRent(event.target.value)} /></div><button className={`px-3 py-1.5 rounded-full text-xs ${renewAuto ? "bg-blue-600/20 text-blue-300" : "bg-white/5 text-gray-500"}`} onClick={() => setRenewAuto((prev) => !prev)}>Auto Renew {renewAuto ? "ON" : "OFF"}</button></div> : null}{mode === "terminate" ? <div className="bg-white rounded-xl border border-gray-200 p-6"><label className="text-xs font-medium text-gray-500 mb-1.5 block">Reason</label><textarea className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-700 min-h-[96px]" value={terminateReason} onChange={(event) => setTerminateReason(event.target.value)} /></div> : null}</>)}</div><div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 flex-shrink-0">{mode === "renew" ? <button className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors" onClick={() => void doRenew()}>Save Renewal</button> : mode === "terminate" ? <button className="bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors" onClick={() => void doTerminate()}>Confirm Terminate</button> : (<><button className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors" onClick={() => setMode("renew")}>Renew Lease</button><button className="bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors" onClick={() => setMode("terminate")}>Terminate Lease</button></>)}</div></div></div>
      ) : null}

      {reviewOpen && selectedRequest ? (
        <div className="fixed inset-0 z-50 bg-black/60"><div className="fixed inset-y-0 right-0 w-[560px] bg-white border-l border-gray-200 flex flex-col z-50 shadow-2xl shadow-black/50"><div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between flex-shrink-0"><h2 className="text-base font-semibold text-gray-900">Request Review</h2><button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700" onClick={() => setReviewOpen(false)}><X className="w-4 h-4" /></button></div><div className="flex-1 overflow-y-auto px-6 py-6 space-y-4"><div className="bg-white rounded-xl border border-gray-200 p-6"><p className="text-sm text-gray-700">Name: {selectedRequest.tenantName}</p><p className="text-sm text-gray-700">Email: {selectedRequest.tenantEmail}</p><p className="text-sm text-gray-700">Phone: {selectedRequest.tenantPhone}</p></div><div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3"><div className="flex items-center justify-between"><p className="text-sm text-gray-700">National ID: {selectedRequest.tenantNationalIdFileId ?? "N/A"}</p>{selectedRequest.tenantNationalIdFileId ? <button className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors" onClick={() => void openSecureFile(selectedRequest.tenantNationalIdFileId!)}>Open</button> : null}</div><div className="flex items-center justify-between"><p className="text-sm text-gray-700">Contract: {selectedRequest.contractFileId ?? "N/A"}</p>{selectedRequest.contractFileId ? <button className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors" onClick={() => void openSecureFile(selectedRequest.contractFileId!)}>Open</button> : null}</div></div><div><label className="text-xs font-medium text-gray-500 mb-1.5 block">Reject Reason</label><textarea className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-700 min-h-[96px]" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} /></div></div><div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 flex-shrink-0"><button className="bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors" onClick={() => void rejectRequest()}>Reject</button><button className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors" onClick={() => void approveRequest()}>Approve</button></div></div></div>
      ) : null}

      {settingsOpen ? (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"><div className="w-full max-w-xl bg-white rounded-xl border border-gray-200 p-6"><div className="flex items-center justify-between mb-6"><h2 className="text-base font-semibold text-gray-900">Leasing Operations</h2><button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700" onClick={() => setSettingsOpen(false)}><X className="w-4 h-4" /></button></div><div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"><div className="flex items-center justify-between"><p className="text-sm text-gray-700">Current status: {settingsEnabledDraft ? "Enabled" : "Suspended"}</p><button className={`w-12 h-7 rounded-full ${settingsEnabledDraft ? "bg-blue-600" : "bg-slate-600"} relative`} onClick={() => setSettingsEnabledDraft((prev) => !prev)}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white ${settingsEnabledDraft ? "left-6" : "left-1"}`} /></button></div>{!settingsEnabledDraft ? <div><label className="text-xs font-medium text-gray-500 mb-1.5 block">Reason</label><textarea className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-700 min-h-[96px]" value={settingsReasonDraft} onChange={(event) => setSettingsReasonDraft(event.target.value)} /></div> : <p className="text-sm text-gray-500">Re-enabling will clear suspension reason.</p>}</div><div className="flex items-center justify-end gap-3 mt-6"><button className="bg-white/5 hover:bg-gray-100 border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors" onClick={() => setSettingsOpen(false)}>Cancel</button><button className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors" onClick={() => void saveSettings()}>Save</button></div></div></div>
      ) : null}
    </div>
  );
}

