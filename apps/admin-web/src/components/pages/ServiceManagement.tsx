import { EligibilityType, ServiceCategory, ServiceFieldType, ServiceRequestStatus } from '@prisma/client';
import { errorMessage, formatDateTime, humanizeEnum } from '../../lib/live-data';
import { DataTable, type DataTableColumn } from '../DataTable';
import { useEffect, useMemo, useState } from 'react';
import { StatusBadge } from '../StatusBadge';
import { DrawerForm } from '../DrawerForm';
import { StatCard } from '../StatCard';
import { toast } from 'sonner';
import {
  SlidersHorizontal, ChevronDown, ChevronLeft, ChevronRight,
  CircleDollarSign, Eye, Flame, Laptop, Plus, Shield,
  Sparkles, Trophy, Wrench, Check, X, Search,
  AlertTriangle, Clock,
} from 'lucide-react';
import { IconPicker, resolveIcon } from '../IconPicker';
import servicesService, {
  type AssigneeOption,
  type CreateMicroServiceInput,
  type DashboardRoleOption,
  type CreateServicePayload,
  type ServiceListItem,
  type ServiceRequestDetail,
  type ServiceRequestListItem,
  type ServiceStats,
} from '../../lib/servicesService';

// ─── Types ────────────────────────────────────────────────────

type ServiceManagementProps = { mode?: 'services' | 'requests' };
type RequestStatus   = 'ALL' | 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
type RequestPriority = 'ALL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type EditableField   = { id: string; label: string; type: ServiceFieldType; required: boolean };
type EditableMicroService = { id: string; name: string; price: string };

// ─── Constants ────────────────────────────────────────────────

const CATEGORY_OPTIONS: ServiceCategory[] = [
  ServiceCategory.MAINTENANCE, ServiceCategory.RECREATION, ServiceCategory.FITNESS,
  ServiceCategory.SECURITY,    ServiceCategory.ADMIN,       ServiceCategory.REQUESTS,
  ServiceCategory.FACILITIES,  ServiceCategory.OTHER,
];
const FIELD_TYPE_OPTIONS: ServiceFieldType[] = [
  ServiceFieldType.TEXT, ServiceFieldType.TEXTAREA, ServiceFieldType.NUMBER,
  ServiceFieldType.DATE, ServiceFieldType.BOOLEAN,  ServiceFieldType.MEMBER_SELECTOR, ServiceFieldType.FILE,
];
const PRIORITY_META: Record<string, { bg: string; color: string; dot: string }> = {
  CRITICAL: { bg: '#FEF2F2', color: '#DC2626', dot: '#EF4444' },
  HIGH:     { bg: '#FFF7ED', color: '#EA580C', dot: '#F97316' },
  MEDIUM:   { bg: '#FFFBEB', color: '#D97706', dot: '#F59E0B' },
  LOW:      { bg: '#F3F4F6', color: '#6B7280', dot: '#94A3B8' },
};
const CATEGORY_ACCENT: Record<string, string> = {
  MAINTENANCE: '#0D9488', RECREATION: '#2563EB', FITNESS: '#BE185D',
  SECURITY: '#7C3AED',   ADMIN: '#D97706',       REQUESTS: '#0891B2',
  FACILITIES: '#059669', OTHER: '#6B7280',
};

// ─── Helpers ──────────────────────────────────────────────────

const money = (v: number) => `EGP ${v.toLocaleString()}`;
const fmt   = (v?: string | null) => v ? formatDateTime(v) : '—';

function serviceIcon(iconName: string | null, category: ServiceCategory): React.ReactNode {
  const s = { width: '15px', height: '15px' };
  if (iconName) {
    const Resolved = resolveIcon(iconName);
    if (Resolved) return <Resolved style={s} />;
  }
  const k = (iconName ?? '').toLowerCase();
  if (k.includes('shield') || k.includes('security') || category === ServiceCategory.SECURITY) return <Shield style={s} />;
  if (k.includes('trophy') || k.includes('club'))     return <Trophy style={s} />;
  if (k.includes('sparkle') || k.includes('amenity')) return <Sparkles style={s} />;
  if (k.includes('laptop') || k.includes('it'))       return <Laptop style={s} />;
  if (k.includes('flame') || k.includes('gas'))       return <Flame style={s} />;
  if (k.includes('money') || k.includes('invoice') || k.includes('billing')) return <CircleDollarSign style={s} />;
  if (category === ServiceCategory.MAINTENANCE || category === ServiceCategory.FACILITIES) return <Wrench style={s} />;
  return <Plus style={s} />;
}

function slaProgressPercent(req: ServiceRequestDetail): number {
  const deadline = req.sla.deadline;
  if (!deadline) return 0;
  const start = new Date(req.createdAt).getTime();
  const end   = new Date(deadline).getTime();
  const total = end - start;
  if (total <= 0) return 100;
  return Math.round(Math.max(0, Math.min(1, (Date.now() - start) / total)) * 100);
}

function renderFieldValue(fv: ServiceRequestDetail['fieldValues'][number]): string {
  if (fv.type === ServiceFieldType.BOOLEAN) return fv.valueBool === null ? '—' : fv.valueBool ? 'Yes' : 'No';
  if (fv.type === ServiceFieldType.DATE)    return fv.valueDate ? formatDateTime(fv.valueDate) : '—';
  if (fv.type === ServiceFieldType.FILE)    return fv.fileAttachmentId ?? fv.valueText ?? '—';
  if (fv.valueNumber !== null)              return String(fv.valueNumber);
  return fv.valueText ?? '—';
}

function nextStatuses(cur: ServiceRequestStatus): ServiceRequestStatus[] {
  if (cur === ServiceRequestStatus.NEW)         return [ServiceRequestStatus.IN_PROGRESS, ServiceRequestStatus.CANCELLED];
  if (cur === ServiceRequestStatus.IN_PROGRESS) return [ServiceRequestStatus.RESOLVED,    ServiceRequestStatus.CANCELLED];
  if (cur === ServiceRequestStatus.RESOLVED)    return [ServiceRequestStatus.CLOSED,       ServiceRequestStatus.CANCELLED];
  return [];
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
  ...inputStyle, height: 'auto', minHeight: '76px', resize: 'vertical', padding: '9px 10px',
};

// ─── Primitives ───────────────────────────────────────────────

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ padding: '7px 18px', borderRadius: '7px', border: 'none', background: active ? '#FFF' : 'transparent', color: active ? '#111827' : '#9CA3AF', cursor: 'pointer', fontSize: '12.5px', fontWeight: active ? 700 : 500, transition: 'all 120ms', fontFamily: "'Work Sans', sans-serif", flexShrink: 0, boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
      {label}
    </button>
  );
}

function SmallTabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ padding: '5px 14px', borderRadius: '6px', border: 'none', background: active ? '#FFF' : 'transparent', color: active ? '#111827' : '#9CA3AF', cursor: 'pointer', fontSize: '12px', fontWeight: active ? 700 : 500, transition: 'all 120ms', fontFamily: "'Work Sans', sans-serif", flexShrink: 0, boxShadow: active ? '0 1px 3px rgba(0,0,0,0.07)' : 'none' }}>
      {label}
    </button>
  );
}

function GhostIconBtn({ icon, onClick }: { icon: React.ReactNode; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #EBEBEB', background: hov ? '#F3F4F6' : '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: hov ? '#374151' : '#9CA3AF', transition: 'all 120ms', flexShrink: 0 }}>
      {icon}
    </button>
  );
}

function Field({ label, required, span2, hint, children }: {
  label: string; required?: boolean; span2?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', gridColumn: span2 ? 'span 2' : undefined }}>
      <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Work Sans', sans-serif" }}>
        {label}{required && <span style={{ color: '#EF4444', marginLeft: '3px' }}>*</span>}
        {hint && <span style={{ fontWeight: 400, marginLeft: '6px', textTransform: 'none', letterSpacing: 0, color: '#C4C9D4' }}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '8px', margin: '2px 0' }}>
      <span style={{ fontSize: '10px', fontWeight: 800, color: '#C4C9D4', textTransform: 'uppercase', letterSpacing: '0.09em', whiteSpace: 'nowrap', fontFamily: "'Work Sans', sans-serif" }}>{label}</span>
      <div style={{ flex: 1, height: '1px', background: '#F0F0F0' }} />
    </div>
  );
}

function InfoPair({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #F0F0F0', background: '#FAFAFA' }}>
      <p style={{ fontSize: '9.5px', fontWeight: 700, color: '#C4C9D4', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 3px', fontFamily: "'Work Sans', sans-serif" }}>{label}</p>
      <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0, fontFamily: mono ? "'DM Mono', monospace" : "'Work Sans', sans-serif" }}>{value}</p>
    </div>
  );
}

function PriorityChip({ priority }: { priority: string }) {
  const m = PRIORITY_META[priority] ?? PRIORITY_META.LOW;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 8px', borderRadius: '5px', fontSize: '10.5px', fontWeight: 700, background: m.bg, color: m.color, fontFamily: "'Work Sans', sans-serif", whiteSpace: 'nowrap' }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
      {humanizeEnum(priority)}
    </span>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange}
      style={{ position: 'relative', width: '40px', height: '22px', borderRadius: '11px', border: `1.5px solid ${checked ? '#A7F3D0' : '#E5E7EB'}`, background: checked ? '#ECFDF5' : '#F9FAFB', cursor: 'pointer', transition: 'all 150ms', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: '2px', width: '16px', height: '16px', borderRadius: '50%', background: checked ? '#059669' : '#D1D5DB', left: checked ? '20px' : '2px', transition: 'left 150ms' }} />
    </button>
  );
}

function Pagination({ page, totalPages, total, onPrev, onNext }: {
  page: number; totalPages: number; total: number; onPrev: () => void; onNext: () => void;
}) {
  return (
    <div style={{ padding: '12px 14px', borderTop: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '11.5px', color: '#C4C9D4', fontFamily: "'DM Mono', monospace" }}>{total} records</span>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button type="button" disabled={page <= 1} onClick={onPrev}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', border: '1px solid #E5E7EB', background: page <= 1 ? '#F9FAFB' : '#FFF', color: page <= 1 ? '#D1D5DB' : '#374151', cursor: page <= 1 ? 'not-allowed' : 'pointer', fontSize: '12px', fontFamily: "'Work Sans', sans-serif" }}>
          <ChevronLeft style={{ width: '12px', height: '12px' }} /> Prev
        </button>
        <button type="button" disabled={page >= totalPages} onClick={onNext}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', border: '1px solid #E5E7EB', background: page >= totalPages ? '#F9FAFB' : '#FFF', color: page >= totalPages ? '#D1D5DB' : '#374151', cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontSize: '12px', fontFamily: "'Work Sans', sans-serif" }}>
          Next <ChevronRight style={{ width: '12px', height: '12px' }} />
        </button>
      </div>
    </div>
  );
}

