import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Eye, RefreshCw, Search, X, ChevronLeft, ChevronRight,
  SlidersHorizontal, ChevronDown, RotateCcw, AlertTriangle,
  FileText, Check, Clock, Mail,
} from 'lucide-react';
import { DataTable, type DataTableColumn } from '../DataTable';
import { DrawerForm } from '../DrawerForm';
import { StatCard } from '../StatCard';
import { StatusBadge } from '../StatusBadge';
import { EmptyState } from '../EmptyState';
import { toast } from 'sonner';
import { API_BASE_URL } from '../../lib/api-client';
import { errorMessage } from '../../lib/live-data';
import rentalService, {
  type LeaseDetail,
  type LeaseListItem,
  type LeaseStatus,
  type RentRequestListItem,
  type RentRequestStatus,
  type RentalSettings,
  type RentalStats,
} from '../../lib/rental-service';

// ─── Types ────────────────────────────────────────────────────

type TabKey  = 'leases' | 'requests';
type LeaseMode = 'view' | 'renew' | 'terminate';
type LeaseSubFilter = 'all' | 'active' | 'expired' | 'terminated';

// ─── Constants ────────────────────────────────────────────────

const EMPTY_SETTINGS: RentalSettings = {
  leasingEnabled: true, suspensionReason: null, suspendedAt: null,
};
const EMPTY_STATS: RentalStats = {
  activeLeases: 0, expiringThisMonth: 0, expiredLeases: 0,
  pendingRentRequests: 0, totalMonthlyRevenue: 0, leasingEnabled: true,
};

// ─── Helpers ──────────────────────────────────────────────────

function formatCurrency(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 }).format(v);
}
function formatDate(v: string | null) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function DaysLeftCell({ days }: { days: number | null }) {
  if (days === null) return <span style={{ color: '#D1D5DB', fontFamily: "'DM Mono', monospace", fontSize: '12px' }}>—</span>;
  const color = days > 60 ? '#9CA3AF' : days >= 30 ? '#D97706' : '#DC2626';
  return (
    <span style={{ fontSize: '12px', fontWeight: days < 30 ? 700 : 500, color, fontFamily: "'DM Mono', monospace" }}>
      {days}d
    </span>
  );
}

function LeaseStatusChip({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    ACTIVE:        { bg: '#ECFDF5', color: '#059669' },
    EXPIRING_SOON: { bg: '#FFFBEB', color: '#D97706' },
    EXPIRED:       { bg: '#F3F4F6', color: '#6B7280' },
    TERMINATED:    { bg: '#FEF2F2', color: '#DC2626' },
  };
  const m = map[status] ?? { bg: '#F3F4F6', color: '#6B7280' };
  return (
    <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '5px', fontSize: '10.5px', fontWeight: 700, background: m.bg, color: m.color, fontFamily: "'Work Sans', sans-serif", whiteSpace: 'nowrap' }}>
      {status.replace('_', ' ')}
    </span>
  );
}

