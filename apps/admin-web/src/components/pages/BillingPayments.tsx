import { errorMessage, formatDateTime, humanizeEnum } from '../../lib/live-data';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataTable, type DataTableColumn } from '../DataTable';
import { StatusBadge } from '../StatusBadge';
import { DrawerForm } from '../DrawerForm';
import { EmptyState } from '../EmptyState';
import { StatCard } from '../StatCard';
import { toast } from 'sonner';
import {
  CreditCard, FileText, CheckCircle2, XCircle, Search, Receipt,
  RefreshCw, Plus, Check, X, ChevronLeft, ChevronRight,
  CalendarRange, SlidersHorizontal, ChevronDown,
} from 'lucide-react';
import billingService, {
  type BillingInvoice,
  type BillingPayment,
  type BillingStats,
  type InvoiceStatus,
  type PaymentMethod,
  type CreateInvoicePayload,
  type RecordPaymentPayload,
} from '../../lib/billing-service';

// ─── Types ────────────────────────────────────────────────────

type ActiveTab = 'invoices' | 'payments';

type InvoiceFormState = {
  communityId: string; unitId: string; residentId: string;
  title: string; amount: string; currency: string;
  dueDate: string; category: string; notes: string;
};

type PaymentFormState = {
  invoiceId: string; amount: string; method: PaymentMethod;
  referenceNumber: string; notes: string; paidAt: string;
};

const INIT_INVOICE: InvoiceFormState = {
  communityId: '', unitId: '', residentId: '', title: '',
  amount: '', currency: 'EGP', dueDate: '', category: 'MAINTENANCE', notes: '',
};

const INIT_PAYMENT: PaymentFormState = {
  invoiceId: '', amount: '', method: 'BANK_TRANSFER',
  referenceNumber: '', notes: '', paidAt: '',
};

const EMPTY_STATS: BillingStats = {
  totalInvoiced: 0, totalCollected: 0, totalOverdue: 0,
  pendingCount: 0, overdueCount: 0, paidCount: 0, totalCount: 0,
};

const PAGE_SIZE = 20;

const PAYMENT_METHODS: PaymentMethod[] = ['BANK_TRANSFER', 'CASH', 'CHEQUE', 'ONLINE', 'CARD'];
const INVOICE_CATEGORIES = ['MAINTENANCE', 'UTILITY', 'SERVICE', 'PENALTY', 'DEPOSIT', 'OTHER'];
const CURRENCIES = ['EGP', 'USD', 'EUR', 'SAR', 'AED'];

const METHOD_META: Record<string, { bg: string; color: string }> = {
  BANK_TRANSFER: { bg: '#EFF6FF', color: '#2563EB' },
  CASH:          { bg: '#F0FDF4', color: '#16A34A' },
  CHEQUE:        { bg: '#FFFBEB', color: '#D97706' },
  ONLINE:        { bg: '#F5F3FF', color: '#7C3AED' },
  CARD:          { bg: '#F0FDFA', color: '#0D9488' },
};

const CAT_META: Record<string, { bg: string; color: string }> = {
  MAINTENANCE: { bg: '#EFF6FF', color: '#2563EB' },
  UTILITY:     { bg: '#F0FDF4', color: '#16A34A' },
  SERVICE:     { bg: '#F5F3FF', color: '#7C3AED' },
  PENALTY:     { bg: '#FEF2F2', color: '#DC2626' },
  DEPOSIT:     { bg: '#FFF7ED', color: '#EA580C' },
  OTHER:       { bg: '#F3F4F6', color: '#6B7280' },
};

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

function TabBtn({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 18px', borderRadius: '7px', border: 'none', background: active ? '#FFF' : 'transparent', color: active ? '#111827' : '#9CA3AF', cursor: 'pointer', fontSize: '12.5px', fontWeight: active ? 700 : 500, transition: 'all 120ms ease', fontFamily: "'Work Sans', sans-serif", flexShrink: 0, boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
      <span style={{ color: active ? '#2563EB' : '#D1D5DB' }}>{icon}</span>
      {label}
    </button>
  );
}

function ActionBtn({ label, icon, variant = 'ghost', onClick, disabled }: {
  label: string; icon?: React.ReactNode; variant?: 'ghost' | 'danger' | 'success';
  onClick: () => void; disabled?: boolean;
}) {
  const [hov, setHov] = useState(false);
  const vs: Record<string, React.CSSProperties> = {
    ghost:   { background: hov ? '#F3F4F6' : '#FFF',    color: '#374151',                  border: '1px solid #E5E7EB' },
    danger:  { background: hov ? '#B91C1C' : '#FEF2F2', color: hov ? '#FFF' : '#DC2626',   border: '1px solid #FECACA' },
    success: { background: hov ? '#047857' : '#ECFDF5', color: hov ? '#FFF' : '#059669',   border: '1px solid #A7F3D0' },
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '11.5px', fontWeight: 700, transition: 'all 120ms ease', fontFamily: "'Work Sans', sans-serif", opacity: disabled ? 0.4 : 1, ...vs[variant] }}>
      {icon}{label}
    </button>
  );
}

