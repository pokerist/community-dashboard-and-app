import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw, Plus, Check, X, Search, FileText,
  Calendar, AlertCircle, DollarSign, Upload, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { StatCard } from '../StatCard';
import { DataTable, type DataTableColumn } from '../DataTable';
import { StatusBadge } from '../StatusBadge';
import apiClient from '../../lib/api-client';
import { errorMessage, formatCurrencyEGP, formatDate, humanizeEnum } from '../../lib/live-data';

// ─── Types ────────────────────────────────────────────────────

type OwnerOption   = { id: string; label: string };
type UnitOption    = { id: string; label: string };

type CreateLeaseForm = {
  unitId: string; ownerId: string;
  startDate: string; endDate: string;
  monthlyRent: string; securityDeposit: string;
  tenantEmail: string; tenantName: string;
  tenantPhone: string; tenantNationalId: string;
  contractFileId: string; nationalIdFileId: string;
  contractFile: File | null; nationalIdPhoto: File | null;
};

const INIT_FORM: CreateLeaseForm = {
  unitId: '', ownerId: '', startDate: '', endDate: '',
  monthlyRent: '', securityDeposit: '',
  tenantEmail: '', tenantName: '', tenantPhone: '', tenantNationalId: '',
  contractFileId: '', nationalIdFileId: '',
  contractFile: null, nationalIdPhoto: null,
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

function Field({ label, hint, required, span2, children }: {
  label: string; hint?: string; required?: boolean; span2?: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', gridColumn: span2 ? 'span 2' : undefined }}>
      <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Work Sans', sans-serif" }}>
        {label}{required && <span style={{ color: '#EF4444', marginLeft: '3px' }}>*</span>}
      </label>
      {hint && <p style={{ fontSize: '10.5px', color: '#B0B7C3', margin: 0 }}>{hint}</p>}
      {children}
    </div>
  );
}

function SectionLabel({ label, sub }: { label: string; sub?: string }) {
  return (
    <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '4px' }}>
      <span style={{ fontSize: '10px', fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.09em', whiteSpace: 'nowrap', fontFamily: "'Work Sans', sans-serif" }}>{label}</span>
      <div style={{ flex: 1, height: '1px', background: '#F0F0F0' }} />
      {sub && <span style={{ fontSize: '10px', color: '#C4C9D4', whiteSpace: 'nowrap', fontFamily: "'Work Sans', sans-serif" }}>{sub}</span>}
    </div>
  );
}

function FileField({ label, fileName, onChange, accept, hint }: {
  label: string; fileName?: string; onChange: (f: File | null) => void;
  accept?: string; hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '7px', border: `1.5px dashed ${fileName ? '#A7F3D0' : '#E5E7EB'}`, background: fileName ? '#F0FDF4' : '#FAFAFA', cursor: 'pointer', fontSize: '12px', color: fileName ? '#059669' : '#9CA3AF', fontFamily: "'Work Sans', sans-serif", transition: 'all 120ms' }}>
        {fileName
          ? <><Check style={{ width: '12px', height: '12px', flexShrink: 0 }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</span></>
          : <><Upload style={{ width: '12px', height: '12px', flexShrink: 0 }} /><span>Choose file…</span></>
        }
        <input type="file" accept={accept} style={{ display: 'none' }} onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      </label>
    </Field>
  );
}

// ─── Create Lease Modal ───────────────────────────────────────

