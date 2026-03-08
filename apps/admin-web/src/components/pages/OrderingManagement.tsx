import { useEffect, useMemo, useState } from 'react';
import { OrderStatus } from '@prisma/client';
import {
  Check, ChefHat, ChevronDown, ChevronLeft, ChevronRight,
  CalendarRange, Edit2, Eye, Plus, Search, SlidersHorizontal,
  Truck, X, UtensilsCrossed,
} from 'lucide-react';
import { toast } from 'sonner';
import { StatCard } from '../StatCard';
import { DataTable, type DataTableColumn } from '../DataTable';
import { DrawerForm } from '../DrawerForm';
import { EmptyState } from '../EmptyState';
import { StatusBadge } from '../StatusBadge';
import orderingService, {
  type OrderDetail,
  type OrderListItem,
  type OrderStats,
  type RestaurantDetail,
  type RestaurantListItem,
} from '../../lib/orderingService';

// ─── Constants ────────────────────────────────────────────────

const PIPELINE_STAGES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.DELIVERED,
];

const STAGE_META: Record<OrderStatus, { color: string; bg: string; dot: string }> = {
  PENDING:   { color: '#D97706', bg: '#FFFBEB', dot: '#F59E0B' },
  CONFIRMED: { color: '#2563EB', bg: '#EFF6FF', dot: '#3B82F6' },
  PREPARING: { color: '#7C3AED', bg: '#F5F3FF', dot: '#8B5CF6' },
  DELIVERED: { color: '#059669', bg: '#ECFDF5', dot: '#10B981' },
  CANCELLED: { color: '#DC2626', bg: '#FEF2F2', dot: '#EF4444' },
};

const fmtDate     = (v?: string | null) => v ? new Date(v).toLocaleDateString()  : '—';
const fmtDateTime = (v?: string | null) => v ? new Date(v).toLocaleString()      : '—';
const money       = (v: number)          => `EGP ${v.toLocaleString()}`;
const fmtRelative = (v: string) => {
  const mins = Math.max(1, Math.floor((Date.now() - new Date(v).getTime()) / 60000));
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const getNextStatus = (s: OrderStatus): OrderStatus | null => {
  if (s === OrderStatus.PENDING)   return OrderStatus.CONFIRMED;
  if (s === OrderStatus.CONFIRMED) return OrderStatus.PREPARING;
  if (s === OrderStatus.PREPARING) return OrderStatus.DELIVERED;
  return null;
};

const quickLabel = (s: OrderStatus): string | null => {
  if (s === OrderStatus.PENDING)   return 'Confirm';
  if (s === OrderStatus.CONFIRMED) return 'Start Preparing';
  if (s === OrderStatus.PREPARING) return 'Mark Delivered';
  return null;
};

// ─── Types ────────────────────────────────────────────────────

type MainTab = 'orders' | 'restaurants';
type RestaurantStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

type RestaurantForm = { name: string; description: string; category: string };
type MenuItemForm   = { id?: string; name: string; description: string; price: string; category: string };

const EMPTY_RESTAURANT: RestaurantForm = { name: '', description: '', category: '' };
const EMPTY_MENU_ITEM: MenuItemForm    = { name: '', description: '', price: '', category: '' };

// ─── Shared styles ────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: '7px',
  border: '1px solid #E5E7EB', fontSize: '13px', color: '#111827',
  background: '#FFF', outline: 'none', fontFamily: "'Work Sans', sans-serif",
  boxSizing: 'border-box', height: '36px',
};
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };
const textareaStyle: React.CSSProperties = {
  ...inputStyle, height: 'auto', minHeight: '80px', resize: 'vertical', padding: '9px 10px',
};

// ─── Primitives ───────────────────────────────────────────────

