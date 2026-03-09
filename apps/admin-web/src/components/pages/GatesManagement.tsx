import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Eye, Pencil, Plus, Power, RefreshCw, DoorOpen, Users, LogIn,
  ArrowRightLeft, Truck, CalendarDays, Check, X, ChevronLeft,
  ChevronRight, CalendarRange, SlidersHorizontal, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { DataTable, type DataTableColumn } from '../DataTable';
import { DrawerForm } from '../DrawerForm';
import { EmptyState } from '../EmptyState';
import { StatusBadge } from '../StatusBadge';
import gatesService, {
  type ClusterOption,
  type GateAccessRole,
  type GateLogItem,
  type GateLogStatusFilter,
  type GateRow,
  type GateStats,
  type QrType,
  GATE_ACCESS_ROLES,
} from '../../lib/gates-service';
import { errorMessage, formatDateTime, humanizeEnum } from '../../lib/live-data';

// ─── Types & constants ────────────────────────────────────────

type GateFormState = {
  name: string;
  clusterId: string;
  allowedRoles: GateAccessRole[];
  etaMinutes: string;
};

const INITIAL_FORM: GateFormState = { name: '', clusterId: '', allowedRoles: ['VISITOR'], etaMinutes: '' };

const EMPTY_STATS: GateStats = {
  totalGates: 0, activeGates: 0, currentlyInside: 0,
  todayEntries: 0, todayVisitors: 0, todayDeliveries: 0,
};

const LOG_PAGE_SIZE = 20;

const ROLE_META: Record<GateAccessRole, { bg: string; color: string }> = {
  RESIDENT:  { bg: '#EFF6FF', color: '#2563EB' },
  VISITOR:   { bg: '#F0FDF4', color: '#16A34A' },
  WORKER:    { bg: '#FFFBEB', color: '#D97706' },
  DELIVERY:  { bg: '#FFF7ED', color: '#EA580C' },
  STAFF:     { bg: '#F5F3FF', color: '#7C3AED' },
  RIDESHARE: { bg: '#F0FDFA', color: '#0D9488' },
};

// ─── Shared styles ────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: '7px',
  border: '1px solid #E5E7EB', fontSize: '13px', color: '#111827',
  background: '#FFF', outline: 'none', fontFamily: "'Work Sans', sans-serif",
  boxSizing: 'border-box', height: '36px',
};
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };

// ─── Primitives ───────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Work Sans', sans-serif" }}>
        {label}
      </label>
      {hint && <p style={{ fontSize: '10.5px', color: '#9CA3AF', margin: '0 0 2px' }}>{hint}</p>}
      {children}
    </div>
  );
}

function RoleChip({ role }: { role: GateAccessRole }) {
  const m = ROLE_META[role];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '5px', fontSize: '10.5px', fontWeight: 700, background: m.bg, color: m.color, fontFamily: "'Work Sans', sans-serif" }}>
      {humanizeEnum(role)}
    </span>
  );
}

function RoleToggle({ role, active, onClick }: { role: GateAccessRole; active: boolean; onClick: () => void }) {
  const m = ROLE_META[role];
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 11px', borderRadius: '6px', border: `1.5px solid ${active ? m.color + '55' : '#E5E7EB'}`, background: active ? m.bg : '#FAFAFA', color: active ? m.color : '#9CA3AF', cursor: 'pointer', fontSize: '12px', fontWeight: active ? 700 : 500, transition: 'all 120ms ease', fontFamily: "'Work Sans', sans-serif" }}
    >
      {active && <Check style={{ width: '10px', height: '10px' }} />}
      {humanizeEnum(role)}
    </button>
  );
}

function GateStatCard({ title, value, icon, accent, onClick, active }: { title: string; value: string; icon: React.ReactNode; accent: string; onClick?: () => void; active?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => { if (onClick && !active) setHov(true); }}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: '1 1 0', minWidth: 0, padding: '13px 15px', borderRadius: '10px',
        border: active ? `1.5px solid ${accent}` : '1px solid #EBEBEB',
        background: active ? accent + '0A' : hov ? accent + '06' : '#FFF',
        borderTop: active ? `3px solid ${accent}` : `3px solid ${accent}`,
        boxShadow: active ? `0 0 0 2px ${accent}22` : '0 1px 3px rgba(0,0,0,0.04)',
        fontFamily: "'Work Sans', sans-serif",
        cursor: onClick ? 'pointer' : undefined,
        transition: 'all 120ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
        <span style={{ color: accent }}>{icon}</span>
        <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
      </div>
      <p style={{ fontSize: '24px', fontWeight: 900, color: '#111827', letterSpacing: '-0.04em', lineHeight: 1, margin: 0, fontFamily: "'DM Mono', monospace" }}>{value}</p>
    </div>
  );
}

