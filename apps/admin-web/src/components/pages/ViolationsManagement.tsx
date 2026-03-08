import { useEffect, useMemo, useState } from 'react';
import { ViolationActionStatus, ViolationActionType, ViolationStatus } from '@prisma/client';
import {
  Edit2, Eye, Plus, Search, Check, X,
  ChevronLeft, ChevronRight, SlidersHorizontal, ChevronDown, CalendarRange,
} from 'lucide-react';
import { toast } from 'sonner';
import { StatCard } from '../StatCard';
import { DataTable, type DataTableColumn } from '../DataTable';
import { DrawerForm } from '../DrawerForm';
import { EmptyState } from '../EmptyState';
import { StatusBadge } from '../StatusBadge';
import violationsService, {
  type ViolationActionRequestItem,
  type ViolationAppealQueueItem,
  type ViolationCategoryItem,
  type ViolationDetail,
  type ViolationInvoice,
  type ViolationListItem,
  type ViolationStats,
} from '../../lib/violationsService';

// ─── Constants ────────────────────────────────────────────────

const CAT_DOTS = ['#0D9488', '#2563EB', '#D97706', '#DC2626'];

const fmtDate     = (v?: string | null) => v ? new Date(v).toLocaleDateString() : '—';
const fmtDateTime = (v?: string | null) => v ? new Date(v).toLocaleString()     : '—';
const money       = (v: number)          => `EGP ${v.toLocaleString()}`;

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

function GhostIconBtn({ icon, onClick, danger }: {
  icon: React.ReactNode; onClick: () => void; danger?: boolean;
}) {
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
    <div style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #EBEBEB', background: '#FFF' }}>
      <p style={{ fontSize: '9.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 3px', fontFamily: "'Work Sans', sans-serif" }}>{label}</p>
      <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0, fontFamily: mono ? "'DM Mono', monospace" : "'Work Sans', sans-serif" }}>{value}</p>
    </div>
  );
}