async function openSecureFile(fileId: string) {
  const token = localStorage.getItem('auth_token');
  if (!token) throw new Error('Missing token');
  const res = await fetch(`${API_BASE_URL}/files/${fileId}/stream`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`File fetch failed (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// ─── Shared styles ────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: '7px',
  border: '1px solid #E5E7EB', fontSize: '13px', color: '#111827',
  background: '#FFF', outline: 'none', fontFamily: "'Work Sans', sans-serif",
  boxSizing: 'border-box', height: '36px',
};
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };
const textareaStyle: React.CSSProperties = {
  ...inputStyle, height: 'auto', minHeight: '90px', resize: 'vertical', padding: '9px 10px',
};

// ─── Primitives ───────────────────────────────────────────────

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ padding: '7px 18px', borderRadius: '7px', border: 'none', background: active ? '#FFF' : 'transparent', color: active ? '#111827' : '#9CA3AF', cursor: 'pointer', fontSize: '12.5px', fontWeight: active ? 700 : 500, transition: 'all 120ms ease', fontFamily: "'Work Sans', sans-serif", flexShrink: 0, boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
      {label}
    </button>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Work Sans', sans-serif" }}>
        {label}{required && <span style={{ color: '#EF4444', marginLeft: '3px' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <p style={{ fontSize: '9.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0, fontFamily: "'Work Sans', sans-serif" }}>{title}</p>
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <p style={{ fontSize: '13px', color: '#374151', margin: 0, fontFamily: "'Work Sans', sans-serif" }}>
      <span style={{ fontWeight: 600, color: '#9CA3AF' }}>{label}: </span>
      <span style={{ fontFamily: mono ? "'DM Mono', monospace" : "'Work Sans', sans-serif", color: '#111827' }}>{value}</span>
    </p>
  );
}

function GhostIconBtn({ icon, onClick, danger }: { icon: React.ReactNode; onClick: () => void; danger?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #EBEBEB', background: hov ? (danger ? '#FEF2F2' : '#F3F4F6') : '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: hov ? (danger ? '#DC2626' : '#374151') : '#9CA3AF', transition: 'all 120ms', flexShrink: 0 }}>
      {icon}
    </button>
  );
}

function ActionBtn({ label, variant = 'ghost', onClick, disabled, small }: {
  label: string; variant?: 'ghost' | 'primary' | 'danger' | 'warning';
  onClick: () => void; disabled?: boolean; small?: boolean;
}) {
  const [hov, setHov] = useState(false);
  const vs: Record<string, React.CSSProperties> = {
    ghost:   { background: hov ? '#F3F4F6' : '#FFF',    color: '#374151', border: '1px solid #E5E7EB' },
    primary: { background: hov ? '#1E3A8A' : '#2563EB', color: '#FFF',   border: 'none' },
    danger:  { background: hov ? '#B91C1C' : '#FEF2F2', color: hov ? '#FFF' : '#DC2626', border: '1px solid #FECACA' },
    warning: { background: hov ? '#92400E' : '#FFFBEB', color: hov ? '#FFF' : '#D97706', border: '1px solid #FDE68A' },
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ padding: small ? '5px 12px' : '7px 16px', borderRadius: '7px', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: small ? '11.5px' : '12.5px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", opacity: disabled ? 0.4 : 1, transition: 'all 120ms ease', ...vs[variant] }}>
      {label}
    </button>
  );
}

// ─── Lease detail drawer content ─────────────────────────────

function LeaseDetailContent({ detail, mode, setMode, onClose, onRefresh }: {
  detail: LeaseDetail;
  mode: LeaseMode;
  setMode: (m: LeaseMode) => void;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [renewStart, setRenewStart]   = useState(detail.startDate.slice(0, 10));
  const [renewEnd,   setRenewEnd]     = useState(detail.endDate.slice(0, 10));
  const [renewRent,  setRenewRent]    = useState(String(detail.monthlyRent));
  const [renewAuto,  setRenewAuto]    = useState(detail.autoRenew);
  const [termReason, setTermReason]   = useState('');

  const doRenew = async () => {
    const rent = Number(renewRent);
    if (!renewStart || !renewEnd || !Number.isFinite(rent) || rent <= 0) { toast.error('Invalid renewal values'); return; }
    try {
      await rentalService.renewLease(detail.id, {
        startDate: new Date(`${renewStart}T00:00:00`).toISOString(),
        endDate:   new Date(`${renewEnd}T00:00:00`).toISOString(),
        monthlyRent: rent, autoRenew: renewAuto,
      });
      toast.success('Lease renewed'); onClose(); onRefresh();
    } catch (e) { toast.error('Failed to renew lease', { description: errorMessage(e) }); }
  };

  const doTerminate = async () => {
    if (!termReason.trim()) { toast.error('Termination reason is required'); return; }
    try {
      await rentalService.terminateLease(detail.id, { reason: termReason.trim() });
      toast.success('Lease terminated'); onClose(); onRefresh();
    } catch (e) { toast.error('Failed to terminate lease', { description: errorMessage(e) }); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Status badge + mode pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <LeaseStatusChip status={detail.status} />
        {mode === 'renew'     && <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px', background: '#EFF6FF', color: '#2563EB' }}>Renew Mode</span>}
        {mode === 'terminate' && <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px', background: '#FEF2F2', color: '#DC2626' }}>Terminate Mode</span>}
      </div>

      {/* Parties */}
      <InfoCard title="Unit & Parties">
        <InfoRow label="Unit"   value={detail.unit.unitNumber} />
        <InfoRow label="Owner"  value={detail.owner.name ?? '—'} />
        <InfoRow label="Tenant" value={detail.tenant?.name ?? '—'} />
      </InfoCard>

      {/* Terms */}
      <InfoCard title="Lease Terms">
        <InfoRow label="Period" value={`${formatDate(detail.startDate)} – ${formatDate(detail.endDate)}`} />
        <InfoRow label="Rent"   value={formatCurrency(detail.monthlyRent)} mono />
        <InfoRow label="Source" value={detail.source} />
        <InfoRow label="Auto Renew" value={detail.autoRenew ? 'Enabled' : 'Disabled'} />
      </InfoCard>

      {/* Renewal chain */}
      <InfoCard title="Renewal Chain">
        {detail.renewedFrom
          ? <p style={{ fontSize: '12.5px', color: '#2563EB', margin: 0, fontFamily: "'DM Mono', monospace" }}>← From: {detail.renewedFrom.id}</p>
          : <p style={{ fontSize: '12.5px', color: '#D1D5DB', margin: 0 }}>No previous renewal</p>
        }
        {detail.renewedTo && (
          <p style={{ fontSize: '12.5px', color: '#2563EB', margin: 0, fontFamily: "'DM Mono', monospace" }}>→ To: {detail.renewedTo.id}</p>
        )}
      </InfoCard>

      {/* Renew form */}
      {mode === 'renew' && (
        <InfoCard title="Renewal Details">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="New Start">
              <input type="date" value={renewStart} onChange={(e) => setRenewStart(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="New End">
              <input type="date" value={renewEnd} onChange={(e) => setRenewEnd(e.target.value)} style={inputStyle} />
            </Field>
          </div>
          <Field label="Monthly Rent (EGP)">
            <input type="number" value={renewRent} onChange={(e) => setRenewRent(e.target.value)}
              style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }} />
          </Field>
          {/* Auto renew toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', border: '1px solid #EBEBEB', background: '#FFF' }}>
            <span style={{ fontSize: '12.5px', color: '#374151', fontFamily: "'Work Sans', sans-serif" }}>Auto Renew</span>
            <button type="button" onClick={() => setRenewAuto((p) => !p)}
              style={{ position: 'relative', width: '40px', height: '22px', borderRadius: '11px', border: `1.5px solid ${renewAuto ? '#A7F3D0' : '#E5E7EB'}`, background: renewAuto ? '#ECFDF5' : '#F9FAFB', cursor: 'pointer', transition: 'all 150ms', flexShrink: 0 }}>
              <span style={{ position: 'absolute', top: '2px', width: '16px', height: '16px', borderRadius: '50%', background: renewAuto ? '#059669' : '#D1D5DB', left: renewAuto ? '20px' : '2px', transition: 'left 150ms' }} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
            <ActionBtn label="Save Renewal" variant="primary" onClick={() => void doRenew()} />
            <ActionBtn label="Cancel" onClick={() => setMode('view')} />
          </div>
        </InfoCard>
      )}

      {/* Terminate form */}
      {mode === 'terminate' && (
        <InfoCard title="Termination">
          <Field label="Reason" required>
            <textarea value={termReason} onChange={(e) => setTermReason(e.target.value)}
              placeholder="State the reason for terminating this lease…" style={textareaStyle} />
          </Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', borderRadius: '7px', background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
            <Mail style={{ width: '13px', height: '13px', color: '#2563EB', flexShrink: 0 }} />
            <span style={{ fontSize: '11.5px', color: '#1E40AF', fontFamily: "'Work Sans', sans-serif" }}>
              Both parties will be notified by email.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
            <ActionBtn label="Confirm Terminate" variant="danger" onClick={() => void doTerminate()} />
            <ActionBtn label="Cancel" onClick={() => setMode('view')} />
          </div>
        </InfoCard>
      )}

      {/* View mode actions */}
      {mode === 'view' && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <ActionBtn label="Renew Lease"     variant="primary" onClick={() => setMode('renew')} />
          <ActionBtn label="Terminate Lease" variant="danger"  onClick={() => setMode('terminate')} />
        </div>
      )}
    </div>
  );
}

// ─── Request review drawer content ───────────────────────────

function RequestReviewContent({ request, onClose, onRefresh }: {
  request: RentRequestListItem; onClose: () => void; onRefresh: () => void;
}) {
  const [rejectReason, setRejectReason] = useState('');

  const approve = async () => {
    try {
      await rentalService.approveRequest(request.id);
      toast.success('Request approved'); onClose(); onRefresh();
    } catch (e) { toast.error('Failed to approve', { description: errorMessage(e) }); }
  };

  const reject = async () => {
    if (!rejectReason.trim()) { toast.error('Rejection reason is required'); return; }
    try {
      await rentalService.rejectRequest(request.id, rejectReason.trim());
      toast.success('Request rejected'); onClose(); onRefresh();
    } catch (e) { toast.error('Failed to reject', { description: errorMessage(e) }); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <StatusBadge value={request.status} />
      </div>

      {/* Tenant info */}
      <InfoCard title="Tenant Info">
        <InfoRow label="Name"        value={request.tenantName} />
        <InfoRow label="Email"       value={request.tenantEmail} />
        <InfoRow label="Phone"       value={request.tenantPhone ?? '—'} />
        <InfoRow label="Nationality" value={request.tenantNationality ?? '—'} />
      </InfoCard>

      {/* Documents */}
      <InfoCard title="Documents">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText style={{ width: '13px', height: '13px', color: '#9CA3AF' }} />
            <span style={{ fontSize: '12.5px', color: '#374151', fontFamily: "'Work Sans', sans-serif" }}>National ID</span>
          </div>
          {request.tenantNationalIdFileId
            ? <button type="button" onClick={() => void openSecureFile(request.tenantNationalIdFileId!)}
                style={{ padding: '5px 12px', borderRadius: '6px', background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif" }}>
                Open
              </button>
            : <span style={{ fontSize: '11.5px', color: '#D1D5DB' }}>N/A</span>
          }
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText style={{ width: '13px', height: '13px', color: '#9CA3AF' }} />
            <span style={{ fontSize: '12.5px', color: '#374151', fontFamily: "'Work Sans', sans-serif" }}>Contract</span>
          </div>
          {request.contractFileId
            ? <button type="button" onClick={() => void openSecureFile(request.contractFileId!)}
                style={{ padding: '5px 12px', borderRadius: '6px', background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif" }}>
                Open
              </button>
            : <span style={{ fontSize: '11.5px', color: '#D1D5DB' }}>N/A</span>
          }
        </div>
      </InfoCard>

      {/* Reject reason */}
      {(request.status === 'PENDING') && (
        <InfoCard title="Review Actions">
          <Field label="Rejection Reason (required to reject)">
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter reason if rejecting…" style={textareaStyle} />
          </Field>
          <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
            <ActionBtn label="Approve" variant="primary" onClick={() => void approve()} />
            <ActionBtn label="Reject"  variant="danger"  onClick={() => void reject()} />
          </div>
        </InfoCard>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────

export function RentalManagement() {
  const [tab,        setTab]        = useState<TabKey>('leases');
  const [settings,   setSettings]   = useState<RentalSettings>(EMPTY_SETTINGS);
  const [stats,      setStats]      = useState<RentalStats>(EMPTY_STATS);
  const [communities, setCommunities] = useState<Array<{ id: string; name: string }>>([]);
  const [leases,     setLeases]     = useState<LeaseListItem[]>([]);
  const [requests,   setRequests]   = useState<RentRequestListItem[]>([]);
  const [requestTotal, setRequestTotal] = useState(0);
  const [loadingLeases,   setLoadingLeases]   = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Lease filters
  const [leaseSearch,     setLeaseSearch]     = useState('');
  const [leaseStatus,     setLeaseStatus]     = useState<'all' | LeaseStatus>('all');
  const [leaseCommunity,  setLeaseCommunity]  = useState('');
  const [leaseExpiring,   setLeaseExpiring]   = useState(false);
  const [leaseFiltersOpen, setLeaseFiltersOpen] = useState(false);
  const [leaseSubFilter,  setLeaseSubFilter]  = useState<LeaseSubFilter>('all');

  // Request filters
  const [reqSearch,  setReqSearch]  = useState('');
  const [reqStatus,  setReqStatus]  = useState<'all' | RentRequestStatus>('all');
  const [reqPage,    setReqPage]    = useState(1);

  // Lease detail drawer
  const [detailOpen,    setDetailOpen]    = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [leaseDetail,   setLeaseDetail]   = useState<LeaseDetail | null>(null);
  const [leaseMode,     setLeaseMode]     = useState<LeaseMode>('view');

  // Request review drawer
  const [reviewOpen,     setReviewOpen]     = useState(false);
  const [selectedReq,    setSelectedReq]    = useState<RentRequestListItem | null>(null);

  const reqPages = useMemo(() => Math.max(1, Math.ceil(requestTotal / 20)), [requestTotal]);

  // Sub-filter leases by status pill
  const filteredLeases = useMemo(() => {
    if (leaseSubFilter === 'all') return leases;
    const map: Record<LeaseSubFilter, LeaseStatus[]> = {
      all:        [],
      active:     ['ACTIVE', 'EXPIRING_SOON'],
      expired:    ['EXPIRED'],
      terminated: ['TERMINATED'],
    };
    const allowed = map[leaseSubFilter];
    return leases.filter((l) => allowed.includes(l.status));
  }, [leases, leaseSubFilter]);

  // Leases that are past their end date but still marked ACTIVE (should have auto-expired)
  const staleActiveLeases = useMemo(() => {
    const now = new Date();
    return leases.filter((l) => (l.status === 'ACTIVE' || l.status === 'EXPIRING_SOON') && new Date(l.endDate) < now);
  }, [leases]);

  const activeLeaseFilters = [leaseStatus !== 'all', !!leaseCommunity, leaseExpiring].filter(Boolean).length;

  // ── Loaders ───────────────────────────────────────────────────

  const loadHeader = useCallback(async () => {
    const [s, st, comms] = await Promise.all([
      rentalService.getSettings(),
      rentalService.getStats(),
      rentalService.listCommunities(),
    ]);
    setSettings(s); setStats(st); setCommunities(comms);
  }, [leaseCommunity]);

  const loadLeases = useCallback(async () => {
    setLoadingLeases(true);
    try {
      const rows = await rentalService.listLeases({
        search:             leaseSearch    || undefined,
        status:             leaseStatus    === 'all' ? undefined : leaseStatus,
        communityId:        leaseCommunity || undefined,
        expiringWithinDays: leaseExpiring  ? 30 : undefined,
      });
      setLeases(rows);
    } catch (e) { toast.error('Failed to load leases', { description: errorMessage(e) }); }
    finally { setLoadingLeases(false); }
  }, [leaseSearch, leaseStatus, leaseCommunity, leaseExpiring]);

  const loadRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const r = await rentalService.listRequests({
        search:  reqSearch || undefined,
        status:  reqStatus === 'all' ? undefined : reqStatus,
        page: reqPage, limit: 20,
      });
      setRequests(r.data); setRequestTotal(r.total);
    } catch (e) { toast.error('Failed to load requests', { description: errorMessage(e) }); }
    finally { setLoadingRequests(false); }
  }, [reqSearch, reqStatus, reqPage]);

  useEffect(() => { void loadHeader();   }, [loadHeader]);
  useEffect(() => { void loadLeases();   }, [loadLeases]);
  useEffect(() => { void loadRequests(); }, [loadRequests]);

  const refreshAll = () => Promise.all([loadHeader(), loadLeases(), loadRequests()]);

  const openLease = async (id: string, mode: LeaseMode) => {
    setDetailOpen(true); setDetailLoading(true); setLeaseMode(mode);
    try {
      const d = await rentalService.getLeaseDetail(id);
      setLeaseDetail(d);
    } catch (e) {
      toast.error('Failed to load lease', { description: errorMessage(e) });
      setDetailOpen(false);
    } finally { setDetailLoading(false); }
  };

  // ── Columns ───────────────────────────────────────────────────

  const leaseCols: DataTableColumn<LeaseListItem>[] = useMemo(() => [
    { key: 'unit',      header: 'Unit',      render: (r) => <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", color: '#111827' }}>{r.unitNumber}</span> },
    { key: 'community', header: 'Community', render: (r) => <span style={{ fontSize: '12px', color: '#6B7280' }}>{r.communityName}</span> },
    { key: 'owner',     header: 'Owner',     render: (r) => <span style={{ fontSize: '12px', color: '#374151' }}>{r.ownerName}</span> },
    { key: 'tenant',    header: 'Tenant',    render: (r) => <span style={{ fontSize: '12px', color: r.tenantName ? '#374151' : '#D1D5DB' }}>{r.tenantName ?? '—'}</span> },
    { key: 'rent',      header: 'Rent/mo',   render: (r) => <span style={{ fontSize: '12.5px', fontWeight: 700, fontFamily: "'DM Mono', monospace", color: '#111827' }}>{formatCurrency(r.monthlyRent)}</span> },
    { key: 'period',    header: 'Period',    render: (r) => <span style={{ fontSize: '11px', color: '#9CA3AF', fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap' }}>{formatDate(r.startDate)} – {formatDate(r.endDate)}</span> },
    { key: 'days',      header: 'Days Left', render: (r) => <DaysLeftCell days={r.daysUntilExpiry} /> },
    { key: 'status',    header: 'Status',    render: (r) => <LeaseStatusChip status={r.status} /> },
    { key: 'actions',   header: '',          render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
        <GhostIconBtn icon={<Eye style={{ width: '11px', height: '11px' }} />} onClick={() => void openLease(r.id, 'view')} />
        <button type="button" onClick={() => void openLease(r.id, 'renew')}
          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#2563EB', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif" }}>
          Renew
        </button>
        <button type="button" onClick={() => void openLease(r.id, 'terminate')}
          style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif" }}>
          Terminate
        </button>
      </div>
    )},
  ], []);

  const reqCols: DataTableColumn<RentRequestListItem>[] = useMemo(() => [
    { key: 'unit',        header: 'Unit',        render: (r) => <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>{r.unitNumber}</span> },
    { key: 'owner',       header: 'Owner',       render: (r) => <span style={{ fontSize: '12px', color: '#6B7280' }}>{r.ownerName ?? '—'}</span> },
    { key: 'tenant',      header: 'Tenant',      render: (r) => <span style={{ fontSize: '12px', color: '#374151' }}>{r.tenantName}</span> },
    { key: 'email',       header: 'Email',       render: (r) => <span style={{ fontSize: '11.5px', color: '#6B7280' }}>{r.tenantEmail}</span> },
    { key: 'requested',   header: 'Requested',   render: (r) => <span style={{ fontSize: '11.5px', color: '#9CA3AF', fontFamily: "'DM Mono', monospace" }}>{formatDate(r.requestedAt)}</span> },
    { key: 'nationality', header: 'Nationality', render: (r) => <span style={{ fontSize: '12px', color: '#6B7280' }}>{r.tenantNationality ?? '—'}</span> },
    { key: 'status',      header: 'Status',      render: (r) => <StatusBadge value={r.status} /> },
    { key: 'actions',     header: '',            render: (r) => (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={() => { setSelectedReq(r); setReviewOpen(true); }}
          style={{ padding: '5px 12px', borderRadius: '7px', background: '#111827', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '11.5px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
          Review
        </button>
      </div>
    )},
  ], []);

  // ─────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif" }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 900, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>Rental / Lease</h1>
        <p style={{ fontSize: '13px', color: '#6B7280', margin: '4px 0 0' }}>Leases, requests, and operations controls.</p>
      </div>

      {/* ── Suspension banner ──────────────────────────────── */}
      {!settings.leasingEnabled && (
        <div style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '10px', border: '1px solid #FDE68A', background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle style={{ width: '14px', height: '14px', color: '#D97706', flexShrink: 0 }} />
            <p style={{ fontSize: '13px', color: '#92400E', margin: 0 }}>
              Leasing operations are suspended — {settings.suspensionReason ?? 'No reason provided'}
            </p>
          </div>
        </div>
      )}

      {/* ── Stats ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
        <StatCard icon="active-users"    title="Active Leases"       value={String(stats.activeLeases)}                               subtitle="Currently running"  onClick={() => { setTab('leases'); setLeaseSubFilter('active'); setLeaseExpiring(false); }} />
        <StatCard icon="complaints-open" title="Expiring This Month" value={String(stats.expiringThisMonth)}                          subtitle="Within 30 days"     onClick={() => { setTab('leases'); setLeaseSubFilter('all'); setLeaseExpiring(true); }} />
        <StatCard icon="tickets"         title="Pending Requests"    value={String(stats.pendingRentRequests)}                         subtitle="Awaiting review"    onClick={() => { setTab('requests'); }} />
        <StatCard icon="revenue"         title="Monthly Revenue"     value={formatCurrency(stats.totalMonthlyRevenue)}                 subtitle="All active leases"  onClick={() => { setTab('leases'); setLeaseSubFilter('all'); setLeaseExpiring(false); }} />
      </div>

      {/* ── Tabs ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '4px', borderRadius: '10px', background: '#F3F4F6', marginBottom: '20px' }}>
        <TabBtn label="Leases"        active={tab === 'leases'}   onClick={() => setTab('leases')} />
        <TabBtn label="Rent Requests" active={tab === 'requests'} onClick={() => setTab('requests')} />
        <button type="button" onClick={() => void refreshAll()}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '7px', border: '1px solid #E5E7EB', background: '#FFF', color: '#374151', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", marginLeft: 'auto' }}>
          <RefreshCw style={{ width: '12px', height: '12px' }} /> Refresh
        </button>
      </div>

      {/* ══ Leases tab ════════════════════════════════════════ */}
      {tab === 'leases' && (
        <div style={{ borderRadius: '12px', border: '1px solid #EBEBEB', background: '#FFF', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          {/* Sub-filter pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 14px', borderBottom: '1px solid #F3F4F6', flexWrap: 'wrap' }}>
            {([
              { key: 'all',        label: 'All' },
              { key: 'active',     label: 'Active' },
              { key: 'expired',    label: 'Expired' },
              { key: 'terminated', label: 'Terminated' },
            ] as const).map((pill) => {
              const isActive = leaseSubFilter === pill.key;
              return (
                <button key={pill.key} type="button" onClick={() => setLeaseSubFilter(pill.key)}
                  style={{ padding: '5px 14px', borderRadius: '16px', border: `1px solid ${isActive ? '#2563EB' : '#E5E7EB'}`, background: isActive ? '#EFF6FF' : '#FAFAFA', color: isActive ? '#2563EB' : '#6B7280', fontSize: '11.5px', fontWeight: isActive ? 700 : 500, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif", transition: 'all 120ms ease' }}>
                  {pill.label}
                  {pill.key === 'all' && <span style={{ marginLeft: '4px', fontSize: '10px', color: isActive ? '#2563EB' : '#9CA3AF' }}>({leases.length})</span>}
                  {pill.key === 'active' && <span style={{ marginLeft: '4px', fontSize: '10px', color: isActive ? '#2563EB' : '#9CA3AF' }}>({leases.filter((l) => l.status === 'ACTIVE' || l.status === 'EXPIRING_SOON').length})</span>}
                  {pill.key === 'expired' && <span style={{ marginLeft: '4px', fontSize: '10px', color: isActive ? '#2563EB' : '#9CA3AF' }}>({leases.filter((l) => l.status === 'EXPIRED').length})</span>}
                  {pill.key === 'terminated' && <span style={{ marginLeft: '4px', fontSize: '10px', color: isActive ? '#2563EB' : '#9CA3AF' }}>({leases.filter((l) => l.status === 'TERMINATED').length})</span>}
                </button>
              );
            })}
            {/* Auto-expire check */}
            <div style={{ marginLeft: 'auto' }}>
              <button type="button" onClick={() => void loadLeases()}
                title="Re-fetch leases and check for any that should have auto-expired"
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '16px', border: '1px solid #E5E7EB', background: '#FAFAFA', color: '#6B7280', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif" }}>
                <Clock style={{ width: '11px', height: '11px' }} />
                Auto-expire Check
              </button>
            </div>
          </div>

          {/* Stale active leases warning */}
          {staleActiveLeases.length > 0 && (
            <div style={{ margin: '0 14px', marginTop: '10px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #FDE68A', background: '#FFFBEB', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle style={{ width: '13px', height: '13px', color: '#D97706', flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: '#92400E', fontFamily: "'Work Sans', sans-serif" }}>
                {staleActiveLeases.length} lease{staleActiveLeases.length > 1 ? 's are' : ' is'} past {staleActiveLeases.length > 1 ? 'their' : 'its'} end date but still showing as active. These should auto-expire via the backend scheduler.
              </span>
            </div>
          )}

          {/* Filter bar */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px' }}>
              <Search style={{ width: '13px', height: '13px', color: '#C4C9D4', flexShrink: 0 }} />
              <input
                placeholder="Search unit, owner, tenant…"
                value={leaseSearch}
                onChange={(e) => setLeaseSearch(e.target.value)}
                style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: '#111827', fontFamily: "'Work Sans', sans-serif" }}
              />
              {/* Expiring soon pill */}
              <button type="button" onClick={() => setLeaseExpiring((p) => !p)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${leaseExpiring ? '#FDE68A' : '#E5E7EB'}`, background: leaseExpiring ? '#FFFBEB' : '#FAFAFA', color: leaseExpiring ? '#D97706' : '#9CA3AF', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif", flexShrink: 0 }}>
                Expiring Soon
              </button>
              {/* Filters toggle */}
              <button type="button" onClick={() => setLeaseFiltersOpen((p) => !p)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: `1px solid ${activeLeaseFilters > 0 ? '#2563EB40' : '#E5E7EB'}`, background: activeLeaseFilters > 0 ? '#EFF6FF' : '#FAFAFA', color: activeLeaseFilters > 0 ? '#2563EB' : '#6B7280', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif", flexShrink: 0 }}>
                <SlidersHorizontal style={{ width: '11px', height: '11px' }} />
                Filters
                {activeLeaseFilters > 0 && <span style={{ width: '15px', height: '15px', borderRadius: '50%', background: '#2563EB', color: '#FFF', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{activeLeaseFilters}</span>}
                <ChevronDown style={{ width: '10px', height: '10px', transform: leaseFiltersOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
              </button>
            </div>
            {leaseFiltersOpen && (
              <div style={{ padding: '10px 14px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <select value={leaseStatus} onChange={(e) => setLeaseStatus(e.target.value as 'all' | LeaseStatus)} style={{ ...selectStyle, width: '150px' }}>
                  <option value="all">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="EXPIRING_SOON">Expiring Soon</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="TERMINATED">Terminated</option>
                </select>
                <select value={leaseCommunity} onChange={(e) => setLeaseCommunity(e.target.value)} style={{ ...selectStyle, width: '180px' }}>
                  <option value="">All Communities</option>
                  {communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <DataTable
            columns={leaseCols}
            rows={filteredLeases}
            rowKey={(r) => r.id}
            loading={loadingLeases}
            emptyTitle="No leases found"
            emptyDescription="Try adjusting your search or filters."
          />
        </div>
      )}

      {/* ══ Requests tab ══════════════════════════════════════ */}
      {tab === 'requests' && (
        <div style={{ borderRadius: '12px', border: '1px solid #EBEBEB', background: '#FFF', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          {/* Filter bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: '1px solid #F3F4F6' }}>
            <Search style={{ width: '13px', height: '13px', color: '#C4C9D4', flexShrink: 0 }} />
            <input
              placeholder="Search tenant, unit…"
              value={reqSearch}
              onChange={(e) => { setReqSearch(e.target.value); setReqPage(1); }}
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: '#111827', fontFamily: "'Work Sans', sans-serif" }}
            />
            <select value={reqStatus} onChange={(e) => { setReqStatus(e.target.value as 'all' | RentRequestStatus); setReqPage(1); }}
              style={{ ...selectStyle, width: '150px', flex: '0 0 150px' }}>
              <option value="all">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <DataTable
            columns={reqCols}
            rows={requests}
            rowKey={(r) => r.id}
            loading={loadingRequests}
            emptyTitle="No requests found"
            emptyDescription="No rent requests match your filters."
          />

          {/* Pagination */}
          <div style={{ padding: '12px 14px', borderTop: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11.5px', color: '#9CA3AF', fontFamily: "'DM Mono', monospace" }}>
              Page {reqPage} of {reqPages}<span style={{ color: '#D1D5DB', marginLeft: '6px' }}>({requestTotal})</span>
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" disabled={reqPage <= 1} onClick={() => setReqPage((p) => Math.max(1, p - 1))}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', border: '1px solid #E5E7EB', background: reqPage <= 1 ? '#F9FAFB' : '#FFF', color: reqPage <= 1 ? '#D1D5DB' : '#374151', cursor: reqPage <= 1 ? 'not-allowed' : 'pointer', fontSize: '12px', fontFamily: "'Work Sans', sans-serif" }}>
                <ChevronLeft style={{ width: '12px', height: '12px' }} /> Prev
              </button>
              <button type="button" disabled={reqPage >= reqPages} onClick={() => setReqPage((p) => Math.min(reqPages, p + 1))}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', border: '1px solid #E5E7EB', background: reqPage >= reqPages ? '#F9FAFB' : '#FFF', color: reqPage >= reqPages ? '#D1D5DB' : '#374151', cursor: reqPage >= reqPages ? 'not-allowed' : 'pointer', fontSize: '12px', fontFamily: "'Work Sans', sans-serif" }}>
                Next <ChevronRight style={{ width: '12px', height: '12px' }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Lease detail drawer ═══════════════════════════════ */}
      <DrawerForm
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title="Lease Detail"
        description="View, renew, or terminate this lease."
        widthClassName="w-full sm:max-w-[500px]"
      >
        {detailLoading || !leaseDetail
          ? <EmptyState title="Loading…" description="Fetching lease details." />
          : <LeaseDetailContent
              key={leaseDetail.id + leaseMode}
              detail={leaseDetail}
              mode={leaseMode}
              setMode={setLeaseMode}
              onClose={() => setDetailOpen(false)}
              onRefresh={() => void refreshAll()}
            />
        }
      </DrawerForm>

      {/* ══ Request review drawer ═════════════════════════════ */}
      <DrawerForm
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        title="Request Review"
        description="Review tenant documents and approve or reject the request."
        widthClassName="w-full sm:max-w-[520px]"
      >
        {!selectedReq
          ? <EmptyState title="No request selected" description="Select a request to review." />
          : <RequestReviewContent
              key={selectedReq.id}
              request={selectedReq}
              onClose={() => setReviewOpen(false)}
              onRefresh={() => void refreshAll()}
            />
        }
      </DrawerForm>
    </div>
  );
}