function TabBtn({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 18px', borderRadius: '7px', border: 'none', background: active ? '#FFF' : 'transparent', color: active ? '#111827' : '#9CA3AF', cursor: 'pointer', fontSize: '12.5px', fontWeight: active ? 700 : 500, transition: 'all 120ms ease', fontFamily: "'Work Sans', sans-serif", flexShrink: 0, boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}
    >
      <span style={{ color: active ? '#2563EB' : '#D1D5DB' }}>{icon}</span>
      {label}
    </button>
  );
}

function ActionBtn({ label, icon, variant = 'ghost', onClick, disabled }: {
  label: string; icon: React.ReactNode;
  variant?: 'ghost' | 'danger';
  onClick: () => void; disabled?: boolean;
}) {
  const [hov, setHov] = useState(false);
  const variantStyle: React.CSSProperties = variant === 'danger'
    ? { background: hov ? '#B91C1C' : '#FEF2F2', color: hov ? '#FFF' : '#DC2626', border: '1px solid #FECACA' }
    : { background: hov ? '#F3F4F6' : '#FFF', color: '#374151', border: '1px solid #E5E7EB' };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '11.5px', fontWeight: 700, transition: 'all 120ms ease', fontFamily: "'Work Sans', sans-serif", opacity: disabled ? 0.4 : 1, ...variantStyle }}
    >
      {icon}{label}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────

