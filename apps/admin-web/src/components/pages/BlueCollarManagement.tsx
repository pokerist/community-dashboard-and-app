import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check, Eye, Plus, RefreshCw, Trash2, X, HardHat, Users,
  Clock, Building2, CalendarDays, FileText, ChevronDown,
  SlidersHorizontal, Search, CheckCircle2, XCircle, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { DataTable, type DataTableColumn } from '../DataTable';
import { DrawerForm } from '../DrawerForm';
import { EmptyState } from '../EmptyState';
import { StatusBadge } from '../StatusBadge';
import blueCollarService, {
  type BlueCollarHoliday,
  type BlueCollarSettings,
  type BlueCollarTerms,
  type BlueCollarWorker,
  type BlueCollarWorkerDetail,
  type BlueCollarWorkerStats,
  type EntityStatus,
} from '../../lib/blue-collar-service';
import { errorMessage, formatDateTime, humanizeEnum } from '../../lib/live-data';

// ─── Constants ────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EMPTY_STATS: BlueCollarWorkerStats = {
  totalWorkers: 0, activeWorkers: 0, pendingApproval: 0, contractorCount: 0,
};

const ACCENTS = ['#0D9488', '#2563EB', '#BE185D'];

// ─── Shared styles ────────────────────────────────────────────

const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1px solid #E5E7EB', fontSize: '13px', color: '#111827', background: '#FFF', outline: 'none', fontFamily: "'Work Sans', sans-serif", boxSizing: 'border-box', height: '36px' };
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };
const textareaStyle: React.CSSProperties = { ...inputStyle, height: 'auto', minHeight: '240px', resize: 'vertical', fontFamily: "'DM Mono', monospace", fontSize: '12px', padding: '10px 12px' };

// ─── Primitives ───────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Work Sans', sans-serif" }}>{label}</label>
      {children}
    </div>
  );
}

function SectionCard({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{ borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FFF', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      {accent && <div style={{ height: '3px', background: accent }} />}
      <div style={{ padding: '18px 20px' }}>{children}</div>
    </div>
  );
}

function SectionTitle({ icon, title, badge }: { icon: React.ReactNode; title: string; badge?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        <span style={{ color: '#9CA3AF' }}>{icon}</span>
        <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#111827', letterSpacing: '-0.01em', fontFamily: "'Work Sans', sans-serif" }}>{title}</span>
      </div>
      {badge && <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px', background: '#F3F4F6', color: '#6B7280', fontFamily: "'DM Mono', monospace" }}>{badge}</span>}
    </div>
  );
}

function ActionBtn({ label, icon, variant = 'ghost', onClick, disabled }: { label: string; icon?: React.ReactNode; variant?: 'primary' | 'ghost' | 'danger' | 'success'; onClick: () => void; disabled?: boolean }) {
  const [hov, setHov] = useState(false);
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: hov ? '#1E3A8A' : '#2563EB', color: '#FFF', border: 'none' },
    ghost:   { background: hov ? '#F3F4F6' : '#FFF', color: '#374151', border: '1px solid #E5E7EB' },
    danger:  { background: hov ? '#B91C1C' : '#FEF2F2', color: hov ? '#FFF' : '#DC2626', border: '1px solid #FECACA' },
    success: { background: hov ? '#047857' : '#ECFDF5', color: hov ? '#FFF' : '#059669', border: '1px solid #A7F3D0' },
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 700, transition: 'all 120ms ease', fontFamily: "'Work Sans', sans-serif", opacity: disabled ? 0.5 : 1, ...styles[variant] }}>
      {icon}{label}
    </button>
  );
}

// ─── Stat card ────────────────────────────────────────────────

function WorkerStatCard({ title, value, icon, accent }: { title: string; value: string; icon: React.ReactNode; accent: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: '14px 16px', borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FFF', borderTop: `3px solid ${accent}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', fontFamily: "'Work Sans', sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px' }}>
        <span style={{ color: accent }}>{icon}</span>
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
      </div>
      <p style={{ fontSize: '26px', fontWeight: 900, color: '#111827', letterSpacing: '-0.04em', lineHeight: 1, margin: 0, fontFamily: "'DM Mono', monospace" }}>{value}</p>
    </div>
  );
}

// ─── Day toggle ───────────────────────────────────────────────

function DayToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ width: '38px', height: '38px', borderRadius: '8px', border: `1.5px solid ${active ? '#2563EB' : '#E5E7EB'}`, background: active ? '#2563EB' : '#FFF', color: active ? '#FFF' : '#9CA3AF', fontSize: '11px', fontWeight: 800, cursor: 'pointer', transition: 'all 120ms ease', fontFamily: "'Work Sans', sans-serif", letterSpacing: '0.02em' }}>
      {label}
    </button>
  );
}

// ─── Tab button ───────────────────────────────────────────────

function TabBtn({ label, icon, active, onClick, count }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void; count?: number }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '7px', border: 'none', background: active ? '#FFF' : 'transparent', color: active ? '#111827' : '#9CA3AF', cursor: 'pointer', fontSize: '12.5px', fontWeight: active ? 700 : 500, transition: 'all 120ms ease', fontFamily: "'Work Sans', sans-serif", flexShrink: 0, boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
      <span style={{ color: active ? '#2563EB' : '#D1D5DB' }}>{icon}</span>
      {label}
      {count !== undefined && count > 0 && (
        <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '1px 5px', borderRadius: '10px', background: active ? '#2563EB' : '#E5E7EB', color: active ? '#FFF' : '#6B7280', fontFamily: "'DM Mono', monospace" }}>{count}</span>
      )}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────