function FilterBar({ search, setSearch, filtersOpen, setFiltersOpen, activeFilters, extra, children }: {
  search: string; setSearch: (v: string) => void;
  filtersOpen: boolean; setFiltersOpen: (v: boolean) => void;
  activeFilters: number; extra?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px' }}>
        <Search style={{ width: '13px', height: '13px', color: '#C4C9D4', flexShrink: 0 }} />
        <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: '#111827', fontFamily: "'Work Sans', sans-serif" }} />
        {extra}
        <button type="button" onClick={() => setFiltersOpen(!filtersOpen)}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: `1px solid ${activeFilters > 0 ? '#BFDBFE' : '#E5E7EB'}`, background: activeFilters > 0 ? '#EFF6FF' : '#FAFAFA', color: activeFilters > 0 ? '#2563EB' : '#6B7280', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif", flexShrink: 0 }}>
          <SlidersHorizontal style={{ width: '11px', height: '11px' }} />
          Filters
          {activeFilters > 0 && <span style={{ width: '15px', height: '15px', borderRadius: '50%', background: '#2563EB', color: '#FFF', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{activeFilters}</span>}
          <ChevronDown style={{ width: '10px', height: '10px', transform: filtersOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
        </button>
      </div>
      {filtersOpen && children && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Service Card ─────────────────────────────────────────────

function ServiceCard({ svc, onEdit, onToggle }: {
  svc: ServiceListItem; onEdit: () => void; onToggle: () => void;
}) {
  const accent = CATEGORY_ACCENT[svc.category] ?? '#6B7280';
  return (
    <div style={{ background: '#FFF', borderRadius: '12px', border: '1px solid #EBEBEB', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', fontFamily: "'Work Sans', sans-serif" }}>
      <div style={{ height: '3px', background: accent }} />
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
        {/* Icon + status */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, flexShrink: 0 }}>
            {serviceIcon(svc.iconName, svc.category)}
          </div>
          <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px', background: svc.status ? '#ECFDF5' : '#F3F4F6', color: svc.status ? '#059669' : '#9CA3AF' }}>
            {svc.status ? 'Active' : 'Inactive'}
          </span>
        </div>
        {/* Name */}
        <div>
          <p style={{ fontSize: '13.5px', fontWeight: 800, color: '#111827', margin: '0 0 3px', letterSpacing: '-0.01em' }}>
            {svc.name}
            {svc.microServicesCount > 0 && (
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', background: '#EFF6FF', color: '#2563EB', marginLeft: '6px' }}>
                {svc.microServicesCount} sub
              </span>
            )}
          </p>
          <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>
            {humanizeEnum(svc.category)}{svc.slaHours ? <span style={{ color: '#D1D5DB', marginLeft: '6px' }}>· {svc.slaHours}h SLA</span> : null}
          </p>
        </div>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div style={{ padding: '8px 10px', borderRadius: '8px', background: '#FAFAFA', border: '1px solid #F0F0F0' }}>
            <p style={{ fontSize: '9px', fontWeight: 700, color: '#C4C9D4', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 2px' }}>Requests</p>
            <p style={{ fontSize: '14px', fontWeight: 800, color: '#111827', margin: 0, fontFamily: "'DM Mono', monospace" }}>{svc.totalRequestsCount}</p>
          </div>
          <div style={{ padding: '8px 10px', borderRadius: '8px', background: '#FAFAFA', border: '1px solid #F0F0F0' }}>
            <p style={{ fontSize: '9px', fontWeight: 700, color: '#C4C9D4', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 2px' }}>Revenue</p>
            <p style={{ fontSize: '11.5px', fontWeight: 800, color: '#111827', margin: 0, fontFamily: "'DM Mono', monospace" }}>{money(svc.revenueTotal)}</p>
          </div>
        </div>
        <p style={{ fontSize: '11px', color: svc.assignedRoleName ? '#6B7280' : '#D1D5DB', margin: 0 }}>
          {svc.assignedRoleName ? `→ ${svc.assignedRoleName}` : 'Unassigned'}
        </p>
      </div>
      <div style={{ padding: '10px 16px', borderTop: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" onClick={onEdit}
          style={{ padding: '5px 14px', borderRadius: '6px', border: '1px solid #E5E7EB', background: '#FAFAFA', color: '#374151', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif" }}>
          Edit
        </button>
        <ToggleSwitch checked={svc.status} onChange={onToggle} />
      </div>
    </div>
  );
}

// ─── Service Form Drawer ──────────────────────────────────────

function ServiceFormDrawer({ open, onClose, editingId, onSaved, roleOptions }: {
  open: boolean; onClose: () => void; editingId: string | null;
  onSaved: () => void; roleOptions: DashboardRoleOption[];
}) {
  const [name,          setName]          = useState('');
  const [category,      setCategory]      = useState<ServiceCategory>(ServiceCategory.MAINTENANCE);
  const [description,   setDescription]   = useState('');
  const [slaHours,      setSlaHours]      = useState('');
  const [startingPrice, setStartingPrice] = useState('');
  const [roleId,        setRoleId]        = useState('UNASSIGNED');
  const [eligibility,   setEligibility]   = useState<EligibilityType>(EligibilityType.ALL);
  const [urgent,        setUrgent]        = useState(false);
  const [iconName,      setIconName]      = useState('');
  const [iconTone,      setIconTone]      = useState<string>('auto');
  const [fields,        setFields]        = useState<EditableField[]>([{ id: 'f1', label: '', type: ServiceFieldType.TEXT, required: false }]);
  const [microServices, setMicroServices] = useState<EditableMicroService[]>([]);
  const [saving,        setSaving]        = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!editingId) {
      setName(''); setCategory(ServiceCategory.MAINTENANCE); setDescription('');
      setSlaHours(''); setStartingPrice(''); setRoleId('UNASSIGNED');
      setEligibility(EligibilityType.ALL); setUrgent(false);
      setIconName(''); setIconTone('auto');
      setFields([{ id: `f-${Date.now()}`, label: '', type: ServiceFieldType.TEXT, required: false }]);
      setMicroServices([]);
      return;
    }
    void servicesService.getServiceDetail(editingId).then((d) => {
      setName(d.name); setCategory(d.category); setDescription(d.description ?? '');
      setSlaHours(d.slaHours ? String(d.slaHours) : '');
      setStartingPrice(d.startingPrice ? String(d.startingPrice) : '');
      setRoleId(d.assignedRoleId ?? 'UNASSIGNED');
      setEligibility(d.unitEligibility as EligibilityType); setUrgent(d.isUrgent);
      setIconName(d.iconName ?? ''); setIconTone(d.iconTone || 'auto');
      setFields(d.fields.length > 0
        ? d.fields.map((f) => ({ id: f.id, label: f.label, type: f.type as ServiceFieldType, required: f.required }))
        : [{ id: `f-${Date.now()}`, label: '', type: ServiceFieldType.TEXT, required: false }]);
      setMicroServices(d.microServices?.map((ms) => ({ id: ms.id, name: ms.name, price: ms.price != null ? String(ms.price) : '' })) ?? []);
    }).catch(() => toast.error('Failed to load service'));
  }, [open, editingId]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Service name is required'); return; }
    setSaving(true);
    const payload: CreateServicePayload = {
      name: name.trim(), category,
      description:    description.trim() || undefined,
      slaHours:       slaHours      ? Number(slaHours)       : undefined,
      startingPrice:  startingPrice ? Number(startingPrice)  : undefined,
      assignedRoleId: roleId !== 'UNASSIGNED' ? roleId       : undefined,
      unitEligibility: eligibility, isUrgent: urgent,
      iconName:  iconName.trim() || undefined,
      iconTone:  iconTone || undefined,
      fields: fields.filter((f) => f.label.trim()).map((f, i) => ({ label: f.label.trim(), type: f.type, required: f.required, order: i + 1 })),
      microServices: microServices.filter((ms) => ms.name.trim()).map((ms, i) => ({
        name: ms.name.trim(),
        price: ms.price ? Number(ms.price) : undefined,
        displayOrder: i + 1,
      })),
    };
    try {
      if (editingId) await servicesService.updateService(editingId, payload);
      else           await servicesService.createService(payload);
      toast.success('Service saved'); onSaved(); onClose();
    } catch (e) { toast.error('Failed to save service', { description: errorMessage(e) }); }
    finally { setSaving(false); }
  };

  const addField    = () => setFields((p) => [...p, { id: `f-${Date.now()}-${p.length}`, label: '', type: ServiceFieldType.TEXT, required: false }]);
  const removeField = (id: string) => setFields((p) => p.filter((f) => f.id !== id));
  const updateField = <K extends keyof EditableField>(id: string, k: K, v: EditableField[K]) =>
    setFields((p) => p.map((f) => f.id === id ? { ...f, [k]: v } : f));

  const addMicroService = () => setMicroServices((p) => [...p, { id: `ms-${Date.now()}-${p.length}`, name: '', price: '' }]);
  const removeMicroService = (id: string) => setMicroServices((p) => p.filter((ms) => ms.id !== id));
  const updateMicroService = <K extends keyof EditableMicroService>(id: string, k: K, v: EditableMicroService[K]) =>
    setMicroServices((p) => p.map((ms) => ms.id === id ? { ...ms, [k]: v } : ms));

  return (
    <DrawerForm
      open={open} onOpenChange={(v) => { if (!v) onClose(); }}
      title={editingId ? 'Edit Service' : 'Add Service'}
      description="Configure service details and dynamic form fields."
      widthClassName="w-full sm:max-w-[580px]"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
          <button type="button" disabled={saving} onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#FFF', color: '#6B7280', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontFamily: "'Work Sans', sans-serif", fontWeight: 600 }}>
            <X style={{ width: '12px', height: '12px' }} /> Cancel
          </button>
          <button type="button" disabled={saving} onClick={() => void handleSave()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '8px', background: saving ? '#9CA3AF' : '#111827', color: '#FFF', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: saving ? 'none' : '0 2px 6px rgba(0,0,0,0.15)' }}>
            <Check style={{ width: '13px', height: '13px' }} />{saving ? 'Saving…' : 'Save Service'}
          </button>
        </div>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <SectionDivider label="Basic Info" />

        <Field label="Service Name" required span2>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. AC Maintenance" style={inputStyle} />
        </Field>

        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value as ServiceCategory)} style={selectStyle}>
            {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{humanizeEnum(c)}</option>)}
          </select>
        </Field>

        <Field label="Icon" hint="pick an icon">
          <IconPicker value={iconName} onChange={setIconName} color={iconTone !== 'auto' ? { blue: '#3B82F6', green: '#10B981', orange: '#F59E0B', purple: '#8B5CF6', pink: '#F43F5E', teal: '#14B8A6' }[iconTone] ?? '#6B7280' : '#6B7280'} allowEmpty />
        </Field>

        <Field label="Color Tone" hint="for mobile app">
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingTop: '2px' }}>
            {([
              { tone: 'auto',   hex: '#6B7280' },
              { tone: 'blue',   hex: '#3B82F6' },
              { tone: 'green',  hex: '#10B981' },
              { tone: 'orange', hex: '#F59E0B' },
              { tone: 'purple', hex: '#8B5CF6' },
              { tone: 'pink',   hex: '#F43F5E' },
              { tone: 'teal',   hex: '#14B8A6' },
            ] as const).map(({ tone, hex }) => (
              <button key={tone} type="button" onClick={() => setIconTone(tone)}
                title={tone}
                style={{
                  width: '28px', height: '28px', borderRadius: '7px', border: iconTone === tone ? `2px solid ${hex}` : '2px solid #E5E7EB',
                  background: hex, cursor: 'pointer', flexShrink: 0, position: 'relative',
                  boxShadow: iconTone === tone ? `0 0 0 2px #FFF, 0 0 0 4px ${hex}` : 'none',
                  transition: 'all 120ms',
                }}>
                {iconTone === tone && (
                  <Check style={{ width: '14px', height: '14px', color: '#FFF', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
                )}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Description" span2>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe this service…" style={textareaStyle} />
        </Field>

        <SectionDivider label="Pricing & SLA" />

        <Field label="SLA Hours">
          <input type="number" min={1} value={slaHours} onChange={(e) => setSlaHours(e.target.value)} placeholder="24"
            style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }} />
        </Field>

        <Field label="Starting Price">
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#9CA3AF', fontFamily: "'DM Mono', monospace", pointerEvents: 'none' }}>EGP</span>
            <input type="number" min={0} value={startingPrice} onChange={(e) => setStartingPrice(e.target.value)} placeholder="0"
              style={{ ...inputStyle, paddingLeft: '42px', fontFamily: "'DM Mono', monospace" }} />
          </div>
        </Field>

        <SectionDivider label="Assignment & Eligibility" />

        <Field label="Assigned Role">
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)} style={selectStyle}>
            <option value="UNASSIGNED">Unassigned</option>
            {roleOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>

        <Field label="Unit Eligibility">
          <select value={eligibility} onChange={(e) => setEligibility(e.target.value as EligibilityType)} style={selectStyle}>
            <option value={EligibilityType.ALL}>All Units</option>
            <option value={EligibilityType.DELIVERED_ONLY}>Delivered Only</option>
            <option value={EligibilityType.NON_DELIVERED_ONLY}>Non-Delivered Only</option>
          </select>
        </Field>

        <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '9px', border: '1px solid #EBEBEB', background: '#FAFAFA' }}>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0 }}>Urgent Service</p>
            <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '2px 0 0' }}>Flag as high-priority for residents</p>
          </div>
          <ToggleSwitch checked={urgent} onChange={() => setUrgent((p) => !p)} />
        </div>

        <SectionDivider label="Micro-services" />

        <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {microServices.map((ms, idx) => (
            <div key={ms.id} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 120px auto', gap: '8px', alignItems: 'center' }}>
              <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                {String.fromCharCode(65 + idx)}
              </span>
              <input value={ms.name} onChange={(e) => updateMicroService(ms.id, 'name', e.target.value)} placeholder="e.g. Pipe Replacement" style={inputStyle} />
              <input type="number" min={0} value={ms.price} onChange={(e) => updateMicroService(ms.id, 'price', e.target.value)} placeholder="Price (optional)"
                style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }} />
              <button type="button" onClick={() => removeMicroService(ms.id)}
                style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #FECACA', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#DC2626', flexShrink: 0 }}>
                <X style={{ width: '11px', height: '11px' }} />
              </button>
            </div>
          ))}
          <button type="button" onClick={addMicroService}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '7px', border: '1px dashed #D1D5DB', background: '#FAFAFA', color: '#6B7280', cursor: 'pointer', fontSize: '12px', fontFamily: "'Work Sans', sans-serif" }}>
            <Plus style={{ width: '11px', height: '11px' }} /> Add Micro-service
          </button>
        </div>

        <SectionDivider label="Form Fields" />

        <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {fields.map((f) => (
            <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '1fr 148px auto auto', gap: '8px', alignItems: 'center' }}>
              <input value={f.label} onChange={(e) => updateField(f.id, 'label', e.target.value)} placeholder="Field label" style={inputStyle} />
              <select value={f.type} onChange={(e) => updateField(f.id, 'type', e.target.value as ServiceFieldType)} style={selectStyle}>
                {FIELD_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{humanizeEnum(t)}</option>)}
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: '#9CA3AF', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'Work Sans', sans-serif" }}>
                <input type="checkbox" checked={f.required} onChange={(e) => updateField(f.id, 'required', e.target.checked)} style={{ accentColor: '#2563EB' }} />
                Req
              </label>
              <button type="button" onClick={() => removeField(f.id)}
                style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #FECACA', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#DC2626', flexShrink: 0 }}>
                <X style={{ width: '11px', height: '11px' }} />
              </button>
            </div>
          ))}
          <button type="button" onClick={addField}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '7px', border: '1px dashed #D1D5DB', background: '#FAFAFA', color: '#6B7280', cursor: 'pointer', fontSize: '12px', fontFamily: "'Work Sans', sans-serif" }}>
            <Plus style={{ width: '11px', height: '11px' }} /> Add Field
          </button>
        </div>
      </div>
    </DrawerForm>
  );
}

