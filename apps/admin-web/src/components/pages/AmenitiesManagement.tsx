import { useEffect, useMemo, useState } from 'react';
import { BillingCycle, BookingStatus, FacilityType } from '@prisma/client';
import {
  Check, Dumbbell, Edit2, Eye, Plus, Search, Waves, X,
  ChevronLeft, ChevronRight, SlidersHorizontal, ChevronDown,
  CalendarRange, Zap,
} from 'lucide-react';
import { IconPicker } from '../IconPicker';
import { toast } from 'sonner';
import { StatCard } from '../StatCard';
import { DataTable, type DataTableColumn } from '../DataTable';
import { DrawerForm } from '../DrawerForm';
import { EmptyState } from '../EmptyState';
import { StatusBadge } from '../StatusBadge';
import amenitiesService, {
  type AmenityStats,
  type BookingDetail,
  type BookingListItem,
  type FacilityDetail,
  type FacilityListItem,
} from '../../lib/amenitiesService';

// ─── Constants ────────────────────────────────────────────────

const COLOR_PRESETS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#F97316', '#14B8A6', '#F43F5E',
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const FACILITY_TYPE_LABELS: Record<FacilityType, string> = {
  [FacilityType.SPORTS]: 'Sports',
  [FacilityType.FITNESS]: 'Fitness',
  [FacilityType.AQUATICS]: 'Aquatics',
  [FacilityType.RECREATION]: 'Recreation',
  [FacilityType.WELLNESS]: 'Wellness',
  [FacilityType.EVENTS]: 'Events',
  [FacilityType.KIDS]: 'Kids',
  [FacilityType.OUTDOOR]: 'Outdoor',
  // legacy
  [FacilityType.GYM]: 'Gym',
  [FacilityType.POOL]: 'Pool',
  [FacilityType.TENNIS_COURT]: 'Tennis Court',
  [FacilityType.MULTIPURPOSE_HALL]: 'Multipurpose Hall',
  [FacilityType.CUSTOM]: 'Custom',
};

/** New general categories shown in the create/edit form dropdown */
const FACILITY_TYPE_OPTIONS: FacilityType[] = [
  FacilityType.SPORTS, FacilityType.FITNESS, FacilityType.AQUATICS,
  FacilityType.RECREATION, FacilityType.WELLNESS, FacilityType.EVENTS,
  FacilityType.KIDS, FacilityType.OUTDOOR,
];

// ─── Types ────────────────────────────────────────────────────

type MainTab   = 'facilities' | 'bookings';
type ManageTab = 'overview' | 'schedule' | 'exceptions' | 'bookings';

type FacilityFormState = {
  name: string; type: FacilityType; description: string;
  iconName: string; color: string; capacity: string;
  billingCycle: BillingCycle; price: string;
  maxReservationsPerDay: string; requiresPrepayment: boolean;
  reminderMinutesBefore: string; cooldownMinutes: string; rules: string;
};

type SlotEditState = {
  startTime: string; endTime: string;
  slotDurationMinutes: string; slotCapacity: string;
};

type ExceptionFormState = {
  date: string; isClosed: boolean;
  startTime: string; endTime: string;
  slotDurationMinutes: string; slotCapacity: string;
};

const EMPTY_FACILITY_FORM: FacilityFormState = {
  name: '', type: FacilityType.SPORTS, description: '',
  iconName: '', color: COLOR_PRESETS[0], capacity: '',
  billingCycle: BillingCycle.NONE, price: '',
  maxReservationsPerDay: '', requiresPrepayment: false,
  reminderMinutesBefore: '', cooldownMinutes: '', rules: '',
};

const EMPTY_SLOT_EDIT: SlotEditState = {
  startTime: '08:00', endTime: '22:00',
  slotDurationMinutes: '60', slotCapacity: '',
};

const EMPTY_EXCEPTION: ExceptionFormState = {
  date: '', isClosed: false, startTime: '', endTime: '',
  slotDurationMinutes: '', slotCapacity: '',
};

// ─── Helpers ──────────────────────────────────────────────────

const fmtDate     = (v?: string | null) => v ? new Date(v).toLocaleDateString()  : '—';
const fmtDateTime = (v?: string | null) => v ? new Date(v).toLocaleString()      : '—';

function parseOptInt(v: string)  { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : undefined; }
function parseOptNum(v: string)  { const n = Number(v); return Number.isFinite(n) ? n              : undefined; }

function billingLabel(price: number | null, cycle: BillingCycle): string {
  if (!price || cycle === BillingCycle.NONE) return 'Free';
  if (cycle === BillingCycle.PER_HOUR) return `EGP ${price}/hr`;
  if (cycle === BillingCycle.PER_SLOT) return `EGP ${price}/slot`;
  if (cycle === BillingCycle.PER_USE)  return `EGP ${price}/use`;
  return `EGP ${price}`;
}

function amountLabel(v: number | null) {
  return v === null ? 'Free' : `EGP ${v.toLocaleString()}`;
}

function iconForType(type: FacilityType) {
  if (type === FacilityType.POOL || type === FacilityType.AQUATICS) return Waves;
  return Dumbbell;
}

