import { DataTable, type DataTableColumn } from '../DataTable';
import { useEffect, useMemo, useState } from 'react';
import { ComplaintStatus, Priority } from '@prisma/client';
import { StatusBadge } from '../StatusBadge';
import { DrawerForm } from '../DrawerForm';
import { EmptyState } from '../EmptyState';
import { StatCard } from '../StatCard';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, SlidersHorizontal, ChevronDown,
  Edit2, Eye, Plus, Search, Check, X,
} from 'lucide-react';
import complaintsService, {
  type ComplaintCategoryItem,
  type ComplaintDetail,
  type ComplaintInvoice,
  type ComplaintListItem,
  type ComplaintStats,
} from '../../lib/complaintsService';

// ─── Constants ────────────────────────────────────────────────

const PRIORITY_META: Record<Priority, { bg: string; color: string; dot: string }> = {
  CRITICAL: { bg: '#FEF2F2', color: '#DC2626', dot: '#EF4444' },
  HIGH:     { bg: '#FFF7ED', color: '#EA580C', dot: '#F97316' },
  MEDIUM:   { bg: '#FFFBEB', color: '#D97706', dot: '#F59E0B' },
  LOW:      { bg: '#F3F4F6', color: '#6B7280', dot: '#94A3B8' },
};

const CAT_DOT_COLORS = [
  '#0D9488', '#2563EB', '#D97706', '#DC2626',
  '#7C3AED', '#EA580C', '#0891B2', '#BE185D',
];

const fmt     = (v?: string | null) => v ? new Date(v).toLocaleString() : '—';
const initials = (name: string) =>
  name.split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase();

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

function TabBtn({ label, active, onClick }: {
  label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      style={{ padding: '7px 18px', borderRadius: '7px', border: 'none', background: active ? '#FFF' : 'transparent', color: active ? '#111827' : '#9CA3AF', cursor: 'pointer', fontSize: '12.5px', fontWeight: active ? 700 : 500, transition: 'all 120ms ease', fontFamily: "'Work Sans', sans-serif", flexShrink: 0, boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
      {label}
    </button>
  );
}

function SmallTabBtn({ label, active, onClick }: {
  label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      style={{ padding: '5px 14px', borderRadius: '6px', border: 'none', background: active ? '#FFF' : 'transparent', color: active ? '#111827' : '#9CA3AF', cursor: 'pointer', fontSize: '12px', fontWeight: active ? 700 : 500, transition: 'all 120ms ease', fontFamily: "'Work Sans', sans-serif", flexShrink: 0, boxShadow: active ? '0 1px 3px rgba(0,0,0,0.07)' : 'none' }}>
      {label}
    </button>
  );
}

function PriorityChip({ priority }: { priority: Priority }) {
  const m = PRIORITY_META[priority];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 8px', borderRadius: '5px', fontSize: '10.5px', fontWeight: 700, background: m.bg, color: m.color, fontFamily: "'Work Sans', sans-serif", whiteSpace: 'nowrap' }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
      {priority}
    </span>
  );
}

function SlaCell({ status, hours }: { status?: string | null; hours?: number | null }) {
  if (status === 'ON_TRACK')
    return <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#059669', fontFamily: "'DM Mono', monospace" }}>{Math.max(hours ?? 0, 0)}h left</span>;
  if (status === 'BREACHED')
    return <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#DC2626', fontFamily: "'DM Mono', monospace" }}>{Math.abs(hours ?? 0)}h over</span>;
  return <span style={{ color: '#D1D5DB', fontSize: '12px' }}>—</span>;
}

function InfoPair({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #EBEBEB', background: '#FFF' }}>
      <p style={{ fontSize: '9.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 3px', fontFamily: "'Work Sans', sans-serif" }}>{label}</p>
      <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0, fontFamily: "'Work Sans', sans-serif" }}>{value}</p>
    </div>
  );
}

function GhostBtn({ label, icon, onClick, disabled }: {
  label: string; icon?: React.ReactNode; onClick: () => void; disabled?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '7px', border: '1px solid #E5E7EB', background: hov ? '#F3F4F6' : '#FFF', color: '#374151', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '12.5px', fontWeight: 700, transition: 'all 120ms ease', fontFamily: "'Work Sans', sans-serif", opacity: disabled ? 0.4 : 1 }}>
      {icon}{label}
    </button>
  );
}