// ─── Request Detail Content ───────────────────────────────────

function RequestDetailContent({ request, assigneeOptions, onReload }: {
  request: ServiceRequestDetail; assigneeOptions: AssigneeOption[]; onReload: () => void;
}) {
  const [subTab,      setSubTab]      = useState<'details' | 'comments' | 'invoices'>('details');
  const [assignToId,  setAssignToId]  = useState(request.assignee?.id ?? '');
  const [statusNote,  setStatusNote]  = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [invAmount,   setInvAmount]   = useState('');
  const [invDueDate,  setInvDueDate]  = useState('');
  const [localReq,    setLocalReq]    = useState(request);

  const refresh = async () => {
    const d = await servicesService.getRequestDetail(localReq.id);
    setLocalReq(d); onReload(); return d;
  };

  const slaPercent = slaProgressPercent(localReq);
  const isBreached = localReq.sla.status === 'BREACHED';
  const nexts      = nextStatuses(localReq.status);

  const invCols: DataTableColumn<typeof localReq.invoices[number]>[] = [
    { key: 'n', header: 'Invoice #', render: (i) => <span style={{ fontSize: '12px', fontFamily: "'DM Mono', monospace", color: '#6B7280' }}>{i.invoiceNumber}</span> },
    { key: 'a', header: 'Amount',    render: (i) => <span style={{ fontSize: '12.5px', fontWeight: 700, fontFamily: "'DM Mono', monospace", color: '#111827' }}>{money(i.amount)}</span> },
    { key: 's', header: 'Status',    render: (i) => <StatusBadge value={i.status} /> },
    { key: 'd', header: 'Due',       render: (i) => <span style={{ fontSize: '11px', color: '#9CA3AF', fontFamily: "'DM Mono', monospace" }}>{fmt(i.dueDate)}</span> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Heading */}
      <div>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: 900, color: '#111827', margin: 0, letterSpacing: '-0.03em' }}>{localReq.requestNumber}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
          <StatusBadge value={localReq.status} />
          <PriorityChip priority={localReq.priority} />
          {isBreached && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px', background: '#FEF2F2', color: '#DC2626' }}>
              <AlertTriangle style={{ width: '10px', height: '10px' }} /> SLA Breached
            </span>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '2px', padding: '3px', borderRadius: '8px', background: '#F3F4F6' }}>
        <SmallTabBtn label="Details"                                   active={subTab === 'details'}  onClick={() => setSubTab('details')} />
        <SmallTabBtn label={`Comments (${localReq.comments.length})`}  active={subTab === 'comments'} onClick={() => setSubTab('comments')} />
        <SmallTabBtn label={`Invoices (${localReq.invoices.length})`}  active={subTab === 'invoices'} onClick={() => setSubTab('invoices')} />
      </div>

      {/* ── Details ── */}
      {subTab === 'details' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <InfoPair label="Unit"      value={localReq.unit.unitNumber} />
            <InfoPair label="Requester" value={localReq.requester.name} />
            <InfoPair label="Phone"     value={localReq.requester.phone ?? '—'} />
            <InfoPair label="Submitted" value={fmt(localReq.createdAt)} mono />
          </div>

          {/* SLA progress */}
          {localReq.sla.deadline && (
            <div style={{ padding: '14px 16px', borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FFF', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Clock style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
                  <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: "'Work Sans', sans-serif" }}>SLA</span>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: "'DM Mono', monospace", color: isBreached ? '#DC2626' : '#059669' }}>
                  {isBreached ? `${localReq.sla.hoursOverdue ?? 0}h overdue` : `${localReq.sla.hoursRemaining ?? 0}h left`}
                </span>
              </div>
              <div style={{ height: '6px', borderRadius: '3px', background: '#F3F4F6', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '3px', width: `${slaPercent}%`, background: isBreached ? '#EF4444' : '#10B981', transition: 'width 300ms' }} />
              </div>
              <p style={{ fontSize: '11px', color: '#C4C9D4', margin: 0, fontFamily: "'DM Mono', monospace" }}>Deadline: {fmt(localReq.sla.deadline)}</p>
            </div>
          )}

          {/* Field values */}
          {localReq.fieldValues.length > 0 && (
            <div style={{ padding: '14px 16px', borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ fontSize: '10.5px', fontWeight: 700, color: '#C4C9D4', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0, fontFamily: "'Work Sans', sans-serif" }}>Form Responses</p>
              {localReq.fieldValues.map((fv) => (
                <div key={fv.fieldId} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '8px', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{fv.label}</span>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#111827' }}>{renderFieldValue(fv)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Assignment */}
          <div style={{ padding: '14px 16px', borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FFF', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ fontSize: '10.5px', fontWeight: 700, color: '#C4C9D4', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0, fontFamily: "'Work Sans', sans-serif" }}>Assignee</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={assignToId || 'UNASSIGNED'} onChange={(e) => setAssignToId(e.target.value === 'UNASSIGNED' ? '' : e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                <option value="UNASSIGNED">Unassigned</option>
                {assigneeOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <button type="button" disabled={!assignToId}
                onClick={() => void servicesService.assignRequest(localReq.id, { assignedToId: assignToId }).then((d) => { setLocalReq(d); onReload(); }).catch(() => toast.error('Failed to assign'))}
                style={{ padding: '0 16px', height: '36px', borderRadius: '7px', background: assignToId ? '#2563EB' : '#F3F4F6', color: assignToId ? '#FFF' : '#C4C9D4', border: 'none', cursor: assignToId ? 'pointer' : 'not-allowed', fontSize: '12.5px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", flexShrink: 0 }}>
                Assign
              </button>
            </div>
          </div>

          {/* Status */}
          {nexts.length > 0 && (
            <div style={{ padding: '14px 16px', borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FFF', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ fontSize: '10.5px', fontWeight: 700, color: '#C4C9D4', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0, fontFamily: "'Work Sans', sans-serif" }}>Status Actions</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {nexts.map((ns) => (
                  <button key={ns} type="button"
                    onClick={() => void servicesService.updateRequestStatus(localReq.id, { status: ns, notes: statusNote || undefined }).then((d) => { setLocalReq(d); setStatusNote(''); onReload(); }).catch(() => toast.error('Failed to update'))}
                    style={{ padding: '6px 14px', borderRadius: '7px', background: ns === ServiceRequestStatus.CANCELLED ? '#FEF2F2' : '#111827', color: ns === ServiceRequestStatus.CANCELLED ? '#DC2626' : '#FFF', border: ns === ServiceRequestStatus.CANCELLED ? '1px solid #FECACA' : 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
                    {humanizeEnum(ns)}
                  </button>
                ))}
              </div>
              <textarea value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="Internal notes…" style={{ ...textareaStyle, minHeight: '66px' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" disabled={!statusNote.trim()}
                  onClick={() => void servicesService.addInternalNote(localReq.id, statusNote.trim()).then((d) => { setLocalReq(d); setStatusNote(''); }).catch(() => toast.error('Failed to save note'))}
                  style={{ padding: '6px 14px', borderRadius: '7px', border: '1px solid #E5E7EB', background: '#FFF', color: '#374151', cursor: statusNote.trim() ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 600, fontFamily: "'Work Sans', sans-serif", opacity: statusNote.trim() ? 1 : 0.4 }}>
                  Save Note
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Comments ── */}
      {subTab === 'comments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {localReq.comments.length === 0
            ? <div style={{ padding: '24px', textAlign: 'center', color: '#C4C9D4', fontSize: '13px', fontFamily: "'Work Sans', sans-serif" }}>No comments yet.</div>
            : localReq.comments.map((c) => (
              <div key={c.id} style={{ padding: '12px 14px', borderRadius: '9px', border: '1px solid #EBEBEB', background: '#FFF', borderLeft: c.isInternal ? '3px solid #FDE68A' : '1px solid #EBEBEB' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#111827' }}>{c.authorName}</span>
                    {c.isInternal && <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' }}>Internal</span>}
                  </div>
                  <span style={{ fontSize: '11px', color: '#C4C9D4', fontFamily: "'DM Mono', monospace" }}>{fmt(c.createdAt)}</span>
                </div>
                <p style={{ fontSize: '12.5px', color: '#374151', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{c.body}</p>
              </div>
            ))
          }
          <div style={{ padding: '12px 14px', borderRadius: '9px', border: '1px solid #EBEBEB', background: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <textarea value={commentBody} onChange={(e) => setCommentBody(e.target.value)} placeholder="Write a comment or internal note…" style={{ ...textareaStyle, background: '#FFF' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" disabled={!commentBody.trim()}
                onClick={() => void servicesService.postComment(localReq.id, { body: commentBody, isInternal: false }).then(async () => { await refresh(); setCommentBody(''); }).catch(() => toast.error('Failed to post'))}
                style={{ padding: '6px 14px', borderRadius: '7px', border: '1px solid #E5E7EB', background: '#FFF', color: '#374151', cursor: commentBody.trim() ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 600, fontFamily: "'Work Sans', sans-serif", opacity: commentBody.trim() ? 1 : 0.4 }}>
                Post Comment
              </button>
              <button type="button" disabled={!commentBody.trim()}
                onClick={() => void servicesService.postComment(localReq.id, { body: commentBody, isInternal: true }).then(async () => { await refresh(); setCommentBody(''); }).catch(() => toast.error('Failed to post'))}
                style={{ padding: '6px 14px', borderRadius: '7px', background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A', cursor: commentBody.trim() ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", opacity: commentBody.trim() ? 1 : 0.4 }}>
                Internal Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invoices ── */}
      {subTab === 'invoices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <DataTable columns={invCols} rows={localReq.invoices} rowKey={(i) => i.id} emptyTitle="No invoices" emptyDescription="Create one below." />
          <div style={{ padding: '14px 16px', borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FFF', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ fontSize: '10.5px', fontWeight: 700, color: '#C4C9D4', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0, fontFamily: "'Work Sans', sans-serif" }}>Create Invoice</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#9CA3AF', fontFamily: "'DM Mono', monospace", pointerEvents: 'none' }}>EGP</span>
                <input type="number" min={1} value={invAmount} onChange={(e) => setInvAmount(e.target.value)} placeholder="Amount"
                  style={{ ...inputStyle, paddingLeft: '42px', fontFamily: "'DM Mono', monospace" }} />
              </div>
              <input type="date" value={invDueDate} onChange={(e) => setInvDueDate(e.target.value)} style={inputStyle} />
            </div>
            <button type="button"
              onClick={async () => {
                if (!invAmount || Number(invAmount) <= 0 || !invDueDate) { toast.error('Amount and due date are required'); return; }
                try {
                  await servicesService.createRequestInvoice(localReq.id, { amount: Number(invAmount), dueDate: new Date(invDueDate).toISOString() });
                  const d = await refresh(); setInvAmount(''); setInvDueDate('');
                  toast.success(`Invoice created for ${d.requestNumber}`);
                } catch { toast.error('Failed to create invoice'); }
              }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '8px 0', borderRadius: '8px', background: '#111827', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
              <Plus style={{ width: '12px', height: '12px' }} /> Create Invoice
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

export function ServiceManagement({ mode = 'services' }: ServiceManagementProps) {
  const [activeTab,       setActiveTab]       = useState<'catalog' | 'requests'>(mode === 'requests' ? 'requests' : 'catalog');
  const [loading,         setLoading]         = useState(false);
  const [stats,           setStats]           = useState<ServiceStats | null>(null);
  const [services,        setServices]        = useState<ServiceListItem[]>([]);
  const [requests,        setRequests]        = useState<ServiceRequestListItem[]>([]);
  const [roleOptions,     setRoleOptions]     = useState<DashboardRoleOption[]>([]);
  const [assigneeOptions, setAssigneeOptions] = useState<AssigneeOption[]>([]);

  // Catalog filters
  const [catSearch,   setCatSearch]   = useState('');
  const [catCategory, setCatCategory] = useState<'ALL' | ServiceCategory>('ALL');
  const [catStatus,   setCatStatus]   = useState<'all' | 'active' | 'inactive'>('all');

  // Request filters
  const [reqSearch,     setReqSearch]     = useState('');
  const [reqServiceId,  setReqServiceId]  = useState('ALL');
  const [reqStatus,     setReqStatus]     = useState<RequestStatus>('ALL');
  const [reqPriority,   setReqPriority]   = useState<RequestPriority>('ALL');
  const [slaBreached,   setSlaBreached]   = useState(false);
  const [reqPage,       setReqPage]       = useState(1);
  const [filtersOpen,   setFiltersOpen]   = useState(false);

  // Drawers
  const [svcDrawerOpen, setSvcDrawerOpen] = useState(false);
  const [editingSvcId,  setEditingSvcId]  = useState<string | null>(null);
  const [reqDrawerOpen, setReqDrawerOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState<ServiceRequestDetail | null>(null);
  const [reqDetailKey,  setReqDetailKey]  = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const [statsData, svcData, reqData] = await Promise.all([
        servicesService.getServiceStats(),
        servicesService.listServices({ status: catStatus, category: catCategory === 'ALL' ? undefined : catCategory, search: catSearch || undefined }),
        servicesService.listRequests({ serviceId: reqServiceId === 'ALL' ? undefined : reqServiceId, status: reqStatus === 'ALL' ? undefined : reqStatus, priority: reqPriority === 'ALL' ? undefined : reqPriority, search: reqSearch || undefined, slaBreached: slaBreached || undefined }),
      ]);
      setStats(statsData); setServices(svcData); setRequests(reqData);
      try { setRoleOptions(await servicesService.listAssignableRoles()); }  catch { setRoleOptions([]); }
      try { setAssigneeOptions(await servicesService.listAssignees()); }    catch { setAssigneeOptions([]); }
    } catch (e) { toast.error('Failed to load services', { description: errorMessage(e) }); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [catSearch, catCategory, catStatus, reqSearch, reqServiceId, reqStatus, reqPriority, slaBreached]);

  const openRequest = async (id: string) => {
    try {
      const d = await servicesService.getRequestDetail(id);
      setActiveRequest(d); setReqDetailKey((k) => k + 1); setReqDrawerOpen(true);
    } catch (e) { toast.error('Failed to load request', { description: errorMessage(e) }); }
  };

  const reqAvgResolution = useMemo(() => {
    const resolved = requests.filter((r) => r.slaStatus === 'RESOLVED');
    if (!resolved.length) return 0;
    return Math.round(resolved.reduce((s, r) => s + Math.abs(r.hoursRemaining ?? 0), 0) / resolved.length);
  }, [requests]);

  const PAGE_SIZE  = 25;
  const pagedReqs  = requests.slice((reqPage - 1) * PAGE_SIZE, reqPage * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(requests.length / PAGE_SIZE));
  const reqActiveFilters = [reqServiceId !== 'ALL', reqStatus !== 'ALL', reqPriority !== 'ALL'].filter(Boolean).length;

  const requestCols = useMemo<DataTableColumn<ServiceRequestListItem>[]>(() => [
    { key: 'n',  header: '#',         render: (r) => <span style={{ fontSize: '11.5px', fontFamily: "'DM Mono', monospace", color: '#6B7280' }}>{r.requestNumber}</span> },
    { key: 's',  header: 'Service',   render: (r) => <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#111827' }}>{r.serviceName}</span> },
    { key: 'u',  header: 'Unit',      render: (r) => <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '5px', fontSize: '10.5px', fontWeight: 700, background: '#EFF6FF', color: '#2563EB' }}>{r.unitNumber}</span> },
    { key: 'rq', header: 'Requester', render: (r) => <span style={{ fontSize: '12px', color: '#374151' }}>{r.requesterName}</span> },
    { key: 'as', header: 'Assignee',  render: (r) => <span style={{ fontSize: '12px', color: r.assigneeName ? '#374151' : '#D1D5DB' }}>{r.assigneeName ?? 'Unassigned'}</span> },
    { key: 'p',  header: 'Priority',  render: (r) => <PriorityChip priority={r.priority} /> },
    { key: 'sl', header: 'SLA',       render: (r) => {
      if (r.slaStatus === 'ON_TRACK') return <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#059669', fontFamily: "'DM Mono', monospace" }}>{r.hoursRemaining ?? 0}h left</span>;
      if (r.slaStatus === 'BREACHED') return <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#DC2626', fontFamily: "'DM Mono', monospace" }}>{Math.abs(r.hoursRemaining ?? 0)}h over</span>;
      if (r.slaStatus === 'RESOLVED') return <span style={{ fontSize: '11.5px', color: '#9CA3AF' }}>Resolved</span>;
      return <span style={{ color: '#D1D5DB' }}>—</span>;
    }},
    { key: 'st', header: 'Status',    render: (r) => <StatusBadge value={r.status} /> },
    { key: 'x',  header: '',          render: (r) => <div style={{ display: 'flex', justifyContent: 'flex-end' }}><GhostIconBtn icon={<Eye style={{ width: '11px', height: '11px' }} />} onClick={() => void openRequest(r.id)} /></div> },
  ], []);

  // ─────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif" }}>

      {/* ── Page header ─────────────────────────────────────── */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 900, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>Services</h1>
        <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '4px 0 0' }}>Manage your service catalog and incoming requests.</p>
      </div>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '4px', borderRadius: '10px', background: '#F3F4F6', marginBottom: '20px' }}>
        <TabBtn label="Service Catalog" active={activeTab === 'catalog'}  onClick={() => setActiveTab('catalog')} />
        <TabBtn label="Requests"        active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} />
        {activeTab === 'catalog' && (
          <button type="button" onClick={() => { setEditingSvcId(null); setSvcDrawerOpen(true); }}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', height: '36px', borderRadius: '8px', background: '#111827', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
            <Plus style={{ width: '13px', height: '13px' }} /> Add Service
          </button>
        )}
      </div>

      {/* ══ CATALOG ═══════════════════════════════════════════ */}
      {activeTab === 'catalog' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
            <StatCard icon="devices"         title="Total Services"  value={String(stats?.totalServices  ?? 0)} subtitle="All configured"    onClick={() => setCatStatus('all')} />
            <StatCard icon="active-users"    title="Active Services" value={String(stats?.activeServices ?? 0)} subtitle="Currently enabled" onClick={() => setCatStatus('active')} />
            <StatCard icon="complaints-open" title="Open Requests"   value={String(stats?.openRequests   ?? 0)} subtitle="Pending action"    onClick={() => { setActiveTab('requests'); setReqStatus('NEW'); setSlaBreached(false); setReqPage(1); }} />
            <StatCard icon="revenue"         title="Total Revenue"   value={money(stats?.totalRevenue    ?? 0)} subtitle="All time" />
          </div>

          {/* Filter bar */}
          <div style={{ borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FFF', padding: '10px 14px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <Search style={{ width: '13px', height: '13px', color: '#C4C9D4', flexShrink: 0 }} />
            <input placeholder="Search services…" value={catSearch} onChange={(e) => setCatSearch(e.target.value)}
              style={{ flex: 1, minWidth: '140px', border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: '#111827', fontFamily: "'Work Sans', sans-serif" }} />
            <select value={catCategory} onChange={(e) => setCatCategory(e.target.value as typeof catCategory)} style={{ ...selectStyle, width: '160px' }}>
              <option value="ALL">All Categories</option>
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{humanizeEnum(c)}</option>)}
            </select>
            <div style={{ display: 'flex', borderRadius: '7px', border: '1px solid #E5E7EB', overflow: 'hidden', flexShrink: 0 }}>
              {(['all', 'active', 'inactive'] as const).map((s, i) => (
                <button key={s} type="button" onClick={() => setCatStatus(s)}
                  style={{ padding: '6px 12px', border: 'none', background: catStatus === s ? '#111827' : '#FFF', color: catStatus === s ? '#FFF' : '#6B7280', fontSize: '11.5px', fontWeight: catStatus === s ? 700 : 500, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif", borderRight: i < 2 ? '1px solid #E5E7EB' : 'none', transition: 'all 120ms' }}>
                  {humanizeEnum(s)}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ height: '220px', borderRadius: '12px', background: '#F3F4F6', border: '1px solid #EBEBEB' }} />
              ))}
            </div>
          ) : services.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', borderRadius: '12px', border: '1px solid #EBEBEB', background: '#FFF', color: '#C4C9D4', fontSize: '13px' }}>No services match your filters.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
              {services.map((svc) => (
                <ServiceCard key={svc.id} svc={svc}
                  onEdit={() => { setEditingSvcId(svc.id); setSvcDrawerOpen(true); }}
                  onToggle={() => void servicesService.toggleService(svc.id).then(load).catch(() => toast.error('Failed to toggle'))}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ══ REQUESTS ══════════════════════════════════════════ */}
      {activeTab === 'requests' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
            <StatCard icon="complaints-open"   title="Open Requests"       value={String(stats?.openRequests          ?? 0)} subtitle="Pending action"  onClick={() => { setReqStatus('NEW'); setSlaBreached(false); setReqPage(1); }} />
            <StatCard icon="complaints-total"  title="SLA Breached"        value={String(stats?.slaBreachedRequests   ?? 0)} subtitle="Over deadline"   onClick={() => { setSlaBreached(true); setReqStatus('ALL'); setReqPage(1); }} />
            <StatCard icon="complaints-closed" title="Resolved This Month" value={String(stats?.resolvedThisMonth     ?? 0)} subtitle="Current month"   onClick={() => { setReqStatus('RESOLVED'); setSlaBreached(false); setReqPage(1); }} />
            <StatCard icon="tickets"           title="Avg Resolution"      value={`${reqAvgResolution}h`}                    subtitle="From resolved" />
          </div>

          <div style={{ borderRadius: '12px', border: '1px solid #EBEBEB', background: '#FFF', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <FilterBar
              search={reqSearch} setSearch={(v) => { setReqSearch(v); setReqPage(1); }}
              filtersOpen={filtersOpen} setFiltersOpen={setFiltersOpen} activeFilters={reqActiveFilters}
              extra={
                <button type="button" onClick={() => setSlaBreached((p) => !p)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${slaBreached ? '#FECACA' : '#E5E7EB'}`, background: slaBreached ? '#FEF2F2' : '#FAFAFA', color: slaBreached ? '#DC2626' : '#9CA3AF', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif", flexShrink: 0, transition: 'all 120ms' }}>
                  <AlertTriangle style={{ width: '10px', height: '10px' }} /> SLA Breached
                </button>
              }
            >
              <select value={reqServiceId} onChange={(e) => { setReqServiceId(e.target.value); setReqPage(1); }} style={{ ...selectStyle, width: '180px' }}>
                <option value="ALL">All Services</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={reqStatus} onChange={(e) => { setReqStatus(e.target.value as RequestStatus); setReqPage(1); }} style={{ ...selectStyle, width: '140px' }}>
                {(['ALL','NEW','IN_PROGRESS','RESOLVED','CLOSED','CANCELLED'] as RequestStatus[]).map((s) => (
                  <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : humanizeEnum(s)}</option>
                ))}
              </select>
              <select value={reqPriority} onChange={(e) => { setReqPriority(e.target.value as RequestPriority); setReqPage(1); }} style={{ ...selectStyle, width: '130px' }}>
                {(['ALL','LOW','MEDIUM','HIGH','CRITICAL'] as RequestPriority[]).map((p) => (
                  <option key={p} value={p}>{p === 'ALL' ? 'All Priorities' : humanizeEnum(p)}</option>
                ))}
              </select>
            </FilterBar>

            <DataTable
              columns={requestCols} rows={pagedReqs} rowKey={(r) => r.id} loading={loading}
              emptyTitle="No requests found" emptyDescription="Try adjusting your search or filters."
            />

            <Pagination
              page={reqPage} totalPages={totalPages} total={requests.length}
              onPrev={() => setReqPage((p) => Math.max(1, p - 1))}
              onNext={() => setReqPage((p) => Math.min(totalPages, p + 1))}
            />
          </div>
        </>
      )}

      {/* ══ Service form drawer ═══════════════════════════════ */}
      <ServiceFormDrawer
        open={svcDrawerOpen} onClose={() => setSvcDrawerOpen(false)}
        editingId={editingSvcId} onSaved={load} roleOptions={roleOptions}
      />

      {/* ══ Request detail drawer ═════════════════════════════ */}
      <DrawerForm
        open={reqDrawerOpen} onOpenChange={(v) => { if (!v) setReqDrawerOpen(false); }}
        title={activeRequest?.service.name ?? 'Request Detail'}
        description="Review and process this service request."
        widthClassName="w-full sm:max-w-[560px]"
      >
        {activeRequest
          ? <RequestDetailContent key={reqDetailKey} request={activeRequest} assigneeOptions={assigneeOptions} onReload={load} />
          : <div style={{ padding: '40px', textAlign: 'center', color: '#C4C9D4', fontSize: '13px' }}>No request selected.</div>
        }
      </DrawerForm>
    </div>
  );
}