function MethodChip({ method }: { method: string }) {
  const m = METHOD_META[method] ?? { bg: '#F3F4F6', color: '#6B7280' };
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '5px', fontSize: '10.5px', fontWeight: 700, background: m.bg, color: m.color, fontFamily: "'Work Sans', sans-serif" }}>{humanizeEnum(method)}</span>;
}

function CatChip({ category }: { category: string }) {
  const m = CAT_META[category] ?? { bg: '#F3F4F6', color: '#6B7280' };
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '5px', fontSize: '10.5px', fontWeight: 700, background: m.bg, color: m.color, fontFamily: "'Work Sans', sans-serif" }}>{humanizeEnum(category)}</span>;
}

function MonoAmount({ amount, currency }: { amount: number; currency: string }) {
  return (
    <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827', fontFamily: "'DM Mono', monospace" }}>
      {currency} {amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

function Pagination({ page, totalPages, total, onPrev, onNext }: {
  page: number; totalPages: number; total: number; onPrev: () => void; onNext: () => void;
}) {
  if (total === 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
      <button type="button" disabled={page <= 1} onClick={onPrev}
        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', border: '1px solid #E5E7EB', background: page <= 1 ? '#F9FAFB' : '#FFF', color: page <= 1 ? '#D1D5DB' : '#374151', cursor: page <= 1 ? 'not-allowed' : 'pointer', fontSize: '12px', fontFamily: "'Work Sans', sans-serif" }}>
        <ChevronLeft style={{ width: '12px', height: '12px' }} /> Prev
      </button>
      <span style={{ fontSize: '12px', color: '#6B7280', fontFamily: "'DM Mono', monospace" }}>
        {page} / {totalPages}<span style={{ color: '#D1D5DB', marginLeft: '6px' }}>({total})</span>
      </span>
      <button type="button" disabled={page >= totalPages} onClick={onNext}
        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', border: '1px solid #E5E7EB', background: page >= totalPages ? '#F9FAFB' : '#FFF', color: page >= totalPages ? '#D1D5DB' : '#374151', cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontSize: '12px', fontFamily: "'Work Sans', sans-serif" }}>
        Next <ChevronRight style={{ width: '12px', height: '12px' }} />
      </button>
    </div>
  );
}

function FilterBar({ searchValue, onSearchChange, filtersOpen, onToggleFilters, activeFilters, placeholder, children }: {
  searchValue: string; onSearchChange: (v: string) => void;
  filtersOpen: boolean; onToggleFilters: () => void;
  activeFilters: number; placeholder?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FFF', overflow: 'hidden', marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: filtersOpen ? '1px solid #F3F4F6' : 'none' }}>
        <Search style={{ width: '13px', height: '13px', color: '#C4C9D4', flexShrink: 0 }} />
        <input placeholder={placeholder ?? 'Search…'} value={searchValue} onChange={(e) => onSearchChange(e.target.value)}
          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: '#111827', fontFamily: "'Work Sans', sans-serif" }} />
        <button type="button" onClick={onToggleFilters}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: `1px solid ${activeFilters > 0 ? '#2563EB40' : '#E5E7EB'}`, background: activeFilters > 0 ? '#EFF6FF' : '#FAFAFA', color: activeFilters > 0 ? '#2563EB' : '#6B7280', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif", flexShrink: 0 }}>
          <SlidersHorizontal style={{ width: '11px', height: '11px' }} />
          Filters
          {activeFilters > 0 && <span style={{ width: '15px', height: '15px', borderRadius: '50%', background: '#2563EB', color: '#FFF', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{activeFilters}</span>}
          <ChevronDown style={{ width: '10px', height: '10px', transform: filtersOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
        </button>
      </div>
      {filtersOpen && (
        <div style={{ padding: '10px 14px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function DateRangePill({ from, to, onFrom, onTo }: { from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '7px', border: '1px solid #E5E7EB', background: '#FAFAFA' }}>
      <CalendarRange style={{ width: '11px', height: '11px', color: '#C4C9D4' }} />
      <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>FROM</span>
      <input type="date" value={from} onChange={(e) => onFrom(e.target.value)}
        style={{ width: '130px', border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', color: '#374151', fontFamily: "'Work Sans', sans-serif" }} />
      <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>TO</span>
      <input type="date" value={to} onChange={(e) => onTo(e.target.value)}
        style={{ width: '130px', border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', color: '#374151', fontFamily: "'Work Sans', sans-serif" }} />
    </div>
  );
}

function DrawerFooter({ onCancel, onSave, saving, saveLabel }: {
  onCancel: () => void; onSave: () => void; saving: boolean; saveLabel: string;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
      <button type="button" disabled={saving} onClick={onCancel}
        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#FFF', color: '#6B7280', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontFamily: "'Work Sans', sans-serif", fontWeight: 600 }}>
        <X style={{ width: '12px', height: '12px' }} /> Cancel
      </button>
      <button type="button" disabled={saving} onClick={onSave}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '8px', background: saving ? '#9CA3AF' : '#111827', color: '#FFF', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: saving ? 'none' : '0 2px 6px rgba(0,0,0,0.18)' }}>
        <Check style={{ width: '13px', height: '13px' }} />
        {saving ? 'Saving…' : saveLabel}
      </button>
    </div>
  );
}

// ─── Invoice Detail Modal ─────────────────────────────────────

function InvoiceDetailModal({ invoice, onClose, onRecordPayment }: {
  invoice: BillingInvoice; onClose: () => void; onRecordPayment: (inv: BillingInvoice) => void;
}) {
  const canPay = invoice.status !== 'PAID' && invoice.status !== 'VOID';

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.4)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px' }}
    >
      <div style={{ width: '100%', maxWidth: '460px', background: '#FFF', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', fontFamily: "'Work Sans', sans-serif" }}>
        {/* Top gradient strip */}
        <div style={{ height: '4px', background: 'linear-gradient(90deg, #2563EB 0%, #0D9488 100%)' }} />

        {/* Header */}
        <div style={{ padding: '20px 22px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Receipt style={{ width: '15px', height: '15px', color: '#2563EB' }} />
            </div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.01em' }}>Invoice Detail</p>
              <p style={{ fontSize: '10.5px', color: '#9CA3AF', margin: '2px 0 0', fontFamily: "'DM Mono', monospace" }}>
                #{invoice.invoiceNumber ?? invoice.id.slice(0, 12).toUpperCase()}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #EBEBEB', background: '#FAFAFA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', flexShrink: 0 }}>
            <X style={{ width: '12px', height: '12px' }} />
          </button>
        </div>

        {/* Title + badges */}
        <div style={{ margin: '16px 22px 12px', padding: '14px 16px', borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FAFAFA' }}>
          <p style={{ fontSize: '15px', fontWeight: 800, color: '#111827', margin: '0 0 8px', letterSpacing: '-0.01em', lineHeight: 1.3 }}>{invoice.title}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <StatusBadge value={invoice.status} />
            <CatChip category={invoice.category} />
          </div>
        </div>

        {/* Info grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '0 22px 14px' }}>
          {[
            { label: 'Amount',   value: `${invoice.currency} ${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, mono: true },
            { label: 'Due Date', value: invoice.dueDate ? formatDateTime(invoice.dueDate) : '—',                                        mono: true },
            { label: 'Unit',     value: invoice.unit?.unitNumber ?? '—',                                                                mono: false },
            { label: 'Resident', value: invoice.resident?.nameEN ?? '—',                                                               mono: false },
          ].map(({ label, value, mono }) => (
            <div key={label} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #EBEBEB', background: '#FFF' }}>
              <p style={{ fontSize: '9.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 3px' }}>{label}</p>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827', margin: 0, fontFamily: mono ? "'DM Mono', monospace" : "'Work Sans', sans-serif" }}>{value}</p>
            </div>
          ))}
        </div>

        {invoice.notes && (
          <div style={{ margin: '0 22px 14px', padding: '11px 13px', borderRadius: '8px', border: '1px solid #EBEBEB', background: '#FAFAFA', fontSize: '12.5px', color: '#4B5563', lineHeight: 1.55 }}>
            {invoice.notes}
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '14px 22px 20px', display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #F3F4F6' }}>
          <button type="button" onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#FFF', color: '#6B7280', cursor: 'pointer', fontSize: '13px', fontFamily: "'Work Sans', sans-serif", fontWeight: 600 }}>
            Close
          </button>
          {canPay && (
            <button type="button" onClick={() => { onClose(); onRecordPayment(invoice); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: '8px', background: '#111827', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
              <CreditCard style={{ width: '12px', height: '12px' }} /> Record Payment
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────

export function BillingPayments() {
  const [activeTab,           setActiveTab]           = useState<ActiveTab>('invoices');
  const [isBootstrapping,     setIsBootstrapping]     = useState(false);
  const [isInvoicesLoading,   setIsInvoicesLoading]   = useState(false);
  const [isPaymentsLoading,   setIsPaymentsLoading]   = useState(false);
  const [isSavingInvoice,     setIsSavingInvoice]     = useState(false);
  const [isSavingPayment,     setIsSavingPayment]     = useState(false);

  const [communities,         setCommunities]         = useState<Array<{ id: string; label: string }>>([]);
  const [unitOptions,         setUnitOptions]         = useState<Array<{ id: string; label: string }>>([]);
  const [residentOptions,     setResidentOptions]     = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState('');

  const [invoices,     setInvoices]     = useState<BillingInvoice[]>([]);
  const [payments,     setPayments]     = useState<BillingPayment[]>([]);
  const [stats,        setStats]        = useState<BillingStats>(EMPTY_STATS);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [paymentTotal, setPaymentTotal] = useState(0);

  const [invFilters, setInvFilters] = useState({ status: 'all', category: 'all', unitId: 'all', from: '', to: '', search: '', page: 1 });
  const [payFilters, setPayFilters] = useState({ method: 'all', from: '', to: '', search: '', page: 1 });
  const [invFiltersOpen, setInvFiltersOpen] = useState(false);
  const [payFiltersOpen, setPayFiltersOpen] = useState(false);

  const [invoiceDrawerOpen, setInvoiceDrawerOpen] = useState(false);
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);
  const [invoiceForm,       setInvoiceForm]       = useState<InvoiceFormState>(INIT_INVOICE);
  const [paymentForm,       setPaymentForm]       = useState<PaymentFormState>(INIT_PAYMENT);

  const [selectedInvoice, setSelectedInvoice] = useState<BillingInvoice | null>(null);
  const [detailOpen,      setDetailOpen]      = useState(false);

  // ── Loaders ───────────────────────────────────────────────────

  const loadStats = useCallback(async (cid: string) => {
    try { setStats(await billingService.getStats(cid)); }
    catch (e) { toast.error('Failed to load stats', { description: errorMessage(e) }); }
  }, []);

  const loadInvoices = useCallback(async (cid: string) => {
    setIsInvoicesLoading(true);
    try {
      const r = await billingService.listInvoices({
        communityId: cid,
        status:   invFilters.status   !== 'all' ? (invFilters.status as InvoiceStatus) : undefined,
        category: invFilters.category !== 'all' ? invFilters.category                  : undefined,
        unitId:   invFilters.unitId   !== 'all' ? invFilters.unitId                    : undefined,
        from:     invFilters.from     ? new Date(`${invFilters.from}T00:00:00`).toISOString()       : undefined,
        to:       invFilters.to       ? new Date(`${invFilters.to}T23:59:59.999`).toISOString()     : undefined,
        search:   invFilters.search   || undefined,
        page: invFilters.page, limit: PAGE_SIZE,
      });
      setInvoices(r.data); setInvoiceTotal(r.total);
    } catch (e) { toast.error('Failed to load invoices', { description: errorMessage(e) }); }
    finally { setIsInvoicesLoading(false); }
  }, [invFilters]);

  const loadPayments = useCallback(async (cid: string) => {
    setIsPaymentsLoading(true);
    try {
      const r = await billingService.listPayments({
        communityId: cid,
        method: payFilters.method !== 'all' ? (payFilters.method as PaymentMethod) : undefined,
        from:   payFilters.from   ? new Date(`${payFilters.from}T00:00:00`).toISOString()       : undefined,
        to:     payFilters.to     ? new Date(`${payFilters.to}T23:59:59.999`).toISOString()     : undefined,
        search: payFilters.search || undefined,
        page: payFilters.page, limit: PAGE_SIZE,
      });
      setPayments(r.data); setPaymentTotal(r.total);
    } catch (e) { toast.error('Failed to load payments', { description: errorMessage(e) }); }
    finally { setIsPaymentsLoading(false); }
  }, [payFilters]);

  const loadOptions = useCallback(async (cid: string) => {
    try {
      const [units, residents] = await Promise.all([
        billingService.listUnitOptions(cid),
        billingService.listResidentOptions(cid),
      ]);
      setUnitOptions(units); setResidentOptions(residents);
    } catch { /* non-fatal */ }
  }, []);

  const bootstrap = useCallback(async () => {
    setIsBootstrapping(true);
    try {
      const opts = await billingService.listCommunityOptions();
      setCommunities(opts);
      const first = opts[0]?.id ?? '';
      setSelectedCommunityId(first);
      if (first) await Promise.all([loadStats(first), loadInvoices(first), loadPayments(first), loadOptions(first)]);
    } catch (e) { toast.error('Failed to initialize', { description: errorMessage(e) }); }
    finally { setIsBootstrapping(false); }
  }, [loadStats, loadInvoices, loadPayments, loadOptions]);

  useEffect(() => { void bootstrap(); }, [bootstrap]);
  useEffect(() => { if (selectedCommunityId) void Promise.all([loadStats(selectedCommunityId), loadOptions(selectedCommunityId)]); }, [selectedCommunityId, loadStats, loadOptions]);
  useEffect(() => { if (selectedCommunityId) void loadInvoices(selectedCommunityId); }, [selectedCommunityId, loadInvoices]);
  useEffect(() => { if (selectedCommunityId) void loadPayments(selectedCommunityId); }, [selectedCommunityId, loadPayments]);

  // ── Actions ───────────────────────────────────────────────────

  const saveInvoice = async () => {
    if (!invoiceForm.communityId || !invoiceForm.unitId || !invoiceForm.title.trim() || !invoiceForm.amount || !invoiceForm.dueDate) {
      toast.error('Fill all required fields'); return;
    }
    const amount = parseFloat(invoiceForm.amount);
    if (Number.isNaN(amount) || amount <= 0) { toast.error('Invalid amount'); return; }
    setIsSavingInvoice(true);
    try {
      await billingService.createInvoice({
        communityId: invoiceForm.communityId, unitId: invoiceForm.unitId,
        residentId:  invoiceForm.residentId  || undefined,
        title: invoiceForm.title.trim(), amount, currency: invoiceForm.currency,
        dueDate: new Date(`${invoiceForm.dueDate}T00:00:00`).toISOString(),
        category: invoiceForm.category,
        notes: invoiceForm.notes.trim() || undefined,
      } as CreateInvoicePayload);
      toast.success('Invoice created');
      setInvoiceDrawerOpen(false); setInvoiceForm(INIT_INVOICE);
      await Promise.all([loadInvoices(selectedCommunityId), loadStats(selectedCommunityId)]);
    } catch (e) { toast.error('Failed to create invoice', { description: errorMessage(e) }); }
    finally { setIsSavingInvoice(false); }
  };

  const savePayment = async () => {
    if (!paymentForm.invoiceId || !paymentForm.amount || !paymentForm.paidAt) {
      toast.error('Fill all required fields'); return;
    }
    const amount = parseFloat(paymentForm.amount);
    if (Number.isNaN(amount) || amount <= 0) { toast.error('Invalid amount'); return; }
    setIsSavingPayment(true);
    try {
      await billingService.recordPayment({
        invoiceId: paymentForm.invoiceId, amount, method: paymentForm.method,
        referenceNumber: paymentForm.referenceNumber.trim() || undefined,
        notes: paymentForm.notes.trim() || undefined,
        paidAt: new Date(paymentForm.paidAt).toISOString(),
      } as RecordPaymentPayload);
      toast.success('Payment recorded');
      setPaymentDrawerOpen(false); setPaymentForm(INIT_PAYMENT);
      await Promise.all([loadPayments(selectedCommunityId), loadInvoices(selectedCommunityId), loadStats(selectedCommunityId)]);
    } catch (e) { toast.error('Failed to record payment', { description: errorMessage(e) }); }
    finally { setIsSavingPayment(false); }
  };

  const voidInvoice = async (invoice: BillingInvoice) => {
    if (!window.confirm(`Void invoice "${invoice.title}"?`)) return;
    try {
      await billingService.voidInvoice(invoice.id);
      toast.success('Invoice voided');
      await Promise.all([loadInvoices(selectedCommunityId), loadStats(selectedCommunityId)]);
    } catch (e) { toast.error('Failed to void', { description: errorMessage(e) }); }
  };

  const openRecordPayment = (invoice: BillingInvoice) => {
    setPaymentForm({ ...INIT_PAYMENT, invoiceId: invoice.id, amount: String((invoice as any).amountDue ?? invoice.amount) });
    setPaymentDrawerOpen(true);
  };

  // ── Derived ───────────────────────────────────────────────────

  const invActiveFilters = useMemo(() => [
    invFilters.status !== 'all', invFilters.category !== 'all', invFilters.unitId !== 'all',
    invFilters.from, invFilters.to, invFilters.search,
  ].filter(Boolean).length, [invFilters]);

  const payActiveFilters = useMemo(() => [
    payFilters.method !== 'all', payFilters.from, payFilters.to, payFilters.search,
  ].filter(Boolean).length, [payFilters]);

  const invTotalPages = Math.max(1, Math.ceil(invoiceTotal / PAGE_SIZE));
  const payTotalPages = Math.max(1, Math.ceil(paymentTotal / PAGE_SIZE));

  const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000   ? `${(n / 1_000).toFixed(1)}K`
    : n.toLocaleString();

  // ── Columns ───────────────────────────────────────────────────

  const invoiceColumns: DataTableColumn<BillingInvoice>[] = [
    { key: 'id', header: 'Invoice', render: (r) => (
      <div>
        <p style={{ fontSize: '12.5px', fontWeight: 700, color: '#111827', margin: 0 }}>{r.title}</p>
        <p style={{ fontSize: '10.5px', color: '#9CA3AF', margin: '1px 0 0', fontFamily: "'DM Mono', monospace" }}>#{r.invoiceNumber ?? r.id.slice(0, 8).toUpperCase()}</p>
      </div>
    )},
    { key: 'unit',     header: 'Unit',     render: (r) => <span style={{ fontSize: '12px', color: '#374151' }}>{r.unit?.unitNumber ?? '—'}</span> },
    { key: 'resident', header: 'Resident', render: (r) => <span style={{ fontSize: '12px', color: '#374151' }}>{r.resident?.nameEN ?? '—'}</span> },
    { key: 'category', header: 'Category', render: (r) => <CatChip category={r.category} /> },
    { key: 'amount',   header: 'Amount',   render: (r) => <MonoAmount amount={r.amount} currency={r.currency} /> },
    { key: 'due',      header: 'Due Date', render: (r) => (
      <span style={{ fontSize: '11.5px', fontFamily: "'DM Mono', monospace", color: r.status === 'OVERDUE' ? '#DC2626' : '#6B7280', fontWeight: r.status === 'OVERDUE' ? 700 : 400 }}>
        {r.dueDate ? formatDateTime(r.dueDate) : '—'}
      </span>
    )},
    { key: 'status',  header: 'Status',  render: (r) => <StatusBadge value={r.status} /> },
    { key: 'actions', header: '', render: (r) => (
      <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
        <ActionBtn label="View" icon={<FileText    style={{ width: '10px', height: '10px' }} />} onClick={() => { setSelectedInvoice(r); setDetailOpen(true); }} />
        <ActionBtn label="Pay"  icon={<CheckCircle2 style={{ width: '10px', height: '10px' }} />} variant="success" onClick={() => openRecordPayment(r)} disabled={r.status === 'PAID' || r.status === 'VOID'} />
        <ActionBtn label="Void" icon={<XCircle     style={{ width: '10px', height: '10px' }} />} variant="danger"  onClick={() => void voidInvoice(r)}   disabled={r.status === 'VOID' || r.status === 'PAID'} />
      </div>
    )},
  ];

  const paymentColumns: DataTableColumn<BillingPayment>[] = [
    { key: 'ref',    header: 'Reference', render: (r) => (
      <div>
        <p style={{ fontSize: '12px', fontWeight: 700, color: '#111827', margin: 0, fontFamily: "'DM Mono', monospace" }}>{r.referenceNumber ?? r.id.slice(0, 10).toUpperCase()}</p>
        <p style={{ fontSize: '10.5px', color: '#9CA3AF', margin: '1px 0 0' }}>{r.invoice?.title ?? '—'}</p>
      </div>
    )},
    { key: 'unit',   header: 'Unit',       render: (r) => <span style={{ fontSize: '12px', color: '#374151' }}>{r.invoice?.unit?.unitNumber ?? '—'}</span> },
    { key: 'amount', header: 'Amount',     render: (r) => <MonoAmount amount={r.amount} currency={r.currency ?? 'EGP'} /> },
    { key: 'method', header: 'Method',     render: (r) => <MethodChip method={r.method} /> },
    { key: 'paidAt', header: 'Paid At',    render: (r) => <span style={{ fontSize: '11.5px', color: '#6B7280', fontFamily: "'DM Mono', monospace" }}>{r.paidAt ? formatDateTime(r.paidAt) : '—'}</span> },
    { key: 'by',     header: 'Recorded By', render: (r) => <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{r.recordedBy?.nameEN ?? '—'}</span> },
    { key: 'status', header: 'Status',     render: (r) => <StatusBadge value={r.status ?? 'COMPLETED'} /> },
  ];

  // ─────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif" }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 900, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>Billing & Payments</h1>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '4px 0 0' }}>Manage invoices, track payments, and monitor collection.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <select value={selectedCommunityId || ''} onChange={(e) => setSelectedCommunityId(e.target.value)} style={{ ...selectStyle, width: '220px' }}>
            <option value=''>Select community</option>
            {communities.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <button type="button" onClick={() => void bootstrap()} disabled={isBootstrapping}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '7px', border: '1px solid #E5E7EB', background: '#FFF', color: '#6B7280', cursor: isBootstrapping ? 'not-allowed' : 'pointer' }}>
            <RefreshCw style={{ width: '13px', height: '13px', animation: isBootstrapping ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          {/* Single context-aware action button — switches with the active tab */}
          {activeTab === 'invoices' ? (
            <button type="button"
              onClick={() => { setInvoiceForm({ ...INIT_INVOICE, communityId: selectedCommunityId }); setInvoiceDrawerOpen(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', height: '36px', borderRadius: '8px', background: '#111827', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
              <Plus style={{ width: '13px', height: '13px' }} /> New Invoice
            </button>
          ) : (
            <button type="button"
              onClick={() => { setPaymentForm(INIT_PAYMENT); setPaymentDrawerOpen(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', height: '36px', borderRadius: '8px', background: '#2563EB', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: '0 2px 6px rgba(37,99,235,0.3)' }}>
              <CreditCard style={{ width: '13px', height: '13px' }} /> Record Payment
            </button>
          )}
        </div>
      </div>

      {/* ── Stats — StatCard component ─────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', marginBottom: '20px' }}>
        <StatCard icon="revenue"            title="Total Invoiced" value={`EGP ${fmt(stats.totalInvoiced)}`}   subtitle="Gross raised" />
        <StatCard icon="revenue"            title="Collected"      value={`EGP ${fmt(stats.totalCollected)}`}  subtitle="Payments received" />
        <StatCard icon="complaints-open"    title="Overdue"        value={`EGP ${fmt(stats.totalOverdue)}`}    subtitle="Past due date" />
        <StatCard icon="complaints-total"   title="Pending"        value={String(stats.pendingCount)}           subtitle="Awaiting payment" />
        <StatCard icon="complaints-closed"  title="Paid"           value={String(stats.paidCount)}              subtitle="Invoices settled" />
        <StatCard icon="tickets"            title="Total"          value={String(stats.totalCount)}             subtitle="All invoices" />
      </div>

      {/* ── Tabs ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '2px', padding: '4px', borderRadius: '10px', background: '#F3F4F6', marginBottom: '16px' }}>
        <TabBtn label="Invoices" icon={<Receipt    style={{ width: '12px', height: '12px' }} />} active={activeTab === 'invoices'} onClick={() => setActiveTab('invoices')} />
        <TabBtn label="Payments" icon={<CreditCard style={{ width: '12px', height: '12px' }} />} active={activeTab === 'payments'} onClick={() => setActiveTab('payments')} />
      </div>

      {/* ══ Invoices ══════════════════════════════════════════ */}
      {activeTab === 'invoices' && (
        <>
          <FilterBar searchValue={invFilters.search} onSearchChange={(v) => setInvFilters((p) => ({ ...p, search: v, page: 1 }))} filtersOpen={invFiltersOpen} onToggleFilters={() => setInvFiltersOpen((p) => !p)} activeFilters={invActiveFilters} placeholder="Search invoices…">
            <select value={invFilters.status} onChange={(e) => setInvFilters((p) => ({ ...p, status: e.target.value, page: 1 }))} style={{ ...selectStyle, width: '140px' }}>
              <option value="all">All Statuses</option>
              {(['PENDING','PAID','OVERDUE','PARTIAL','VOID'] as InvoiceStatus[]).map((s) => <option key={s} value={s}>{humanizeEnum(s)}</option>)}
            </select>
            <select value={invFilters.category} onChange={(e) => setInvFilters((p) => ({ ...p, category: e.target.value, page: 1 }))} style={{ ...selectStyle, width: '140px' }}>
              <option value="all">All Categories</option>
              {INVOICE_CATEGORIES.map((c) => <option key={c} value={c}>{humanizeEnum(c)}</option>)}
            </select>
            <select value={invFilters.unitId} onChange={(e) => setInvFilters((p) => ({ ...p, unitId: e.target.value, page: 1 }))} style={{ ...selectStyle, width: '160px' }}>
              <option value="all">All Units</option>
              {unitOptions.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
            <DateRangePill from={invFilters.from} to={invFilters.to} onFrom={(v) => setInvFilters((p) => ({ ...p, from: v, page: 1 }))} onTo={(v) => setInvFilters((p) => ({ ...p, to: v, page: 1 }))} />
          </FilterBar>
          <DataTable columns={invoiceColumns} rows={invoices} rowKey={(r) => r.id} loading={isInvoicesLoading} emptyTitle="No invoices found" emptyDescription="Create an invoice or adjust your filters." />
          <Pagination page={invFilters.page} totalPages={invTotalPages} total={invoiceTotal} onPrev={() => setInvFilters((p) => ({ ...p, page: Math.max(1, p.page - 1) }))} onNext={() => setInvFilters((p) => ({ ...p, page: Math.min(invTotalPages, p.page + 1) }))} />
        </>
      )}

      {/* ══ Payments ══════════════════════════════════════════ */}
      {activeTab === 'payments' && (
        <>
          <FilterBar searchValue={payFilters.search} onSearchChange={(v) => setPayFilters((p) => ({ ...p, search: v, page: 1 }))} filtersOpen={payFiltersOpen} onToggleFilters={() => setPayFiltersOpen((p) => !p)} activeFilters={payActiveFilters} placeholder="Search payments…">
            <select value={payFilters.method} onChange={(e) => setPayFilters((p) => ({ ...p, method: e.target.value, page: 1 }))} style={{ ...selectStyle, width: '160px' }}>
              <option value="all">All Methods</option>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{humanizeEnum(m)}</option>)}
            </select>
            <DateRangePill from={payFilters.from} to={payFilters.to} onFrom={(v) => setPayFilters((p) => ({ ...p, from: v, page: 1 }))} onTo={(v) => setPayFilters((p) => ({ ...p, to: v, page: 1 }))} />
          </FilterBar>
          <DataTable columns={paymentColumns} rows={payments} rowKey={(r) => r.id} loading={isPaymentsLoading} emptyTitle="No payments found" emptyDescription="Record a payment or adjust your filters." />
          <Pagination page={payFilters.page} totalPages={payTotalPages} total={paymentTotal} onPrev={() => setPayFilters((p) => ({ ...p, page: Math.max(1, p.page - 1) }))} onNext={() => setPayFilters((p) => ({ ...p, page: Math.min(payTotalPages, p.page + 1) }))} />
        </>
      )}

      {/* ══ Invoice detail modal ══════════════════════════════ */}
      {detailOpen && selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => setDetailOpen(false)}
          onRecordPayment={openRecordPayment}
        />
      )}

      {/* ══ New Invoice drawer ════════════════════════════════ */}
      <DrawerForm
        open={invoiceDrawerOpen}
        onOpenChange={(o) => { setInvoiceDrawerOpen(o); if (!o) setInvoiceForm(INIT_INVOICE); }}
        title="New Invoice"
        description="Create a billing invoice for a unit or resident."
        footer={<DrawerFooter onCancel={() => setInvoiceDrawerOpen(false)} onSave={() => void saveInvoice()} saving={isSavingInvoice} saveLabel="Create Invoice" />}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <SectionLabel label="Assignment" />

          <Field label="Community" required>
            <select value={invoiceForm.communityId || ''} onChange={(e) => setInvoiceForm((p) => ({ ...p, communityId: e.target.value }))} style={selectStyle}>
              <option value=''>Select community…</option>
              {communities.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Unit" required>
            <select value={invoiceForm.unitId || ''} onChange={(e) => setInvoiceForm((p) => ({ ...p, unitId: e.target.value }))} style={selectStyle}>
              <option value=''>Select unit…</option>
              {unitOptions.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </Field>
          <Field label="Resident" span2 hint="Optional — leave blank for a unit-level invoice">
            <select value={invoiceForm.residentId || ''} onChange={(e) => setInvoiceForm((p) => ({ ...p, residentId: e.target.value }))} style={selectStyle}>
              <option value=''>None</option>
              {residentOptions.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </Field>

          <SectionLabel label="Invoice Details" />

          <Field label="Title" required span2>
            <input value={invoiceForm.title} onChange={(e) => setInvoiceForm((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Monthly maintenance fee" style={inputStyle} />
          </Field>
          <Field label="Amount" required>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#9CA3AF', fontFamily: "'DM Mono', monospace", pointerEvents: 'none', userSelect: 'none' }}>
                {invoiceForm.currency}
              </span>
              <input
                type="number" min="0" step="0.01"
                value={invoiceForm.amount}
                onChange={(e) => setInvoiceForm((p) => ({ ...p, amount: e.target.value }))}
                placeholder="0.00"
                style={{ ...inputStyle, paddingLeft: `${invoiceForm.currency.length * 8 + 18}px`, fontFamily: "'DM Mono', monospace" }}
              />
            </div>
          </Field>
          <Field label="Currency">
            <select value={invoiceForm.currency} onChange={(e) => setInvoiceForm((p) => ({ ...p, currency: e.target.value }))} style={selectStyle}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Category">
            <select value={invoiceForm.category} onChange={(e) => setInvoiceForm((p) => ({ ...p, category: e.target.value }))} style={selectStyle}>
              {INVOICE_CATEGORIES.map((c) => <option key={c} value={c}>{humanizeEnum(c)}</option>)}
            </select>
          </Field>
          <Field label="Due Date" required>
            <input type="date" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm((p) => ({ ...p, dueDate: e.target.value }))} style={inputStyle} />
          </Field>
          <Field label="Notes" span2>
            <textarea value={invoiceForm.notes} onChange={(e) => setInvoiceForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional internal notes…" style={textareaStyle} />
          </Field>
        </div>
      </DrawerForm>

      {/* ══ Record Payment drawer ═════════════════════════════ */}
      <DrawerForm
        open={paymentDrawerOpen}
        onOpenChange={(o) => { setPaymentDrawerOpen(o); if (!o) setPaymentForm(INIT_PAYMENT); }}
        title="Record Payment"
        description="Log a payment against an existing invoice."
        footer={<DrawerFooter onCancel={() => setPaymentDrawerOpen(false)} onSave={() => void savePayment()} saving={isSavingPayment} saveLabel="Record Payment" />}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <SectionLabel label="Invoice" />

          <Field label="Invoice" required span2>
            <select value={paymentForm.invoiceId || ''} onChange={(e) => setPaymentForm((p) => ({ ...p, invoiceId: e.target.value }))} style={selectStyle}>
              <option value=''>Select invoice…</option>
              {invoices
                .filter((i) => i.status !== 'PAID' && i.status !== 'VOID')
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.title} — {i.currency} {i.amount.toLocaleString()}
                  </option>
                ))}
            </select>
          </Field>

          <SectionLabel label="Payment Details" />

          <Field label="Amount" required>
            <input type="number" min="0" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0.00" style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }} />
          </Field>
          <Field label="Method">
            <select value={paymentForm.method} onChange={(e) => setPaymentForm((p) => ({ ...p, method: e.target.value as PaymentMethod }))} style={selectStyle}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{humanizeEnum(m)}</option>)}
            </select>
          </Field>
          <Field label="Date & Time Paid" required span2>
            <input type="datetime-local" value={paymentForm.paidAt} onChange={(e) => setPaymentForm((p) => ({ ...p, paidAt: e.target.value }))} style={inputStyle} />
          </Field>
          <Field label="Reference Number" span2 hint="Transaction ID, cheque number, or reference">
            <input value={paymentForm.referenceNumber} onChange={(e) => setPaymentForm((p) => ({ ...p, referenceNumber: e.target.value }))} placeholder="TXN-12345" style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }} />
          </Field>
          <Field label="Notes" span2>
            <textarea value={paymentForm.notes} onChange={(e) => setPaymentForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional notes…" style={textareaStyle} />
          </Field>
        </div>
      </DrawerForm>
    </div>
  );
}