export function GatesManagement() {
  const [activeTab,           setActiveTab]           = useState<'gates' | 'log'>('gates');
  const [isBootstrapping,     setIsBootstrapping]     = useState(false);
  const [isGatesLoading,      setIsGatesLoading]      = useState(false);
  const [isLogLoading,        setIsLogLoading]        = useState(false);
  const [isSaving,            setIsSaving]            = useState(false);
  const [communities,         setCommunities]         = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState('');
  const [clusters,            setClusters]            = useState<ClusterOption[]>([]);
  const [isClustersLoading,   setIsClustersLoading]   = useState(false);
  const [gates,               setGates]               = useState<GateRow[]>([]);
  const [stats,               setStats]               = useState<GateStats>(EMPTY_STATS);
  const [logFilters,          setLogFilters]          = useState({ gateId: 'all', from: '', to: '', qrType: 'all', status: 'all', page: 1 });
  const [logResult,           setLogResult]           = useState<{ data: GateLogItem[]; total: number }>({ data: [], total: 0 });
  const [logFiltersOpen,      setLogFiltersOpen]      = useState(false);
  const [drawerOpen,          setDrawerOpen]          = useState(false);
  const [editingGate,         setEditingGate]         = useState<GateRow | null>(null);
  const [form,                setForm]                = useState<GateFormState>(INITIAL_FORM);
  const [activeStatFilter,    setActiveStatFilter]    = useState<string | null>(null);

  const resetForm = () => { setEditingGate(null); setForm(INITIAL_FORM); };
  const openCreate = () => { resetForm(); setDrawerOpen(true); };
  const openEdit = (gate: GateRow) => {
    setEditingGate(gate);
    setForm({ name: gate.name, clusterId: gate.clusterIds?.[0] ?? '', allowedRoles: gate.allowedRoles, etaMinutes: gate.etaMinutes ? String(gate.etaMinutes) : '' });
    setDrawerOpen(true);
  };

  // ── Loaders ───────────────────────────────────────────────────

  const loadStats = useCallback(async (cid: string) => {
    try { setStats(await gatesService.getGateStats(cid)); }
    catch (e) { toast.error('Failed to load stats', { description: errorMessage(e) }); }
  }, []);

  const loadGates = useCallback(async (cid: string) => {
    setIsGatesLoading(true);
    try { setGates(await gatesService.listGates({ communityId: cid, includeInactive: true })); }
    catch (e) { toast.error('Failed to load gates', { description: errorMessage(e) }); }
    finally { setIsGatesLoading(false); }
  }, []);

  const loadLog = useCallback(async () => {
    if (!selectedCommunityId) return;
    setIsLogLoading(true);
    try {
      const r = await gatesService.listGateLog({
        communityId: selectedCommunityId,
        gateId:  logFilters.gateId  !== 'all' ? logFilters.gateId                                      : undefined,
        from:    logFilters.from    ? new Date(`${logFilters.from}T00:00:00`).toISOString()             : undefined,
        to:      logFilters.to      ? new Date(`${logFilters.to}T23:59:59.999`).toISOString()           : undefined,
        qrType:  logFilters.qrType  !== 'all' ? (logFilters.qrType  as QrType)             : undefined,
        status:  logFilters.status  !== 'all' ? (logFilters.status  as GateLogStatusFilter) : undefined,
        page: logFilters.page, limit: LOG_PAGE_SIZE,
      });
      setLogResult({ data: r.data, total: r.total });
    } catch (e) { toast.error('Failed to load gate log', { description: errorMessage(e) }); }
    finally { setIsLogLoading(false); }
  }, [logFilters, selectedCommunityId]);

  const loadClusters = useCallback(async (cid: string) => {
    if (!cid) { setClusters([]); return; }
    setIsClustersLoading(true);
    try { setClusters(await gatesService.listClusterOptions(cid)); }
    catch (e) { toast.error('Failed to load clusters', { description: errorMessage(e) }); }
    finally { setIsClustersLoading(false); }
  }, []);

  const bootstrap = useCallback(async () => {
    setIsBootstrapping(true);
    try {
      const opts = await gatesService.listCommunityOptions();
      setCommunities(opts);
      const first = opts[0]?.id ?? '';
      setSelectedCommunityId(first);
      if (first) await Promise.all([loadGates(first), loadStats(first), loadClusters(first)]);
    } catch (e) { toast.error('Failed to initialize', { description: errorMessage(e) }); }
    finally { setIsBootstrapping(false); }
  }, [loadGates, loadStats, loadClusters]);

  useEffect(() => { void bootstrap(); }, [bootstrap]);
  useEffect(() => {
    if (!selectedCommunityId) return;
    void Promise.all([loadGates(selectedCommunityId), loadStats(selectedCommunityId), loadClusters(selectedCommunityId)]).catch(
      (e: unknown) => toast.error('Failed to refresh', { description: errorMessage(e) }),
    );
  }, [selectedCommunityId, loadGates, loadStats, loadClusters]);
  useEffect(() => { void loadLog(); }, [loadLog]);

  // ── Actions ───────────────────────────────────────────────────

  const saveGate = async () => {
    if (!selectedCommunityId)      { toast.error('Select a community first'); return; }
    if (!form.name.trim())         { toast.error('Gate name is required'); return; }
    if (!form.allowedRoles.length) { toast.error('At least one role required'); return; }
    const eta = form.etaMinutes.trim();
    const etaMinutes = eta ? Number(eta) : undefined;
    if (etaMinutes !== undefined && (!Number.isInteger(etaMinutes) || etaMinutes < 1 || etaMinutes > 120)) {
      toast.error('ETA must be 1–120'); return;
    }
    setIsSaving(true);
    try {
      const clusterId = form.clusterId || undefined;
      if (editingGate) {
        await gatesService.updateGate(editingGate.id, { name: form.name.trim(), clusterIds: clusterId ? [clusterId] : [], allowedRoles: form.allowedRoles, etaMinutes });
        toast.success('Gate updated');
      } else {
        await gatesService.createGate({ communityId: selectedCommunityId, name: form.name.trim(), clusterIds: clusterId ? [clusterId] : [], allowedRoles: form.allowedRoles, etaMinutes });
        toast.success('Gate created');
      }
      setDrawerOpen(false);
      resetForm();
      await Promise.all([loadGates(selectedCommunityId), loadStats(selectedCommunityId)]);
    } catch (e) { toast.error('Failed to save gate', { description: errorMessage(e) }); }
    finally { setIsSaving(false); }
  };

  const deactivateGate = async (gate: GateRow) => {
    if (!window.confirm(`Deactivate "${gate.name}"?`)) return;
    try {
      await gatesService.removeGate(gate.id);
      toast.success('Gate deactivated');
      await Promise.all([loadGates(selectedCommunityId), loadStats(selectedCommunityId)]);
    } catch (e) { toast.error('Failed to deactivate', { description: errorMessage(e) }); }
  };

  const goToGateLog = (gateId: string) => {
    setActiveTab('log');
    setLogFilters((p) => ({ ...p, gateId, page: 1 }));
  };

  // ── Columns ───────────────────────────────────────────────────

  const gateColumns: DataTableColumn<GateRow>[] = [
    {
      key: 'name', header: 'Gate',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '7px', background: r.status === 'ACTIVE' ? '#ECFDF5' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <DoorOpen style={{ width: '13px', height: '13px', color: r.status === 'ACTIVE' ? '#059669' : '#9CA3AF' }} />
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827', margin: 0 }}>{r.name}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'roles', header: 'Allowed Roles',
      render: (r) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {r.allowedRoles.map((role) => <RoleChip key={role} role={role} />)}
        </div>
      ),
    },
    {
      key: 'eta', header: 'ETA',
      render: (r) => r.etaMinutes
        ? <span style={{ fontSize: '12px', fontFamily: "'DM Mono', monospace", color: '#374151' }}>{r.etaMinutes} min</span>
        : <span style={{ color: '#D1D5DB' }}>—</span>,
    },
    {
      key: 'status', header: 'Status',
      render: (r) => <StatusBadge value={r.status} />,
    },
    {
      key: 'actions', header: '',
      render: (r) => (
        <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
          <ActionBtn label="Edit"       icon={<Pencil style={{ width: '10px', height: '10px' }} />} onClick={() => openEdit(r)} />
          <ActionBtn label="Log"        icon={<Eye    style={{ width: '10px', height: '10px' }} />} onClick={() => goToGateLog(r.id)} />
          <ActionBtn label="Deactivate" icon={<Power  style={{ width: '10px', height: '10px' }} />} variant="danger" onClick={() => void deactivateGate(r)} disabled={r.status !== 'ACTIVE'} />
        </div>
      ),
    },
  ];

  const logRows = useMemo(() =>
    logResult.data.map((r) => ({
      ...r,
      statusLabel: r.checkedInAt && !r.checkedOutAt ? 'INSIDE' : 'EXITED',
    })),
  [logResult.data]);

  const logColumns: DataTableColumn<(typeof logRows)[number]>[] = [
    { key: 'time',     header: 'Time',      render: (r) => <span style={{ fontSize: '11.5px', color: '#9CA3AF', fontFamily: "'DM Mono', monospace" }}>{r.checkedInAt ? formatDateTime(r.checkedInAt) : '—'}</span> },
    { key: 'visitor',  header: 'Visitor',   render: (r) => <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{r.visitorName ?? '—'}</span> },
    { key: 'unit',     header: 'Unit',      render: (r) => <span style={{ fontSize: '12px', color: '#6B7280' }}>{r.unitNumber ?? '—'}</span> },
    {
      key: 'type', header: 'Type',
      render: (r) => {
        const m = ROLE_META[r.qrType as GateAccessRole] ?? { bg: '#F3F4F6', color: '#6B7280' };
        return <span style={{ padding: '2px 8px', borderRadius: '5px', fontSize: '10.5px', fontWeight: 700, background: m.bg, color: m.color, fontFamily: "'Work Sans', sans-serif" }}>{humanizeEnum(r.qrType)}</span>;
      },
    },
    { key: 'in',       header: 'Check In',  render: (r) => <span style={{ fontSize: '11px', color: '#9CA3AF', fontFamily: "'DM Mono', monospace" }}>{r.checkedInAt  ? formatDateTime(r.checkedInAt)  : '—'}</span> },
    { key: 'out',      header: 'Check Out', render: (r) => <span style={{ fontSize: '11px', color: '#9CA3AF', fontFamily: "'DM Mono', monospace" }}>{r.checkedOutAt ? formatDateTime(r.checkedOutAt) : '—'}</span> },
    {
      key: 'duration', header: 'Duration',
      render: (r) => r.durationMinutes !== null
        ? <span style={{ fontSize: '12px', fontFamily: "'DM Mono', monospace", color: '#374151' }}>{r.durationMinutes} min</span>
        : <span style={{ color: '#D1D5DB' }}>—</span>,
    },
    { key: 'operator', header: 'Operator',  render: (r) => <span style={{ fontSize: '12px', color: '#6B7280' }}>{r.gateOperatorName ?? '—'}</span> },
    { key: 'status',   header: 'Status',    render: (r) => <StatusBadge value={r.statusLabel} /> },
  ];

  const totalLogPages   = Math.max(1, Math.ceil(logResult.total / LOG_PAGE_SIZE));
  const logActiveFilters = [
    logFilters.gateId !== 'all',
    logFilters.from,
    logFilters.to,
    logFilters.qrType !== 'all',
    logFilters.status !== 'all',
  ].filter(Boolean).length;

  // ─────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif" }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 900, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>Gates</h1>
          <p style={{ marginTop: '4px', fontSize: '13px', color: '#6B7280', margin: '4px 0 0' }}>Manage entry points and monitor activity in real time.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <select
            value={selectedCommunityId || ''}
            onChange={(e) => setSelectedCommunityId(e.target.value)}
            style={{ ...selectStyle, width: '220px' }}
          >
            <option value=''>Select community</option>
            {communities.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <button
            type="button"
            onClick={() => void bootstrap()}
            disabled={isBootstrapping}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '7px', border: '1px solid #E5E7EB', background: '#FFF', color: '#6B7280', cursor: isBootstrapping ? 'not-allowed' : 'pointer' }}
          >
            <RefreshCw style={{ width: '13px', height: '13px', animation: isBootstrapping ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', overflowX: 'auto' }}>
        <GateStatCard title="Total Gates"      value={String(stats.totalGates)}      icon={<DoorOpen       style={{ width: '12px', height: '12px' }} />} accent="#2563EB"
          active={activeStatFilter === 'total'}
          onClick={() => { setActiveStatFilter(activeStatFilter === 'total' ? null : 'total'); setActiveTab('gates'); setLogFilters((p) => ({ ...p, qrType: 'all', status: 'all', page: 1 })); }}
        />
        <GateStatCard title="Active Gates"     value={String(stats.activeGates)}     icon={<DoorOpen       style={{ width: '12px', height: '12px' }} />} accent="#059669"
          active={activeStatFilter === 'active'}
          onClick={() => { setActiveStatFilter(activeStatFilter === 'active' ? null : 'active'); setActiveTab('gates'); setLogFilters((p) => ({ ...p, qrType: 'all', status: 'all', page: 1 })); }}
        />
        <GateStatCard title="Currently Inside" value={String(stats.currentlyInside)} icon={<Users          style={{ width: '12px', height: '12px' }} />} accent="#7C3AED"
          active={activeStatFilter === 'inside'}
          onClick={() => { setActiveStatFilter(activeStatFilter === 'inside' ? null : 'inside'); setActiveTab('log'); setLogFilters((p) => ({ ...p, qrType: 'all', status: 'INSIDE', page: 1 })); }}
        />
        <GateStatCard title="Today Entries"    value={String(stats.todayEntries)}    icon={<LogIn          style={{ width: '12px', height: '12px' }} />} accent="#0D9488"
          active={activeStatFilter === 'entries'}
          onClick={() => { setActiveStatFilter(activeStatFilter === 'entries' ? null : 'entries'); setActiveTab('log'); setLogFilters((p) => ({ ...p, qrType: 'all', status: 'all', page: 1 })); }}
        />
        <GateStatCard title="Today Visitors"   value={String(stats.todayVisitors)}   icon={<ArrowRightLeft style={{ width: '12px', height: '12px' }} />} accent="#D97706"
          active={activeStatFilter === 'visitors'}
          onClick={() => { setActiveStatFilter(activeStatFilter === 'visitors' ? null : 'visitors'); setActiveTab('log'); setLogFilters((p) => ({ ...p, qrType: 'VISITOR', status: 'all', page: 1 })); }}
        />
        <GateStatCard title="Today Deliveries" value={String(stats.todayDeliveries)} icon={<Truck          style={{ width: '12px', height: '12px' }} />} accent="#BE185D"
          active={activeStatFilter === 'deliveries'}
          onClick={() => { setActiveStatFilter(activeStatFilter === 'deliveries' ? null : 'deliveries'); setActiveTab('log'); setLogFilters((p) => ({ ...p, qrType: 'DELIVERY', status: 'all', page: 1 })); }}
        />
      </div>

      {/* ── Tab bar ────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '4px', borderRadius: '10px', background: '#F3F4F6', marginBottom: '16px' }}>
        <TabBtn label="Gates"     icon={<DoorOpen     style={{ width: '12px', height: '12px' }} />} active={activeTab === 'gates'} onClick={() => { setActiveTab('gates'); setActiveStatFilter(null); }} />
        <TabBtn label="Entry Log" icon={<CalendarDays style={{ width: '12px', height: '12px' }} />} active={activeTab === 'log'}   onClick={() => { setActiveTab('log'); setActiveStatFilter(null); }}   />
        <div style={{ marginLeft: 'auto', paddingRight: '4px' }}>
          <button
            type="button"
            onClick={openCreate}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '7px', background: '#111827', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}
          >
            <Plus style={{ width: '12px', height: '12px' }} /> Add Gate
          </button>
        </div>
      </div>

      {/* ══ Gates tab ════════════════════════════════════════ */}
      {activeTab === 'gates' && (
        <DataTable
          columns={gateColumns}
          rows={gates}
          rowKey={(r) => r.id}
          loading={isGatesLoading}
          emptyTitle="No gates found"
          emptyDescription="Add a gate to start managing entry points."
        />
      )}

      {/* ══ Log tab ══════════════════════════════════════════ */}
      {activeTab === 'log' && (
        <>
          {/* Filter bar */}
          <div style={{ borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FFF', overflow: 'hidden', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: logFiltersOpen ? '1px solid #F3F4F6' : 'none' }}>
              <select
                value={logFilters.gateId}
                onChange={(e) => setLogFilters((p) => ({ ...p, gateId: e.target.value, page: 1 }))}
                style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: logFilters.gateId === 'all' ? '#9CA3AF' : '#111827', fontFamily: "'Work Sans', sans-serif", cursor: 'pointer' }}
              >
                <option value="all">All gates</option>
                {gates.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button
                type="button"
                onClick={() => setLogFiltersOpen((p) => !p)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: `1px solid ${logActiveFilters > 0 ? '#2563EB40' : '#E5E7EB'}`, background: logActiveFilters > 0 ? '#EFF6FF' : '#FAFAFA', color: logActiveFilters > 0 ? '#2563EB' : '#6B7280', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif", flexShrink: 0 }}
              >
                <SlidersHorizontal style={{ width: '11px', height: '11px' }} />
                Filters
                {logActiveFilters > 0 && (
                  <span style={{ width: '15px', height: '15px', borderRadius: '50%', background: '#2563EB', color: '#FFF', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {logActiveFilters}
                  </span>
                )}
                <ChevronDown style={{ width: '10px', height: '10px', transform: logFiltersOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
              </button>
            </div>

            {logFiltersOpen && (
              <div style={{ padding: '10px 14px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '7px', border: '1px solid #E5E7EB', background: '#FAFAFA' }}>
                  <CalendarRange style={{ width: '11px', height: '11px', color: '#9CA3AF' }} />
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>FROM</span>
                  <input
                    type="date"
                    value={logFilters.from}
                    onChange={(e) => setLogFilters((p) => ({ ...p, from: e.target.value, page: 1 }))}
                    style={{ ...inputStyle, width: '130px', border: 'none', background: 'transparent', height: '26px', padding: '0 4px' }}
                  />
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>TO</span>
                  <input
                    type="date"
                    value={logFilters.to}
                    onChange={(e) => setLogFilters((p) => ({ ...p, to: e.target.value, page: 1 }))}
                    style={{ ...inputStyle, width: '130px', border: 'none', background: 'transparent', height: '26px', padding: '0 4px' }}
                  />
                </div>
                <select
                  value={logFilters.qrType}
                  onChange={(e) => setLogFilters((p) => ({ ...p, qrType: e.target.value, page: 1 }))}
                  style={{ ...selectStyle, width: '140px' }}
                >
                  <option value="all">All Types</option>
                  <option value="VISITOR">Visitor</option>
                  <option value="DELIVERY">Delivery</option>
                  <option value="WORKER">Worker</option>
                  <option value="RIDESHARE">Rideshare</option>
                </select>
                <select
                  value={logFilters.status}
                  onChange={(e) => setLogFilters((p) => ({ ...p, status: e.target.value, page: 1 }))}
                  style={{ ...selectStyle, width: '130px' }}
                >
                  <option value="all">All Statuses</option>
                  <option value="INSIDE">Inside</option>
                  <option value="EXITED">Exited</option>
                </select>
              </div>
            )}
          </div>

          {!isLogLoading && logRows.length === 0 ? (
            <EmptyState title="No log entries found" description="Try changing your gate, date, type, or status filters." />
          ) : (
            <>
              <DataTable
                columns={logColumns}
                rows={logRows}
                rowKey={(r) => r.id}
                loading={isLogLoading}
                emptyTitle="No log entries found"
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  disabled={logFilters.page <= 1}
                  onClick={() => setLogFilters((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', border: '1px solid #E5E7EB', background: logFilters.page <= 1 ? '#F9FAFB' : '#FFF', color: logFilters.page <= 1 ? '#D1D5DB' : '#374151', cursor: logFilters.page <= 1 ? 'not-allowed' : 'pointer', fontSize: '12px', fontFamily: "'Work Sans', sans-serif" }}
                >
                  <ChevronLeft style={{ width: '12px', height: '12px' }} /> Prev
                </button>
                <span style={{ fontSize: '12px', color: '#6B7280', fontFamily: "'DM Mono', monospace" }}>
                  {logFilters.page} / {totalLogPages}
                  <span style={{ color: '#D1D5DB', marginLeft: '6px' }}>({logResult.total})</span>
                </span>
                <button
                  type="button"
                  disabled={logFilters.page >= totalLogPages}
                  onClick={() => setLogFilters((p) => ({ ...p, page: Math.min(totalLogPages, p.page + 1) }))}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', border: '1px solid #E5E7EB', background: logFilters.page >= totalLogPages ? '#F9FAFB' : '#FFF', color: logFilters.page >= totalLogPages ? '#D1D5DB' : '#374151', cursor: logFilters.page >= totalLogPages ? 'not-allowed' : 'pointer', fontSize: '12px', fontFamily: "'Work Sans', sans-serif" }}
                >
                  Next <ChevronRight style={{ width: '12px', height: '12px' }} />
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* ══ Drawer ═══════════════════════════════════════════ */}
      <DrawerForm
        open={drawerOpen}
        onOpenChange={(open) => { setDrawerOpen(open); if (!open) resetForm(); }}
        title={editingGate ? 'Edit Gate' : 'Add Gate'}
        description="Configure gate details and allowed roles."
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setDrawerOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '7px', border: '1px solid #E5E7EB', background: '#FFF', color: '#6B7280', cursor: isSaving ? 'not-allowed' : 'pointer', fontSize: '12.5px', fontFamily: "'Work Sans', sans-serif" }}
            >
              <X style={{ width: '12px', height: '12px' }} /> Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void saveGate()}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 20px', borderRadius: '7px', background: isSaving ? '#9CA3AF' : '#111827', color: '#FFF', border: 'none', cursor: isSaving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}
            >
              <Check style={{ width: '13px', height: '13px' }} />
              {isSaving ? 'Saving…' : editingGate ? 'Save Changes' : 'Create Gate'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: "'Work Sans', sans-serif" }}>
          <Field label="Gate Name">
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Main Gate"
              style={inputStyle}
            />
          </Field>
          <Field label="Cluster" hint="Select the cluster this gate belongs to">
            <select
              value={form.clusterId}
              onChange={(e) => setForm((p) => ({ ...p, clusterId: e.target.value }))}
              disabled={isClustersLoading || clusters.length === 0}
              style={selectStyle}
            >
              <option value="">{isClustersLoading ? 'Loading clusters…' : clusters.length === 0 ? 'No clusters available' : 'Select cluster'}</option>
              {clusters.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="ETA Minutes" hint="Shown to visitors as estimated arrival time (1–120)">
            <input
              type="number"
              min={1}
              max={120}
              value={form.etaMinutes}
              onChange={(e) => setForm((p) => ({ ...p, etaMinutes: e.target.value }))}
              placeholder="10"
              style={{ ...inputStyle, width: '100px' }}
            />
          </Field>
          <Field label="Allowed Roles">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '10px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#FAFAFA' }}>
              {GATE_ACCESS_ROLES.map((role) => (
                <RoleToggle
                  key={role}
                  role={role}
                  active={form.allowedRoles.includes(role)}
                  onClick={() => setForm((p) => ({
                    ...p,
                    allowedRoles: p.allowedRoles.includes(role)
                      ? p.allowedRoles.filter((r) => r !== role)
                      : [...p.allowedRoles, role],
                  }))}
                />
              ))}
            </div>
            {form.allowedRoles.length === 0 && (
              <p style={{ fontSize: '11px', color: '#DC2626', marginTop: '4px', fontFamily: "'Work Sans', sans-serif" }}>
                At least one role must be selected
              </p>
            )}
          </Field>
        </div>
      </DrawerForm>
    </div>
  );
}