function CreateLeaseModal({ open, onClose, unitOptions, ownerOptions, onCreated }: {
  open: boolean; onClose: () => void;
  unitOptions: UnitOption[]; ownerOptions: OwnerOption[];
  onCreated: () => void;
}) {
  const [form, setForm]       = useState<CreateLeaseForm>(INIT_FORM);
  const [saving, setSaving]   = useState(false);

  const set = <K extends keyof CreateLeaseForm>(key: K, val: CreateLeaseForm[K]) =>
    setForm((p) => ({ ...p, [key]: val }));

  const handleCreate = async () => {
    const required = [form.unitId, form.ownerId, form.startDate, form.endDate, form.monthlyRent, form.tenantEmail];
    if (required.some((v) => !String(v).trim())) { toast.error('Fill all required fields'); return; }
    const usingFiles = !!form.contractFile || !!form.nationalIdPhoto;
    const usingIds   = !!form.contractFileId.trim() && !!form.nationalIdFileId.trim();
    if (!usingFiles && !usingIds) { toast.error('Upload contract + national ID files, or provide existing file IDs'); return; }
    if (!usingIds && (!form.tenantName || !form.tenantPhone || !form.tenantNationalId)) {
      toast.error('For new tenant onboarding, provide name, phone, and national ID'); return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('unitId',      form.unitId);
      fd.append('ownerId',     form.ownerId);
      fd.append('startDate',   new Date(form.startDate).toISOString());
      fd.append('endDate',     new Date(form.endDate).toISOString());
      fd.append('monthlyRent', String(Number(form.monthlyRent)));
      if (form.securityDeposit)       fd.append('securityDeposit',  String(Number(form.securityDeposit)));
      fd.append('tenantEmail', form.tenantEmail.trim());
      if (form.tenantName.trim())        fd.append('tenantName',      form.tenantName.trim());
      if (form.tenantPhone.trim())       fd.append('tenantPhone',     form.tenantPhone.trim());
      if (form.tenantNationalId.trim())  fd.append('tenantNationalId', form.tenantNationalId.trim());
      if (form.contractFileId.trim())   fd.append('contractFileId',  form.contractFileId.trim());
      if (form.nationalIdFileId.trim()) fd.append('nationalIdFileId', form.nationalIdFileId.trim());
      if (form.contractFile)            fd.append('contractFile',    form.contractFile);
      if (form.nationalIdPhoto)         fd.append('nationalIdPhoto', form.nationalIdPhoto);
      await apiClient.post('/leases', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Lease created');
      setForm(INIT_FORM);
      onCreated();
      onClose();
    } catch (e) { toast.error('Failed to create lease', { description: errorMessage(e) }); }
    finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.4)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px' }}
    >
      <div style={{ width: '100%', maxWidth: '580px', background: '#FFF', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', fontFamily: "'Work Sans', sans-serif", display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        {/* Gradient strip */}
        <div style={{ height: '4px', background: 'linear-gradient(90deg, #2563EB 0%, #0D9488 100%)', flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FileText style={{ width: '15px', height: '15px', color: '#2563EB' }} />
            </div>
            <div>
              <p style={{ fontSize: '14.5px', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.01em' }}>Create Lease</p>
              <p style={{ fontSize: '11.5px', color: '#9CA3AF', margin: '2px 0 0' }}>New lease contract with tenant onboarding</p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #EBEBEB', background: '#FAFAFA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', flexShrink: 0 }}>
            <X style={{ width: '12px', height: '12px' }} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

            <SectionLabel label="Contract" />

            <Field label="Unit" required>
              <select value={form.unitId || ''} onChange={(e) => set('unitId', e.target.value)} style={selectStyle}>
                <option value=''>Select unit…</option>
                {unitOptions.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </Field>
            <Field label="Owner" required>
              <select value={form.ownerId || ''} onChange={(e) => set('ownerId', e.target.value)} style={selectStyle}>
                <option value=''>Select owner…</option>
                {ownerOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Start Date" required>
              <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="End Date" required>
              <input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Monthly Rent" required>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#9CA3AF', fontFamily: "'DM Mono', monospace", pointerEvents: 'none' }}>EGP</span>
                <input type="number" min="0" value={form.monthlyRent} onChange={(e) => set('monthlyRent', e.target.value)} placeholder="0.00"
                  style={{ ...inputStyle, paddingLeft: '42px', fontFamily: "'DM Mono', monospace" }} />
              </div>
            </Field>
            <Field label="Security Deposit" hint="Optional">
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#9CA3AF', fontFamily: "'DM Mono', monospace", pointerEvents: 'none' }}>EGP</span>
                <input type="number" min="0" value={form.securityDeposit} onChange={(e) => set('securityDeposit', e.target.value)} placeholder="0.00"
                  style={{ ...inputStyle, paddingLeft: '42px', fontFamily: "'DM Mono', monospace" }} />
              </div>
            </Field>

            <SectionLabel label="Tenant" sub="New or existing" />

            <Field label="Email" required span2>
              <input type="email" value={form.tenantEmail} onChange={(e) => set('tenantEmail', e.target.value)} placeholder="tenant@example.com" style={inputStyle} />
            </Field>
            <Field label="Full Name" hint="Required for new tenants">
              <input value={form.tenantName} onChange={(e) => set('tenantName', e.target.value)} placeholder="John Doe" style={inputStyle} />
            </Field>
            <Field label="Phone" hint="Required for new tenants">
              <input value={form.tenantPhone} onChange={(e) => set('tenantPhone', e.target.value)} placeholder="+201234567890" style={inputStyle} />
            </Field>
            <Field label="National ID" hint="Required for new tenants" span2>
              <input value={form.tenantNationalId} onChange={(e) => set('tenantNationalId', e.target.value)} placeholder="2980***********" style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }} />
            </Field>

            <SectionLabel label="Documents" sub="Upload files or use existing IDs" />

            <FileField label="Contract File" fileName={form.contractFile?.name} accept=".pdf,image/*" onChange={(f) => set('contractFile', f)} hint="PDF or image" />
            <FileField label="National ID Photo" fileName={form.nationalIdPhoto?.name} accept=".pdf,image/*" onChange={(f) => set('nationalIdPhoto', f)} hint="PDF or image" />
            <Field label="Contract File ID" hint="Existing UUID — replaces upload">
              <input value={form.contractFileId} onChange={(e) => set('contractFileId', e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" style={{ ...inputStyle, fontFamily: "'DM Mono', monospace", fontSize: '11.5px' }} />
            </Field>
            <Field label="National ID File ID" hint="Existing UUID — replaces upload">
              <input value={form.nationalIdFileId} onChange={(e) => set('nationalIdFileId', e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" style={{ ...inputStyle, fontFamily: "'DM Mono', monospace', fontSize: '11.5px'", fontSize: '11.5px' }} />
            </Field>

          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #F3F4F6', flexShrink: 0 }}>
          <button type="button" disabled={saving} onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#FFF', color: '#6B7280', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontFamily: "'Work Sans', sans-serif", fontWeight: 600 }}>
            <X style={{ width: '12px', height: '12px' }} /> Cancel
          </button>
          <button type="button" disabled={saving} onClick={() => void handleCreate()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '8px', background: saving ? '#9CA3AF' : '#111827', color: '#FFF', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: saving ? 'none' : '0 2px 6px rgba(0,0,0,0.18)' }}>
            <Check style={{ width: '13px', height: '13px' }} />
            {saving ? 'Creating…' : 'Create Lease'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────

export function LeaseManagement() {
  const [leasesData,    setLeasesData]    = useState<any[]>([]);
  const [ownerOptions,  setOwnerOptions]  = useState<OwnerOption[]>([]);
  const [unitOptions,   setUnitOptions]   = useState<UnitOption[]>([]);
  const [searchTerm,    setSearchTerm]    = useState('');
  const [isLoading,     setIsLoading]     = useState(false);
  const [loadError,     setLoadError]     = useState<string | null>(null);
  const [modalOpen,     setModalOpen]     = useState(false);

  const loadLeases = useCallback(async () => {
    setIsLoading(true); setLoadError(null);
    try {
      const [leasesRes, ownersRes, unitsRes] = await Promise.all([
        apiClient.get('/leases'),
        apiClient.get('/admin/users', { params: { userType: 'owner', take: 500, skip: 0 } }),
        apiClient.get('/units', { params: { page: 1, limit: 100 } }),
      ]);
      setLeasesData(Array.isArray(leasesRes.data) ? leasesRes.data : []);
      setOwnerOptions(
        (Array.isArray(ownersRes.data) ? ownersRes.data : []).map((u: any) => ({
          id: String(u.id),
          label: u.nameEN ?? u.email ?? u.phone ?? String(u.id),
        })),
      );
      const rawUnits = Array.isArray(unitsRes.data?.data) ? unitsRes.data.data
        : Array.isArray(unitsRes.data)                     ? unitsRes.data : [];
      setUnitOptions(
        rawUnits.map((u: any) => ({
          id: String(u.id),
          label: [u.projectName, u.block ? `Block ${u.block}` : null, u.unitNumber ? `Unit ${u.unitNumber}` : null].filter(Boolean).join(' – ') || String(u.id),
        })),
      );
    } catch (e) {
      const msg = errorMessage(e);
      setLoadError(msg);
      toast.error('Failed to load leases', { description: msg });
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { void loadLeases(); }, [loadLeases]);

  // ── Derived ───────────────────────────────────────────────────

  const filteredLeases = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return leasesData;
    return leasesData.filter((l) =>
      [l.leaseNumber, l.id, l.unit?.unitNumber, l.owner?.nameEN, l.tenant?.nameEN, l.tenantEmail, l.status]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [leasesData, searchTerm]);

  const activeLeases     = leasesData.filter((l) => String(l.status ?? '').toUpperCase() === 'ACTIVE');
  const expiringSoon     = leasesData.filter((l) => {
    const d = new Date(l.endDate ?? 0);
    if (Number.isNaN(d.getTime())) return false;
    const diff = (d.getTime() - Date.now()) / 86_400_000;
    return diff >= 0 && diff <= 30;
  });
  const overduePayments  = leasesData.filter((l) => ['OVERDUE', 'LATE'].includes(String(l.paymentStatus ?? '').toUpperCase()));
  const totalMonthlyRent = leasesData.reduce((s, l) => s + Number(l.monthlyRent ?? 0), 0);

  // ── Columns ───────────────────────────────────────────────────

  const columns: DataTableColumn<any>[] = [
    { key: 'id',       header: 'Lease',           render: (l) => (
      <div>
        <p style={{ fontSize: '12.5px', fontWeight: 700, color: '#111827', margin: 0, fontFamily: "'DM Mono', monospace" }}>{l.leaseNumber ?? l.id?.slice(0, 10)}</p>
      </div>
    )},
    { key: 'unit',     header: 'Unit',            render: (l) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 700, background: '#EFF6FF', color: '#2563EB', fontFamily: "'Work Sans', sans-serif" }}>
        {l.unit?.unitNumber ?? l.unitId ?? '—'}
      </span>
    )},
    { key: 'owner',    header: 'Owner',           render: (l) => <span style={{ fontSize: '12px', color: '#6B7280' }}>{l.owner?.nameEN ?? l.owner?.email ?? '—'}</span> },
    { key: 'tenant',   header: 'Tenant',          render: (l) => <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#111827' }}>{l.tenant?.nameEN ?? l.tenantEmail ?? '—'}</span> },
    { key: 'period',   header: 'Period',          render: (l) => (
      <div>
        <p style={{ fontSize: '11.5px', color: '#374151', margin: 0, fontFamily: "'DM Mono', monospace" }}>{formatDate(l.startDate)}</p>
        <p style={{ fontSize: '10.5px', color: '#9CA3AF', margin: '1px 0 0', fontFamily: "'DM Mono', monospace" }}>→ {formatDate(l.endDate)}</p>
      </div>
    )},
    { key: 'rent',     header: 'Monthly Rent',    render: (l) => (
      <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827', fontFamily: "'DM Mono', monospace" }}>
        {formatCurrencyEGP(l.monthlyRent)}
      </span>
    )},
    { key: 'status',   header: 'Status',          render: (l) => <StatusBadge value={l.status} /> },
    { key: 'payStatus',header: 'Payment',         render: (l) => <StatusBadge value={l.paymentStatus ?? 'UNKNOWN'} /> },
  ];

  // ─────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif" }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 900, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>Lease & Rental Management</h1>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '4px 0 0' }}>Live lease contracts and tenant data.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button type="button" onClick={() => void loadLeases()} disabled={isLoading}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '7px', border: '1px solid #E5E7EB', background: '#FFF', color: '#6B7280', cursor: isLoading ? 'not-allowed' : 'pointer' }}>
            <RefreshCw style={{ width: '13px', height: '13px', animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button type="button" onClick={() => setModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', height: '36px', borderRadius: '8px', background: '#111827', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
            <Plus style={{ width: '13px', height: '13px' }} /> Create Lease
          </button>
        </div>
      </div>

      {/* ── Error banner ───────────────────────────────────── */}
      {loadError && (
        <div style={{ marginBottom: '16px', padding: '12px 14px', borderRadius: '9px', border: '1px solid #FECACA', background: '#FEF2F2', color: '#991B1B', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle style={{ width: '14px', height: '14px', flexShrink: 0 }} />
          {loadError}
        </div>
      )}

      {/* ── Stats ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
        <StatCard icon="active-users"     title="Active Leases"       value={String(activeLeases.length)}        subtitle="Currently active contracts" />
        <StatCard icon="complaints-total" title="Expiring Soon"       value={String(expiringSoon.length)}        subtitle="Within the next 30 days" />
        <StatCard icon="complaints-open"  title="Overdue Payments"    value={String(overduePayments.length)}     subtitle="Late or overdue" />
        <StatCard icon="revenue"          title="Total Monthly Rent"  value={formatCurrencyEGP(totalMonthlyRent)} subtitle="Across all active leases" />
      </div>

      {/* ── Table card ─────────────────────────────────────── */}
      <div style={{ borderRadius: '12px', border: '1px solid #EBEBEB', background: '#FFF', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        {/* Search bar */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search style={{ width: '13px', height: '13px', color: '#C4C9D4', flexShrink: 0 }} />
          <input
            placeholder="Search by unit, owner, tenant, or status…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: '#111827', fontFamily: "'Work Sans', sans-serif" }}
          />
          {searchTerm && (
            <button type="button" onClick={() => setSearchTerm('')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: '#F3F4F6', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
              <X style={{ width: '10px', height: '10px' }} />
            </button>
          )}
        </div>

        <DataTable
          columns={columns}
          rows={filteredLeases}
          rowKey={(l) => l.id}
          loading={isLoading}
          emptyTitle="No leases found"
          emptyDescription="Create a lease or adjust your search."
        />
      </div>

      {/* ── Create modal ───────────────────────────────────── */}
      <CreateLeaseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        unitOptions={unitOptions}
        ownerOptions={ownerOptions}
        onCreated={() => void loadLeases()}
      />
    </div>
  );
}