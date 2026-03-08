import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Eye, Pencil, Plus, Search, SlidersHorizontal, ChevronDown, X, CalendarRange } from 'lucide-react';
import { PermitCategory, ServiceFieldType } from '@prisma/client';
import { toast } from 'sonner';
import { DataTable, type DataTableColumn } from '../DataTable';
import { DrawerForm } from '../DrawerForm';
import { StatusBadge } from '../StatusBadge';
import { StatCard } from '../StatCard';
import permitsService, {
  type PermitRequestDetail,
  type PermitRequestListItem,
  type PermitStats,
  type PermitTypeItem,
} from '../../lib/permitsService';
import { errorMessage, formatDateTime, humanizeEnum } from '../../lib/live-data';

// ─── Types ────────────────────────────────────────────────────

type PermitStatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

// ─── Constants ────────────────────────────────────────────────

const PERMIT_CATEGORIES: PermitCategory[] = [
  PermitCategory.ACCOUNT_INFO,
  PermitCategory.LEGAL_OWNERSHIP,
  PermitCategory.UTILITIES_SERVICES,
  PermitCategory.COMMUNITY_ACTIVITIES,
  PermitCategory.OPERATIONAL,
];

const FIELD_TYPE_OPTIONS: ServiceFieldType[] = [
  ServiceFieldType.TEXT, ServiceFieldType.TEXTAREA, ServiceFieldType.NUMBER,
  ServiceFieldType.DATE, ServiceFieldType.BOOLEAN,  ServiceFieldType.MEMBER_SELECTOR, ServiceFieldType.FILE,
];

const ICON_NAME_OPTIONS = ['Wrench', 'Shield', 'FileText', 'Key', 'Building', 'Car', 'Clock', 'Home', 'Users', 'AlertTriangle', 'Zap', 'Leaf'] as const;

const COLOR_PALETTE = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316', '#14B8A6', '#F43F5E'] as const;

const CATEGORY_META: Record<PermitCategory, { bg: string; color: string; accent: string }> = {
  ACCOUNT_INFO:         { bg: '#EFF6FF', color: '#2563EB', accent: '#2563EB' },
  LEGAL_OWNERSHIP:      { bg: '#EDE9FE', color: '#7C3AED', accent: '#7C3AED' },
  UTILITIES_SERVICES:   { bg: '#F0FDFA', color: '#0D9488', accent: '#0D9488' },
  COMMUNITY_ACTIVITIES: { bg: '#ECFDF5', color: '#059669', accent: '#059669' },
  OPERATIONAL:          { bg: '#FFFBEB', color: '#D97706', accent: '#D97706' },
};

// ─── Helpers ──────────────────────────────────────────────────

function categoryChip(cat: PermitCategory): React.ReactNode {
  const m = CATEGORY_META[cat];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '5px', fontSize: '10.5px', fontWeight: 700, background: m.bg, color: m.color, fontFamily: "'Work Sans', sans-serif", whiteSpace: 'nowrap' }}>
      {humanizeEnum(cat)}
    </span>
  );
}

function renderFieldValue(field: PermitRequestDetail['fieldValues'][number]): React.ReactNode {
  const s: React.CSSProperties = { fontSize: '13px', fontWeight: 600, color: '#111827', fontFamily: "'Work Sans', sans-serif" };
  if (field.type === ServiceFieldType.FILE && field.valueText) {
    const name = field.valueText.split('/').at(-1) ?? field.valueText;
    return <a href={field.valueText} target="_blank" rel="noreferrer" style={{ ...s, color: '#2563EB', textDecoration: 'underline' }}>{name}</a>;
  }
  if (field.type === ServiceFieldType.BOOLEAN) {
    return <span style={s}>{field.valueBool === null ? '—' : field.valueBool ? 'Yes' : 'No'}</span>;
  }
  if (field.type === ServiceFieldType.DATE) {
    return <span style={s}>{field.valueDate ? formatDateTime(field.valueDate) : '—'}</span>;
  }
  if (field.valueNumber !== null) return <span style={s}>{field.valueNumber}</span>;
  if (field.valueText) return <span style={s}>{field.valueText}</span>;
  return <span style={{ ...s, color: '#C4C9D4' }}>—</span>;
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

function GhostIconBtn({ icon, onClick, disabled, title }: {
  icon: React.ReactNode; onClick: () => void; disabled?: boolean; title?: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #EBEBEB', background: hov && !disabled ? '#F3F4F6' : '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'not-allowed' : 'pointer', color: disabled ? '#D1D5DB' : hov ? '#374151' : '#9CA3AF', transition: 'all 120ms', flexShrink: 0 }}>
      {icon}
    </button>
  );
}

function Field({ label, required, span2, children }: {
  label: string; required?: boolean; span2?: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', gridColumn: span2 ? 'span 2' : undefined }}>
      <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Work Sans', sans-serif" }}>
        {label}{required && <span style={{ color: '#EF4444', marginLeft: '3px' }}>*</span>}
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

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange}
      style={{ position: 'relative', width: '40px', height: '22px', borderRadius: '11px', border: `1.5px solid ${checked ? '#A7F3D0' : '#E5E7EB'}`, background: checked ? '#ECFDF5' : '#F9FAFB', cursor: 'pointer', transition: 'all 150ms', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: '2px', width: '16px', height: '16px', borderRadius: '50%', background: checked ? '#059669' : '#D1D5DB', left: checked ? '20px' : '2px', transition: 'left 150ms' }} />
    </button>
  );
}