function TabBtn({ label, active, onClick, count }: {
  label: string; active: boolean; onClick: () => void; count?: number;
}) {
  return (
    <button type="button" onClick={onClick}
      style={{ padding: '7px 18px', borderRadius: '7px', border: 'none', background: active ? '#FFF' : 'transparent', color: active ? '#111827' : '#9CA3AF', cursor: 'pointer', fontSize: '12.5px', fontWeight: active ? 700 : 500, transition: 'all 120ms ease', fontFamily: "'Work Sans', sans-serif", flexShrink: 0, boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
      {label}
      {count !== undefined && count > 0 && (
        <span style={{ minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '9px', background: active ? '#2563EB' : '#E5E7EB', color: active ? '#FFF' : '#6B7280', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {count}
        </span>
      )}
    </button>
  );
}

function SmallTabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ padding: '5px 14px', borderRadius: '6px', border: 'none', background: active ? '#FFF' : 'transparent', color: active ? '#111827' : '#9CA3AF', cursor: 'pointer', fontSize: '12px', fontWeight: active ? 700 : 500, transition: 'all 120ms ease', fontFamily: "'Work Sans', sans-serif", flexShrink: 0, boxShadow: active ? '0 1px 3px rgba(0,0,0,0.07)' : 'none' }}>
      {label}
    </button>
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

function InfoPair({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #F0F0F0', background: '#FAFAFA' }}>
      <p style={{ fontSize: '9.5px', fontWeight: 700, color: '#C4C9D4', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 3px', fontFamily: "'Work Sans', sans-serif" }}>{label}</p>
      <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0, fontFamily: mono ? "'DM Mono', monospace" : "'Work Sans', sans-serif" }}>{value}</p>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0' }}>
      <span style={{ fontSize: '10px', fontWeight: 800, color: '#C4C9D4', textTransform: 'uppercase', letterSpacing: '0.09em', whiteSpace: 'nowrap', fontFamily: "'Work Sans', sans-serif" }}>{label}</span>
      <div style={{ flex: 1, height: '1px', background: '#F0F0F0' }} />
    </div>
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
      <span style={{ fontSize: '11.5px', color: '#C4C9D4', fontFamily: "'DM Mono', monospace" }}>
        Page {page} of {totalPages} <span style={{ color: '#E5E7EB' }}>({total})</span>
      </span>
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

function FilterBar({
  search, setSearch, extra, filtersOpen, setFiltersOpen, activeFilters, children,
}: {
  search: string; setSearch: (v: string) => void;
  extra?: React.ReactNode;
  filtersOpen: boolean; setFiltersOpen: (v: boolean) => void; activeFilters: number;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ borderBottom: filtersOpen ? '1px solid #F3F4F6' : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px' }}>
        <Search style={{ width: '13px', height: '13px', color: '#C4C9D4', flexShrink: 0 }} />
        <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: '#111827', fontFamily: "'Work Sans', sans-serif" }} />
        {extra}
        <button type="button" onClick={() => setFiltersOpen(!filtersOpen)}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: `1px solid ${activeFilters > 0 ? '#2563EB40' : '#E5E7EB'}`, background: activeFilters > 0 ? '#EFF6FF' : '#FAFAFA', color: activeFilters > 0 ? '#2563EB' : '#6B7280', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif", flexShrink: 0 }}>
          <SlidersHorizontal style={{ width: '11px', height: '11px' }} />
          Filters
          {activeFilters > 0 && (
            <span style={{ width: '15px', height: '15px', borderRadius: '50%', background: '#2563EB', color: '#FFF', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {activeFilters}
            </span>
          )}
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

function DateRangePill({ from, to, onFrom, onTo }: {
  from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '7px', border: '1px solid #E5E7EB', background: '#FAFAFA' }}>
      <CalendarRange style={{ width: '11px', height: '11px', color: '#C4C9D4' }} />
      <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>FROM</span>
      <input type="date" value={from} onChange={(e) => onFrom(e.target.value)}
        style={{ width: '120px', border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', color: '#374151', fontFamily: "'Work Sans', sans-serif" }} />
      <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>TO</span>
      <input type="date" value={to} onChange={(e) => onTo(e.target.value)}
        style={{ width: '120px', border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', color: '#374151', fontFamily: "'Work Sans', sans-serif" }} />
    </div>
  );
}

// ─── Pipeline Bar ─────────────────────────────────────────────

function PipelineBar({ stats, activeStatus, onClickStage }: {
  stats: OrderStats | null;
  activeStatus: string;
  onClickStage: (s: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '12px 14px', borderBottom: '1px solid #F3F4F6', overflowX: 'auto' }}>
      {PIPELINE_STAGES.map((stage, i) => {
        const count  = stats?.byStatus?.[stage] ?? 0;
        const meta   = STAGE_META[stage];
        const active = activeStatus === stage;
        return (
          <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <button type="button" onClick={() => onClickStage(active ? 'ALL' : stage)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 20px', borderRadius: '9px', border: `1.5px solid ${active ? meta.dot + '60' : '#F0F0F0'}`, background: active ? meta.bg : '#FAFAFA', cursor: 'pointer', transition: 'all 130ms', minWidth: '90px' }}>
              <span style={{ fontSize: '20px', fontWeight: 900, color: active ? meta.color : '#6B7280', fontFamily: "'DM Mono', monospace", letterSpacing: '-0.03em', lineHeight: 1 }}>{count}</span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: active ? meta.color : '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: '3px', fontFamily: "'Work Sans', sans-serif" }}>{stage}</span>
            </button>
            {i < PIPELINE_STAGES.length - 1 && (
              <ChevronRight style={{ width: '12px', height: '12px', color: '#D1D5DB', flexShrink: 0 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Restaurant Card ──────────────────────────────────────────

function RestaurantCard({ row, onEdit, onMenu, onToggle }: {
  row: RestaurantListItem;
  onEdit: () => void;
  onMenu: () => void;
  onToggle: () => void;
}) {
  const [hov, setHov] = useState<string | null>(null);
  const initial = row.name.charAt(0).toUpperCase();

  return (
    <div style={{ background: '#FFF', borderRadius: '10px', border: '1px solid #EBEBEB', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
      {/* Top accent */}
      <div style={{ height: '3px', background: row.isActive ? 'linear-gradient(90deg,#0D9488,#2563EB)' : '#E5E7EB' }} />

      <div style={{ padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800, color: '#374151', fontFamily: "'Work Sans', sans-serif", flexShrink: 0 }}>
              {initial}
            </div>
            <div>
              <p style={{ fontSize: '13.5px', fontWeight: 700, color: '#111827', margin: '0 0 3px', fontFamily: "'Work Sans', sans-serif" }}>{row.name}</p>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: row.isActive ? '#ECFDF5' : '#F9FAFB', color: row.isActive ? '#059669' : '#9CA3AF', fontFamily: "'Work Sans', sans-serif" }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: row.isActive ? '#059669' : '#D1D5DB' }} />
                {row.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          {row.category && (
            <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#9CA3AF', padding: '3px 8px', borderRadius: '5px', background: '#F3F4F6', flexShrink: 0, fontFamily: "'Work Sans', sans-serif" }}>
              {row.category}
            </span>
          )}
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
          {[
            { label: 'Menu Items', value: String(row.menuItemCount), mono: true },
            { label: 'Today Orders', value: String(row.todayOrderCount), mono: true },
            { label: 'This Month', value: money(row.totalRevenue), mono: true },
          ].map((s) => (
            <div key={s.label} style={{ padding: '8px 10px', borderRadius: '7px', background: '#FAFAFA', border: '1px solid #F0F0F0' }}>
              <p style={{ fontSize: '9px', fontWeight: 700, color: '#C4C9D4', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 2px', fontFamily: "'Work Sans', sans-serif" }}>{s.label}</p>
              <p style={{ fontSize: '12px', fontWeight: 700, color: '#111827', margin: 0, fontFamily: s.mono ? "'DM Mono', monospace" : "'Work Sans', sans-serif" }}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer actions */}
      <div style={{ display: 'flex', gap: '6px', padding: '10px 16px 14px', borderTop: '1px solid #F7F8FA' }}>
        {[
          { label: 'Manage Menu', onClick: onMenu, primary: true },
          { label: 'Edit',        onClick: onEdit  },
          { label: row.isActive ? 'Disable' : 'Enable', onClick: onToggle },
        ].map((btn) => (
          <button key={btn.label} type="button" onClick={btn.onClick}
            onMouseEnter={() => setHov(btn.label)} onMouseLeave={() => setHov(null)}
            style={{ flex: btn.primary ? 1 : undefined, padding: '6px 12px', borderRadius: '7px', border: `1px solid ${btn.primary ? '#2563EB40' : '#E5E7EB'}`, background: btn.primary ? (hov === btn.label ? '#2563EB' : '#EFF6FF') : (hov === btn.label ? '#F3F4F6' : '#FAFAFA'), color: btn.primary ? (hov === btn.label ? '#FFF' : '#2563EB') : '#374151', cursor: 'pointer', fontSize: '11.5px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", transition: 'all 120ms', whiteSpace: 'nowrap' }}>
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Restaurant Form Modal ────────────────────────────────────

function RestaurantModal({ open, onClose, editingId, onSaved }: {
  open: boolean; onClose: () => void; editingId: string | null; onSaved: () => void;
}) {
  const [form, setForm]     = useState<RestaurantForm>(EMPTY_RESTAURANT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingId) {
      orderingService.getRestaurantDetail(editingId).then((d) => {
        setForm({ name: d.name, description: d.description ?? '', category: d.category ?? '' });
      }).catch(() => toast.error('Failed to load restaurant'));
    } else {
      setForm(EMPTY_RESTAURANT);
    }
  }, [open, editingId]);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Restaurant name is required'); return; }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), description: form.description.trim() || undefined, category: form.category.trim() || undefined };
      if (editingId) await orderingService.updateRestaurant(editingId, payload);
      else           await orderingService.createRestaurant(payload);
      toast.success('Restaurant saved');
      onSaved();
      onClose();
    } catch { toast.error('Failed to save restaurant'); }
    finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.4)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '440px', background: '#FFF', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', fontFamily: "'Work Sans', sans-serif" }}>
        <div style={{ height: '4px', background: 'linear-gradient(90deg, #0D9488 0%, #2563EB 100%)' }} />

        <div style={{ padding: '20px 22px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6' }}>
          <p style={{ fontSize: '14.5px', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.01em' }}>
            {editingId ? 'Edit Restaurant' : 'Add Restaurant'}
          </p>
          <button type="button" onClick={onClose}
            style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #EBEBEB', background: '#FAFAFA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>
            <X style={{ width: '12px', height: '12px' }} />
          </button>
        </div>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {[
            { key: 'name',        label: 'Restaurant Name', ph: 'e.g. Lemon Tree Kitchen', req: true },
            { key: 'category',    label: 'Category',        ph: 'e.g. Egyptian, Fast Food'              },
          ].map((f) => (
            <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Work Sans', sans-serif" }}>
                {f.label}{f.req && <span style={{ color: '#EF4444', marginLeft: '3px' }}>*</span>}
              </label>
              <input value={(form as any)[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.ph} style={inputStyle} />
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Work Sans', sans-serif" }}>Description</label>
            <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Short description visible to residents…" style={textareaStyle} />
          </div>
        </div>

        <div style={{ padding: '14px 22px 20px', display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #F3F4F6' }}>
          <button type="button" disabled={saving} onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#FFF', color: '#6B7280', cursor: 'pointer', fontSize: '13px', fontFamily: "'Work Sans', sans-serif", fontWeight: 600 }}>
            Cancel
          </button>
          <button type="button" disabled={saving} onClick={() => void handleSave()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '8px', background: saving ? '#9CA3AF' : '#111827', color: '#FFF', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: saving ? 'none' : '0 2px 6px rgba(0,0,0,0.18)' }}>
            <Check style={{ width: '13px', height: '13px' }} />
            {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Restaurant'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Order Detail Content ─────────────────────────────────────

function OrderDetailContent({ orderDetail, onAdvance, onCancel }: {
  orderDetail: OrderDetail;
  onAdvance: () => void;
  onCancel: (reason: string) => Promise<void>;
}) {
  const [cancelExpanded, setCancelExpanded] = useState(false);
  const [cancelReason,   setCancelReason]   = useState('');
  const [cancelling,     setCancelling]     = useState(false);

  const meta  = STAGE_META[orderDetail.status] ?? STAGE_META.PENDING;
  const label = quickLabel(orderDetail.status);

  const handleCancel = async () => {
    if (!cancelReason.trim()) { toast.error('Cancel reason is required'); return; }
    setCancelling(true);
    try { await onCancel(cancelReason.trim()); } finally { setCancelling(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <p style={{ fontSize: '20px', fontWeight: 900, color: '#111827', margin: 0, fontFamily: "'DM Mono', monospace", letterSpacing: '-0.03em' }}>
            {orderDetail.orderNumber}
          </p>
          <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '2px 0 0', fontFamily: "'Work Sans', sans-serif" }}>
            {orderDetail.restaurant.name}
          </p>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', background: meta.bg, color: meta.color, fontSize: '11px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", border: `1px solid ${meta.dot}30` }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: meta.dot }} />
          {orderDetail.status}
        </span>
      </div>

      {/* Customer */}
      <div style={{ padding: '14px', borderRadius: '9px', border: '1px solid #EBEBEB', background: '#FFF', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ fontSize: '9.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0, fontFamily: "'Work Sans', sans-serif" }}>Customer</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <InfoPair label="Name"  value={orderDetail.user.name} />
          <InfoPair label="Phone" value={orderDetail.user.phone ?? '—'} />
          <InfoPair label="Unit"  value={orderDetail.unit?.unitNumber ?? '—'} />
          <InfoPair label="Placed" value={fmtDateTime(orderDetail.createdAt)} />
        </div>
      </div>

      {/* Items */}
      <div style={{ padding: '14px', borderRadius: '9px', border: '1px solid #EBEBEB', background: '#FFF', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ fontSize: '9.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0, fontFamily: "'Work Sans', sans-serif" }}>Items</p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
              {['Item', 'Qty', 'Unit', 'Total'].map((h) => (
                <th key={h} style={{ fontSize: '10px', fontWeight: 700, color: '#C4C9D4', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 0 7px', textAlign: h === 'Item' ? 'left' : 'right', fontFamily: "'Work Sans', sans-serif" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orderDetail.items.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #F9FAFB' }}>
                <td style={{ fontSize: '12.5px', color: '#111827', padding: '7px 0', fontFamily: "'Work Sans', sans-serif" }}>{item.menuItemName}</td>
                <td style={{ fontSize: '12.5px', color: '#6B7280', padding: '7px 0', textAlign: 'right', fontFamily: "'Work Sans', sans-serif" }}>×{item.quantity}</td>
                <td style={{ fontSize: '12px', color: '#9CA3AF', padding: '7px 0', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>{money(item.unitPrice)}</td>
                <td style={{ fontSize: '13px', fontWeight: 700, color: '#111827', padding: '7px 0', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>{money(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid #F3F4F6' }}>
          <p style={{ fontSize: '20px', fontWeight: 900, color: '#111827', margin: 0, fontFamily: "'DM Mono', monospace", letterSpacing: '-0.03em' }}>
            {money(orderDetail.totalAmount)}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ padding: '14px', borderRadius: '9px', border: '1px solid #EBEBEB', background: '#FFF', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ fontSize: '9.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0, fontFamily: "'Work Sans', sans-serif" }}>Timeline</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {PIPELINE_STAGES.map((stage, i) => {
            const stageIdx   = PIPELINE_STAGES.indexOf(stage);
            const currentIdx = PIPELINE_STAGES.indexOf(
              orderDetail.status === OrderStatus.CANCELLED ? OrderStatus.PREPARING : orderDetail.status,
            );
            const reached  = stageIdx <= currentIdx;
            const isCurrent = orderDetail.status === stage;
            const m        = STAGE_META[stage];
            const stamp    =
              stage === OrderStatus.CONFIRMED  ? orderDetail.confirmedAt  :
              stage === OrderStatus.PREPARING  ? orderDetail.preparedAt   :
              stage === OrderStatus.DELIVERED  ? orderDetail.deliveredAt  : orderDetail.createdAt;

            return (
              <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: reached ? m.bg : '#F9FAFB', border: `1.5px solid ${reached ? m.dot : '#E5E7EB'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isCurrent ? m.dot : (reached ? m.dot + '80' : '#E5E7EB') }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '12.5px', fontWeight: isCurrent ? 700 : 500, color: reached ? '#111827' : '#9CA3AF', margin: 0, fontFamily: "'Work Sans', sans-serif" }}>{stage}</p>
                  <p style={{ fontSize: '10.5px', color: '#C4C9D4', margin: '1px 0 0', fontFamily: "'DM Mono', monospace" }}>{stamp ? fmtDateTime(stamp) : '—'}</p>
                </div>
                {i < PIPELINE_STAGES.length - 1 && (
                  <div style={{ width: '1px', height: '16px', background: reached ? m.dot + '40' : '#F0F0F0', position: 'absolute', left: '13px', marginTop: '28px', display: 'none' }} />
                )}
              </div>
            );
          })}
          {orderDetail.status === OrderStatus.CANCELLED && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#FEF2F2', border: '1.5px solid #FCA5A5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <X style={{ width: '12px', height: '12px', color: '#DC2626' }} />
              </div>
              <div>
                <p style={{ fontSize: '12.5px', fontWeight: 700, color: '#DC2626', margin: 0, fontFamily: "'Work Sans', sans-serif" }}>CANCELLED</p>
                <p style={{ fontSize: '10.5px', color: '#C4C9D4', margin: '1px 0 0', fontFamily: "'DM Mono', monospace" }}>
                  {orderDetail.cancelledAt ? fmtDateTime(orderDetail.cancelledAt) : '—'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {orderDetail.status !== OrderStatus.DELIVERED && orderDetail.status !== OrderStatus.CANCELLED && (
        <div style={{ padding: '14px', borderRadius: '9px', border: '1px solid #EBEBEB', background: '#FFF', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '9.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0, fontFamily: "'Work Sans', sans-serif" }}>Actions</p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {label && (
              <button type="button" onClick={onAdvance}
                style={{ padding: '8px 18px', borderRadius: '8px', background: '#2563EB', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", display: 'flex', alignItems: 'center', gap: '6px' }}>
                {orderDetail.status === OrderStatus.PENDING   ? <Check   style={{ width: '13px', height: '13px' }} /> :
                 orderDetail.status === OrderStatus.CONFIRMED ? <ChefHat style={{ width: '13px', height: '13px' }} /> :
                 <Truck style={{ width: '13px', height: '13px' }} />}
                {label}
              </button>
            )}
            <button type="button" onClick={() => setCancelExpanded((p) => !p)}
              style={{ padding: '8px 16px', borderRadius: '8px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
              Cancel Order
            </button>
          </div>
          {cancelExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation…" style={textareaStyle} />
              <button type="button" disabled={cancelling} onClick={() => void handleCancel()}
                style={{ alignSelf: 'flex-start', padding: '7px 16px', borderRadius: '7px', background: cancelling ? '#9CA3AF' : '#DC2626', color: '#FFF', border: 'none', cursor: cancelling ? 'not-allowed' : 'pointer', fontSize: '12.5px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
                {cancelling ? 'Cancelling…' : 'Confirm Cancel'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Menu Builder Drawer ──────────────────────────────────────

function MenuBuilderContent({ restaurant, onRefresh }: {
  restaurant: RestaurantDetail;
  onRefresh: () => void;
}) {
  const [selectedCat,  setSelectedCat]  = useState(() => restaurant.menu[0]?.category ?? 'Uncategorized');
  const [formOpen,     setFormOpen]     = useState(false);
  const [menuForm,     setMenuForm]     = useState<MenuItemForm>(EMPTY_MENU_ITEM);

  const categories    = useMemo(() => restaurant.menu.map((e) => e.category), [restaurant]);
  const selectedItems = useMemo(() => restaurant.menu.find((e) => e.category === selectedCat)?.items ?? [], [restaurant, selectedCat]);

  const saveItem = async () => {
    const price = Number(menuForm.price);
    if (!menuForm.name.trim() || !Number.isFinite(price) || price <= 0) {
      toast.error('Name and positive price required'); return;
    }
    try {
      const payload = { name: menuForm.name.trim(), description: menuForm.description.trim() || undefined, price, category: menuForm.category.trim() || selectedCat };
      if (menuForm.id) await orderingService.updateMenuItem(menuForm.id, payload);
      else             await orderingService.addMenuItem(restaurant.id, payload);
      setFormOpen(false);
      setMenuForm(EMPTY_MENU_ITEM);
      onRefresh();
    } catch { toast.error('Failed to save item'); }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '520px', border: '1px solid #EBEBEB', borderRadius: '10px', overflow: 'hidden', background: '#FFF' }}>
      {/* Sidebar */}
      <div style={{ background: '#FAFAFA', borderRight: '1px solid #EBEBEB', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 12px 8px' }}>
          <p style={{ fontSize: '9.5px', fontWeight: 700, color: '#C4C9D4', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px', fontFamily: "'Work Sans', sans-serif" }}>Categories</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {(categories.length ? categories : ['Uncategorized']).map((cat) => (
              <button key={cat} type="button" onClick={() => setSelectedCat(cat)}
                style={{ padding: '8px 10px', borderRadius: '7px', border: 'none', background: selectedCat === cat ? '#EFF6FF' : 'transparent', color: selectedCat === cat ? '#2563EB' : '#6B7280', cursor: 'pointer', fontSize: '12.5px', fontWeight: selectedCat === cat ? 700 : 500, textAlign: 'left', fontFamily: "'Work Sans', sans-serif", borderLeft: selectedCat === cat ? '2px solid #2563EB' : '2px solid transparent', transition: 'all 120ms' }}>
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 'auto', padding: '10px 12px', borderTop: '1px solid #EBEBEB' }}>
          <button type="button" onClick={() => {
            const next = window.prompt('New category name');
            if (!next?.trim()) return;
            setSelectedCat(next.trim());
            setMenuForm((p) => ({ ...p, category: next.trim() }));
          }} style={{ fontSize: '12px', color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Work Sans', sans-serif", fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Plus style={{ width: '11px', height: '11px' }} /> Add Category
          </button>
        </div>
      </div>

      {/* Items panel */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #F3F4F6' }}>
          <p style={{ fontSize: '13.5px', fontWeight: 700, color: '#111827', margin: 0, fontFamily: "'Work Sans', sans-serif" }}>{selectedCat}</p>
          <button type="button" onClick={() => { setFormOpen((p) => !p); setMenuForm({ ...EMPTY_MENU_ITEM, category: selectedCat }); }}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '7px', background: '#2563EB', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
            <Plus style={{ width: '11px', height: '11px' }} /> Add Item
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Inline form */}
          {formOpen && (
            <div style={{ padding: '14px', borderRadius: '9px', border: '1.5px dashed #C4C9D4', background: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <SectionLabel label={menuForm.id ? 'Edit Item' : 'New Item'} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ gridColumn: 'span 1' }}>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '4px', fontFamily: "'Work Sans', sans-serif" }}>Name *</label>
                  <input value={menuForm.name} onChange={(e) => setMenuForm((p) => ({ ...p, name: e.target.value }))} placeholder="Item name" style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '4px', fontFamily: "'Work Sans', sans-serif" }}>Price *</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#9CA3AF', fontFamily: "'DM Mono', monospace", pointerEvents: 'none' }}>EGP</span>
                    <input type="number" min={0} value={menuForm.price} onChange={(e) => setMenuForm((p) => ({ ...p, price: e.target.value }))}
                      placeholder="0" style={{ ...inputStyle, paddingLeft: '42px', fontFamily: "'DM Mono', monospace" }} />
                  </div>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '4px', fontFamily: "'Work Sans', sans-serif" }}>Description</label>
                  <textarea value={menuForm.description} onChange={(e) => setMenuForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Optional description…" style={{ ...textareaStyle, minHeight: '60px' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button type="button" onClick={() => void saveItem()}
                  style={{ padding: '6px 14px', borderRadius: '7px', background: '#111827', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
                  Save
                </button>
                <button type="button" onClick={() => { setFormOpen(false); setMenuForm(EMPTY_MENU_ITEM); }}
                  style={{ padding: '6px 12px', borderRadius: '7px', border: '1px solid #E5E7EB', background: '#FFF', color: '#6B7280', cursor: 'pointer', fontSize: '12px', fontFamily: "'Work Sans', sans-serif" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {selectedItems.length === 0 && !formOpen && (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: '#C4C9D4', fontFamily: "'Work Sans', sans-serif", fontSize: '13px' }}>
              <UtensilsCrossed style={{ width: '28px', height: '28px', margin: '0 auto 8px', opacity: 0.4 }} />
              No items in this category
            </div>
          )}

          {selectedItems.map((item) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #F0F0F0', background: item.isAvailable ? '#FFF' : '#FAFAFA' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '7px', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <UtensilsCrossed style={{ width: '14px', height: '14px', color: '#C4C9D4' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: item.isAvailable ? '#111827' : '#9CA3AF', margin: 0, fontFamily: "'Work Sans', sans-serif" }}>{item.name}</p>
                {item.description && <p style={{ fontSize: '11px', color: '#C4C9D4', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: "'Work Sans', sans-serif" }}>{item.description}</p>}
              </div>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827', margin: 0, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{money(item.price)}</p>
              <ToggleSwitch checked={item.isAvailable} onChange={() => {
                orderingService.toggleMenuItem(item.id).then(onRefresh).catch(() => toast.error('Failed'));
              }} />
              <GhostIconBtn icon={<Edit2 style={{ width: '11px', height: '11px' }} />} onClick={() => {
                setMenuForm({ id: item.id, name: item.name, description: item.description ?? '', price: String(item.price), category: item.category ?? selectedCat });
                setFormOpen(true);
              }} />
              <GhostIconBtn icon={<X style={{ width: '11px', height: '11px' }} />} danger onClick={() => {
                orderingService.deleteMenuItem(item.id).then(onRefresh).catch(() => toast.error('Failed'));
              }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

export function OrderingManagement() {
  const [tab, setTab] = useState<MainTab>('orders');

  // — orders state
  const [stats,          setStats]          = useState<OrderStats | null>(null);
  const [orders,         setOrders]         = useState<OrderListItem[]>([]);
  const [ordersLoading,  setOrdersLoading]  = useState(true);
  const [orderSearch,    setOrderSearch]    = useState('');
  const [orderRestId,    setOrderRestId]    = useState('ALL');
  const [orderStatus,    setOrderStatus]    = useState('ALL');
  const [orderDateFrom,  setOrderDateFrom]  = useState('');
  const [orderDateTo,    setOrderDateTo]    = useState('');
  const [orderPage,      setOrderPage]      = useState(1);
  const [orderTotal,     setOrderTotal]     = useState(0);
  const [orderTotalPg,   setOrderTotalPg]   = useState(1);
  const [filtersOpen,    setFiltersOpen]    = useState(false);

  // — order detail drawer
  const [detailOpen,   setDetailOpen]   = useState(false);
  const [orderDetail,  setOrderDetail]  = useState<OrderDetail | null>(null);

  // — restaurants state
  const [restaurants,      setRestaurants]      = useState<RestaurantListItem[]>([]);
  const [restsLoading,     setRestsLoading]     = useState(true);
  const [restSearch,       setRestSearch]       = useState('');
  const [restCategory,     setRestCategory]     = useState('ALL');
  const [restStatus,       setRestStatus]       = useState<RestaurantStatusFilter>('ALL');
  const [restFiltersOpen,  setRestFiltersOpen]  = useState(false);

  // — restaurant modal
  const [restModalOpen,  setRestModalOpen]  = useState(false);
  const [editingRestId,  setEditingRestId]  = useState<string | null>(null);

  // — menu drawer
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [menuRest,     setMenuRest]     = useState<RestaurantDetail | null>(null);

  // ── loaders ───────────────────────────────────────────────

  const loadOrders = async () => {
    setOrdersLoading(true);
    try {
      const [statsRes, listRes] = await Promise.all([
        orderingService.getOrderStats(),
        orderingService.listOrders({
          search: orderSearch.trim() || undefined,
          restaurantId: orderRestId === 'ALL' ? undefined : orderRestId,
          status: orderStatus === 'ALL' ? undefined : (orderStatus as OrderStatus),
          dateFrom: orderDateFrom || undefined,
          dateTo: orderDateTo || undefined,
          page: orderPage,
          limit: 25,
        }),
      ]);
      setStats(statsRes);
      setOrders(listRes.data);
      setOrderTotal(listRes.total);
      setOrderTotalPg(listRes.totalPages);
    } catch { toast.error('Failed to load orders'); }
    finally { setOrdersLoading(false); }
  };

  const loadRestaurants = async () => {
    setRestsLoading(true);
    try {
      const list = await orderingService.listRestaurants({ includeInactive: true });
      setRestaurants(list);
    } catch { toast.error('Failed to load restaurants'); }
    finally { setRestsLoading(false); }
  };

  useEffect(() => { void loadOrders(); }, [orderRestId, orderStatus, orderDateFrom, orderDateTo, orderPage]);
  useEffect(() => {
    const t = window.setTimeout(() => void loadOrders(), 300);
    return () => window.clearTimeout(t);
  }, [orderSearch]);
  useEffect(() => { void loadRestaurants(); }, []);

  const filteredRests = useMemo(() => restaurants.filter((r) => {
    if (restStatus === 'ACTIVE'   && !r.isActive) return false;
    if (restStatus === 'INACTIVE' &&  r.isActive) return false;
    if (restCategory !== 'ALL'    && r.category !== restCategory) return false;
    if (restSearch.trim() && !r.name.toLowerCase().includes(restSearch.trim().toLowerCase())) return false;
    return true;
  }), [restaurants, restSearch, restCategory, restStatus]);

  const categoryOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of restaurants) if (r.category) s.add(r.category);
    return ['ALL', ...Array.from(s).sort()];
  }, [restaurants]);

  const openOrderDetail = async (id: string) => {
    try {
      const d = await orderingService.getOrderDetail(id);
      setOrderDetail(d);
      setDetailOpen(true);
    } catch { toast.error('Failed to load order'); }
  };

  const advanceOrder = async (id: string, status: OrderStatus) => {
    const next = getNextStatus(status);
    if (!next) return;
    try {
      const updated = await orderingService.updateOrderStatus(id, { status: next });
      if (orderDetail?.id === id) setOrderDetail(updated);
      await loadOrders();
    } catch { toast.error('Failed to update status'); }
  };

  const cancelOrder = async (id: string, reason: string) => {
    const updated = await orderingService.cancelOrder(id, reason);
    setOrderDetail(updated);
    await loadOrders();
  };

  const openMenuBuilder = async (restId: string) => {
    try {
      const detail = await orderingService.getRestaurantDetail(restId);
      setMenuRest(detail);
      setMenuOpen(true);
    } catch { toast.error('Failed to load menu'); }
  };

  const refreshMenu = async () => {
    if (!menuRest) return;
    const detail = await orderingService.getRestaurantDetail(menuRest.id);
    setMenuRest(detail);
  };

  // ── active filter counts ──────────────────────────────────
  const orderActiveFilters = [orderRestId !== 'ALL', orderStatus !== 'ALL', !!orderDateFrom, !!orderDateTo].filter(Boolean).length;
  const restActiveFilters  = [restCategory !== 'ALL', restStatus !== 'ALL'].filter(Boolean).length;

  // ── columns ───────────────────────────────────────────────
  const orderColumns = useMemo<DataTableColumn<OrderListItem>[]>(() => [
    {
      key: 'order', header: 'Order #', className: 'w-[120px]',
      render: (r) => (
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '12.5px', fontWeight: 700, color: '#111827' }}>{r.orderNumber}</span>
      ),
    },
    { key: 'restaurant', header: 'Restaurant', render: (r) => <span style={{ fontSize: '12.5px', color: '#374151', fontFamily: "'Work Sans', sans-serif" }}>{r.restaurantName}</span> },
    { key: 'customer',   header: 'Customer',   render: (r) => <span style={{ fontSize: '12.5px', color: '#374151', fontFamily: "'Work Sans', sans-serif" }}>{r.userName}</span> },
    { key: 'unit',       header: 'Unit',       render: (r) => <span style={{ fontSize: '12px', color: '#9CA3AF', fontFamily: "'DM Mono', monospace" }}>{r.unitNumber ?? '—'}</span> },
    { key: 'items',      header: 'Items',      render: (r) => <span style={{ fontSize: '12px', color: '#6B7280', fontFamily: "'Work Sans', sans-serif" }}>{r.itemCount} items</span> },
    {
      key: 'amount', header: 'Amount', className: 'text-right',
      render: (r) => <span style={{ display: 'block', textAlign: 'right', fontSize: '13px', fontWeight: 700, color: '#111827', fontFamily: "'DM Mono', monospace" }}>{money(r.totalAmount)}</span>,
    },
    {
      key: 'status', header: 'Status',
      render: (r) => {
        const m = STAGE_META[r.status];
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '5px', background: m?.bg ?? '#F9FAFB', color: m?.color ?? '#9CA3AF', fontSize: '10.5px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", border: `1px solid ${(m?.dot ?? '#E5E7EB') + '30'}` }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: m?.dot ?? '#E5E7EB' }} />
            {r.status}
          </span>
        );
      },
    },
    { key: 'time', header: 'Time', render: (r) => <span style={{ fontSize: '11.5px', color: '#C4C9D4', fontFamily: "'DM Mono', monospace" }}>{fmtRelative(r.createdAt)}</span> },
    {
      key: 'actions', header: '', className: 'w-[80px] text-right',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
          <GhostIconBtn icon={<Eye style={{ width: '11px', height: '11px' }} />} onClick={() => void openOrderDetail(r.id)} />
          {getNextStatus(r.status) && (
            <GhostIconBtn icon={<Check style={{ width: '11px', height: '11px' }} />} onClick={() => void advanceOrder(r.id, r.status)} />
          )}
        </div>
      ),
    },
  ], [orderDetail]);

  // ── render ────────────────────────────────────────────────

  return (
    <div style={{ minHeight: 'calc(100vh - 140px)', background: '#F5F4F1', borderRadius: '14px', padding: '28px', fontFamily: "'Work Sans', sans-serif", display: 'flex', flexDirection: 'column', gap: '22px' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#111827', margin: 0, letterSpacing: '-0.02em' }}>Ordering Center</h1>
          <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '3px 0 0', fontWeight: 500 }}>Monitor live orders and manage restaurant menus</p>
        </div>
        {tab === 'restaurants' && (
          <button type="button" onClick={() => { setEditingRestId(null); setRestModalOpen(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: '8px', background: '#111827', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, boxShadow: '0 2px 6px rgba(0,0,0,0.18)' }}>
            <Plus style={{ width: '13px', height: '13px' }} /> Add Restaurant
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: '#EBEBEB', padding: '4px', borderRadius: '9px', width: 'fit-content' }}>
        <TabBtn label="Orders"      active={tab === 'orders'}      onClick={() => setTab('orders')}      count={stats?.activeOrders} />
        <TabBtn label="Restaurants" active={tab === 'restaurants'} onClick={() => setTab('restaurants')} />
      </div>

      {/* ── ORDERS TAB ── */}
      {tab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            <StatCard icon="active-users" title="Active Orders"      value={String(stats?.activeOrders ?? 0)}          subtitle="In progress" />
            <StatCard icon="tickets"      title="Delivered Today"    value={String(stats?.deliveredToday ?? 0)}         subtitle="Completed" />
            <StatCard icon="revenue"      title="Revenue Today"      value={money(stats?.revenueToday ?? 0)}            subtitle="Collected" />
            <StatCard icon="occupancy"    title="Revenue This Month" value={money(stats?.revenueThisMonth ?? 0)}        subtitle="Month total" />
          </div>

          {/* Pipeline bar */}
          <div style={{ background: '#FFF', borderRadius: '10px', border: '1px solid #EBEBEB' }}>
            <PipelineBar stats={stats} activeStatus={orderStatus} onClickStage={(s) => { setOrderStatus(s); setOrderPage(1); }} />

            {/* Filter bar */}
            <FilterBar
              search={orderSearch} setSearch={(v) => { setOrderSearch(v); setOrderPage(1); }}
              filtersOpen={filtersOpen} setFiltersOpen={setFiltersOpen}
              activeFilters={orderActiveFilters}
            >
              <select value={orderRestId} onChange={(e) => { setOrderRestId(e.target.value); setOrderPage(1); }} style={{ ...selectStyle, width: '180px' }}>
                <option value="ALL">All Restaurants</option>
                {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <select value={orderStatus} onChange={(e) => { setOrderStatus(e.target.value); setOrderPage(1); }} style={{ ...selectStyle, width: '150px' }}>
                <option value="ALL">All Statuses</option>
                {Object.values(OrderStatus).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <DateRangePill from={orderDateFrom} to={orderDateTo} onFrom={(v) => { setOrderDateFrom(v); setOrderPage(1); }} onTo={(v) => { setOrderDateTo(v); setOrderPage(1); }} />
            </FilterBar>

            {/* Table */}
            <div style={{ padding: '0 0 0' }}>
              {ordersLoading ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#C4C9D4', fontSize: '13px' }}>Loading…</div>
              ) : (
                <DataTable
                  columns={orderColumns}
                  rows={orders}
                  rowKey={(r) => r.id}
                  rowStyle={(r) => ({
                    borderLeft: r.status === OrderStatus.PENDING ? '3px solid #F59E0B' : r.status === OrderStatus.CANCELLED ? '3px solid #FCA5A5' : undefined,
                    opacity: r.status === OrderStatus.CANCELLED ? 0.65 : 1,
                  })}
                  emptyTitle="No orders found"
                  emptyDescription="Orders will appear here once residents place them."
                />
              )}
            </div>
            <Pagination page={orderPage} totalPages={orderTotalPg} total={orderTotal}
              onPrev={() => setOrderPage((p) => Math.max(1, p - 1))}
              onNext={() => setOrderPage((p) => Math.min(orderTotalPg, p + 1))} />
          </div>
        </div>
      )}

      {/* ── RESTAURANTS TAB ── */}
      {tab === 'restaurants' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filter bar */}
          <div style={{ background: '#FFF', borderRadius: '10px', border: '1px solid #EBEBEB' }}>
            <FilterBar
              search={restSearch} setSearch={setRestSearch}
              filtersOpen={restFiltersOpen} setFiltersOpen={setRestFiltersOpen}
              activeFilters={restActiveFilters}
            >
              <select value={restCategory} onChange={(e) => setRestCategory(e.target.value)} style={{ ...selectStyle, width: '160px' }}>
                {categoryOptions.map((c) => <option key={c} value={c}>{c === 'ALL' ? 'All Categories' : c}</option>)}
              </select>
              <select value={restStatus} onChange={(e) => setRestStatus(e.target.value as RestaurantStatusFilter)} style={{ ...selectStyle, width: '140px' }}>
                <option value="ALL">All</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </FilterBar>
          </div>

          {/* Cards grid */}
          {restsLoading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#C4C9D4', fontSize: '13px', background: '#FFF', borderRadius: '10px', border: '1px solid #EBEBEB' }}>Loading…</div>
          ) : filteredRests.length === 0 ? (
            <div style={{ padding: '48px 32px', textAlign: 'center', color: '#C4C9D4', fontSize: '13px', background: '#FFF', borderRadius: '10px', border: '1px solid #EBEBEB' }}>
              <UtensilsCrossed style={{ width: '32px', height: '32px', margin: '0 auto 10px', opacity: 0.4 }} />
              No restaurants found
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {filteredRests.map((r) => (
                <RestaurantCard key={r.id} row={r}
                  onEdit={() => { setEditingRestId(r.id); setRestModalOpen(true); }}
                  onMenu={() => void openMenuBuilder(r.id)}
                  onToggle={() => {
                    orderingService.toggleRestaurant(r.id).then(loadRestaurants).catch(() => toast.error('Failed'));
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ORDER DETAIL DRAWER ── */}
      <DrawerForm open={detailOpen} onOpenChange={setDetailOpen}
        title={orderDetail ? orderDetail.orderNumber : 'Order Detail'}
        description="View order items, status timeline and take action">
        {!orderDetail ? (
          <EmptyState compact title="No order selected" description="Select an order to view details." />
        ) : (
          <OrderDetailContent
            key={orderDetail.id}
            orderDetail={orderDetail}
            onAdvance={() => void advanceOrder(orderDetail.id, orderDetail.status)}
            onCancel={(reason) => cancelOrder(orderDetail.id, reason)}
          />
        )}
      </DrawerForm>

      {/* ── RESTAURANT MODAL ── */}
      <RestaurantModal
        open={restModalOpen}
        onClose={() => setRestModalOpen(false)}
        editingId={editingRestId}
        onSaved={() => { void loadRestaurants(); void loadOrders(); }}
      />

      {/* ── MENU BUILDER DRAWER ── */}
      <DrawerForm open={menuOpen} onOpenChange={setMenuOpen}
        title={menuRest ? `${menuRest.name} — Menu` : 'Menu Builder'}
        description="Manage categories and items"
        widthClassName="w-full sm:max-w-[720px]">
        {!menuRest ? (
          <EmptyState compact title="No restaurant selected" description="Select a restaurant first." />
        ) : (
          <MenuBuilderContent key={menuRest.id} restaurant={menuRest} onRefresh={() => void refreshMenu()} />
        )}
      </DrawerForm>
    </div>
  );
}