function PrimaryBtn({ label, icon, onClick, saving, saveLabel }: {
  label?: string; icon?: React.ReactNode; onClick: () => void; saving?: boolean; saveLabel?: string;
}) {
  return (
    <button type="button" onClick={onClick} disabled={saving}
      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '8px', background: saving ? '#9CA3AF' : '#111827', color: '#FFF', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: saving ? 'none' : '0 2px 6px rgba(0,0,0,0.15)' }}>
      {icon}{saving ? saveLabel ?? 'Saving…' : label}
    </button>
  );
}

function BluePillBtn({ label, onClick, disabled }: {
  label: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '7px', background: '#2563EB', color: '#FFF', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif', opacity: disabled ? 0.4 : 1", opacity: disabled ? 0.4 : 1 }}>
      {label}
    </button>
  );
}

function AmberPillBtn({ label, onClick, disabled }: {
  label: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '7px', background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", opacity: disabled ? 0.4 : 1 }}>
      {label}
    </button>
  );
}

// ─── Category Modal ───────────────────────────────────────────

function CategoryModal({ open, onClose, editing, onSaved }: {
  open: boolean; onClose: () => void;
  editing: ComplaintCategoryItem | null;
  onSaved: () => void;
}) {
  const [form, setForm]     = useState({ name: '', slaHours: '24', description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) setForm({ name: editing.name, slaHours: String(editing.slaHours), description: editing.description ?? '' });
    else          setForm({ name: '', slaHours: '24', description: '' });
  }, [editing, open]);

  const handleSave = async () => {
    const name = form.name.trim();
    const hrs  = Number(form.slaHours);
    if (!name || !Number.isInteger(hrs) || hrs < 1 || hrs > 720) {
      toast.error('Provide a valid name and SLA hours (1–720)'); return;
    }
    setSaving(true);
    try {
      if (editing) await complaintsService.updateCategory(editing.id, { name, slaHours: hrs, description: form.description.trim() || undefined });
      else         await complaintsService.createCategory({ name, slaHours: hrs, description: form.description.trim() || undefined });
      toast.success('Category saved');
      onSaved(); onClose();
    } catch { toast.error('Failed to save category'); }
    finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.4)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px' }}
    >
      <div style={{ width: '100%', maxWidth: '440px', background: '#FFF', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', fontFamily: "'Work Sans', sans-serif" }}>
        {/* Gradient strip */}
        <div style={{ height: '4px', background: 'linear-gradient(90deg, #2563EB 0%, #0D9488 100%)' }} />

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
          {/* Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Work Sans', sans-serif" }}>
              Category Name <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Plumbing"
              style={inputStyle}
            />
          </div>

          {/* SLA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Work Sans', sans-serif" }}>
              SLA Hours <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="number" min={1} max={720}
                value={form.slaHours}
                onChange={(e) => setForm((p) => ({ ...p, slaHours: e.target.value }))}
                style={{ ...inputStyle, paddingRight: '52px', fontFamily: "'DM Mono', monospace" }}
              />
              <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#9CA3AF', pointerEvents: 'none', fontFamily: "'Work Sans', sans-serif" }}>hours</span>
            </div>
          </div>

          {/* Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Work Sans', sans-serif" }}>
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Optional description…"
              style={textareaStyle}
            />
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

// ─── Detail Drawer content ────────────────────────────────────

function DetailContent({ detail, onReload }: {
  detail: ComplaintDetail; onReload: () => void;
}) {
  const [subTab,           setSubTab]           = useState<'details' | 'comments' | 'invoices'>('details');
  const [commentBody,      setCommentBody]      = useState('');
  const [postingComment,   setPostingComment]   = useState(false);

  const postComment = async (internal: boolean) => {
    if (!commentBody.trim()) return;
    setPostingComment(true);
    try {
      await complaintsService.addComment(detail.id, { body: commentBody.trim(), isInternal: internal || undefined });
      setCommentBody('');
      onReload();
    } catch { toast.error('Failed to post comment'); }
    finally { setPostingComment(false); }
  };

  const updateStatus = async (s: ComplaintStatus) => {
    try {
      await complaintsService.updateComplaintStatus(detail.id, s);
      toast.success('Status updated');
      onReload();
    } catch { toast.error('Failed to update status'); }
  };

  const invoiceCols: DataTableColumn<ComplaintInvoice>[] = [
    { key: 'n', header: 'Invoice #', render: (r) => <span style={{ fontSize: '12px', fontFamily: "'DM Mono', monospace", color: '#111827' }}>{r.invoiceNumber}</span> },
    { key: 'a', header: 'Amount',    render: (r) => <span style={{ fontSize: '12.5px', fontWeight: 700, fontFamily: "'DM Mono', monospace", color: '#111827' }}>EGP {r.amount.toLocaleString()}</span> },
    { key: 't', header: 'Type',      render: (r) => <span style={{ fontSize: '12px', color: '#6B7280' }}>{r.type}</span> },
    { key: 's', header: 'Status',    render: (r) => <StatusBadge value={r.status} /> },
    { key: 'd', header: 'Due Date',  render: (r) => <span style={{ fontSize: '11.5px', color: '#9CA3AF', fontFamily: "'DM Mono', monospace" }}>{fmt(r.dueDate)}</span> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Number + badges */}
      <div>
        <p style={{ fontSize: '22px', fontWeight: 900, color: '#111827', letterSpacing: '-0.03em', margin: 0, fontFamily: "'DM Mono', monospace" }}>{detail.complaintNumber}</p>
        {detail.title && <p style={{ fontSize: '13px', color: '#6B7280', margin: '4px 0 10px', fontFamily: "'Work Sans', sans-serif" }}>{detail.title}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: detail.title ? 0 : '10px' }}>
          <StatusBadge value={detail.status} />
          <PriorityChip priority={detail.priority} />
          {detail.categoryName && (
            <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px', background: '#EFF6FF', color: '#2563EB', fontFamily: "'Work Sans', sans-serif" }}>
              {detail.categoryName}
            </span>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '2px', padding: '3px', borderRadius: '8px', background: '#F3F4F6' }}>
        <SmallTabBtn label="Details"                           active={subTab === 'details'}  onClick={() => setSubTab('details')} />
        <SmallTabBtn label={`Comments (${detail.comments.length})`} active={subTab === 'comments'} onClick={() => setSubTab('comments')} />
        <SmallTabBtn label={`Invoices (${detail.invoices.length})`} active={subTab === 'invoices'} onClick={() => setSubTab('invoices')} />
      </div>

      {/* ── Details ── */}
      {subTab === 'details' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <InfoPair label="Unit"      value={detail.unitNumber ?? '—'} />
            <InfoPair label="Reporter"  value={detail.reporterName} />
            <InfoPair label="Assignee"  value={detail.assigneeName ?? 'Unassigned'} />
            <InfoPair label="Submitted" value={fmt(detail.createdAt)} />
          </div>

          {detail.description && (
            <div style={{ padding: '12px 14px', borderRadius: '9px', border: '1px solid #EBEBEB', background: '#FAFAFA', fontSize: '13px', color: '#374151', lineHeight: 1.6, fontFamily: "'Work Sans', sans-serif" }}>
              {detail.description}
            </div>
          )}

          {/* Status actions */}
          <div style={{ padding: '14px 16px', borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FFF', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0, fontFamily: "'Work Sans', sans-serif" }}>Status Actions</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {detail.status === ComplaintStatus.NEW && (
                <BluePillBtn label="Mark In Progress" onClick={() => void updateStatus(ComplaintStatus.IN_PROGRESS)} disabled={!detail.assigneeId} />
              )}
              {detail.status === ComplaintStatus.IN_PROGRESS && (
                <BluePillBtn label="Mark Resolved" onClick={() => void updateStatus(ComplaintStatus.RESOLVED)} />
              )}
              {detail.status === ComplaintStatus.RESOLVED && (
                <GhostBtn label="Close Complaint" onClick={() => void updateStatus(ComplaintStatus.CLOSED)} />
              )}
              {detail.status === ComplaintStatus.CLOSED && (
                <span style={{ fontSize: '12.5px', color: '#9CA3AF', fontFamily: "'Work Sans', sans-serif" }}>This complaint is closed.</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Comments ── */}
      {subTab === 'comments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {detail.comments.length === 0
            ? <EmptyState title="No comments yet" description="Post the first comment or internal note." />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {detail.comments.map((c) => (
                  <div key={c.id}
                    style={{ display: 'flex', gap: '10px', paddingLeft: '10px', borderLeft: `2px solid ${c.isInternal ? '#FDE68A' : '#E5E7EB'}` }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10.5px', fontWeight: 700, flexShrink: 0, fontFamily: "'Work Sans', sans-serif" }}>
                      {initials(c.authorName)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#111827', fontFamily: "'Work Sans', sans-serif" }}>{c.authorName}</span>
                        {c.isInternal && (
                          <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A', fontFamily: "'Work Sans', sans-serif" }}>
                            Internal
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '12.5px', color: '#374151', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.55, fontFamily: "'Work Sans', sans-serif" }}>{c.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          }

          {/* Comment input */}
          <div style={{ padding: '14px', borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Write a comment or internal note…"
              style={{ ...textareaStyle, background: '#FFF' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <GhostBtn label="Post Comment"  onClick={() => void postComment(false)} disabled={!commentBody.trim() || postingComment} />
              <AmberPillBtn label="Internal Note" onClick={() => void postComment(true)}  disabled={!commentBody.trim() || postingComment} />
            </div>
          </div>
        </div>
      )}

      {/* ── Invoices ── */}
      {subTab === 'invoices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <BluePillBtn
              label="+ Create Invoice"
              onClick={() => toast.info('Use Billing to create invoices linked to complaints.')}
            />
          </div>
          <DataTable
            columns={invoiceCols}
            rows={detail.invoices}
            rowKey={(r) => r.id}
            emptyTitle="No linked invoices"
            emptyDescription="No invoice records linked to this complaint."
          />
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────

export function ComplaintsViolations() {
  const [tab,           setTab]           = useState<'complaints' | 'settings'>('complaints');
  const [stats,         setStats]         = useState<ComplaintStats | null>(null);
  const [resolvedMonth, setResolvedMonth] = useState(0);
  const [categories,    setCategories]    = useState<ComplaintCategoryItem[]>([]);
  const [rows,          setRows]          = useState<ComplaintListItem[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [total,         setTotal]         = useState(0);
  const [totalPages,    setTotalPages]    = useState(1);

  const [search,       setSearch]       = useState('');
  const [status,       setStatus]       = useState('ALL');
  const [categoryId,   setCategoryId]   = useState('ALL');
  const [priority,     setPriority]     = useState('ALL');
  const [slaOnly,      setSlaOnly]      = useState(false);
  const [filtersOpen,  setFiltersOpen]  = useState(false);
  const [page,         setPage]         = useState(1);

  const [detailOpen,  setDetailOpen]  = useState(false);
  const [detail,      setDetail]      = useState<ComplaintDetail | null>(null);
  const [detailKey,   setDetailKey]   = useState(0);

  const [catModalOpen,    setCatModalOpen]    = useState(false);
  const [editingCategory, setEditingCategory] = useState<ComplaintCategoryItem | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const month = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const [st, cats, list, resolved] = await Promise.all([
        complaintsService.getComplaintStats(),
        complaintsService.listCategories(true),
        complaintsService.listComplaints({
          page, limit: 25,
          search:     search     || undefined,
          status:     status     !== 'ALL' ? (status as ComplaintStatus) : undefined,
          categoryId: categoryId !== 'ALL' ? categoryId                  : undefined,
          priority:   priority   !== 'ALL' ? (priority as Priority)      : undefined,
          slaBreached: slaOnly   || undefined,
        }),
        complaintsService.listComplaints({ page: 1, limit: 1, status: ComplaintStatus.RESOLVED, dateFrom: month }),
      ]);
      setStats(st); setCategories(cats);
      setRows(list.data); setTotal(list.total); setTotalPages(list.totalPages);
      setResolvedMonth(resolved.total);
    } catch { toast.error('Failed to load complaints'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [page, search, status, categoryId, priority, slaOnly]);

  const activeFilters = [status !== 'ALL', categoryId !== 'ALL', priority !== 'ALL'].filter(Boolean).length;

  const cols = useMemo<DataTableColumn<ComplaintListItem>[]>(() => [
    { key: 'n',   header: '#',         render: (r) => <span style={{ fontSize: '11.5px', fontFamily: "'DM Mono', monospace", color: '#6B7280' }}>{r.complaintNumber}</span> },
    { key: 't',   header: 'Title',     render: (r) => <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827', fontFamily: "'Work Sans', sans-serif" }}>{r.title ?? 'Untitled complaint'}</span> },
    { key: 'c',   header: 'Category',  render: (r) => <span style={{ fontSize: '12px', color: '#6B7280' }}>{r.categoryName ?? '—'}</span> },
    { key: 'u',   header: 'Unit',      render: (r) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '5px', fontSize: '10.5px', fontWeight: 700, background: '#EFF6FF', color: '#2563EB', fontFamily: "'Work Sans', sans-serif" }}>
        {r.unitNumber ?? '—'}
      </span>
    )},
    { key: 'r',   header: 'Reporter',  render: (r) => <span style={{ fontSize: '12px', color: '#374151' }}>{r.reporterName}</span> },
    { key: 'a',   header: 'Assignee',  render: (r) => <span style={{ fontSize: '12px', color: r.assigneeName ? '#374151' : '#C4C9D4' }}>{r.assigneeName ?? 'Unassigned'}</span> },
    { key: 'p',   header: 'Priority',  render: (r) => <PriorityChip priority={r.priority} /> },
    { key: 'sla', header: 'SLA',       render: (r) => <SlaCell status={r.slaStatus} hours={r.hoursRemaining} /> },
    { key: 's',   header: 'Status',    render: (r) => <StatusBadge value={r.status} /> },
    { key: 'x',   header: '',          render: (r) => (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button"
          onClick={() => void complaintsService.getComplaintDetail(r.id).then((d) => {
            setDetail(d); setDetailKey((k) => k + 1); setDetailOpen(true);
          }).catch(() => toast.error('Failed to load detail'))}
          style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #EBEBEB', background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9CA3AF' }}>
          <Eye style={{ width: '12px', height: '12px' }} />
        </button>
      </div>
    )},
  ], []);

  // ─────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif" }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 900, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>Complaints & Violations</h1>
        <p style={{ fontSize: '13px', color: '#6B7280', margin: '4px 0 0' }}>Complaint operations and category SLA settings.</p>
      </div>

      {/* ── Top-level tabs ─────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '2px', padding: '4px', borderRadius: '10px', background: '#F3F4F6', marginBottom: '20px', width: 'fit-content' }}>
        <TabBtn label="Complaints" active={tab === 'complaints'} onClick={() => setTab('complaints')} />
        <TabBtn label="Settings"   active={tab === 'settings'}   onClick={() => setTab('settings')} />
      </div>

      {/* ══ Complaints tab ════════════════════════════════════ */}
      {tab === 'complaints' && (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
            <StatCard icon="complaints-open"   title="Open Complaints"     value={String(stats?.open ?? 0)}              subtitle="NEW + IN_PROGRESS" />
            <StatCard icon="complaints-total"  title="SLA Breached"        value={String(stats?.slaBreached ?? 0)}        subtitle="Open complaints only" />
            <StatCard icon="complaints-closed" title="Resolved This Month" value={String(resolvedMonth)}                  subtitle="Current month" />
            <StatCard icon="revenue"           title="Avg Resolution Time" value={`${stats?.avgResolutionHours ?? 0}h`}   subtitle="Resolved + closed" />
          </div>

          {/* Table card */}
          <div style={{ borderRadius: '12px', border: '1px solid #EBEBEB', background: '#FFF', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>

            {/* Filter bar */}
            <div style={{ borderBottom: filtersOpen ? '1px solid #F3F4F6' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px' }}>
                <Search style={{ width: '13px', height: '13px', color: '#C4C9D4', flexShrink: 0 }} />
                <input
                  placeholder="Search complaints…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: '#111827', fontFamily: "'Work Sans', sans-serif" }}
                />

                {/* SLA breached pill toggle */}
                <button type="button" onClick={() => { setSlaOnly((p) => !p); setPage(1); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${slaOnly ? '#FECACA' : '#E5E7EB'}`, background: slaOnly ? '#FEF2F2' : '#FAFAFA', color: slaOnly ? '#DC2626' : '#9CA3AF', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif", flexShrink: 0, transition: 'all 120ms' }}>
                  SLA Breached
                </button>

                {/* Filters toggle */}
                <button type="button" onClick={() => setFiltersOpen((p) => !p)}
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

                {/* Check SLA */}
                <button type="button"
                  onClick={() => void complaintsService.checkSlaBreaches().then(() => load()).then(() => toast.success('SLA checked')).catch(() => toast.error('SLA check failed'))}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '6px', border: '1px solid #E5E7EB', background: '#FFF', color: '#374151', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif", flexShrink: 0 }}>
                  Check SLA
                </button>
              </div>

              {/* Expanded filters */}
              {filtersOpen && (
                <div style={{ padding: '10px 14px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={{ ...selectStyle, width: '150px' }}>
                    <option value="ALL">All Statuses</option>
                    <option value="NEW">New</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                  <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} style={{ ...selectStyle, width: '170px' }}>
                    <option value="ALL">All Categories</option>
                    {categories.filter((c) => c.isActive).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }} style={{ ...selectStyle, width: '130px' }}>
                    <option value="ALL">All Priorities</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              )}
            </div>

            {/* Table */}
            <DataTable
              columns={cols}
              rows={rows}
              rowKey={(r) => r.id}
              loading={loading}
              rowStyle={(r) => r.slaStatus === 'BREACHED' ? { borderLeft: '3px solid #FCA5A5' } : {}}
              emptyTitle="No complaints found"
              emptyDescription="Try adjusting your search or filters."
            />

            {/* Pagination */}
            <div style={{ padding: '12px 14px', borderTop: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11.5px', color: '#9CA3AF', fontFamily: "'DM Mono', monospace" }}>
                Page {page} of {totalPages}<span style={{ color: '#D1D5DB', marginLeft: '6px' }}>({total})</span>
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', border: '1px solid #E5E7EB', background: page <= 1 ? '#F9FAFB' : '#FFF', color: page <= 1 ? '#D1D5DB' : '#374151', cursor: page <= 1 ? 'not-allowed' : 'pointer', fontSize: '12px', fontFamily: "'Work Sans', sans-serif" }}>
                  <ChevronLeft style={{ width: '12px', height: '12px' }} /> Prev
                </button>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', border: '1px solid #E5E7EB', background: page >= totalPages ? '#F9FAFB' : '#FFF', color: page >= totalPages ? '#D1D5DB' : '#374151', cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontSize: '12px', fontFamily: "'Work Sans', sans-serif" }}>
                  Next <ChevronRight style={{ width: '12px', height: '12px' }} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══ Settings tab ══════════════════════════════════════ */}
      {tab === 'settings' && (
        <div style={{ borderRadius: '12px', border: '1px solid #EBEBEB', background: '#FFF', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          {/* Header */}
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.01em' }}>Complaint Categories</p>
              <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '3px 0 0' }}>Define categories and SLA targets for complaint routing.</p>
            </div>
            <button type="button"
              onClick={() => { setEditingCategory(null); setCatModalOpen(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', height: '36px', borderRadius: '8px', background: '#111827', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
              <Plus style={{ width: '13px', height: '13px' }} /> Add Category
            </button>
          </div>

          {/* List */}
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {categories.length === 0
              ? <EmptyState title="No categories yet" description="Create complaint categories and SLA targets." />
              : categories.map((c, i) => (
                <div key={c.id}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '9px', border: '1px solid #EBEBEB', background: '#FAFAFA' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: CAT_DOT_COLORS[Math.abs(c.displayOrder ?? i) % CAT_DOT_COLORS.length], flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827', margin: 0 }}>{c.name}</p>
                      {c.description && <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '2px 0 0' }}>{c.description}</p>}
                    </div>
                    <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px', background: '#EFF6FF', color: '#2563EB', fontFamily: "'DM Mono', monospace" }}>
                      {c.slaHours}h SLA
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Active toggle */}
                    <button type="button"
                      onClick={() => void complaintsService.toggleCategory(c.id).then(() => load())}
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
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title="Complaint Detail"
        description="View status, comments, and linked invoices."
        widthClassName="w-full sm:max-w-[560px]"
      >
        {!detail
          ? <EmptyState title="No complaint selected" description="Select a complaint from the list." />
          : <DetailContent key={detailKey} detail={detail}
              onReload={() => {
                void complaintsService.getComplaintDetail(detail.id).then((d) => setDetail(d)).catch(() => toast.error('Failed to reload'));
                void load();
              }}
            />
        }
      </DrawerForm>

      {/* ══ Category modal ════════════════════════════════════ */}
      <CategoryModal
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        editing={editingCategory}
        onSaved={() => void load()}
      />
    </div>
  );
}