export function BlueCollarManagement() {
  const [activeTab, setActiveTab] = useState<'workers' | 'settings' | 'terms'>('workers');

  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isWorkersLoading, setIsWorkersLoading] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingTerms, setIsSavingTerms] = useState(false);
  const [isSavingHoliday, setIsSavingHoliday] = useState(false);

  const [communities, setCommunities] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState('');

  const [workers, setWorkers]  = useState<BlueCollarWorker[]>([]);
  const [stats, setStats]      = useState<BlueCollarWorkerStats>(EMPTY_STATS);
  const [settings, setSettings] = useState<BlueCollarSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState({ workingHoursStart: '07:00', workingHoursEnd: '18:00', allowedDays: [1, 2, 3, 4, 5] });

  const [holidays,   setHolidays]   = useState<BlueCollarHoliday[]>([]);
  const [newHoliday, setNewHoliday] = useState({ date: '', label: '' });

  const [terms,         setTerms]         = useState<BlueCollarTerms>({ terms: '', version: 1, updatedAt: null });
  const [isEditingTerms,setIsEditingTerms] = useState(false);
  const [termsDraft,    setTermsDraft]    = useState('');

  const [filters, setFilters] = useState({ contractorId: 'all', status: 'all', search: '' });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [workerDetailOpen, setWorkerDetailOpen] = useState(false);
  const [workerDetail,     setWorkerDetail]     = useState<BlueCollarWorkerDetail | null>(null);

  // ── Derived ───────────────────────────────────────────────────
  const contractorOptions = useMemo(() => {
    const m = new Map<string, string>();
    workers.forEach((w) => { if (!m.has(w.contractorName)) m.set(w.contractorName, w.contractorName); });
    return Array.from(m.values());
  }, [workers]);

  const filteredWorkers = useMemo(() => {
    const s = filters.search.trim().toLowerCase();
    return [...workers]
      .sort((a, b) => {
        const ap = a.accessProfileStatus === 'PENDING' ? 1 : 0;
        const bp = b.accessProfileStatus === 'PENDING' ? 1 : 0;
        return bp - ap || a.fullName.localeCompare(b.fullName);
      })
      .filter((w) =>
        (filters.contractorId === 'all' || w.contractorName === filters.contractorId) &&
        (filters.status === 'all' || w.status === filters.status) &&
        (!s || w.fullName.toLowerCase().includes(s) || w.nationalId.toLowerCase().includes(s))
      );
  }, [filters, workers]);

  const activeFilters = [filters.contractorId !== 'all', filters.status !== 'all', filters.search].filter(Boolean).length;

  // ── Loaders ───────────────────────────────────────────────────
  const bootstrap = useCallback(async () => {
    setIsBootstrapping(true);
    try {
      const opts = await blueCollarService.listCommunityOptions();
      setCommunities(opts);
      setSelectedCommunityId(opts[0]?.id ?? '');
    } catch (e) { toast.error('Failed to initialize', { description: errorMessage(e) }); }
    finally { setIsBootstrapping(false); }
  }, []);

  const loadWorkers = useCallback(async () => {
    if (!selectedCommunityId) { setWorkers([]); return; }
    setIsWorkersLoading(true);
    try { const r = await blueCollarService.listWorkers({ communityId: selectedCommunityId, limit: 100 }); setWorkers(r.data); }
    catch (e) { toast.error('Failed to load workers', { description: errorMessage(e) }); }
    finally { setIsWorkersLoading(false); }
  }, [selectedCommunityId]);

  const loadStats    = useCallback(async () => { if (!selectedCommunityId) { setStats(EMPTY_STATS); return; } try { setStats(await blueCollarService.getWorkerStats(selectedCommunityId)); } catch (e) { toast.error('Failed to load stats', { description: errorMessage(e) }); } }, [selectedCommunityId]);
  const loadSettings = useCallback(async () => { if (!selectedCommunityId) { setSettings(null); return; } try { const r = await blueCollarService.getSettings(selectedCommunityId); setSettings(r); if (r) setSettingsForm({ workingHoursStart: r.workingHoursStart, workingHoursEnd: r.workingHoursEnd, allowedDays: r.allowedDays }); } catch (e) { toast.error('Failed to load settings', { description: errorMessage(e) }); } }, [selectedCommunityId]);
  const loadHolidays = useCallback(async () => { if (!selectedCommunityId) { setHolidays([]); return; } try { setHolidays(await blueCollarService.listHolidays(selectedCommunityId, new Date().getFullYear())); } catch (e) { toast.error('Failed to load holidays', { description: errorMessage(e) }); } }, [selectedCommunityId]);
  const loadTerms    = useCallback(async () => { if (!selectedCommunityId) { setTerms({ terms: '', version: 1, updatedAt: null }); return; } try { const r = await blueCollarService.getTerms(selectedCommunityId); setTerms(r); setTermsDraft(r.terms); } catch (e) { toast.error('Failed to load terms', { description: errorMessage(e) }); } }, [selectedCommunityId]);

  useEffect(() => { void bootstrap(); }, [bootstrap]);
  useEffect(() => { if (!selectedCommunityId) return; void Promise.all([loadWorkers(), loadStats(), loadSettings(), loadHolidays(), loadTerms()]); }, [selectedCommunityId, loadWorkers, loadStats, loadSettings, loadHolidays, loadTerms]);

  // ── Actions ───────────────────────────────────────────────────
  const saveSettings = async () => {
    if (!selectedCommunityId) { toast.error('Select a community first'); return; }
    setIsSavingSettings(true);
    try { setSettings(await blueCollarService.upsertSettings(selectedCommunityId, settingsForm)); toast.success('Settings saved'); }
    catch (e) { toast.error('Failed to save settings', { description: errorMessage(e) }); }
    finally { setIsSavingSettings(false); }
  };

  const addHoliday = async () => {
    if (!selectedCommunityId || !newHoliday.date || !newHoliday.label.trim()) { toast.error('Holiday date and label required'); return; }
    setIsSavingHoliday(true);
    try { await blueCollarService.addHoliday(selectedCommunityId, { date: newHoliday.date, label: newHoliday.label.trim() }); setNewHoliday({ date: '', label: '' }); await loadHolidays(); toast.success('Holiday added'); }
    catch (e) { toast.error('Failed to add holiday', { description: errorMessage(e) }); }
    finally { setIsSavingHoliday(false); }
  };

  const removeHoliday = async (h: BlueCollarHoliday) => {
    if (!window.confirm(`Remove "${h.label}"?`)) return;
    try { await blueCollarService.removeHoliday(h.id); await loadHolidays(); toast.success('Holiday removed'); }
    catch (e) { toast.error('Failed to remove holiday', { description: errorMessage(e) }); }
  };

  const saveTerms = async () => {
    if (!selectedCommunityId || !termsDraft.trim()) { toast.error('Terms cannot be empty'); return; }
    setIsSavingTerms(true);
    try { const r = await blueCollarService.updateTerms(selectedCommunityId, termsDraft.trim()); setTerms(r); setIsEditingTerms(false); toast.success('Terms updated'); }
    catch (e) { toast.error('Failed to update terms', { description: errorMessage(e) }); }
    finally { setIsSavingTerms(false); }
  };

  const openWorkerDetail = async (workerId: string) => {
    try { const d = await blueCollarService.getWorkerDetail(workerId); setWorkerDetail(d); setWorkerDetailOpen(true); }
    catch (e) { toast.error('Failed to load worker detail', { description: errorMessage(e) }); }
  };

  const approveWorker = async (accessProfileId: string) => {
    if (!window.confirm('Approve this worker?')) return;
    try {
      await blueCollarService.approveWorkerAccess(accessProfileId);
      toast.success('Worker approved');
      await Promise.all([loadWorkers(), loadStats()]);
      if (workerDetail?.accessProfileId === accessProfileId) setWorkerDetail(await blueCollarService.getWorkerDetail(workerDetail.id));
    } catch (e) { toast.error('Failed to approve', { description: errorMessage(e) }); }
  };

  const rejectWorker = async (accessProfileId: string) => {
    const reason = window.prompt('Rejection reason');
    if (!reason?.trim()) return;
    try {
      await blueCollarService.rejectWorkerAccess(accessProfileId, reason.trim());
      toast.success('Worker rejected');
      await Promise.all([loadWorkers(), loadStats()]);
      if (workerDetail?.accessProfileId === accessProfileId) setWorkerDetail(await blueCollarService.getWorkerDetail(workerDetail.id));
    } catch (e) { toast.error('Failed to reject', { description: errorMessage(e) }); }
  };

  // ── Columns ───────────────────────────────────────────────────
  const workerColumns: DataTableColumn<BlueCollarWorker>[] = [
    { key: 'name', header: 'Worker', render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {r.accessProfileStatus === 'PENDING' && <AlertCircle style={{ width: '12px', height: '12px', color: '#D97706', flexShrink: 0 }} />}
        <div>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827', margin: 0 }}>{r.fullName}</p>
          <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0, fontFamily: "'DM Mono', monospace" }}>{r.nationalId}</p>
        </div>
      </div>
    )},
    { key: 'jobType',    header: 'Job Type',   render: (r) => <span style={{ fontSize: '12.5px', color: '#374151' }}>{r.jobType ?? '—'}</span> },
    { key: 'contractor', header: 'Contractor',  render: (r) => <span style={{ fontSize: '12.5px', color: '#374151' }}>{r.contractorName}</span> },
    { key: 'unit',       header: 'Unit',        render: (r) => <span style={{ fontSize: '12px', color: '#6B7280' }}>{r.unitNumber}</span> },
    { key: 'status',     header: 'Status',      render: (r) => <StatusBadge value={r.accessProfileStatus} /> },
    { key: 'actions',    header: '',            render: (r) => (
      <div style={{ display: 'flex', gap: '5px' }}>
        <ActionBtn label="View" icon={<Eye style={{ width: '10px', height: '10px' }} />} onClick={() => void openWorkerDetail(r.id)} />
        <ActionBtn label="Approve" icon={<CheckCircle2 style={{ width: '10px', height: '10px' }} />} variant="success" onClick={() => void approveWorker(r.accessProfileId)} disabled={r.accessProfileStatus !== 'PENDING'} />
        <ActionBtn label="Reject" icon={<XCircle style={{ width: '10px', height: '10px' }} />} variant="danger" onClick={() => void rejectWorker(r.accessProfileId)} disabled={r.accessProfileStatus !== 'PENDING'} />
      </div>
    )},
  ];

  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif" }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 900, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>Blue Collar</h1>
          <p style={{ marginTop: '4px', fontSize: '13px', color: '#6B7280' }}>Worker approvals, calendar settings, and terms &amp; conditions.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select value={selectedCommunityId || ''} onChange={(e) => setSelectedCommunityId(e.target.value)} style={{ ...selectStyle, width: '220px' }}>
            <option value=''>Select community</option>
            {communities.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <button type="button" onClick={() => void bootstrap()} disabled={isBootstrapping}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '7px', border: '1px solid #E5E7EB', background: '#FFF', color: '#6B7280', cursor: isBootstrapping ? 'not-allowed' : 'pointer', fontSize: '12px', fontFamily: "'Work Sans', sans-serif" }}>
            <RefreshCw style={{ width: '12px', height: '12px', animation: isBootstrapping ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* ── Stat strip ─────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', overflowX: 'auto' }}>
        <WorkerStatCard title="Total Workers"    value={String(stats.totalWorkers)}    icon={<HardHat  style={{ width: '13px', height: '13px' }} />} accent="#2563EB" />
        <WorkerStatCard title="Active"           value={String(stats.activeWorkers)}   icon={<Users    style={{ width: '13px', height: '13px' }} />} accent="#0D9488" />
        <WorkerStatCard title="Pending Approval" value={String(stats.pendingApproval)} icon={<Clock    style={{ width: '13px', height: '13px' }} />} accent="#D97706" />
        <WorkerStatCard title="Contractors"      value={String(stats.contractorCount)} icon={<Building2 style={{ width: '13px', height: '13px' }} />} accent="#BE185D" />
      </div>

      {/* ── Tab bar ────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '2px', padding: '4px', borderRadius: '10px', background: '#F3F4F6', marginBottom: '16px', overflowX: 'auto' }}>
        <TabBtn label="Workers"           icon={<HardHat    style={{ width: '12px', height: '12px' }} />} active={activeTab === 'workers'}  onClick={() => setActiveTab('workers')}  count={stats.pendingApproval} />
        <TabBtn label="Settings"          icon={<CalendarDays style={{ width: '12px', height: '12px' }} />} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        <TabBtn label="Terms & Conditions" icon={<FileText   style={{ width: '12px', height: '12px' }} />} active={activeTab === 'terms'}    onClick={() => setActiveTab('terms')}    />
      </div>

      {/* ══ Workers tab ══════════════════════════════════════ */}
      {activeTab === 'workers' && (
        <>
          {/* Filter bar */}
          <div style={{ borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FFF', overflow: 'hidden', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: filtersOpen ? '1px solid #F3F4F6' : 'none' }}>
              <Search style={{ width: '13px', height: '13px', color: '#9CA3AF', flexShrink: 0 }} />
              <input placeholder="Search name or national ID…" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: '#111827', fontFamily: "'Work Sans', sans-serif" }} />
              {stats.pendingApproval > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '5px', background: '#FEF3C7', color: '#D97706', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                  <AlertCircle style={{ width: '10px', height: '10px' }} />
                  {stats.pendingApproval} pending
                </div>
              )}
              <button type="button" onClick={() => setFiltersOpen((p) => !p)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: `1px solid ${activeFilters > 0 ? '#2563EB40' : '#E5E7EB'}`, background: activeFilters > 0 ? '#EFF6FF' : '#FAFAFA', color: activeFilters > 0 ? '#2563EB' : '#6B7280', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif" }}>
                <SlidersHorizontal style={{ width: '11px', height: '11px' }} />
                Filters
                {activeFilters > 0 && <span style={{ width: '15px', height: '15px', borderRadius: '50%', background: '#2563EB', color: '#FFF', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{activeFilters}</span>}
                <ChevronDown style={{ width: '10px', height: '10px', transform: filtersOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
              </button>
            </div>
            {filtersOpen && (
              <div style={{ padding: '10px 14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <select value={filters.contractorId} onChange={(e) => setFilters((p) => ({ ...p, contractorId: e.target.value }))} style={{ ...selectStyle, width: '180px' }}>
                  <option value="all">All Contractors</option>
                  {contractorOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))} style={{ ...selectStyle, width: '150px' }}>
                  <option value="all">All Statuses</option>
                  {(['ACTIVE', 'INACTIVE', 'SUSPENDED'] as EntityStatus[]).map((s) => <option key={s} value={s}>{humanizeEnum(s)}</option>)}
                </select>
              </div>
            )}
          </div>

          <DataTable columns={workerColumns} rows={filteredWorkers} rowKey={(r) => r.id} loading={isWorkersLoading} emptyTitle="No workers found" emptyDescription="No workers match the selected filters." />
        </>
      )}

      {/* ══ Settings tab ════════════════════════════════════ */}
      {activeTab === 'settings' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'start' }}>
          {/* Working hours */}
          <SectionCard accent={ACCENTS[1]}>
            <SectionTitle icon={<Clock style={{ width: '13px', height: '13px' }} />} title="Working Hours & Days" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <Field label="Start Time">
                <input type="time" value={settingsForm.workingHoursStart} onChange={(e) => setSettingsForm((p) => ({ ...p, workingHoursStart: e.target.value }))} style={inputStyle} />
              </Field>
              <Field label="End Time">
                <input type="time" value={settingsForm.workingHoursEnd} onChange={(e) => setSettingsForm((p) => ({ ...p, workingHoursEnd: e.target.value }))} style={inputStyle} />
              </Field>
            </div>
            <Field label="Allowed Days">
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                {DAY_LABELS.map((label, idx) => (
                  <DayToggle key={idx} label={label} active={settingsForm.allowedDays.includes(idx)}
                    onClick={() => setSettingsForm((p) => ({ ...p, allowedDays: p.allowedDays.includes(idx) ? p.allowedDays.filter((d) => d !== idx) : [...p.allowedDays, idx] }))} />
                ))}
              </div>
            </Field>
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" disabled={isSavingSettings} onClick={() => void saveSettings()}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 18px', borderRadius: '7px', background: isSavingSettings ? '#9CA3AF' : '#111827', color: '#FFF', border: 'none', cursor: isSavingSettings ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
                <Check style={{ width: '13px', height: '13px' }} />
                {isSavingSettings ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </SectionCard>

          {/* Holiday calendar */}
          <SectionCard accent={ACCENTS[0]}>
            <SectionTitle icon={<CalendarDays style={{ width: '13px', height: '13px' }} />} title="Holiday Calendar" badge={String(new Date().getFullYear())} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px', maxHeight: '260px', overflowY: 'auto' }}>
              {holidays.length === 0 ? (
                <p style={{ fontSize: '12.5px', color: '#9CA3AF', padding: '12px 0' }}>No holidays added yet.</p>
              ) : holidays.map((h) => (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '7px', border: '1px solid #EBEBEB', background: '#FAFAFA' }}>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0 }}>{h.label}</p>
                    <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '2px 0 0', fontFamily: "'DM Mono', monospace" }}>{formatDateTime(h.date)}</p>
                  </div>
                  <button type="button" onClick={() => void removeHoliday(h)}
                    style={{ width: '26px', height: '26px', borderRadius: '6px', border: '1px solid #FECACA', background: '#FFF5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#DC2626' }}>
                    <Trash2 style={{ width: '11px', height: '11px' }} />
                  </button>
                </div>
              ))}
            </div>
            {/* Add holiday row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', alignItems: 'end' }}>
              <Field label="Date">
                <input type="date" value={newHoliday.date} onChange={(e) => setNewHoliday((p) => ({ ...p, date: e.target.value }))} style={inputStyle} />
              </Field>
              <Field label="Label">
                <input value={newHoliday.label} onChange={(e) => setNewHoliday((p) => ({ ...p, label: e.target.value }))} placeholder="e.g. New Year's Day" style={inputStyle} />
              </Field>
              <button type="button" disabled={isSavingHoliday} onClick={() => void addHoliday()}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', borderRadius: '7px', background: isSavingHoliday ? '#9CA3AF' : ACCENTS[0], color: '#FFF', border: 'none', cursor: isSavingHoliday ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", height: '36px', flexShrink: 0 }}>
                <Plus style={{ width: '12px', height: '12px' }} />
                Add
              </button>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ══ Terms tab ════════════════════════════════════════ */}
      {activeTab === 'terms' && (
        <SectionCard accent={ACCENTS[2]}>
          <SectionTitle icon={<FileText style={{ width: '13px', height: '13px' }} />} title="Terms & Conditions" badge={`v${terms.version}`} />
          <p style={{ fontSize: '11.5px', color: '#9CA3AF', marginBottom: '12px', fontFamily: "'DM Mono', monospace" }}>
            Last updated: {terms.updatedAt ? formatDateTime(terms.updatedAt) : 'Not yet configured'}
          </p>
          {!isEditingTerms ? (
            <div style={{ borderRadius: '8px', border: '1px solid #EBEBEB', background: '#F9FAFB', padding: '14px 16px', whiteSpace: 'pre-wrap', fontSize: '13px', color: '#374151', lineHeight: '1.6', minHeight: '120px', fontFamily: "'DM Mono', monospace" }}>
              {terms.terms || <span style={{ color: '#D1D5DB' }}>No terms configured yet.</span>}
            </div>
          ) : (
            <textarea value={termsDraft} onChange={(e) => setTermsDraft(e.target.value)} style={textareaStyle} />
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
            {!isEditingTerms ? (
              <button type="button" onClick={() => setIsEditingTerms(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 16px', borderRadius: '7px', background: '#111827', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
                Edit Terms
              </button>
            ) : (
              <>
                <button type="button" onClick={() => { setTermsDraft(terms.terms); setIsEditingTerms(false); }}
                  style={{ padding: '7px 14px', borderRadius: '7px', border: '1px solid #E5E7EB', background: '#FFF', color: '#6B7280', cursor: 'pointer', fontSize: '12.5px', fontFamily: "'Work Sans', sans-serif" }}>
                  Cancel
                </button>
                <button type="button" disabled={isSavingTerms} onClick={() => void saveTerms()}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 18px', borderRadius: '7px', background: isSavingTerms ? '#9CA3AF' : '#111827', color: '#FFF', border: 'none', cursor: isSavingTerms ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
                  <Check style={{ width: '13px', height: '13px' }} />
                  {isSavingTerms ? 'Saving…' : 'Save Terms'}
                </button>
              </>
            )}
          </div>
        </SectionCard>
      )}

      {/* ══ Worker detail drawer ═════════════════════════════ */}
      <DrawerForm
        open={workerDetailOpen}
        onOpenChange={setWorkerDetailOpen}
        title="Worker Detail"
        description="Profile, contractor, unit, and access grant history."
        widthClassName="w-full sm:max-w-[520px]"
        footer={workerDetail ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
            <ActionBtn label="Reject" icon={<XCircle style={{ width: '12px', height: '12px' }} />} variant="danger" onClick={() => void rejectWorker(workerDetail.accessProfileId)} disabled={workerDetail.accessProfileStatus !== 'PENDING'} />
            <ActionBtn label="Approve" icon={<CheckCircle2 style={{ width: '12px', height: '12px' }} />} variant="success" onClick={() => void approveWorker(workerDetail.accessProfileId)} disabled={workerDetail.accessProfileStatus !== 'PENDING'} />
          </div>
        ) : null}
      >
        {!workerDetail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ height: '40px', borderRadius: '8px', background: '#F3F4F6' }} />)}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: "'Work Sans', sans-serif" }}>
            {/* Profile card */}
            <div style={{ borderRadius: '10px', border: '1px solid #EBEBEB', overflow: 'hidden' }}>
              <div style={{ height: '3px', background: 'linear-gradient(90deg, #2563EB, #0D9488)' }} />
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#EFF6FF', border: '1.5px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <HardHat style={{ width: '18px', height: '18px', color: '#2563EB' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '14.5px', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.01em' }}>{workerDetail.fullName}</p>
                  <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '3px 0 0', fontFamily: "'DM Mono', monospace" }}>{workerDetail.nationalId}</p>
                  {workerDetail.phone && <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '2px 0 0', fontFamily: "'DM Mono', monospace" }}>{workerDetail.phone}</p>}
                </div>
                <StatusBadge value={workerDetail.accessProfileStatus} />
              </div>
            </div>

            {/* Info grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                { label: 'Contractor', value: workerDetail.contractorName },
                { label: 'Unit',       value: workerDetail.unitNumber },
                { label: 'Job Type',   value: workerDetail.jobType ?? '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #EBEBEB', background: '#FAFAFA' }}>
                  <p style={{ fontSize: '10px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 3px' }}>{label}</p>
                  <p style={{ fontSize: '13px', color: '#111827', margin: 0, fontWeight: 600 }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Access grants */}
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Access Grants</p>
              {workerDetail.accessGrants.length === 0 ? (
                <EmptyState title="No access grants" description="No grant history available." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {workerDetail.accessGrants.map((g) => (
                    <div key={g.id} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #EBEBEB', background: '#FAFAFA' }}>
                      <p style={{ fontSize: '12.5px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>{g.permissions.join(', ')}</p>
                      <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0, fontFamily: "'DM Mono', monospace" }}>{formatDateTime(g.validFrom)} → {formatDateTime(g.validTo)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DrawerForm>
    </div>
  );
}