function Pagination({ page, totalPages, total, onPrev, onNext }: {
  page: number; totalPages: number; total: number; onPrev: () => void; onNext: () => void;
}) {
  return (
    <div style={{ padding: '12px 14px', borderTop: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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

function FilterBar({
  search, setSearch,
  extra, filtersOpen, setFiltersOpen, activeFilters,
  children,
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
        <input
          placeholder="Search…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: '#111827', fontFamily: "'Work Sans', sans-serif" }}
        />
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

// ─── Category Modal ───────────────────────────────────────────

function CategoryModal({ open, onClose, editing, onSaved }: {
  open: boolean; onClose: () => void;
  editing: ViolationCategoryItem | null; onSaved: () => void;
}) {
  const [form, setForm]     = useState({ name: '', defaultFineAmount: '500', description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) setForm({ name: editing.name, defaultFineAmount: String(editing.defaultFineAmount), description: editing.description ?? '' });
    else          setForm({ name: '', defaultFineAmount: '500', description: '' });
  }, [editing, open]);

  const handleSave = async () => {
    const name = form.name.trim();
    const amt  = Number(form.defaultFineAmount);
    if (!name || !Number.isFinite(amt) || amt <= 0) {
      toast.error('Provide a valid category name and fine amount'); return;
    }
    setSaving(true);
    try {
      if (editing) await violationsService.updateCategory(editing.id, { name, defaultFineAmount: amt, description: form.description.trim() || undefined });
      else         await violationsService.createCategory({ name, defaultFineAmount: amt, description: form.description.trim() || undefined });
      toast.success('Category saved'); onSaved(); onClose();
    } catch { toast.error('Failed to save category'); }
    finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.4)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '440px', background: '#FFF', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', fontFamily: "'Work Sans', sans-serif" }}>
        <div style={{ height: '4px', background: 'linear-gradient(90deg, #7C3AED 0%, #2563EB 100%)' }} />

        {/* Header */}
        <div style={{ padding: '20px 22px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6' }}>
          <p style={{ fontSize: '14.5px', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.01em' }}>
            {editing ? 'Edit Category' : 'Add Category'}
          </p>
          <button type="button" onClick={onClose}
            style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #EBEBEB', background: '#FAFAFA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>
            <X style={{ width: '12px', height: '12px' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Work Sans', sans-serif" }}>
              Category Name <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Noise Violation" style={inputStyle} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Work Sans', sans-serif" }}>
              Default Fine <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#9CA3AF', fontFamily: "'DM Mono', monospace", pointerEvents: 'none' }}>EGP</span>
              <input type="number" min={0} value={form.defaultFineAmount} onChange={(e) => setForm((p) => ({ ...p, defaultFineAmount: e.target.value }))}
                style={{ ...inputStyle, paddingLeft: '42px', fontFamily: "'DM Mono', monospace" }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Work Sans', sans-serif" }}>
              Description
            </label>
            <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional description…" style={textareaStyle} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px 20px', display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #F3F4F6' }}>
          <button type="button" disabled={saving} onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#FFF', color: '#6B7280', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontFamily: "'Work Sans', sans-serif", fontWeight: 600 }}>
            <X style={{ width: '12px', height: '12px' }} /> Cancel
          </button>
          <button type="button" disabled={saving} onClick={() => void handleSave()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '8px', background: saving ? '#9CA3AF' : '#111827', color: '#FFF', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: saving ? 'none' : '0 2px 6px rgba(0,0,0,0.18)' }}>
            <Check style={{ width: '13px', height: '13px' }} />
            {saving ? 'Saving…' : 'Save Category'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Action Request Card ──────────────────────────────────────

function ActionCard({ action, onReview }: {
  action: ViolationActionRequestItem;
  onReview: (approved: boolean, reason?: string) => void;
}) {
  const [rejectInput, setRejectInput]       = useState('');
  const [showReject,  setShowReject]        = useState(false);
  const isAppeal = action.type === ViolationActionType.APPEAL;

  return (
    <div style={{ padding: '14px 16px', borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FFF', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#111827', fontFamily: "'Work Sans', sans-serif" }}>
            {isAppeal ? 'Appeal' : 'Fix Submission'}
          </span>
          {isAppeal && (
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: '#EDE9FE', color: '#7C3AED', fontFamily: "'Work Sans', sans-serif" }}>APPEAL</span>
          )}
        </div>
        <StatusBadge value={action.status} />
      </div>

      {/* Meta */}
      <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>
        Submitted by <strong style={{ color: '#6B7280' }}>{action.requestedByName}</strong> · {fmtDateTime(action.createdAt)}
      </p>

      {/* Note */}
      <div style={{ padding: '10px 12px', borderRadius: '8px', background: '#FAFAFA', border: '1px solid #F0F0F0' }}>
        <p style={{ fontSize: '12.5px', color: '#374151', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.55, fontFamily: "'Work Sans', sans-serif" }}>
          {action.note ?? 'No note provided'}
        </p>
      </div>

      {/* Appeal waiver note */}
      {isAppeal && action.status === ViolationActionStatus.PENDING && (
        <p style={{ fontSize: '11px', color: '#7C3AED', margin: 0, fontFamily: "'Work Sans', sans-serif" }}>
          Approving this appeal will cancel the violation and waive the fine.
        </p>
      )}

      {/* Actions */}
      {action.status === ViolationActionStatus.PENDING && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={() => onReview(true)}
              style={{ padding: '6px 16px', borderRadius: '7px', background: '#111827', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
              {isAppeal ? 'Approve Appeal' : 'Approve Fix'}
            </button>
            <button type="button" onClick={() => setShowReject((p) => !p)}
              style={{ padding: '6px 14px', borderRadius: '7px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
              {isAppeal ? 'Reject Appeal' : 'Reject Fix'}
            </button>
          </div>
          {showReject && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <textarea value={rejectInput} onChange={(e) => setRejectInput(e.target.value)}
                placeholder="Rejection reason…" style={{ ...textareaStyle, minHeight: '70px' }} />
              <button type="button" onClick={() => {
                if (!rejectInput.trim()) { toast.error('Rejection reason is required'); return; }
                onReview(false, rejectInput.trim());
              }}
                style={{ alignSelf: 'flex-start', padding: '6px 16px', borderRadius: '7px', background: '#DC2626', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
                Confirm Reject
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Detail Drawer content ────────────────────────────────────

function DetailContent({ detail, onReload }: {
  detail: ViolationDetail; onReload: () => void;
}) {
  const [subTab,          setSubTab]          = useState<'details' | 'evidence' | 'appeals' | 'invoices'>('details');
  const [showCancelInput, setShowCancelInput] = useState(false);
  const [cancelInput,     setCancelInput]     = useState('');

  const detailAppeals = detail.actionRequests.filter((a) => a.type === ViolationActionType.APPEAL);
  const detailFixes   = detail.actionRequests.filter((a) => a.type === ViolationActionType.FIX_SUBMISSION);

  const reviewAction = async (row: ViolationActionRequestItem, approved: boolean, reason?: string) => {
    try {
      if (row.type === ViolationActionType.APPEAL) await violationsService.reviewAppeal(row.id, approved, reason);
      else                                          await violationsService.reviewFixSubmission(row.id, approved, reason);
      toast.success('Review saved'); onReload();
    } catch { toast.error('Failed to save review'); }
  };

  const handleMarkPaid = async () => {
    try {
      await violationsService.markAsPaid(detail.id);
      toast.success('Marked as paid'); onReload();
    } catch { toast.error('Failed to update'); }
  };

  const handleCancel = async () => {
    if (!cancelInput.trim()) { toast.error('Cancellation reason is required'); return; }
    try {
      await violationsService.cancelViolation(detail.id);
      toast.success('Violation cancelled'); setShowCancelInput(false); setCancelInput(''); onReload();
    } catch { toast.error('Failed to cancel'); }
  };

  const invoiceCols: DataTableColumn<ViolationInvoice>[] = [
    { key: 'n', header: 'Invoice #', render: (r) => <span style={{ fontSize: '12px', fontFamily: "'DM Mono', monospace", color: '#111827' }}>{r.invoiceNumber}</span> },
    { key: 'a', header: 'Amount',    render: (r) => <span style={{ fontSize: '12.5px', fontWeight: 700, fontFamily: "'DM Mono', monospace", color: '#111827' }}>{money(r.amount)}</span> },
    { key: 't', header: 'Type',      render: (r) => <span style={{ fontSize: '12px', color: '#6B7280' }}>{r.type}</span> },
    { key: 's', header: 'Status',    render: (r) => <StatusBadge value={r.status} /> },
    { key: 'd', header: 'Due Date',  render: (r) => <span style={{ fontSize: '11.5px', color: '#9CA3AF', fontFamily: "'DM Mono', monospace" }}>{fmtDate(r.dueDate)}</span> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Number + badges */}
      <div>
        <p style={{ fontSize: '22px', fontWeight: 900, color: '#111827', letterSpacing: '-0.03em', margin: 0, fontFamily: "'DM Mono', monospace" }}>{detail.violationNumber}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
          <StatusBadge value={detail.status} />
          {detail.categoryName && (
            <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px', background: '#EFF6FF', color: '#2563EB', fontFamily: "'Work Sans', sans-serif" }}>
              {detail.categoryName}
            </span>
          )}
          {detail.actionRequests.some((a) => a.type === ViolationActionType.APPEAL) && (
            <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px', background: '#EDE9FE', color: '#7C3AED', fontFamily: "'Work Sans', sans-serif" }}>
              Appealed
            </span>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '2px', padding: '3px', borderRadius: '8px', background: '#F3F4F6' }}>
        <SmallTabBtn label="Details"                                   active={subTab === 'details'}  onClick={() => setSubTab('details')} />
        <SmallTabBtn label="Evidence"                                  active={subTab === 'evidence'} onClick={() => setSubTab('evidence')} />
        <SmallTabBtn label={`Appeals (${detailAppeals.length + detailFixes.length})`} active={subTab === 'appeals'}  onClick={() => setSubTab('appeals')} />
        <SmallTabBtn label={`Invoices (${detail.invoices.length})`}    active={subTab === 'invoices'} onClick={() => setSubTab('invoices')} />
      </div>

      {/* ── Details ── */}
      {subTab === 'details' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <InfoPair label="Unit"     value={detail.unitNumber} />
            <InfoPair label="Resident" value={detail.residentName ?? '—'} />
            <InfoPair label="Issuer"   value={detail.issuerName ?? '—'} />
            <InfoPair label="Appeal Deadline" value={fmtDate(detail.appealDeadline)} mono />
          </div>

          {detail.description && (
            <div style={{ padding: '12px 14px', borderRadius: '9px', border: '1px solid #EBEBEB', background: '#FAFAFA', fontSize: '13px', color: '#374151', lineHeight: 1.6, fontFamily: "'Work Sans', sans-serif" }}>
              {detail.description}
            </div>
          )}

          {/* Fine */}
          <div style={{ padding: '14px 16px', borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FFF' }}>
            <p style={{ fontSize: '9.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px', fontFamily: "'Work Sans', sans-serif" }}>Fine Amount</p>
            <p style={{ fontSize: '24px', fontWeight: 900, color: '#111827', margin: 0, fontFamily: "'DM Mono', monospace", letterSpacing: '-0.03em' }}>
              {money(detail.fineAmount)}
            </p>
          </div>

          {/* Actions */}
          {detail.status === ViolationStatus.PENDING && (
            <div style={{ padding: '14px 16px', borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FFF', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0, fontFamily: "'Work Sans', sans-serif" }}>Actions</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => void handleMarkPaid()}
                  style={{ padding: '7px 16px', borderRadius: '7px', background: '#111827', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
                  Mark as Paid
                </button>
                <button type="button" onClick={() => setShowCancelInput((p) => !p)}
                  style={{ padding: '7px 14px', borderRadius: '7px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
                  Cancel Violation
                </button>
              </div>
              {showCancelInput && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <textarea value={cancelInput} onChange={(e) => setCancelInput(e.target.value)}
                    placeholder="Cancellation reason…" style={textareaStyle} />
                  <button type="button" onClick={() => void handleCancel()}
                    style={{ alignSelf: 'flex-start', padding: '7px 16px', borderRadius: '7px', background: '#DC2626', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
                    Confirm Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Evidence ── */}
      {subTab === 'evidence' && (
        detail.photoEvidence.length === 0
          ? <EmptyState title="No photo evidence" description="Evidence files will appear here." />
          : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {detail.photoEvidence.map((f) => (
                <a key={f.id} href={f.url ?? '#'} target="_blank" rel="noreferrer"
                  style={{ borderRadius: '9px', border: '1px solid #EBEBEB', overflow: 'hidden', background: '#FAFAFA', textDecoration: 'none', display: 'block' }}>
                  <img src={f.url ?? ''} alt={f.fileName ?? 'Evidence'} style={{ width: '100%', height: '120px', objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: '8px 10px' }}>
                    <p style={{ fontSize: '11px', color: '#6B7280', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Work Sans', sans-serif" }}>
                      {f.fileName ?? f.id}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )
      )}

      {/* ── Appeals & Fixes ── */}
      {subTab === 'appeals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {detailAppeals.length === 0 && detailFixes.length === 0
            ? <EmptyState title="No appeals submitted" description="Appeals and fix submissions will appear here." />
            : (
              <>
                {detailAppeals.map((a) => (
                  <ActionCard key={a.id} action={a}
                    onReview={(approved, reason) => void reviewAction(a, approved, reason)} />
                ))}
                {detailFixes.map((a) => (
                  <ActionCard key={a.id} action={a}
                    onReview={(approved, reason) => void reviewAction(a, approved, reason)} />
                ))}
              </>
            )
          }
        </div>
      )}

      {/* ── Invoices ── */}
      {subTab === 'invoices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button"
              onClick={() => toast.info('Create invoice from Billing until inline invoice form is enabled.')}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '7px', background: '#2563EB', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
              <Plus style={{ width: '11px', height: '11px' }} /> Create Invoice
            </button>
          </div>
          <DataTable
            columns={invoiceCols} rows={detail.invoices} rowKey={(r) => r.id}
            emptyTitle="No linked invoices" emptyDescription="No invoice records linked to this violation."
          />
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────

export function ViolationsManagement() {
  const [tab,        setTab]        = useState<'violations' | 'appeals' | 'settings'>('violations');
  const [stats,      setStats]      = useState<ViolationStats | null>(null);
  const [categories, setCategories] = useState<ViolationCategoryItem[]>([]);

  // Violations list
  const [rows,       setRows]       = useState<ViolationListItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [status,     setStatus]     = useState('ALL');
  const [categoryId, setCategoryId] = useState('ALL');
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [hasAppeal,  setHasAppeal]  = useState(false);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total,      setTotal]      = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Appeals list
  const [appealRows,       setAppealRows]       = useState<ViolationAppealQueueItem[]>([]);
  const [appealsLoading,   setAppealsLoading]   = useState(true);
  const [appealSearch,     setAppealSearch]     = useState('');
  const [appealStatus,     setAppealStatus]     = useState('ALL');
  const [appealDateFrom,   setAppealDateFrom]   = useState('');
  const [appealDateTo,     setAppealDateTo]     = useState('');
  const [appealPage,       setAppealPage]       = useState(1);
  const [appealTotalPages, setAppealTotalPages] = useState(1);
  const [appealTotal,      setAppealTotal]      = useState(0);
  const [appealFiltersOpen, setAppealFiltersOpen] = useState(false);

  // Detail drawer
  const [detail,     setDetail]     = useState<ViolationDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailKey,  setDetailKey]  = useState(0);

  // Category modal
  const [catModalOpen,    setCatModalOpen]    = useState(false);
  const [editingCategory, setEditingCategory] = useState<ViolationCategoryItem | null>(null);

  // ── Loaders ───────────────────────────────────────────────────

  const loadViolations = async () => {
    setLoading(true);
    try {
      const [st, cats, list] = await Promise.all([
        violationsService.getViolationStats(),
        violationsService.listCategories(true),
        violationsService.listViolations({
          page, limit: 25,
          search:     search     || undefined,
          status:     status     !== 'ALL' ? (status as ViolationStatus) : undefined,
          categoryId: categoryId !== 'ALL' ? categoryId                  : undefined,
          hasAppeal:  hasAppeal  || undefined,
          dateFrom:   dateFrom   ? new Date(dateFrom).toISOString()                   : undefined,
          dateTo:     dateTo     ? new Date(`${dateTo}T23:59:59`).toISOString()        : undefined,
        }),
      ]);
      setStats(st); setCategories(cats);
      setRows(list.data); setTotal(list.total); setTotalPages(list.totalPages);
    } catch { toast.error('Failed to load violations'); }
    finally { setLoading(false); }
  };

  const loadAppeals = async () => {
    setAppealsLoading(true);
    try {
      const res = await violationsService.listAppealRequests({
        page: appealPage, limit: 25,
        search:   appealSearch   || undefined,
        status:   appealStatus   !== 'ALL' ? (appealStatus as ViolationActionStatus) : undefined,
        dateFrom: appealDateFrom ? new Date(appealDateFrom).toISOString()             : undefined,
        dateTo:   appealDateTo   ? new Date(`${appealDateTo}T23:59:59`).toISOString() : undefined,
      });
      setAppealRows(res.data); setAppealTotal(res.total); setAppealTotalPages(res.totalPages);
    } catch { toast.error('Failed to load appeals'); }
    finally { setAppealsLoading(false); }
  };

  useEffect(() => {
    if (tab === 'violations' || tab === 'settings') void loadViolations();
  }, [tab, page, search, status, categoryId, dateFrom, dateTo, hasAppeal]);

  useEffect(() => {
    if (tab === 'appeals') void loadAppeals();
  }, [tab, appealPage, appealSearch, appealStatus, appealDateFrom, appealDateTo]);

  const openDetail = async (id: string) => {
    try {
      const d = await violationsService.getViolationDetail(id);
      setDetail(d); setDetailKey((k) => k + 1); setDetailOpen(true);
    } catch { toast.error('Failed to load detail'); }
  };

  // ── Columns ───────────────────────────────────────────────────

  const violationCols = useMemo<DataTableColumn<ViolationListItem>[]>(() => [
    { key: 'n', header: '#',           render: (r) => <span style={{ fontSize: '11.5px', fontFamily: "'DM Mono', monospace", color: '#6B7280' }}>{r.violationNumber}</span> },
    { key: 'c', header: 'Category',    render: (r) => <span style={{ fontSize: '12px', color: '#374151' }}>{r.categoryName ?? '—'}</span> },
    { key: 'u', header: 'Unit',        render: (r) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '5px', fontSize: '10.5px', fontWeight: 700, background: '#EFF6FF', color: '#2563EB', fontFamily: "'Work Sans', sans-serif" }}>
        {r.unitNumber}
      </span>
    )},
    { key: 'r', header: 'Resident',    render: (r) => <span style={{ fontSize: '12px', color: '#374151' }}>{r.residentName ?? '—'}</span> },
    { key: 'i', header: 'Issuer',      render: (r) => <span style={{ fontSize: '12px', color: '#6B7280' }}>{r.issuerName ?? '—'}</span> },
    { key: 'f', header: 'Fine',        render: (r) => (
      <span style={{ fontSize: '12.5px', fontWeight: 700, fontFamily: "'DM Mono', monospace", color: '#111827', display: 'block', textAlign: 'right' }}>
        {money(r.fineAmount)}
      </span>
    )},
    { key: 's', header: 'Status',      render: (r) => <StatusBadge value={r.status} /> },
    { key: 'a', header: 'Appeal',      render: (r) => r.hasAppeal
      ? <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px', background: '#EDE9FE', color: '#7C3AED', fontFamily: "'Work Sans', sans-serif" }}>Appealed</span>
      : <span style={{ color: '#D1D5DB', fontSize: '12px' }}>—</span>
    },
    { key: 'x', header: '',            render: (r) => (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <GhostIconBtn icon={<Eye style={{ width: '11px', height: '11px' }} />} onClick={() => void openDetail(r.id)} />
      </div>
    )},
  ], []);

  const appealCols = useMemo<DataTableColumn<ViolationAppealQueueItem>[]>(() => [
    { key: 'n',    header: 'Violation #', render: (r) => <span style={{ fontSize: '11.5px', fontFamily: "'DM Mono', monospace", color: '#6B7280' }}>{r.violationNumber}</span> },
    { key: 'c',    header: 'Category',    render: (r) => <span style={{ fontSize: '12px', color: '#374151' }}>{r.categoryName ?? '—'}</span> },
    { key: 'u',    header: 'Unit',        render: (r) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '5px', fontSize: '10.5px', fontWeight: 700, background: '#EFF6FF', color: '#2563EB', fontFamily: "'Work Sans', sans-serif" }}>
        {r.unitNumber}
      </span>
    )},
    { key: 'r',    header: 'Resident',    render: (r) => <span style={{ fontSize: '12px', color: '#374151' }}>{r.residentName ?? '—'}</span> },
    { key: 'f',    header: 'Fine',        render: (r) => <span style={{ fontSize: '12.5px', fontWeight: 700, fontFamily: "'DM Mono', monospace", color: '#111827' }}>{money(r.fineAmount)}</span> },
    { key: 'note', header: 'Appeal Note', render: (r) => (
      <span style={{ fontSize: '12px', color: '#6B7280' }}>
        {(r.appealNote ?? '—').slice(0, 70)}{(r.appealNote ?? '').length > 70 ? '…' : ''}
      </span>
    )},
    { key: 'd',    header: 'Submitted',   render: (r) => <span style={{ fontSize: '11px', fontFamily: "'DM Mono', monospace", color: '#9CA3AF' }}>{fmtDateTime(r.submittedAt)}</span> },
    { key: 's',    header: 'Status',      render: (r) => <StatusBadge value={r.status} /> },
    { key: 'x',    header: '',            render: (r) => (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <GhostIconBtn icon={<Eye style={{ width: '11px', height: '11px' }} />} onClick={() => void openDetail(r.violationId)} />
      </div>
    )},
  ], []);

  const vActiveFilters = [status !== 'ALL', categoryId !== 'ALL', dateFrom, dateTo, hasAppeal].filter(Boolean).length;
  const aActiveFilters = [appealStatus !== 'ALL', appealDateFrom, appealDateTo].filter(Boolean).length;

  // ─────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif" }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 900, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>Violations Management</h1>
        <p style={{ fontSize: '13px', color: '#6B7280', margin: '4px 0 0' }}>Manage violations, appeals queue, and categories.</p>
      </div>

      {/* ── Tabs ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '2px', padding: '4px', borderRadius: '10px', background: '#F3F4F6', marginBottom: '20px', width: 'fit-content' }}>
        <TabBtn label="Violations" active={tab === 'violations'} onClick={() => setTab('violations')} />
        <TabBtn label="Appeals"    active={tab === 'appeals'}    onClick={() => setTab('appeals')} />
        <TabBtn label="Settings"   active={tab === 'settings'}   onClick={() => setTab('settings')} />
      </div>

      {/* ══ Violations tab ════════════════════════════════════ */}
      {tab === 'violations' && (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
            <StatCard icon="complaints-total" title="Total Violations"   value={String(stats?.total ?? 0)}                       subtitle="All records" />
            <StatCard icon="complaints-open"  title="Pending Payment"    value={String(stats?.pending ?? 0)}                      subtitle="Awaiting payment" />
            <StatCard icon="revenue"          title="Fines Collected"    value={money(stats?.totalFinesCollected ?? 0)}            subtitle="Status = PAID" />
            <StatCard icon="tickets"          title="Pending Appeals"    value={String(stats?.pendingAppeals ?? 0)}                subtitle="Appeal queue" />
          </div>

          {/* Table card */}
          <div style={{ borderRadius: '12px', border: '1px solid #EBEBEB', background: '#FFF', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <FilterBar
              search={search} setSearch={(v) => { setSearch(v); setPage(1); }}
              filtersOpen={filtersOpen} setFiltersOpen={setFiltersOpen} activeFilters={vActiveFilters}
              extra={
                <button type="button" onClick={() => { setHasAppeal((p) => !p); setPage(1); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${hasAppeal ? '#DDD6FE' : '#E5E7EB'}`, background: hasAppeal ? '#EDE9FE' : '#FAFAFA', color: hasAppeal ? '#7C3AED' : '#9CA3AF', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif", flexShrink: 0, transition: 'all 120ms' }}>
                  Has Appeal
                </button>
              }
            >
              <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={{ ...selectStyle, width: '150px' }}>
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="PAID">Paid</option>
                <option value="APPEALED">Appealed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} style={{ ...selectStyle, width: '170px' }}>
                <option value="ALL">All Categories</option>
                {categories.filter((c) => c.isActive).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <DateRangePill
                from={dateFrom} to={dateTo}
                onFrom={(v) => { setDateFrom(v); setPage(1); }}
                onTo={(v)   => { setDateTo(v);   setPage(1); }}
              />
            </FilterBar>

            <DataTable
              columns={violationCols} rows={rows} rowKey={(r) => r.id} loading={loading}
              rowStyle={(r) => r.status === ViolationStatus.APPEALED ? { borderLeft: '3px solid #C4B5FD' } : {}}
              emptyTitle="No violations found" emptyDescription="Try adjusting your search or filters."
            />

            <Pagination
              page={page} totalPages={totalPages} total={total}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
            />
          </div>
        </>
      )}

      {/* ══ Appeals tab ═══════════════════════════════════════ */}
      {tab === 'appeals' && (
        <div style={{ borderRadius: '12px', border: '1px solid #EBEBEB', background: '#FFF', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <FilterBar
            search={appealSearch} setSearch={(v) => { setAppealSearch(v); setAppealPage(1); }}
            filtersOpen={appealFiltersOpen} setFiltersOpen={setAppealFiltersOpen} activeFilters={aActiveFilters}
          >
            <select value={appealStatus} onChange={(e) => { setAppealStatus(e.target.value); setAppealPage(1); }} style={{ ...selectStyle, width: '150px' }}>
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CLOSED">Closed</option>
            </select>
            <DateRangePill
              from={appealDateFrom} to={appealDateTo}
              onFrom={(v) => { setAppealDateFrom(v); setAppealPage(1); }}
              onTo={(v)   => { setAppealDateTo(v);   setAppealPage(1); }}
            />
          </FilterBar>

          <DataTable
            columns={appealCols} rows={appealRows} rowKey={(r) => r.actionRequestId} loading={appealsLoading}
            emptyTitle="No appeals submitted" emptyDescription="Appeal queue is empty."
          />

          <Pagination
            page={appealPage} totalPages={appealTotalPages} total={appealTotal}
            onPrev={() => setAppealPage((p) => Math.max(1, p - 1))}
            onNext={() => setAppealPage((p) => Math.min(appealTotalPages, p + 1))}
          />
        </div>
      )}

      {/* ══ Settings tab ══════════════════════════════════════ */}
      {tab === 'settings' && (
        <div style={{ borderRadius: '12px', border: '1px solid #EBEBEB', background: '#FFF', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.01em' }}>Violation Categories</p>
              <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '3px 0 0' }}>Define category names and default fine amounts.</p>
            </div>
            <button type="button" onClick={() => { setEditingCategory(null); setCatModalOpen(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', height: '36px', borderRadius: '8px', background: '#111827', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
              <Plus style={{ width: '13px', height: '13px' }} /> Add Category
            </button>
          </div>

          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {categories.length === 0
              ? <EmptyState title="No violation categories" description="Create categories and default fines." />
              : categories.map((c, i) => (
                <div key={c.id}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '9px', border: '1px solid #EBEBEB', background: '#FAFAFA' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: CAT_DOTS[Math.abs(c.displayOrder ?? i) % CAT_DOTS.length], flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827', margin: 0 }}>{c.name}</p>
                      {c.description && <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '2px 0 0' }}>{c.description}</p>}
                    </div>
                    <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px', background: '#FEF2F2', color: '#DC2626', fontFamily: "'DM Mono', monospace" }}>
                      {money(c.defaultFineAmount)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Toggle */}
                    <button type="button"
                      onClick={() => void violationsService.toggleCategory(c.id).then(() => loadViolations())}
                      style={{ position: 'relative', width: '40px', height: '22px', borderRadius: '11px', border: `1.5px solid ${c.isActive ? '#A7F3D0' : '#E5E7EB'}`, background: c.isActive ? '#ECFDF5' : '#F9FAFB', cursor: 'pointer', transition: 'all 150ms', flexShrink: 0 }}>
                      <span style={{ position: 'absolute', top: '2px', width: '16px', height: '16px', borderRadius: '50%', background: c.isActive ? '#059669' : '#D1D5DB', left: c.isActive ? '20px' : '2px', transition: 'left 150ms' }} />
                    </button>
                    {/* Edit */}
                    <button type="button"
                      onClick={() => { setEditingCategory(c); setCatModalOpen(true); }}
                      style={{ width: '30px', height: '30px', borderRadius: '7px', border: '1px solid #EBEBEB', background: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9CA3AF' }}>
                      <Edit2 style={{ width: '12px', height: '12px' }} />
                    </button>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* ══ Detail drawer ═════════════════════════════════════ */}
      <DrawerForm
        open={detailOpen} onOpenChange={setDetailOpen}
        title="Violation Detail"
        description="Review violation details, appeals and actions."
        widthClassName="w-full sm:max-w-[560px]"
      >
        {!detail
          ? <EmptyState title="No violation selected" description="Select a violation from the list." />
          : <DetailContent key={detailKey} detail={detail}
              onReload={() => {
                void violationsService.getViolationDetail(detail.id).then((d) => setDetail(d)).catch(() => toast.error('Failed to reload'));
                void loadViolations(); void loadAppeals();
              }}
            />
        }
      </DrawerForm>

      {/* ══ Category modal ════════════════════════════════════ */}
      <CategoryModal
        open={catModalOpen} onClose={() => setCatModalOpen(false)}
        editing={editingCategory} onSaved={() => void loadViolations()}
      />
    </div>
  );
}