function categoryPillColor(type: FacilityType): { bg: string; text: string; border: string } {
  switch (type) {
    case FacilityType.SPORTS:            return { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7' };
    case FacilityType.FITNESS:           return { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' };
    case FacilityType.AQUATICS:          return { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' };
    case FacilityType.RECREATION:        return { bg: '#EDE9FE', text: '#5B21B6', border: '#C4B5FD' };
    case FacilityType.WELLNESS:          return { bg: '#FCE7F3', text: '#9D174D', border: '#F9A8D4' };
    case FacilityType.EVENTS:            return { bg: '#FFF7ED', text: '#9A3412', border: '#FDBA74' };
    case FacilityType.KIDS:              return { bg: '#F0FDFA', text: '#0F766E', border: '#5EEAD4' };
    case FacilityType.OUTDOOR:           return { bg: '#F0FDF4', text: '#166534', border: '#86EFAC' };
    // legacy
    case FacilityType.GYM:               return { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' };
    case FacilityType.POOL:              return { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' };
    case FacilityType.TENNIS_COURT:      return { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7' };
    case FacilityType.MULTIPURPOSE_HALL: return { bg: '#EDE9FE', text: '#5B21B6', border: '#C4B5FD' };
    case FacilityType.CUSTOM:            return { bg: '#F3F4F6', text: '#374151', border: '#D1D5DB' };
    default:                             return { bg: '#F3F4F6', text: '#374151', border: '#D1D5DB' };
  }
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
      style={{ padding: '7px 18px', borderRadius: '7px', border: 'none', background: active ? '#FFF' : 'transparent', color: active ? '#111827' : '#9CA3AF', cursor: 'pointer', fontSize: '12.5px', fontWeight: active ? 700 : 500, transition: 'all 120ms ease', fontFamily: "'Work Sans', sans-serif", flexShrink: 0, boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
      {label}
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

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '4px' }}>
      <span style={{ fontSize: '10px', fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.09em', whiteSpace: 'nowrap', fontFamily: "'Work Sans', sans-serif" }}>{label}</span>
      <div style={{ flex: 1, height: '1px', background: '#F0F0F0' }} />
    </div>
  );
}

function InfoPair({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #EBEBEB', background: '#FFF' }}>
      <p style={{ fontSize: '9.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 3px', fontFamily: "'Work Sans', sans-serif" }}>{label}</p>
      <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0, fontFamily: mono ? "'DM Mono', monospace" : "'Work Sans', sans-serif" }}>{value}</p>
    </div>
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

function Pagination({ page, totalPages, total, onPrev, onNext }: {
  page: number; totalPages: number; total: number; onPrev: () => void; onNext: () => void;
}) {
  if (total === 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderTop: '1px solid #F3F4F6' }}>
      <span style={{ fontSize: '11.5px', color: '#9CA3AF', fontFamily: "'DM Mono', monospace" }}>
        Page {page} of {totalPages}<span style={{ color: '#D1D5DB', marginLeft: '6px' }}>({total})</span>
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

// ─── Facility Card ────────────────────────────────────────────

function FacilityCard({ facility, detail, onManage, onEdit, onToggle }: {
  facility: FacilityListItem;
  detail?: FacilityDetail;
  onManage: () => void;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const Icon         = iconForType(facility.type);
  const color        = facility.color ?? '#2563EB';
  const configuredDays = new Set((detail?.slotConfig ?? []).map((s) => s.dayOfWeek));

  return (
    <div style={{ background: '#FFF', borderRadius: '12px', border: '1px solid #EBEBEB', borderLeft: `4px solid ${color}`, padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', fontFamily: "'Work Sans', sans-serif" }}>
      {/* Name + type */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon style={{ width: '15px', height: '15px', color }} />
          </div>
          <div>
            <p style={{ fontSize: '13.5px', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.01em' }}>{facility.name}</p>
            <p style={{ fontSize: '10.5px', color: '#9CA3AF', margin: '2px 0 0' }}>{FACILITY_TYPE_LABELS[facility.type] ?? facility.type}</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px', background: facility.isActive ? '#ECFDF5' : '#F3F4F6', color: facility.isActive ? '#059669' : '#9CA3AF' }}>
            {facility.isActive ? 'Active' : 'Inactive'}
          </span>
          {(() => { const c = categoryPillColor(facility.type); return (
            <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: c.bg, color: c.text, border: `1px solid ${c.border}`, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {FACILITY_TYPE_LABELS[facility.type] ?? facility.type}
            </span>
          ); })()}
        </div>
      </div>

      {/* Capacity + pricing */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '5px', background: '#F3F4F6', color: '#6B7280', fontFamily: "'Work Sans', sans-serif" }}>
          Cap: {facility.capacity ?? '—'}
        </span>
        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '5px', background: '#EFF6FF', color: '#2563EB', fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
          {billingLabel(facility.price, facility.billingCycle)}
        </span>
      </div>

      {/* Day dots */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {DAYS.map((label, idx) => (
          <div key={label} title={label}
            style={{ width: '18px', height: '18px', borderRadius: '4px', background: configuredDays.has(idx) ? `${color}30` : '#F3F4F6', border: configuredDays.has(idx) ? `1px solid ${color}50` : '1px solid #EBEBEB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '8px', fontWeight: 700, color: configuredDays.has(idx) ? color : '#D1D5DB', fontFamily: "'Work Sans', sans-serif" }}>{label[0]}</span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>
        {facility.upcomingBookingsToday} bookings today · {detail?.bookingStats.pendingBookings ?? 0} pending
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '6px', paddingTop: '2px' }}>
        <button type="button" onClick={onManage}
          style={{ flex: 1, padding: '6px 0', borderRadius: '7px', border: '1px solid #E5E7EB', background: '#FAFAFA', color: '#374151', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif" }}>
          Manage Slots
        </button>
        <button type="button" onClick={onEdit}
          style={{ padding: '6px 12px', borderRadius: '7px', border: '1px solid #E5E7EB', background: '#FAFAFA', color: '#374151', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif" }}>
          Edit
        </button>
        <button type="button" onClick={onToggle}
          style={{ padding: '6px 12px', borderRadius: '7px', border: `1px solid ${facility.isActive ? '#FECACA' : '#A7F3D0'}`, background: facility.isActive ? '#FEF2F2' : '#ECFDF5', color: facility.isActive ? '#DC2626' : '#059669', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif" }}>
          {facility.isActive ? 'Disable' : 'Enable'}
        </button>
      </div>
    </div>
  );
}

// ─── Facility Form Modal ──────────────────────────────────────

function FacilityFormModal({ open, editingId, form, setForm, onClose, onSave }: {
  open: boolean; editingId: string | null;
  form: FacilityFormState; setForm: React.Dispatch<React.SetStateAction<FacilityFormState>>;
  onClose: () => void; onSave: () => void;
}) {
  if (!open) return null;
  const set = <K extends keyof FacilityFormState>(k: K, v: FacilityFormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.4)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px' }}
    >
      <div style={{ width: '100%', maxWidth: '560px', background: '#FFF', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', fontFamily: "'Work Sans', sans-serif", display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div style={{ height: '4px', background: 'linear-gradient(90deg, #2563EB 0%, #0D9488 100%)', flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: '14.5px', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.01em' }}>
              {editingId ? 'Edit Facility' : 'Add Facility'}
            </p>
            <p style={{ fontSize: '11.5px', color: '#9CA3AF', margin: '3px 0 0' }}>
              {editingId ? 'Update facility details and settings' : 'Create a new facility and configure availability'}
            </p>
          </div>
          <button type="button" onClick={onClose}
            style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #EBEBEB', background: '#FAFAFA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', flexShrink: 0 }}>
            <X style={{ width: '12px', height: '12px' }} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <SectionLabel label="Basic Info" />

            <Field label="Facility Name" required span2>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Main Swimming Pool" style={inputStyle} />
            </Field>
            <Field label="Category">
              <select value={form.type} onChange={(e) => set('type', e.target.value as FacilityType)} style={selectStyle}>
                {FACILITY_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{FACILITY_TYPE_LABELS[t] ?? t}</option>
                ))}
              </select>
            </Field>
            <Field label="Icon" hint="pick an icon">
              <IconPicker value={form.iconName} onChange={(v) => set('iconName', v)} color={form.color || '#6B7280'} allowEmpty />
            </Field>
            <Field label="Description" span2>
              <textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Describe this facility…" style={textareaStyle} />
            </Field>

            {/* Color picker */}
            <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Work Sans', sans-serif" }}>Theme Color</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '6px' }}>
                {COLOR_PRESETS.map((c) => (
                  <button key={c} type="button" onClick={() => set('color', c)}
                    style={{ height: '32px', borderRadius: '7px', background: c, border: form.color === c ? '2px solid #111827' : '2px solid transparent', cursor: 'pointer', boxShadow: form.color === c ? '0 2px 8px rgba(0,0,0,0.2)' : 'none', transform: form.color === c ? 'scale(1.08)' : 'none', transition: 'all 120ms' }} />
                ))}
              </div>
            </div>

            <SectionLabel label="Capacity & Pricing" />

            <Field label="Max Capacity">
              <input type="number" min={1} value={form.capacity} onChange={(e) => set('capacity', e.target.value)} placeholder="50" style={inputStyle} />
            </Field>
            <Field label="Billing Type">
              <select value={form.billingCycle} onChange={(e) => set('billingCycle', e.target.value as BillingCycle)} style={selectStyle}>
                <option value={BillingCycle.NONE}>Free</option>
                <option value={BillingCycle.PER_HOUR}>Per Hour</option>
                <option value={BillingCycle.PER_SLOT}>Per Slot</option>
                <option value={BillingCycle.PER_USE}>Per Use</option>
              </select>
            </Field>
            <Field label="Price (EGP)">
              <input type="number" min={0} disabled={form.billingCycle === BillingCycle.NONE}
                value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="0"
                style={{ ...inputStyle, fontFamily: "'DM Mono', monospace", opacity: form.billingCycle === BillingCycle.NONE ? 0.4 : 1 }} />
            </Field>
            <Field label="Max Bookings/Day" hint="Per resident">
              <input type="number" min={1} value={form.maxReservationsPerDay} onChange={(e) => set('maxReservationsPerDay', e.target.value)} placeholder="Unlimited" style={inputStyle} />
            </Field>

            {/* Prepayment toggle */}
            <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '9px', border: '1px solid #EBEBEB', background: '#FAFAFA' }}>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0 }}>Requires Prepayment</p>
                <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '2px 0 0' }}>Residents must pay before the booking is confirmed</p>
              </div>
              <button type="button" onClick={() => set('requiresPrepayment', !form.requiresPrepayment)}
                style={{ position: 'relative', width: '40px', height: '22px', borderRadius: '11px', border: `1.5px solid ${form.requiresPrepayment ? '#A7F3D0' : '#E5E7EB'}`, background: form.requiresPrepayment ? '#ECFDF5' : '#F9FAFB', cursor: 'pointer', transition: 'all 150ms', flexShrink: 0 }}>
                <span style={{ position: 'absolute', top: '2px', width: '16px', height: '16px', borderRadius: '50%', background: form.requiresPrepayment ? '#059669' : '#D1D5DB', left: form.requiresPrepayment ? '20px' : '2px', transition: 'left 150ms' }} />
              </button>
            </div>

            <Field label="Reminder Before (min)">
              <input type="number" min={0} value={form.reminderMinutesBefore} onChange={(e) => set('reminderMinutesBefore', e.target.value)} placeholder="15" style={inputStyle} />
            </Field>
            <Field label="Cooldown (min)">
              <input type="number" min={0} value={form.cooldownMinutes} onChange={(e) => set('cooldownMinutes', e.target.value)} placeholder="0" style={inputStyle} />
            </Field>

            <SectionLabel label="Rules & Policies" />

            <Field label="Rules" span2>
              <textarea value={form.rules} onChange={(e) => set('rules', e.target.value)} placeholder="Enter any rules or policies for this facility…" style={textareaStyle} />
            </Field>

            {/* Tip */}
            <div style={{ gridColumn: 'span 2', padding: '12px 14px', borderRadius: '9px', border: '1px solid #FDE68A', background: '#FFFBEB', fontSize: '12px', color: '#92400E', lineHeight: 1.5 }}>
              💡 Configure time slots and exceptions after creating the facility via <strong>Manage Slots</strong>.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #F3F4F6', flexShrink: 0 }}>
          <button type="button" onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#FFF', color: '#6B7280', cursor: 'pointer', fontSize: '13px', fontFamily: "'Work Sans', sans-serif", fontWeight: 600 }}>
            <X style={{ width: '12px', height: '12px' }} /> Cancel
          </button>
          <button type="button" onClick={onSave}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '8px', background: '#111827', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: '0 2px 6px rgba(0,0,0,0.18)' }}>
            <Check style={{ width: '13px', height: '13px' }} /> Save Facility
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Manage Slots Drawer content ─────────────────────────────

function ManageContent({
  facility, manageFacilityId,
  onRefresh, onLoadBookings,
  manageBookings, manageBookingsLoading,
  manageBookingStatus, setManageBookingStatus,
  onOpenBookingDetail,
}: {
  facility: FacilityDetail;
  manageFacilityId: string;
  onRefresh: () => void;
  onLoadBookings: () => void;
  manageBookings: BookingListItem[];
  manageBookingsLoading: boolean;
  manageBookingStatus: string;
  setManageBookingStatus: (v: string) => void;
  onOpenBookingDetail: (id: string) => void;
}) {
  const [subTab,        setSubTab]        = useState<ManageTab>('overview');
  const [slotEditDay,   setSlotEditDay]   = useState<number | null>(null);
  const [slotEdit,      setSlotEdit]      = useState<SlotEditState>(EMPTY_SLOT_EDIT);
  const [exceptionForm, setExceptionForm] = useState<ExceptionFormState>(EMPTY_EXCEPTION);

  useEffect(() => {
    if (subTab === 'bookings') onLoadBookings();
  }, [subTab]);

  const startEditDay = (day: number) => {
    const existing = facility.slotConfig.find((s) => s.dayOfWeek === day);
    setSlotEditDay(day);
    setSlotEdit({
      startTime:           existing?.startTime            ?? '08:00',
      endTime:             existing?.endTime              ?? '22:00',
      slotDurationMinutes: existing?.slotDurationMinutes?.toString() ?? '60',
      slotCapacity:        existing?.slotCapacity?.toString()        ?? '',
    });
  };

  const saveDayConfig = async () => {
    if (slotEditDay === null) return;
    const dur = parseOptInt(slotEdit.slotDurationMinutes);
    if (!dur || dur < 15) { toast.error('Slot duration must be at least 15 minutes'); return; }
    try {
      await amenitiesService.upsertSlotConfig(manageFacilityId, slotEditDay, {
        startTime: slotEdit.startTime, endTime: slotEdit.endTime,
        slotDurationMinutes: dur, slotCapacity: parseOptInt(slotEdit.slotCapacity),
      });
      onRefresh(); setSlotEditDay(null);
      toast.success('Slot configuration saved');
    } catch { toast.error('Failed to save slot configuration'); }
  };

  const removeDayConfig = async (id: string) => {
    try { await amenitiesService.removeSlotConfig(id); onRefresh(); toast.success('Removed'); }
    catch { toast.error('Failed to remove'); }
  };

  const saveException = async () => {
    if (!exceptionForm.date) { toast.error('Exception date is required'); return; }
    try {
      await amenitiesService.addSlotException(manageFacilityId, {
        date:               new Date(exceptionForm.date).toISOString(),
        isClosed:           exceptionForm.isClosed,
        startTime:          exceptionForm.isClosed ? undefined : exceptionForm.startTime || undefined,
        endTime:            exceptionForm.isClosed ? undefined : exceptionForm.endTime   || undefined,
        slotDurationMinutes: exceptionForm.isClosed ? undefined : parseOptInt(exceptionForm.slotDurationMinutes),
        slotCapacity:        exceptionForm.isClosed ? undefined : parseOptInt(exceptionForm.slotCapacity),
      });
      setExceptionForm(EMPTY_EXCEPTION); onRefresh();
      toast.success('Exception saved');
    } catch { toast.error('Failed to save exception'); }
  };

  const removeException = async (id: string) => {
    try { await amenitiesService.removeSlotException(id); onRefresh(); toast.success('Removed'); }
    catch { toast.error('Failed to remove'); }
  };

  const manageBookingCols: DataTableColumn<BookingListItem>[] = [
    { key: 'date',   header: 'Date',   render: (r) => <span style={{ fontSize: '11.5px', fontFamily: "'DM Mono', monospace", color: '#374151' }}>{fmtDate(r.date)}</span> },
    { key: 'time',   header: 'Time',   render: (r) => <span style={{ fontSize: '11.5px', fontFamily: "'DM Mono', monospace", color: '#374151' }}>{r.startTime} – {r.endTime}</span> },
    { key: 'user',   header: 'User',   render: (r) => <span style={{ fontSize: '12px', color: '#374151' }}>{r.userName}</span> },
    { key: 'unit',   header: 'Unit',   render: (r) => <span style={{ fontSize: '12px', color: '#6B7280' }}>{r.unitNumber ?? '—'}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} /> },
    { key: 'eye',    header: '',       render: (r) => (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <GhostIconBtn icon={<Eye style={{ width: '11px', height: '11px' }} />} onClick={() => onOpenBookingDetail(r.id)} />
      </div>
    )},
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Facility name + sub-tabs */}
      <div>
        <p style={{ fontSize: '15px', fontWeight: 800, color: '#111827', margin: '0 0 12px', letterSpacing: '-0.01em' }}>{facility.name}</p>
        <div style={{ display: 'flex', gap: '2px', padding: '3px', borderRadius: '8px', background: '#F3F4F6' }}>
          {(['overview','schedule','exceptions','bookings'] as ManageTab[]).map((t) => (
            <SmallTabBtn key={t} label={t.charAt(0).toUpperCase() + t.slice(1)} active={subTab === t} onClick={() => setSubTab(t)} />
          ))}
        </div>
      </div>

      {/* ── Overview ── */}
      {subTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <InfoPair label="Type"      value={facility.type} />
          <InfoPair label="Capacity"  value={String(facility.capacity ?? '—')} />
          <InfoPair label="Price"     value={billingLabel(facility.price, facility.billingCycle)} mono />
          <InfoPair label="Today"     value={`${facility.upcomingBookingsToday} bookings`} />
          <InfoPair label="Pending"   value={String(facility.bookingStats.pendingBookings)} />
          <InfoPair label="Revenue"   value={`EGP ${facility.bookingStats.revenueThisMonth.toLocaleString()}`} mono />
          {facility.rules && (
            <div style={{ gridColumn: 'span 2', padding: '12px 14px', borderRadius: '9px', border: '1px solid #EBEBEB', background: '#FAFAFA', fontSize: '12.5px', color: '#374151', lineHeight: 1.55, fontFamily: "'Work Sans', sans-serif" }}>
              {facility.rules}
            </div>
          )}
        </div>
      )}

      {/* ── Schedule ── */}
      {subTab === 'schedule' && (
        <div style={{ borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FFF', overflow: 'hidden' }}>
          {DAYS.map((label, dayOfWeek) => {
            const row = facility.slotConfig.find((s) => s.dayOfWeek === dayOfWeek);
            const isEditing = slotEditDay === dayOfWeek;
            return (
              <div key={label} style={{ borderBottom: dayOfWeek < 6 ? '1px solid #F3F4F6' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#374151', width: '36px', flexShrink: 0, fontFamily: "'Work Sans', sans-serif" }}>{label}</span>
                  {row ? (
                    <>
                      <span style={{ fontSize: '11.5px', color: '#6B7280', fontFamily: "'DM Mono', monospace" }}>{row.startTime} – {row.endTime}</span>
                      <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 7px', borderRadius: '5px', background: '#EFF6FF', color: '#2563EB', fontFamily: "'DM Mono', monospace" }}>{row.slotDurationMinutes}m</span>
                      <span style={{ fontSize: '10.5px', color: '#9CA3AF' }}>Cap {row.slotCapacity ?? 1}/slot</span>
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                        <GhostIconBtn icon={<Edit2 style={{ width: '11px', height: '11px' }} />} onClick={() => startEditDay(dayOfWeek)} />
                        <GhostIconBtn icon={<X    style={{ width: '11px', height: '11px' }} />} onClick={() => void removeDayConfig(row.id)} danger />
                      </div>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: '12px', color: '#C4C9D4', fontFamily: "'Work Sans', sans-serif" }}>Not configured</span>
                      <button type="button" onClick={() => startEditDay(dayOfWeek)}
                        style={{ marginLeft: 'auto', fontSize: '11.5px', fontWeight: 700, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Work Sans', sans-serif" }}>
                        + Add
                      </button>
                    </>
                  )}
                </div>
                {isEditing && (
                  <div style={{ padding: '0 14px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#FAFAFA', borderTop: '1px solid #F3F4F6' }}>
                    <Field label="Start Time"><input type="time" value={slotEdit.startTime} onChange={(e) => setSlotEdit((p) => ({ ...p, startTime: e.target.value }))} style={inputStyle} /></Field>
                    <Field label="End Time">  <input type="time" value={slotEdit.endTime}   onChange={(e) => setSlotEdit((p) => ({ ...p, endTime:   e.target.value }))} style={inputStyle} /></Field>
                    <Field label="Duration (min)"><input type="number" min={15} value={slotEdit.slotDurationMinutes} onChange={(e) => setSlotEdit((p) => ({ ...p, slotDurationMinutes: e.target.value }))} style={inputStyle} /></Field>
                    <Field label="Capacity/Slot"> <input type="number" min={1}  value={slotEdit.slotCapacity}        onChange={(e) => setSlotEdit((p) => ({ ...p, slotCapacity:        e.target.value }))} style={inputStyle} /></Field>
                    <div style={{ gridColumn: 'span 2', display: 'flex', gap: '8px' }}>
                      <button type="button" onClick={() => void saveDayConfig()}
                        style={{ padding: '7px 16px', borderRadius: '7px', background: '#111827', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
                        Save
                      </button>
                      <button type="button" onClick={() => setSlotEditDay(null)}
                        style={{ padding: '7px 14px', borderRadius: '7px', border: '1px solid #E5E7EB', background: '#FFF', color: '#6B7280', cursor: 'pointer', fontSize: '12.5px', fontFamily: "'Work Sans', sans-serif" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Exceptions ── */}
      {subTab === 'exceptions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Existing */}
          <div style={{ borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FFF', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #F3F4F6' }}>
              <p style={{ fontSize: '12px', fontWeight: 700, color: '#111827', margin: 0 }}>Existing Exceptions</p>
            </div>
            {facility.slotExceptions.length === 0
              ? <div style={{ padding: '20px' }}><EmptyState title="No exceptions" description="Add a date-specific exception below." /></div>
              : facility.slotExceptions.map((item) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderBottom: '1px solid #F9FAFB' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#111827', fontFamily: "'DM Mono', monospace" }}>{fmtDate(item.date)}</span>
                    {item.isClosed
                      ? <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px', background: '#FEF2F2', color: '#DC2626' }}>Closed</span>
                      : <span style={{ fontSize: '11px', color: '#6B7280', fontFamily: "'DM Mono', monospace" }}>{item.startTime} – {item.endTime}</span>
                    }
                  </div>
                  <button type="button" onClick={() => void removeException(item.id)}
                    style={{ fontSize: '11.5px', fontWeight: 700, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Work Sans', sans-serif" }}>
                    Remove
                  </button>
                </div>
              ))
            }
          </div>

          {/* Add form */}
          <div style={{ borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FFF', padding: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <p style={{ gridColumn: 'span 2', fontSize: '12px', fontWeight: 700, color: '#111827', margin: 0 }}>Add Exception</p>
            <Field label="Date" required>
              <input type="date" value={exceptionForm.date} onChange={(e) => setExceptionForm((p) => ({ ...p, date: e.target.value }))} style={inputStyle} />
            </Field>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="button" onClick={() => setExceptionForm((p) => ({ ...p, isClosed: !p.isClosed }))}
                style={{ padding: '6px 14px', borderRadius: '6px', border: `1px solid ${exceptionForm.isClosed ? '#FECACA' : '#E5E7EB'}`, background: exceptionForm.isClosed ? '#FEF2F2' : '#FAFAFA', color: exceptionForm.isClosed ? '#DC2626' : '#9CA3AF', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif" }}>
                {exceptionForm.isClosed ? '✗ Closed Day' : 'Mark as Closed'}
              </button>
            </div>
            {!exceptionForm.isClosed && (
              <>
                <Field label="Start"><input type="time" value={exceptionForm.startTime} onChange={(e) => setExceptionForm((p) => ({ ...p, startTime: e.target.value }))} style={inputStyle} /></Field>
                <Field label="End">  <input type="time" value={exceptionForm.endTime}   onChange={(e) => setExceptionForm((p) => ({ ...p, endTime:   e.target.value }))} style={inputStyle} /></Field>
              </>
            )}
            <div style={{ gridColumn: 'span 2' }}>
              <button type="button" onClick={() => void saveException()}
                style={{ padding: '7px 20px', borderRadius: '7px', background: '#111827', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
                Save Exception
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bookings ── */}
      {subTab === 'bookings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <select value={manageBookingStatus} onChange={(e) => { setManageBookingStatus(e.target.value); onLoadBookings(); }} style={{ ...selectStyle, width: '160px' }}>
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <DataTable
            columns={manageBookingCols}
            rows={manageBookings}
            rowKey={(r) => r.id}
            loading={manageBookingsLoading}
            emptyTitle="No bookings"
            emptyDescription="Bookings for this facility will appear here."
          />
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────

export function AmenitiesManagement() {
  const [tab,              setTab]              = useState<MainTab>('facilities');
  const [stats,            setStats]            = useState<AmenityStats | null>(null);
  const [facilities,       setFacilities]       = useState<FacilityListItem[]>([]);
  const [facilityDetails,  setFacilityDetails]  = useState<Record<string, FacilityDetail>>({});
  const [facilitiesLoading, setFacilitiesLoading] = useState(true);
  const [categoryFilter,    setCategoryFilter]    = useState<FacilityType | 'ALL'>('ALL');

  const [facilityModalOpen, setFacilityModalOpen] = useState(false);
  const [editingFacilityId, setEditingFacilityId] = useState<string | null>(null);
  const [facilityForm,      setFacilityForm]      = useState<FacilityFormState>(EMPTY_FACILITY_FORM);

  const [manageDrawerOpen,   setManageDrawerOpen]   = useState(false);
  const [manageFacilityId,   setManageFacilityId]   = useState<string | null>(null);
  const [manageBookings,     setManageBookings]     = useState<BookingListItem[]>([]);
  const [manageBookingsLoading, setManageBookingsLoading] = useState(false);
  const [manageBookingStatus, setManageBookingStatus] = useState('ALL');

  const [bookings,       setBookings]       = useState<BookingListItem[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingSearch,  setBookingSearch]  = useState('');
  const [bookingFacId,   setBookingFacId]   = useState('ALL');
  const [bookingStatus,  setBookingStatus]  = useState('ALL');
  const [bookingFrom,    setBookingFrom]    = useState('');
  const [bookingTo,      setBookingTo]      = useState('');
  const [bookingPage,    setBookingPage]    = useState(1);
  const [bookingTotal,   setBookingTotal]   = useState(0);
  const [bookingTotalPages, setBookingTotalPages] = useState(1);
  const [filtersOpen,    setFiltersOpen]    = useState(false);

  const [bookingDetailOpen, setBookingDetailOpen] = useState(false);
  const [bookingDetail,     setBookingDetail]     = useState<BookingDetail | null>(null);
  const [showRejectInput,   setShowRejectInput]   = useState(false);
  const [rejectReason,      setRejectReason]      = useState('');

  const managedFacility = useMemo(
    () => manageFacilityId ? facilityDetails[manageFacilityId] ?? null : null,
    [facilityDetails, manageFacilityId],
  );

  const filteredFacilities = useMemo(
    () => categoryFilter === 'ALL' ? facilities : facilities.filter((f) => f.type === categoryFilter),
    [facilities, categoryFilter],
  );

  // ── Loaders ───────────────────────────────────────────────────

  const loadStats = async () => {
    const s = await amenitiesService.getAmenityStats();
    setStats(s);
  };

  const loadFacilities = async () => {
    setFacilitiesLoading(true);
    try {
      const [list] = await Promise.all([amenitiesService.listFacilities(true), loadStats()]);
      setFacilities(list);
      const entries = await Promise.all(
        list.map(async (f) => {
          try { return [f.id, await amenitiesService.getFacilityDetail(f.id)] as const; }
          catch { return [f.id, null] as const; }
        }),
      );
      const map: Record<string, FacilityDetail> = {};
      entries.forEach(([id, d]) => { if (d) map[id] = d; });
      setFacilityDetails(map);
    } catch { toast.error('Failed to load facilities'); }
    finally { setFacilitiesLoading(false); }
  };

  const loadBookings = async () => {
    setBookingsLoading(true);
    try {
      const r = await amenitiesService.listBookings({
        page: bookingPage, limit: 25,
        search:     bookingSearch  || undefined,
        facilityId: bookingFacId   !== 'ALL' ? bookingFacId  : undefined,
        status:     bookingStatus  !== 'ALL' ? (bookingStatus as BookingStatus) : undefined,
        dateFrom:   bookingFrom    ? new Date(bookingFrom).toISOString()                   : undefined,
        dateTo:     bookingTo      ? new Date(`${bookingTo}T23:59:59`).toISOString()        : undefined,
      });
      setBookings(r.data); setBookingTotal(r.total); setBookingTotalPages(r.totalPages);
      await loadStats();
    } catch { toast.error('Failed to load bookings'); }
    finally { setBookingsLoading(false); }
  };

  const loadManageBookings = async () => {
    if (!manageFacilityId) return;
    setManageBookingsLoading(true);
    try {
      const r = await amenitiesService.listBookings({
        page: 1, limit: 50, facilityId: manageFacilityId,
        status: manageBookingStatus !== 'ALL' ? (manageBookingStatus as BookingStatus) : undefined,
      });
      setManageBookings(r.data);
    } catch { toast.error('Failed to load facility bookings'); }
    finally { setManageBookingsLoading(false); }
  };

  const refreshManagedFacility = async () => {
    if (!manageFacilityId) return;
    const d = await amenitiesService.getFacilityDetail(manageFacilityId);
    setFacilityDetails((p) => ({ ...p, [manageFacilityId]: d }));
  };

  useEffect(() => { if (tab === 'facilities') void loadFacilities(); }, [tab]);
  useEffect(() => { if (tab === 'bookings')   void loadBookings();   }, [tab, bookingPage, bookingSearch, bookingFacId, bookingStatus, bookingFrom, bookingTo]);

  // ── Facility CRUD ─────────────────────────────────────────────

  const openCreate = () => {
    setEditingFacilityId(null); setFacilityForm(EMPTY_FACILITY_FORM); setFacilityModalOpen(true);
  };

  const openEdit = async (id: string) => {
    try {
      const d = await amenitiesService.getFacilityDetail(id);
      setFacilityDetails((p) => ({ ...p, [id]: d }));
      setEditingFacilityId(id);
      setFacilityForm({
        name: d.name, type: d.type, description: d.description ?? '',
        iconName: d.iconName ?? '', color: d.color ?? COLOR_PRESETS[0],
        capacity: d.capacity?.toString() ?? '', billingCycle: d.billingCycle,
        price: d.price?.toString() ?? '', maxReservationsPerDay: d.maxReservationsPerDay?.toString() ?? '',
        requiresPrepayment: d.requiresPrepayment,
        reminderMinutesBefore: d.reminderMinutesBefore?.toString() ?? '',
        cooldownMinutes: d.cooldownMinutes?.toString() ?? '', rules: d.rules ?? '',
      });
      setFacilityModalOpen(true);
    } catch { toast.error('Failed to load facility'); }
  };

  const saveFacility = async () => {
    if (!facilityForm.name.trim()) { toast.error('Facility name is required'); return; }
    const payload = {
      name: facilityForm.name.trim(), type: facilityForm.type,
      description: facilityForm.description.trim() || undefined,
      iconName: facilityForm.iconName.trim() || undefined,
      color: facilityForm.color || undefined,
      capacity: parseOptInt(facilityForm.capacity),
      billingCycle: facilityForm.billingCycle,
      price: facilityForm.billingCycle === BillingCycle.NONE ? undefined : parseOptNum(facilityForm.price),
      maxReservationsPerDay: parseOptInt(facilityForm.maxReservationsPerDay),
      requiresPrepayment: facilityForm.requiresPrepayment,
      reminderMinutesBefore: parseOptInt(facilityForm.reminderMinutesBefore),
      cooldownMinutes: parseOptInt(facilityForm.cooldownMinutes),
      rules: facilityForm.rules.trim() || undefined,
    };
    try {
      if (editingFacilityId) await amenitiesService.updateFacility(editingFacilityId, payload);
      else                   await amenitiesService.createFacility(payload);
      setFacilityModalOpen(false); await loadFacilities(); toast.success('Facility saved');
    } catch { toast.error('Failed to save facility'); }
  };

  const toggleFacility = async (id: string) => {
    try { await amenitiesService.toggleFacility(id); await loadFacilities(); toast.success('Updated'); }
    catch { toast.error('Failed to update'); }
  };

  const openManageDrawer = async (id: string) => {
    try {
      const d = await amenitiesService.getFacilityDetail(id);
      setFacilityDetails((p) => ({ ...p, [id]: d }));
      setManageFacilityId(id); setManageDrawerOpen(true);
    } catch { toast.error('Failed to load facility details'); }
  };

  // ── Booking actions ───────────────────────────────────────────

  const openBookingDetail = async (id: string) => {
    try {
      const d = await amenitiesService.getBookingDetail(id);
      setBookingDetail(d); setShowRejectInput(false); setRejectReason(''); setBookingDetailOpen(true);
    } catch { toast.error('Failed to load booking detail'); }
  };

  const approveBooking = async (id: string) => {
    try {
      await amenitiesService.approveBooking(id);
      await Promise.all([loadBookings(), loadFacilities(), loadManageBookings()]);
      if (bookingDetail?.id === id) setBookingDetail(await amenitiesService.getBookingDetail(id));
      toast.success('Booking approved');
    } catch { toast.error('Failed to approve booking'); }
  };

  const rejectBooking = async (id: string) => {
    if (!rejectReason.trim()) { toast.error('Reject reason is required'); return; }
    try {
      await amenitiesService.rejectBooking(id, rejectReason.trim());
      await Promise.all([loadBookings(), loadFacilities(), loadManageBookings()]);
      if (bookingDetail?.id === id) setBookingDetail(await amenitiesService.getBookingDetail(id));
      setShowRejectInput(false); setRejectReason(''); toast.success('Booking rejected');
    } catch { toast.error('Failed to reject booking'); }
  };

  // ── Booking columns ───────────────────────────────────────────

  const bookingCols = useMemo<DataTableColumn<BookingListItem>[]>(() => [
    { key: 'facility', header: 'Facility',  render: (r) => <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#111827' }}>{r.facilityName}</span> },
    { key: 'user',     header: 'User',      render: (r) => <span style={{ fontSize: '12px', color: '#374151' }}>{r.userName}</span> },
    { key: 'unit',     header: 'Unit',      render: (r) => <span style={{ fontSize: '12px', color: '#6B7280' }}>{r.unitNumber ?? '—'}</span> },
    { key: 'date',     header: 'Date',      render: (r) => <span style={{ fontSize: '11.5px', fontFamily: "'DM Mono', monospace", color: '#374151' }}>{fmtDate(r.date)}</span> },
    { key: 'time',     header: 'Time',      render: (r) => <span style={{ fontSize: '11.5px', fontFamily: "'DM Mono', monospace", color: '#374151' }}>{r.startTime} – {r.endTime}</span> },
    { key: 'amount',   header: 'Amount',    render: (r) => <span style={{ fontSize: '12.5px', fontWeight: 700, fontFamily: "'DM Mono', monospace", color: r.totalAmount === null ? '#D1D5DB' : '#111827', display: 'block', textAlign: 'right' }}>{amountLabel(r.totalAmount)}</span> },
    { key: 'status',   header: 'Status',    render: (r) => <StatusBadge value={r.status} /> },
    { key: 'actions',  header: '',          render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
        <GhostIconBtn icon={<Eye style={{ width: '11px', height: '11px' }} />} onClick={() => void openBookingDetail(r.id)} />
        {(r.status === BookingStatus.PENDING || r.status === BookingStatus.PENDING_PAYMENT) && (
          <>
            <GhostIconBtn icon={<Check style={{ width: '11px', height: '11px' }} />} onClick={() => void approveBooking(r.id)} />
            <GhostIconBtn icon={<X    style={{ width: '11px', height: '11px' }} />} onClick={() => void openBookingDetail(r.id)} danger />
          </>
        )}
      </div>
    )},
  ], []);

  const activeFilters = [bookingFacId !== 'ALL', bookingStatus !== 'ALL', bookingFrom, bookingTo].filter(Boolean).length;

  // ─────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: 'calc(100vh - 140px)', background: '#F5F4F1', borderRadius: '14px', padding: '28px', fontFamily: "'Work Sans', sans-serif", display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>Amenities</h1>
          <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '3px 0 0', fontWeight: 500 }}>Manage facilities, slot schedules, and bookings</p>
        </div>
      </div>

      {/* ── Top-level tabs ─────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '4px', borderRadius: '10px', background: '#EBEBEB' }}>
        <TabBtn label="Facilities" active={tab === 'facilities'} onClick={() => setTab('facilities')} />
        <TabBtn label="Bookings"   active={tab === 'bookings'}   onClick={() => setTab('bookings')} />
      </div>

      {/* ══ Facilities tab ════════════════════════════════════ */}
      {tab === 'facilities' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            <StatCard icon="occupancy"    title="Total Facilities"   value={String(stats?.totalFacilities ?? 0)}                            subtitle="All configured" onClick={() => setTab('facilities')} />
            <StatCard icon="active-users" title="Active"             value={String(stats?.activeFacilities ?? 0)}                           subtitle="Bookable now"  onClick={() => setTab('facilities')} />
            <StatCard icon="tickets"      title="Bookings Today"     value={String(stats?.bookingsToday ?? 0)}                              subtitle="All facilities" onClick={() => setTab('bookings')} />
            <StatCard icon="revenue"      title="Revenue This Month" value={`EGP ${(stats?.revenueThisMonth ?? 0).toLocaleString()}`}       subtitle="Collected"     onClick={() => setTab('bookings')} />
          </div>

          {/* Facilities card */}
          <div style={{ borderRadius: '12px', border: '1px solid #EBEBEB', background: '#FFF', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 800, color: '#111827', margin: 0 }}>Facilities</p>
                <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '3px 0 0' }}>Slot config and booking actions per facility</p>
              </div>
              <button type="button" onClick={openCreate}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', height: '36px', borderRadius: '8px', background: '#111827', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
                <Plus style={{ width: '13px', height: '13px' }} /> Add Facility
              </button>
            </div>

            {/* Category filter pills */}
            <div style={{ padding: '12px 18px 0', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              {(['ALL' as const, ...FACILITY_TYPE_OPTIONS, ...facilities.map((f) => f.type).filter((t) => !FACILITY_TYPE_OPTIONS.includes(t)).filter((v, i, a) => a.indexOf(v) === i)] as const).map((t) => {
                const isActive = categoryFilter === t;
                const label = t === 'ALL' ? 'All Categories' : (FACILITY_TYPE_LABELS[t] ?? t);
                const pillColor = t !== 'ALL' ? categoryPillColor(t) : null;
                return (
                  <button key={t} type="button" onClick={() => setCategoryFilter(t)}
                    style={{
                      padding: '5px 14px', borderRadius: '20px', fontSize: '11.5px', fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer', transition: 'all 120ms', fontFamily: "'Work Sans', sans-serif",
                      border: isActive
                        ? `1.5px solid ${t === 'ALL' ? '#111827' : pillColor!.border}`
                        : '1.5px solid #E5E7EB',
                      background: isActive
                        ? (t === 'ALL' ? '#111827' : pillColor!.bg)
                        : '#FAFAFA',
                      color: isActive
                        ? (t === 'ALL' ? '#FFF' : pillColor!.text)
                        : '#9CA3AF',
                    }}>
                    {label}
                    {isActive && t !== 'ALL' && (
                      <span style={{ marginLeft: '6px', fontSize: '10px', opacity: 0.7 }}>
                        ({facilities.filter((f) => f.type === t).length})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div style={{ padding: '16px 18px' }}>
              {facilitiesLoading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} style={{ height: '180px', borderRadius: '12px', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', border: '1px solid #EBEBEB' }} />
                  ))}
                  <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
                </div>
              ) : filteredFacilities.length === 0 ? (
                <EmptyState title={categoryFilter === 'ALL' ? 'No facilities found' : `No ${FACILITY_TYPE_LABELS[categoryFilter] ?? categoryFilter} facilities`} description={categoryFilter === 'ALL' ? 'Create your first facility.' : 'Try selecting a different category or create a new facility.'} />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                  {filteredFacilities.map((f) => (
                    <FacilityCard
                      key={f.id}
                      facility={f}
                      detail={facilityDetails[f.id]}
                      onManage={() => void openManageDrawer(f.id)}
                      onEdit={()   => void openEdit(f.id)}
                      onToggle={()  => void toggleFacility(f.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ Bookings tab ══════════════════════════════════════ */}
      {tab === 'bookings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            <StatCard icon="tickets"         title="Total Bookings"    value={String((stats?.bookingsByStatus.PENDING ?? 0) + (stats?.bookingsByStatus.APPROVED ?? 0) + (stats?.bookingsByStatus.CANCELLED ?? 0) + (stats?.bookingsByStatus.REJECTED ?? 0))} subtitle="All statuses" onClick={() => setTab('bookings')} />
            <StatCard icon="complaints-open" title="Pending Approval"  value={String(stats?.pendingApprovals ?? 0)}                              subtitle="Awaiting action" onClick={() => setTab('bookings')} />
            <StatCard icon="active-users"    title="Approved Today"    value={String(stats?.bookingsToday ?? 0)}                                  subtitle="Daily activity" onClick={() => setTab('bookings')} />
            <StatCard icon="revenue"         title="Revenue This Month" value={`EGP ${(stats?.revenueThisMonth ?? 0).toLocaleString()}`}          subtitle="Collected"      onClick={() => setTab('bookings')} />
          </div>

          {/* Table card */}
          <div style={{ borderRadius: '12px', border: '1px solid #EBEBEB', background: '#FFF', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            {/* Search + filter bar */}
            <div style={{ borderBottom: filtersOpen ? '1px solid #F3F4F6' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px' }}>
                <Search style={{ width: '13px', height: '13px', color: '#C4C9D4', flexShrink: 0 }} />
                <input
                  placeholder="Search user or unit…"
                  value={bookingSearch}
                  onChange={(e) => { setBookingSearch(e.target.value); setBookingPage(1); }}
                  style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: '#111827', fontFamily: "'Work Sans', sans-serif" }}
                />
                <button type="button" onClick={() => setFiltersOpen((p) => !p)}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: `1px solid ${activeFilters > 0 ? '#2563EB40' : '#E5E7EB'}`, background: activeFilters > 0 ? '#EFF6FF' : '#FAFAFA', color: activeFilters > 0 ? '#2563EB' : '#6B7280', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif", flexShrink: 0 }}>
                  <SlidersHorizontal style={{ width: '11px', height: '11px' }} />
                  Filters
                  {activeFilters > 0 && <span style={{ width: '15px', height: '15px', borderRadius: '50%', background: '#2563EB', color: '#FFF', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{activeFilters}</span>}
                  <ChevronDown style={{ width: '10px', height: '10px', transform: filtersOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
                </button>
              </div>
              {filtersOpen && (
                <div style={{ padding: '10px 14px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <select value={bookingFacId} onChange={(e) => { setBookingFacId(e.target.value); setBookingPage(1); }} style={{ ...selectStyle, width: '180px' }}>
                    <option value="ALL">All Facilities</option>
                    {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <select value={bookingStatus} onChange={(e) => { setBookingStatus(e.target.value); setBookingPage(1); }} style={{ ...selectStyle, width: '150px' }}>
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING">Pending</option>
                    <option value="PENDING_PAYMENT">Pending Payment</option>
                    <option value="APPROVED">Approved</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '7px', border: '1px solid #E5E7EB', background: '#FAFAFA' }}>
                    <CalendarRange style={{ width: '11px', height: '11px', color: '#C4C9D4' }} />
                    <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>FROM</span>
                    <input type="date" value={bookingFrom} onChange={(e) => { setBookingFrom(e.target.value); setBookingPage(1); }}
                      style={{ width: '120px', border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', color: '#374151', fontFamily: "'Work Sans', sans-serif" }} />
                    <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>TO</span>
                    <input type="date" value={bookingTo} onChange={(e) => { setBookingTo(e.target.value); setBookingPage(1); }}
                      style={{ width: '120px', border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', color: '#374151', fontFamily: "'Work Sans', sans-serif" }} />
                  </div>
                </div>
              )}
            </div>

            <DataTable
              columns={bookingCols}
              rows={bookings}
              rowKey={(r) => r.id}
              loading={bookingsLoading}
              emptyTitle="No bookings found"
              emptyDescription="Try adjusting your search or filters."
            />

            <Pagination
              page={bookingPage} totalPages={bookingTotalPages} total={bookingTotal}
              onPrev={() => setBookingPage((p) => Math.max(1, p - 1))}
              onNext={() => setBookingPage((p) => Math.min(bookingTotalPages, p + 1))}
            />
          </div>
        </div>
      )}

      {/* ══ Facility form modal ═══════════════════════════════ */}
      <FacilityFormModal
        open={facilityModalOpen}
        editingId={editingFacilityId}
        form={facilityForm}
        setForm={setFacilityForm}
        onClose={() => setFacilityModalOpen(false)}
        onSave={() => void saveFacility()}
      />

      {/* ══ Manage slots drawer ═══════════════════════════════ */}
      <DrawerForm
        open={manageDrawerOpen}
        onOpenChange={setManageDrawerOpen}
        title={managedFacility ? `Manage · ${managedFacility.name}` : 'Manage Slots'}
        description="Configure time slots, exceptions, and schedules."
        widthClassName="w-full sm:max-w-[640px]"
      >
        {!managedFacility
          ? <EmptyState title="No facility selected" description="Select a facility first." />
          : <ManageContent
              key={manageFacilityId}
              facility={managedFacility}
              manageFacilityId={manageFacilityId!}
              onRefresh={() => void refreshManagedFacility()}
              onLoadBookings={() => void loadManageBookings()}
              manageBookings={manageBookings}
              manageBookingsLoading={manageBookingsLoading}
              manageBookingStatus={manageBookingStatus}
              setManageBookingStatus={setManageBookingStatus}
              onOpenBookingDetail={(id) => void openBookingDetail(id)}
            />
        }
      </DrawerForm>

      {/* ══ Booking detail drawer ═════════════════════════════ */}
      <DrawerForm
        open={bookingDetailOpen}
        onOpenChange={setBookingDetailOpen}
        title={bookingDetail ? `${bookingDetail.facilityName} · ${fmtDate(bookingDetail.date)}` : 'Booking Detail'}
        description="View and manage booking requests."
      >
        {!bookingDetail
          ? <EmptyState title="No booking selected" description="Select a booking to view details." />
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Badges */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <StatusBadge value={bookingDetail.status} />
                {bookingDetail.requiresPrepayment && <StatusBadge value={bookingDetail.paymentStatus ?? 'PENDING'} />}
              </div>

              {/* Booking info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { label: 'User',    value: bookingDetail.userName },
                  { label: 'Phone',   value: bookingDetail.userPhone ?? '—' },
                  { label: 'Unit',    value: bookingDetail.unitNumber ?? '—' },
                  { label: 'Date',    value: fmtDate(bookingDetail.date) },
                  { label: 'Time',    value: `${bookingDetail.startTime} – ${bookingDetail.endTime}` },
                  { label: 'Booked',  value: fmtDateTime(bookingDetail.createdAt) },
                ].map(({ label, value }) => (
                  <InfoPair key={label} label={label} value={value} mono={['Time','Date','Booked'].includes(label)} />
                ))}
              </div>

              {/* Facility */}
              <div style={{ padding: '12px 14px', borderRadius: '9px', border: '1px solid #EBEBEB', background: '#FAFAFA' }}>
                <p style={{ fontSize: '9.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 5px', fontFamily: "'Work Sans', sans-serif" }}>Facility</p>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0 }}>{bookingDetail.facilityName} <span style={{ color: '#9CA3AF', fontWeight: 400 }}>({bookingDetail.facilityType})</span></p>
                {bookingDetail.facilityRules && <p style={{ fontSize: '12px', color: '#6B7280', margin: '6px 0 0', lineHeight: 1.5 }}>{bookingDetail.facilityRules}</p>}
              </div>

              {/* Payment */}
              {bookingDetail.totalAmount !== null && bookingDetail.totalAmount > 0 && (
                <div style={{ padding: '14px', borderRadius: '9px', border: '1px solid #EBEBEB', background: '#FFF', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <p style={{ fontSize: '9.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0, fontFamily: "'Work Sans', sans-serif" }}>Payment</p>
                  <p style={{ fontSize: '22px', fontWeight: 900, color: '#111827', margin: 0, fontFamily: "'DM Mono', monospace", letterSpacing: '-0.03em' }}>
                    EGP {bookingDetail.totalAmount.toLocaleString()}
                  </p>
                  <p style={{ fontSize: '11.5px', color: '#9CA3AF', margin: 0 }}>Status: {bookingDetail.paymentStatus ?? 'PENDING'}</p>
                  {bookingDetail.invoices[0] && <p style={{ fontSize: '11.5px', color: '#9CA3AF', margin: 0 }}>Invoice: {bookingDetail.invoices[0].invoiceNumber}</p>}
                </div>
              )}

              {/* Actions */}
              {(bookingDetail.status === BookingStatus.PENDING || bookingDetail.status === BookingStatus.PENDING_PAYMENT) && (
                <div style={{ padding: '14px', borderRadius: '9px', border: '1px solid #EBEBEB', background: '#FFF', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0, fontFamily: "'Work Sans', sans-serif" }}>Actions</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => void approveBooking(bookingDetail.id)}
                      style={{ padding: '7px 16px', borderRadius: '7px', background: '#2563EB', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
                      Approve Booking
                    </button>
                    <button type="button" onClick={() => setShowRejectInput((p) => !p)}
                      style={{ padding: '7px 16px', borderRadius: '7px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
                      Reject Booking
                    </button>
                  </div>
                  {showRejectInput && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Reason for rejection…" style={textareaStyle} />
                      <button type="button" onClick={() => void rejectBooking(bookingDetail.id)}
                        style={{ alignSelf: 'flex-start', padding: '7px 16px', borderRadius: '7px', background: '#DC2626', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
                        Confirm Reject
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        }
      </DrawerForm>
    </div>
  );
}