function DateRangePill({ from, to, onFrom, onTo }: {
  from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '7px', border: '1px solid #E5E7EB', background: '#FAFAFA', flexShrink: 0 }}>
      <CalendarRange style={{ width: '11px', height: '11px', color: '#C4C9D4' }} />
      <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#C4C9D4', textTransform: 'uppercase', letterSpacing: '0.06em' }}>FROM</span>
      <input type="date" value={from} onChange={(e) => onFrom(e.target.value)}
        style={{ width: '120px', border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', color: '#374151', fontFamily: "'Work Sans', sans-serif" }} />
      <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#C4C9D4', textTransform: 'uppercase', letterSpacing: '0.06em' }}>TO</span>
      <input type="date" value={to} onChange={(e) => onTo(e.target.value)}
        style={{ width: '120px', border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', color: '#374151', fontFamily: "'Work Sans', sans-serif" }} />
    </div>
  );
}

// ─── PermitTypeEditor (right panel) ──────────────────────────

function PermitTypeEditor({ selectedType, onRefresh }: {
  selectedType: PermitTypeItem | null; onRefresh: (id: string) => Promise<void>;
}) {
  const [editingName,    setEditingName]    = useState(false);
  const [nameDraft,      setNameDraft]      = useState('');
  const [editingAppearance, setEditingAppearance] = useState(false);
  const [iconDraft,      setIconDraft]      = useState('');
  const [colorDraft,     setColorDraft]     = useState('');
  const [addingField,    setAddingField]    = useState(false);
  const [fieldLabel,     setFieldLabel]     = useState('');
  const [fieldType,      setFieldType]      = useState<ServiceFieldType>(ServiceFieldType.TEXT);
  const [fieldRequired,  setFieldRequired]  = useState(false);
  const [saving,         setSaving]         = useState(false);

  useEffect(() => {
    if (selectedType) {
      setNameDraft(selectedType.name); setEditingName(false); setAddingField(false);
      setIconDraft(selectedType.iconName ?? 'FileText'); setColorDraft(selectedType.color ?? COLOR_PALETTE[0]);
      setEditingAppearance(false);
    }
  }, [selectedType?.id]);

  if (!selectedType) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', color: '#C4C9D4', fontSize: '13px', fontFamily: "'Work Sans', sans-serif", textAlign: 'center' }}>
        Select a permit type to configure its fields.
      </div>
    );
  }

  const accent = CATEGORY_META[selectedType.category]?.accent ?? '#6B7280';

  const handleSaveName = async () => {
    if (!nameDraft.trim()) return;
    setSaving(true);
    try {
      await permitsService.updatePermitType(selectedType.id, { name: nameDraft.trim() });
      setEditingName(false); await onRefresh(selectedType.id);
    } catch (e) { toast.error('Failed to save name', { description: errorMessage(e) }); }
    finally { setSaving(false); }
  };

  const handleSaveAppearance = async () => {
    setSaving(true);
    try {
      await permitsService.updatePermitType(selectedType.id, { iconName: iconDraft, color: colorDraft } as any);
      setEditingAppearance(false); await onRefresh(selectedType.id);
    } catch (e) { toast.error('Failed to save appearance', { description: errorMessage(e) }); }
    finally { setSaving(false); }
  };

  const handleAddField = async () => {
    if (!fieldLabel.trim()) { toast.error('Field label is required'); return; }
    setSaving(true);
    try {
      await permitsService.addField(selectedType.id, { label: fieldLabel.trim(), type: fieldType, required: fieldRequired });
      setFieldLabel(''); setFieldType(ServiceFieldType.TEXT); setFieldRequired(false); setAddingField(false);
      await onRefresh(selectedType.id);
    } catch (e) { toast.error('Failed to add field', { description: errorMessage(e) }); }
    finally { setSaving(false); }
  };

  const handleRemoveField = async (fieldId: string) => {
    try {
      await permitsService.removeField(fieldId); await onRefresh(selectedType.id);
    } catch (e) { toast.error('Failed to remove field', { description: errorMessage(e) }); }
  };

  const handleMove = async (fieldId: string, dir: 'up' | 'down') => {
    const idx = selectedType.fields.findIndex((f) => f.id === fieldId);
    if (idx < 0) return;
    const target = dir === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= selectedType.fields.length) return;
    const ordered = selectedType.fields.slice();
    const [moved] = ordered.splice(idx, 1);
    ordered.splice(target, 0, moved);
    try {
      await permitsService.updatePermitType(selectedType.id, {
        name: selectedType.name, category: selectedType.category,
        description: selectedType.description ?? undefined,
        fields: ordered.map((f, i) => ({ label: f.label, type: f.type, placeholder: f.placeholder ?? undefined, required: f.required, displayOrder: i + 1 })),
      });
      await onRefresh(selectedType.id);
    } catch (e) { toast.error('Failed to reorder', { description: errorMessage(e) }); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Top accent */}
      <div style={{ height: '3px', borderRadius: '2px', background: accent }} />

      {/* Type name */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#C4C9D4', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: "'Work Sans', sans-serif" }}>Type Name</span>
          {!editingName && (
            <button type="button" onClick={() => setEditingName(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '5px', border: '1px solid #E5E7EB', background: '#FAFAFA', color: '#6B7280', fontSize: '11.5px', cursor: 'pointer', fontFamily: "'Work Sans', sans-serif" }}>
              <Pencil style={{ width: '10px', height: '10px' }} /> Edit
            </button>
          )}
        </div>

        {editingName ? (
          <div style={{ display: 'flex', gap: '6px' }}>
            <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <GhostIconBtn icon={<Check style={{ width: '11px', height: '11px' }} />} onClick={() => void handleSaveName()} disabled={saving} />
            <GhostIconBtn icon={<X style={{ width: '11px', height: '11px' }} />} onClick={() => { setNameDraft(selectedType.name); setEditingName(false); }} />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <p style={{ fontSize: '13.5px', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.01em', fontFamily: "'Work Sans', sans-serif" }}>{selectedType.name}</p>
            {categoryChip(selectedType.category)}
          </div>
        )}
      </div>

      {/* Appearance (icon + color) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#C4C9D4', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: "'Work Sans', sans-serif" }}>Appearance</span>
          {!editingAppearance && (
            <button type="button" onClick={() => setEditingAppearance(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '5px', border: '1px solid #E5E7EB', background: '#FAFAFA', color: '#6B7280', fontSize: '11.5px', cursor: 'pointer', fontFamily: "'Work Sans', sans-serif" }}>
              <Pencil style={{ width: '10px', height: '10px' }} /> Edit
            </button>
          )}
        </div>

        {editingAppearance ? (
          <div style={{ padding: '12px 14px', borderRadius: '9px', border: '1px dashed #D1D5DB', background: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', fontFamily: "'Work Sans', sans-serif" }}>Icon Name</span>
              <select value={iconDraft} onChange={(e) => setIconDraft(e.target.value)} style={selectStyle}>
                {ICON_NAME_OPTIONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', fontFamily: "'Work Sans', sans-serif" }}>Color</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {COLOR_PALETTE.map((c) => (
                  <button key={c} type="button" onClick={() => setColorDraft(c)}
                    style={{
                      width: '28px', height: '28px', borderRadius: '50%', background: c,
                      border: colorDraft === c ? '3px solid #111827' : '3px solid transparent',
                      cursor: 'pointer', transition: 'all 120ms', boxShadow: colorDraft === c ? '0 0 0 2px #FFF inset' : 'none',
                      outline: 'none', flexShrink: 0,
                    }}
                    title={c}
                  />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" disabled={saving} onClick={() => void handleSaveAppearance()}
                style={{ flex: 1, padding: '6px 0', borderRadius: '7px', background: saving ? '#9CA3AF' : '#111827', color: '#FFF', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '12.5px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => { setIconDraft(selectedType.iconName ?? 'FileText'); setColorDraft(selectedType.color ?? COLOR_PALETTE[0]); setEditingAppearance(false); }}
                style={{ padding: '6px 14px', borderRadius: '7px', border: '1px solid #E5E7EB', background: '#FFF', color: '#6B7280', cursor: 'pointer', fontSize: '12.5px', fontFamily: "'Work Sans', sans-serif" }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '9px', border: '1px solid #EBEBEB', background: '#FAFAFA' }}>
            <span style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: selectedType.color ?? COLOR_PALETTE[0],
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }} />
            <div>
              <p style={{ fontSize: '12.5px', fontWeight: 700, color: '#111827', margin: 0, fontFamily: "'Work Sans', sans-serif" }}>
                {selectedType.iconName ?? 'FileText'}
              </p>
              <p style={{ fontSize: '10.5px', color: '#9CA3AF', margin: '1px 0 0', fontFamily: "'DM Mono', monospace" }}>
                {selectedType.color ?? COLOR_PALETTE[0]}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Fields list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#C4C9D4', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: "'Work Sans', sans-serif" }}>
          Fields ({selectedType.fields.length})
        </span>

        {selectedType.fields.length === 0 && !addingField && (
          <p style={{ fontSize: '12px', color: '#C4C9D4', fontFamily: "'Work Sans', sans-serif", padding: '12px 0' }}>No fields yet.</p>
        )}

        {selectedType.fields.map((f, i) => (
          <div key={f.id} style={{ padding: '10px 12px', borderRadius: '9px', border: '1px solid #EBEBEB', background: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#111827', flex: 1, fontFamily: "'Work Sans', sans-serif" }}>{f.label}</span>
              <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: '#F3F4F6', color: '#6B7280', whiteSpace: 'nowrap', fontFamily: "'Work Sans', sans-serif" }}>
                {humanizeEnum(f.type)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: f.required ? '#D97706' : '#C4C9D4', fontFamily: "'Work Sans', sans-serif" }}>
                {f.required ? 'Required' : 'Optional'}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <GhostIconBtn icon={<ArrowUp style={{ width: '10px', height: '10px' }} />} onClick={() => void handleMove(f.id, 'up')} disabled={i === 0} title="Move up" />
                <GhostIconBtn icon={<ArrowDown style={{ width: '10px', height: '10px' }} />} onClick={() => void handleMove(f.id, 'down')} disabled={i === selectedType.fields.length - 1} title="Move down" />
                <button type="button" onClick={() => void handleRemoveField(f.id)}
                  style={{ padding: '0 8px', height: '28px', borderRadius: '6px', border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: '11.5px', fontWeight: 600, fontFamily: "'Work Sans', sans-serif" }}>
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Add field inline */}
        {addingField ? (
          <div style={{ padding: '12px 14px', borderRadius: '9px', border: '1px dashed #D1D5DB', background: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)} placeholder="Field label" style={inputStyle} />
            <select value={fieldType} onChange={(e) => setFieldType(e.target.value as ServiceFieldType)} style={selectStyle}>
              {FIELD_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{humanizeEnum(t)}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: '#9CA3AF', cursor: 'pointer', fontFamily: "'Work Sans', sans-serif" }}>
              <input type="checkbox" checked={fieldRequired} onChange={(e) => setFieldRequired(e.target.checked)} style={{ accentColor: '#2563EB' }} />
              Required
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" disabled={saving} onClick={() => void handleAddField()}
                style={{ flex: 1, padding: '6px 0', borderRadius: '7px', background: saving ? '#9CA3AF' : '#111827', color: '#FFF', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '12.5px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
                {saving ? 'Adding…' : 'Confirm'}
              </button>
              <button type="button" onClick={() => { setAddingField(false); setFieldLabel(''); setFieldType(ServiceFieldType.TEXT); setFieldRequired(false); }}
                style={{ padding: '6px 14px', borderRadius: '7px', border: '1px solid #E5E7EB', background: '#FFF', color: '#6B7280', cursor: 'pointer', fontSize: '12.5px', fontFamily: "'Work Sans', sans-serif" }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setAddingField(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '7px', border: '1px dashed #D1D5DB', background: '#FAFAFA', color: '#6B7280', cursor: 'pointer', fontSize: '12px', fontFamily: "'Work Sans', sans-serif" }}>
            <Plus style={{ width: '11px', height: '11px' }} /> Add Field
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Request Detail Drawer ────────────────────────────────────

function RequestDetail({ request, onReload }: {
  request: PermitRequestDetail; onReload: () => void;
}) {
  const [approveMode,  setApproveMode]  = useState(false);
  const [rejectMode,   setRejectMode]   = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [localReq,     setLocalReq]     = useState(request);

  const isPending = localReq.status === 'PENDING';

  const handleApprove = async () => {
    try {
      const d = await permitsService.approveRequest(localReq.id);
      setLocalReq(d); setApproveMode(false); onReload(); toast.success('Request approved');
    } catch (e) { toast.error('Failed to approve', { description: errorMessage(e) }); }
  };

  const handleReject = async () => {
    try {
      const d = await permitsService.rejectRequest(localReq.id, rejectReason.trim());
      setLocalReq(d); setRejectMode(false); onReload(); toast.success('Request rejected');
    } catch (e) { toast.error('Failed to reject', { description: errorMessage(e) }); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Header */}
      <div>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: 900, color: '#111827', margin: '0 0 8px', letterSpacing: '-0.03em' }}>
          {localReq.requestNumber}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <StatusBadge value={localReq.status} />
          {categoryChip(localReq.permitType.category)}
        </div>
        <p style={{ fontSize: '11.5px', color: '#9CA3AF', margin: '8px 0 0', fontFamily: "'DM Mono', monospace" }}>
          Submitted {formatDateTime(localReq.submittedAt)}
        </p>
      </div>

      {/* Permit type */}
      <div style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FAFAFA' }}>
        <p style={{ fontSize: '9.5px', fontWeight: 700, color: '#C4C9D4', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px', fontFamily: "'Work Sans', sans-serif" }}>Permit Type</p>
        <p style={{ fontSize: '13.5px', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.01em' }}>{localReq.permitType.name}</p>
      </div>

      {/* Requester */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <InfoPair label="Requester" value={localReq.requester.name} />
        <InfoPair label="Unit"      value={localReq.unit.unitNumber} />
        <InfoPair label="Phone"     value={localReq.requester.phone ?? '—'} />
      </div>

      {/* Field values */}
      {localReq.fieldValues.length > 0 && (
        <div style={{ padding: '14px 16px', borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ fontSize: '10.5px', fontWeight: 700, color: '#C4C9D4', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0, fontFamily: "'Work Sans', sans-serif" }}>Form Responses</p>
          {localReq.fieldValues.map((fv) => (
            <div key={fv.fieldId} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '8px', alignItems: 'baseline' }}>
              <span style={{ fontSize: '12px', color: '#9CA3AF', fontFamily: "'Work Sans', sans-serif" }}>{fv.label}</span>
              {renderFieldValue(fv)}
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      {localReq.notes && (
        <div style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FFFBEB' }}>
          <p style={{ fontSize: '10.5px', fontWeight: 700, color: '#C4C9D4', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px', fontFamily: "'Work Sans', sans-serif" }}>Notes</p>
          <p style={{ fontSize: '12.5px', color: '#374151', margin: 0, lineHeight: 1.55 }}>{localReq.notes}</p>
        </div>
      )}

      {/* Actions */}
      {isPending ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {rejectMode ? (
            <>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Rejection reason…" style={textareaStyle} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => void handleReject()}
                  style={{ flex: 1, padding: '8px 0', borderRadius: '7px', background: '#DC2626', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
                  Confirm Reject
                </button>
                <button type="button" onClick={() => setRejectMode(false)}
                  style={{ padding: '8px 16px', borderRadius: '7px', border: '1px solid #E5E7EB', background: '#FFF', color: '#6B7280', cursor: 'pointer', fontSize: '12.5px', fontFamily: "'Work Sans', sans-serif" }}>
                  Cancel
                </button>
              </div>
            </>
          ) : approveMode ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => void handleApprove()}
                style={{ flex: 1, padding: '8px 0', borderRadius: '7px', background: '#059669', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
                Confirm Approve
              </button>
              <button type="button" onClick={() => setApproveMode(false)}
                style={{ padding: '8px 16px', borderRadius: '7px', border: '1px solid #E5E7EB', background: '#FFF', color: '#6B7280', cursor: 'pointer', fontSize: '12.5px', fontFamily: "'Work Sans', sans-serif" }}>
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setApproveMode(true)}
                style={{ flex: 1, padding: '8px 0', borderRadius: '7px', background: '#111827', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
                Approve
              </button>
              <button type="button" onClick={() => setRejectMode(true)}
                style={{ flex: 1, padding: '8px 0', borderRadius: '7px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
                Reject
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: '14px 16px', borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FFF', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <InfoPair label="Reviewed By" value={localReq.reviewer?.name ?? '—'} />
          <InfoPair label="Reviewed At" value={localReq.reviewedAt ? formatDateTime(localReq.reviewedAt) : '—'} mono />
        </div>
      )}
    </div>
  );
}

// ─── Create Type Drawer ───────────────────────────────────────

function CreateTypeDrawer({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: () => void;
}) {
  const [name,        setName]        = useState('');
  const [cat,         setCat]         = useState<PermitCategory>(PermitCategory.OPERATIONAL);
  const [description, setDescription] = useState('');
  const [iconName,    setIconName]    = useState('FileText');
  const [color,       setColor]       = useState(COLOR_PALETTE[0]);
  const [fields,      setFields]      = useState([{ id: 'f1', label: '', type: ServiceFieldType.TEXT, required: false }]);
  const [saving,      setSaving]      = useState(false);

  const reset = () => {
    setName(''); setCat(PermitCategory.OPERATIONAL); setDescription('');
    setIconName('FileText'); setColor(COLOR_PALETTE[0]);
    setFields([{ id: 'f1', label: '', type: ServiceFieldType.TEXT, required: false }]);
  };

  useEffect(() => { if (!open) reset(); }, [open]);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Permit type name is required'); return; }
    setSaving(true);
    try {
      await permitsService.createPermitType({
        name: name.trim(), category: cat,
        description: description.trim() || undefined,
        iconName: iconName || undefined,
        color: color || undefined,
        fields: fields.filter((f) => f.label.trim()).map((f, i) => ({ label: f.label.trim(), type: f.type, required: f.required, displayOrder: i + 1 })),
      });
      toast.success('Permit type created'); onCreated(); onClose();
    } catch (e) { toast.error('Failed to create permit type', { description: errorMessage(e) }); }
    finally { setSaving(false); }
  };

  const addField    = () => setFields((p) => [...p, { id: `f-${Date.now()}-${p.length}`, label: '', type: ServiceFieldType.TEXT, required: false }]);
  const removeField = (id: string) => setFields((p) => p.filter((f) => f.id !== id));
  const updateField = <K extends keyof typeof fields[number]>(id: string, k: K, v: typeof fields[number][K]) =>
    setFields((p) => p.map((f) => f.id === id ? { ...f, [k]: v } : f));

  return (
    <DrawerForm
      open={open} onOpenChange={(v) => { if (!v) onClose(); }}
      title="Add Permit Type"
      description="Create a permit type and configure its form fields."
      widthClassName="w-full sm:max-w-[540px]"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
          <button type="button" disabled={saving} onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#FFF', color: '#6B7280', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontFamily: "'Work Sans', sans-serif", fontWeight: 600 }}>
            <X style={{ width: '12px', height: '12px' }} /> Cancel
          </button>
          <button type="button" disabled={saving} onClick={() => void handleCreate()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '8px', background: saving ? '#9CA3AF' : '#111827', color: '#FFF', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: saving ? 'none' : '0 2px 6px rgba(0,0,0,0.15)' }}>
            <Check style={{ width: '13px', height: '13px' }} />{saving ? 'Creating…' : 'Create Type'}
          </button>
        </div>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <SectionDivider label="Basic Info" />

        <Field label="Name" required span2>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Construction Permit" style={inputStyle} />
        </Field>

        <Field label="Category" span2>
          <select value={cat} onChange={(e) => setCat(e.target.value as PermitCategory)} style={selectStyle}>
            {PERMIT_CATEGORIES.map((c) => <option key={c} value={c}>{humanizeEnum(c)}</option>)}
          </select>
        </Field>

        <Field label="Description" span2>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description…" style={textareaStyle} />
        </Field>

        <SectionDivider label="Appearance (Mobile App)" />

        <Field label="Icon Name" span2>
          <select value={iconName} onChange={(e) => setIconName(e.target.value)} style={selectStyle}>
            {ICON_NAME_OPTIONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
          </select>
          <span style={{ fontSize: '10.5px', color: '#9CA3AF', fontFamily: "'Work Sans', sans-serif", marginTop: '2px' }}>
            Lucide icon name displayed in the mobile app
          </span>
        </Field>

        <Field label="Color" span2>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {COLOR_PALETTE.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)}
                style={{
                  width: '32px', height: '32px', borderRadius: '50%', background: c, border: color === c ? '3px solid #111827' : '3px solid transparent',
                  cursor: 'pointer', transition: 'all 120ms', boxShadow: color === c ? '0 0 0 2px #FFF inset' : 'none',
                  outline: 'none', flexShrink: 0,
                }}
                title={c}
              />
            ))}
          </div>
          <span style={{ fontSize: '10.5px', color: '#9CA3AF', fontFamily: "'Work Sans', sans-serif", marginTop: '2px' }}>
            Accent color shown in the mobile app
          </span>
        </Field>

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

// ─── Main ─────────────────────────────────────────────────────

export function PermitsManagement() {
  const [activeTab,       setActiveTab]       = useState<'requests' | 'types'>('types');
  const [loading,         setLoading]         = useState(false);
  const [stats,           setStats]           = useState<PermitStats | null>(null);
  const [permitTypes,     setPermitTypes]     = useState<PermitTypeItem[]>([]);
  const [requests,        setRequests]        = useState<PermitRequestListItem[]>([]);
  const [selectedType,    setSelectedType]    = useState<PermitTypeItem | null>(null);

  // Filters
  const [search,          setSearch]          = useState('');
  const [status,          setStatus]          = useState<PermitStatusFilter>('ALL');
  const [category,        setCategory]        = useState<'ALL' | PermitCategory>('ALL');
  const [dateFrom,        setDateFrom]        = useState('');
  const [dateTo,          setDateTo]          = useState('');
  const [filtersOpen,     setFiltersOpen]     = useState(false);

  // Drawers
  const [createOpen,      setCreateOpen]      = useState(false);
  const [reqDrawerOpen,   setReqDrawerOpen]   = useState(false);
  const [activeRequest,   setActiveRequest]   = useState<PermitRequestDetail | null>(null);
  const [reqDetailKey,    setReqDetailKey]    = useState(0);

  const groupedTypes = useMemo(() => {
    const groups = Object.fromEntries(PERMIT_CATEGORIES.map((c) => [c, [] as PermitTypeItem[]])) as Record<PermitCategory, PermitTypeItem[]>;
    permitTypes.forEach((pt) => groups[pt.category].push(pt));
    return groups;
  }, [permitTypes]);

  const load = async () => {
    setLoading(true);
    try {
      const [statsData, typeData, reqData] = await Promise.all([
        permitsService.getStats(),
        permitsService.listPermitTypes(true),
        permitsService.listRequests({
          search:   search   || undefined,
          status:   status   === 'ALL' ? undefined : status,
          category: category === 'ALL' ? undefined : category,
          dateFrom: dateFrom || undefined,
          dateTo:   dateTo   || undefined,
        }),
      ]);
      setStats(statsData); setPermitTypes(typeData); setRequests(reqData);
      if (typeData.length > 0 && !selectedType) setSelectedType(typeData[0]);
    } catch (e) { toast.error('Failed to load permits', { description: errorMessage(e) }); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [search, status, category, dateFrom, dateTo]);

  const refreshType = async (id: string) => {
    const detail = await permitsService.getPermitType(id);
    setSelectedType(detail);
    setPermitTypes((p) => p.map((t) => t.id === id ? detail : t));
  };

  const openRequest = async (id: string) => {
    try {
      const d = await permitsService.getRequestDetail(id);
      setActiveRequest(d); setReqDetailKey((k) => k + 1); setReqDrawerOpen(true);
    } catch (e) { toast.error('Failed to load request', { description: errorMessage(e) }); }
  };

  const activeFilters = [status !== 'ALL', category !== 'ALL', dateFrom, dateTo].filter(Boolean).length;

  const requestCols = useMemo<DataTableColumn<PermitRequestListItem>[]>(() => [
    { key: 'n',  header: '#',           render: (r) => <span style={{ fontSize: '11.5px', fontFamily: "'DM Mono', monospace", color: '#6B7280' }}>{r.requestNumber}</span> },
    { key: 'pt', header: 'Permit Type', render: (r) => <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#111827' }}>{r.permitTypeName}</span> },
    { key: 'c',  header: 'Category',    render: (r) => categoryChip(r.category) },
    { key: 'u',  header: 'Unit',        render: (r) => <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '5px', fontSize: '10.5px', fontWeight: 700, background: '#EFF6FF', color: '#2563EB' }}>{r.unitNumber}</span> },
    { key: 'rq', header: 'Requester',   render: (r) => <span style={{ fontSize: '12px', color: '#374151' }}>{r.requesterName}</span> },
    { key: 'd',  header: 'Submitted',   render: (r) => <span style={{ fontSize: '11px', fontFamily: "'DM Mono', monospace", color: '#9CA3AF' }}>{formatDateTime(r.submittedAt)}</span> },
    { key: 'st', header: 'Status',      render: (r) => <StatusBadge value={r.status} /> },
    { key: 'x',  header: '',            render: (r) => <div style={{ display: 'flex', justifyContent: 'flex-end' }}><GhostIconBtn icon={<Eye style={{ width: '11px', height: '11px' }} />} onClick={() => void openRequest(r.id)} /></div> },
  ], []);

  // ─────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif" }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 900, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>Permits</h1>
        <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '4px 0 0' }}>Manage permit requests and configure permit types.</p>
      </div>

      {/* ── Stats ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
        <StatCard icon="complaints-total"  title="Total Requests"      value={String(stats?.totalRequests     ?? 0)} subtitle="All time" />
        <StatCard icon="complaints-open"   title="Pending"             value={String(stats?.pendingRequests   ?? 0)} subtitle="Awaiting review" />
        <StatCard icon="complaints-closed" title="Approved This Month" value={String(stats?.approvedThisMonth ?? 0)} subtitle="Current month" />
        <StatCard icon="tickets"           title="Rejected This Month" value={String(stats?.rejectedThisMonth ?? 0)} subtitle="Current month" />
      </div>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '2px', padding: '4px', borderRadius: '10px', background: '#F3F4F6', marginBottom: '20px', width: 'fit-content' }}>
        <TabBtn label="Permit Types" active={activeTab === 'types'}    onClick={() => setActiveTab('types')} />
        <TabBtn label="Requests"     active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} />
      </div>

      {/* ══ Types tab ═════════════════════════════════════════ */}
      {activeTab === 'types' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
            <button type="button" onClick={() => setCreateOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', height: '36px', borderRadius: '8px', background: '#111827', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
              <Plus style={{ width: '13px', height: '13px' }} /> Add Permit Type
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '14px', alignItems: 'start' }}>
            {/* Left: grouped list */}
            <div style={{ borderRadius: '12px', border: '1px solid #EBEBEB', background: '#FFF', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {loading && permitTypes.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#C4C9D4', fontSize: '13px' }}>Loading…</div>
              ) : permitTypes.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#C4C9D4', fontSize: '13px' }}>No permit types configured.</div>
              ) : (
                PERMIT_CATEGORIES.map((cat) => {
                  const types = groupedTypes[cat];
                  if (types.length === 0) return null;
                  const accent = CATEGORY_META[cat].accent;
                  return (
                    <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: accent, flexShrink: 0 }} />
                        <span style={{ fontSize: '10px', fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.09em', fontFamily: "'Work Sans', sans-serif" }}>{humanizeEnum(cat)}</span>
                        <div style={{ flex: 1, height: '1px', background: '#F0F0F0' }} />
                      </div>
                      {types.map((pt) => {
                        const isSelected = selectedType?.id === pt.id;
                        return (
                          <button key={pt.id} type="button"
                            onClick={() => setSelectedType(pt)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '9px', border: `1px solid ${isSelected ? `${accent}40` : '#EBEBEB'}`, background: isSelected ? `${accent}08` : '#FAFAFA', cursor: 'pointer', textAlign: 'left', transition: 'all 120ms', width: '100%' }}>
                            <div>
                              <p style={{ fontSize: '13px', fontWeight: isSelected ? 800 : 600, color: '#111827', margin: 0, fontFamily: "'Work Sans', sans-serif" }}>{pt.name}</p>
                              <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '2px 0 0', fontFamily: "'Work Sans', sans-serif" }}>
                                {pt.fields.length} field{pt.fields.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {isSelected && (
                                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: `${accent}18`, color: accent }}>
                                  Selected
                                </span>
                              )}
                              <ToggleSwitch checked={pt.isActive} onChange={() => void permitsService.togglePermitType(pt.id).then(load).catch(() => toast.error('Failed to toggle'))} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            {/* Right: editor panel */}
            <div style={{ borderRadius: '12px', border: '1px solid #EBEBEB', background: '#FFF', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', padding: '16px', position: 'sticky', top: '20px' }}>
              <PermitTypeEditor selectedType={selectedType} onRefresh={refreshType} />
            </div>
          </div>
        </>
      )}

      {/* ══ Requests tab ══════════════════════════════════════ */}
      {activeTab === 'requests' && (
        <div style={{ borderRadius: '12px', border: '1px solid #EBEBEB', background: '#FFF', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          {/* Filter bar */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px' }}>
              <Search style={{ width: '13px', height: '13px', color: '#C4C9D4', flexShrink: 0 }} />
              <input placeholder="Search request #, unit, requester…" value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: '#111827', fontFamily: "'Work Sans', sans-serif" }} />
              <button type="button" onClick={() => setFiltersOpen((p) => !p)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: `1px solid ${activeFilters > 0 ? '#BFDBFE' : '#E5E7EB'}`, background: activeFilters > 0 ? '#EFF6FF' : '#FAFAFA', color: activeFilters > 0 ? '#2563EB' : '#6B7280', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif", flexShrink: 0 }}>
                <SlidersHorizontal style={{ width: '11px', height: '11px' }} />
                Filters
                {activeFilters > 0 && <span style={{ width: '15px', height: '15px', borderRadius: '50%', background: '#2563EB', color: '#FFF', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{activeFilters}</span>}
                <ChevronDown style={{ width: '10px', height: '10px', transform: filtersOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
              </button>
            </div>
            {filtersOpen && (
              <div style={{ padding: '10px 14px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select value={status} onChange={(e) => setStatus(e.target.value as PermitStatusFilter)} style={{ ...selectStyle, width: '140px' }}>
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
                <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} style={{ ...selectStyle, width: '180px' }}>
                  <option value="ALL">All Categories</option>
                  {PERMIT_CATEGORIES.map((c) => <option key={c} value={c}>{humanizeEnum(c)}</option>)}
                </select>
                <DateRangePill from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} />
              </div>
            )}
          </div>

          <DataTable
            columns={requestCols} rows={requests} rowKey={(r) => r.id} loading={loading}
            emptyTitle="No permit requests found" emptyDescription="Try adjusting your search or filters."
          />
        </div>
      )}

      {/* ══ Create type drawer ════════════════════════════════ */}
      <CreateTypeDrawer open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />

      {/* ══ Request detail drawer ═════════════════════════════ */}
      <DrawerForm
        open={reqDrawerOpen} onOpenChange={(v) => { if (!v) setReqDrawerOpen(false); }}
        title={activeRequest?.requestNumber ?? 'Permit Request'}
        description="Review this permit request and decide."
        widthClassName="w-full sm:max-w-[480px]"
      >
        {activeRequest
          ? <RequestDetail key={reqDetailKey} request={activeRequest} onReload={load} />
          : <div style={{ padding: '40px', textAlign: 'center', color: '#C4C9D4', fontSize: '13px' }}>No request selected.</div>
        }
      </DrawerForm>
    </div>
  );
}