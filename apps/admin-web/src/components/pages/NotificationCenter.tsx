import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus, RefreshCw, Search, Eye, RotateCcw, X, Check,
  Bell, Layers, Wifi, Users, ChevronDown, SlidersHorizontal, Edit2, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { StatCard } from '../StatCard';
import { StatusBadge } from '../StatusBadge';
import notificationsService, {
  type NotificationAudience,
  type NotificationChannel,
  type NotificationListItem,
  type NotificationStatus,
  type NotificationTemplate,
  type NotificationType,
  type NotificationDetail,
  type SendNotificationPayload,
  type CreateNotificationTemplatePayload,
} from '../../lib/notificationsService';
import { errorMessage, formatDateTime, humanizeEnum } from '../../lib/live-data';
import apiClient from '../../lib/api-client';

// ─── Constants ────────────────────────────────────────────────

const CHANNELS: NotificationChannel[] = ['IN_APP', 'PUSH', 'SMS', 'EMAIL', 'WHATSAPP'];
const TYPES: NotificationType[] = [
  'ANNOUNCEMENT', 'PAYMENT_REMINDER', 'MAINTENANCE_ALERT',
  'EVENT_NOTIFICATION', 'EMERGENCY_ALERT',
];
const AUDIENCES: NotificationAudience[] = [
  'ALL', 'SPECIFIC_RESIDENCES', 'SPECIFIC_BLOCKS', 'SPECIFIC_UNITS',
];

// ─── Types ────────────────────────────────────────────────────

type SendForm = {
  type: NotificationType;
  titleEn: string;
  titleAr: string;
  messageEn: string;
  messageAr: string;
  channels: NotificationChannel[];
  targetAudience: NotificationAudience;
  communityIds: string[];
  phaseIds: string[];
  clusterIds: string[];
  unitIds: string[];
};

const DEFAULT_FORM: SendForm = {
  type: 'ANNOUNCEMENT', titleEn: '', titleAr: '', messageEn: '', messageAr: '',
  channels: ['IN_APP', 'PUSH'], targetAudience: 'ALL',
  communityIds: [], phaseIds: [], clusterIds: [], unitIds: [],
};

type TemplateForm = {
  name: string;
  type: NotificationType;
  titleEn: string;
  titleAr: string;
  messageEn: string;
  messageAr: string;
  channels: NotificationChannel[];
  isActive: boolean;
};

const DEFAULT_TEMPLATE_FORM: TemplateForm = {
  name: '', type: 'ANNOUNCEMENT', titleEn: '', titleAr: '',
  messageEn: '', messageAr: '', channels: ['IN_APP', 'PUSH'], isActive: true,
};

function splitCsv(v: string): string[] {
  return v.split(',').map((p) => p.trim()).filter(Boolean);
}

// ─── Design tokens ────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: '7px',
  border: '1px solid #E5E7EB', fontSize: '13px', color: '#111827',
  background: '#FFF', outline: 'none', fontFamily: "'Work Sans', sans-serif",
  boxSizing: 'border-box', height: '36px',
};
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };
const textareaStyle: React.CSSProperties = {
  ...inputStyle, height: 'auto', resize: 'vertical' as const,
};

// ─── Primitives ───────────────────────────────────────────────

function Field({ label, required, children, span2 }: {
  label: string; required?: boolean; children: React.ReactNode; span2?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: span2 ? 'span 2' : undefined }}>
      <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Work Sans', sans-serif" }}>
        {label}{required && <span style={{ color: '#DC2626', marginLeft: '3px' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid #F3F4F6' }}>
      <span style={{ color: '#9CA3AF' }}>{icon}</span>
      <span style={{ fontSize: '11px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Work Sans', sans-serif" }}>{label}</span>
    </div>
  );
}

// ─── Channel pill toggle ──────────────────────────────────────

function ChannelToggle({ channel, checked, onChange }: { channel: NotificationChannel; checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      style={{
        padding: '5px 10px', borderRadius: '6px', fontSize: '11.5px', fontWeight: checked ? 700 : 500,
        fontFamily: "'Work Sans', sans-serif", cursor: 'pointer', transition: 'all 120ms ease',
        border: `1px solid ${checked ? '#2563EB40' : '#E5E7EB'}`,
        background: checked ? '#EFF6FF' : '#FAFAFA',
        color: checked ? '#2563EB' : '#6B7280',
      }}
    >
      {humanizeEnum(channel)}
    </button>
  );
}

// ─── Searchable checkbox list ─────────────────────────────────

function SearchableCheckboxList({ items, selected, onToggle, searchValue, onSearchChange, labelFn }: {
  items: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  searchValue: string;
  onSearchChange: (v: string) => void;
  labelFn?: (item: { id: string; label: string }) => string;
}) {
  const getLabel = labelFn || ((item: { id: string; label: string }) => item.label);
  const needle = searchValue.trim().toLowerCase();
  const filtered = needle ? items.filter((i) => getLabel(i).toLowerCase().includes(needle)) : items;
  const sorted = [...filtered].sort((a, b) => {
    const aChecked = selected.includes(a.id) ? 0 : 1;
    const bChecked = selected.includes(b.id) ? 0 : 1;
    return aChecked - bChecked;
  });

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: '6px' }}>
        <Search style={{ width: '12px', height: '12px', color: '#9CA3AF', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
        <input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search..."
          style={{ ...inputStyle, paddingLeft: '28px' }}
        />
      </div>
      <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #E5E7EB', borderRadius: '7px', background: '#FAFAFA' }}>
        {sorted.length === 0 ? (
          <p style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#9CA3AF', margin: 0 }}>No results</p>
        ) : sorted.map((item) => {
          const isChecked = selected.includes(item.id);
          return (
            <label
              key={item.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px',
                cursor: 'pointer', fontSize: '12.5px', color: '#111827',
                fontFamily: "'Work Sans', sans-serif",
                borderBottom: '1px solid #F3F4F6',
                background: isChecked ? '#EFF6FF' : 'transparent',
              }}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggle(item.id)}
                style={{ accentColor: '#2563EB' }}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getLabel(item)}</span>
            </label>
          );
        })}
      </div>
      {selected.length > 0 && (
        <p style={{ fontSize: '11px', color: '#6B7280', margin: '4px 0 0', fontFamily: "'Work Sans', sans-serif" }}>
          {selected.length} selected
        </p>
      )}
    </div>
  );
}

// ─── Notification row ─────────────────────────────────────────

function NotifRow({ row, onResend, resending, onView }: {
  row: NotificationListItem;
  onResend: () => void;
  resending: boolean;
  onView: () => void;
}) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto auto auto auto auto',
      alignItems: 'center', gap: '12px', padding: '11px 14px',
      borderBottom: '1px solid #F9FAFB', transition: 'background 100ms',
    }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#FAFAFA'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
    >
      {/* Title + type */}
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.title}</p>
        <p style={{ fontSize: '11.5px', color: '#9CA3AF', margin: '2px 0 0', fontFamily: "'Work Sans', sans-serif" }}>{humanizeEnum(row.type)}</p>
      </div>
      {/* Audience */}
      <span style={{ fontSize: '12px', color: '#6B7280', whiteSpace: 'nowrap' }}>{humanizeEnum(row.targetAudience)}</span>
      {/* Channels */}
      <span style={{ fontSize: '12px', color: '#6B7280', whiteSpace: 'nowrap' }}>
        {row.channels.map((c) => humanizeEnum(c)).join(', ')}
      </span>
      {/* Status */}
      <StatusBadge value={row.status} />
      {/* Sent at */}
      <span style={{ fontSize: '11.5px', color: '#9CA3AF', fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap' }}>
        {formatDateTime(row.sentAt ?? row.createdAt)}
      </span>
      {/* Actions */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <button type="button" onClick={onView}
          style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #E5E7EB', background: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B7280', transition: 'all 120ms ease' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#111827'; e.currentTarget.style.color = '#FFF'; e.currentTarget.style.borderColor = '#111827'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#FFF'; e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.borderColor = '#E5E7EB'; }}>
          <Eye style={{ width: '11px', height: '11px' }} />
        </button>
        <button type="button" onClick={onResend} disabled={resending}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px', height: '28px', borderRadius: '6px', border: '1px solid #E5E7EB', background: '#FFF', cursor: resending ? 'not-allowed' : 'pointer', fontSize: '11.5px', fontWeight: 600, color: '#6B7280', fontFamily: "'Work Sans', sans-serif", opacity: resending ? 0.6 : 1, transition: 'all 120ms ease' }}
          onMouseEnter={(e) => { if (!resending) { e.currentTarget.style.background = '#F3F4F6'; } }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#FFF'; }}>
          <RotateCcw style={{ width: '10px', height: '10px', animation: resending ? 'spin 1s linear infinite' : 'none' }} />
          {resending ? 'Resending…' : 'Resend'}
        </button>
      </div>
    </div>
  );
}

// ─── Template row ─────────────────────────────────────────────

function TemplateRow({ row, onEdit, onToggle }: {
  row: NotificationTemplate;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto auto auto auto',
      alignItems: 'center', gap: '12px', padding: '11px 14px',
      borderBottom: '1px solid #F9FAFB',
    }}>
      <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0 }}>{row.name}</p>
      <span style={{ fontSize: '12px', color: '#6B7280' }}>{humanizeEnum(row.type)}</span>
      <span style={{ fontSize: '12px', color: '#6B7280' }}>{row.channels.map((c) => humanizeEnum(c)).join(', ')}</span>
      <StatusBadge value={row.isActive ? 'ACTIVE' : 'INACTIVE'} />
      <div style={{ display: 'flex', gap: '4px' }}>
        <button type="button" onClick={onEdit}
          style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #E5E7EB', background: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B7280', transition: 'all 120ms ease' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#111827'; e.currentTarget.style.color = '#FFF'; e.currentTarget.style.borderColor = '#111827'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#FFF'; e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.borderColor = '#E5E7EB'; }}>
          <Edit2 style={{ width: '11px', height: '11px' }} />
        </button>
        <button type="button" onClick={onToggle}
          style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #E5E7EB', background: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: row.isActive ? '#16A34A' : '#9CA3AF', transition: 'all 120ms ease' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#F3F4F6'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#FFF'; }}>
          {row.isActive ? <ToggleRight style={{ width: '13px', height: '13px' }} /> : <ToggleLeft style={{ width: '13px', height: '13px' }} />}
        </button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────

export function NotificationCenter() {
  const [rows, setRows] = useState<NotificationListItem[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [stats, setStats] = useState({ totalSent: 0, deliveredToday: 0, failedToday: 0, activeDeviceTokens: 0 });
  const [loading, setLoading] = useState(true);
  const [sendOpen, setSendOpen] = useState(false);
  const [form, setForm] = useState<SendForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<{
    search: string; type: NotificationType | 'all';
    status: NotificationStatus | 'all'; channel: NotificationChannel | 'all';
  }>({ search: '', type: 'all', status: 'all', channel: 'all' });

  // View notification detail state
  const [viewNotif, setViewNotif] = useState<NotificationListItem | null>(null);
  const [detail, setDetail] = useState<NotificationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Communities & units for audience dropdowns
  const [communities, setCommunities] = useState<{ id: string; name: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; unitNumber: string; block: string | null }[]>([]);
  const [communitySearch, setCommunitySearch] = useState('');
  const [unitSearch, setUnitSearch] = useState('');

  // Template dialog state
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState<TemplateForm>(DEFAULT_TEMPLATE_FORM);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Load communities and units on mount
  useEffect(() => {
    const load = async () => {
      try {
        const [commRes, unitRes] = await Promise.all([
          apiClient.get('/communities', { params: { page: 1, limit: 500 } }),
          apiClient.get('/units', { params: { page: 1, limit: 500 } }),
        ]);
        const commData = Array.isArray(commRes.data) ? commRes.data : (commRes.data?.data ?? []);
        const unitData = Array.isArray(unitRes.data) ? unitRes.data : (unitRes.data?.data ?? []);
        setCommunities(commData);
        setUnits(unitData);
      } catch {
        // silently ignore - dropdowns will just be empty
      }
    };
    void load();
  }, []);

  const viewNotification = async (row: NotificationListItem) => {
    setViewNotif(row);
    setDetail(null);
    setLoadingDetail(true);
    try {
      const result = await notificationsService.getDetail(row.id);
      setDetail(result);
    } catch (e) {
      toast.error('Failed to load notification details', { description: errorMessage(e) });
    } finally {
      setLoadingDetail(false);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, listRes, templateRes] = await Promise.all([
        notificationsService.getStats(),
        notificationsService.list({ page: 1, type: filters.type !== 'all' ? filters.type : undefined, status: filters.status !== 'all' ? filters.status : undefined, channel: filters.channel !== 'all' ? filters.channel : undefined }),
        notificationsService.listTemplates(),
      ]);
      setStats({ totalSent: statsRes.totalSent, deliveredToday: statsRes.deliveredToday, failedToday: statsRes.failedToday, activeDeviceTokens: statsRes.activeDeviceTokens });
      setRows(listRes.data);
      setTemplates(templateRes);
    } catch (e) { toast.error('Failed to load notifications', { description: errorMessage(e) }); }
    finally { setLoading(false); }
  }, [filters.channel, filters.status, filters.type]);

  useEffect(() => { void loadData(); }, [loadData]);

  const filteredRows = useMemo(() => {
    const needle = filters.search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => [r.title, r.type, r.status, r.targetAudience].join(' ').toLowerCase().includes(needle));
  }, [filters.search, rows]);

  const submitSend = async () => {
    if (!form.titleEn.trim() || !form.messageEn.trim()) { toast.error('Title (EN) and English message are required'); return; }
    const payload: SendNotificationPayload = {
      type: form.type, title: form.titleEn.trim(), titleAr: form.titleAr.trim() || undefined,
      messageEn: form.messageEn.trim(),
      messageAr: form.messageAr.trim() || undefined, channels: form.channels, targetAudience: form.targetAudience,
      audienceMeta: form.targetAudience === 'ALL' ? undefined
        : form.targetAudience === 'SPECIFIC_RESIDENCES' ? { communityIds: form.communityIds }
          : form.targetAudience === 'SPECIFIC_BLOCKS' ? { phaseIds: form.phaseIds, clusterIds: form.clusterIds }
            : { unitIds: form.unitIds },
    };
    setSaving(true);
    try {
      await notificationsService.send(payload);
      toast.success('Notification sent');
      setForm(DEFAULT_FORM); setSendOpen(false); await loadData();
    } catch (e) { toast.error('Failed to send', { description: errorMessage(e) }); }
    finally { setSaving(false); }
  };

  const resendFailed = async (id: string) => {
    setResendingId(id);
    try {
      const r = await notificationsService.resendFailed(id);
      toast.success('Resend completed', { description: `Attempted ${r.attempted}, sent ${r.sent}, failed ${r.failed}` });
      await loadData();
    } catch (e) { toast.error('Failed to resend', { description: errorMessage(e) }); }
    finally { setResendingId(null); }
  };

  // Template handlers
  const openNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm(DEFAULT_TEMPLATE_FORM);
    setTemplateDialogOpen(true);
  };

  const openEditTemplate = (t: NotificationTemplate) => {
    setEditingTemplate(t);
    setTemplateForm({
      name: t.name,
      type: t.type,
      titleEn: t.titleEn,
      titleAr: t.titleAr ?? '',
      messageEn: t.messageEn,
      messageAr: t.messageAr ?? '',
      channels: t.channels,
      isActive: t.isActive,
    });
    setTemplateDialogOpen(true);
  };

  const submitTemplate = async () => {
    if (!templateForm.name.trim() || !templateForm.titleEn.trim() || !templateForm.messageEn.trim()) {
      toast.error('Name, Title (EN), and Message (EN) are required');
      return;
    }
    const payload: CreateNotificationTemplatePayload = {
      name: templateForm.name.trim(),
      type: templateForm.type,
      titleEn: templateForm.titleEn.trim(),
      titleAr: templateForm.titleAr.trim() || undefined,
      messageEn: templateForm.messageEn.trim(),
      messageAr: templateForm.messageAr.trim() || undefined,
      channels: templateForm.channels,
      isActive: templateForm.isActive,
    };
    setSavingTemplate(true);
    try {
      if (editingTemplate) {
        await notificationsService.updateTemplate(editingTemplate.id, payload);
        toast.success('Template updated');
      } else {
        await notificationsService.createTemplate(payload);
        toast.success('Template created');
      }
      setTemplateDialogOpen(false);
      setEditingTemplate(null);
      setTemplateForm(DEFAULT_TEMPLATE_FORM);
      await loadData();
    } catch (e) {
      toast.error('Failed to save template', { description: errorMessage(e) });
    } finally {
      setSavingTemplate(false);
    }
  };

  const toggleTemplate = async (t: NotificationTemplate) => {
    try {
      await notificationsService.toggleTemplate(t.id);
      toast.success(`Template ${t.isActive ? 'deactivated' : 'activated'}`);
      await loadData();
    } catch (e) {
      toast.error('Failed to toggle template', { description: errorMessage(e) });
    }
  };

  const activeFilters = [filters.type !== 'all', filters.status !== 'all', filters.channel !== 'all'].filter(Boolean).length;

  // Prepare items for searchable checkbox lists
  const communityItems = useMemo(() => communities.map((c) => ({ id: c.id, label: c.name })), [communities]);
  const unitItems = useMemo(() => units.map((u) => ({ id: u.id, label: `${u.unitNumber}${u.block ? ` \u00b7 ${u.block}` : ''}` })), [units]);

  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* ── Header ─── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 900, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>Notifications</h1>
          <p style={{ marginTop: '4px', fontSize: '13px', color: '#6B7280' }}>Manage delivery channels, templates, and dispatch history.</p>
        </div>
        <button type="button" onClick={() => setSendOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: '#111827', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
          <Plus style={{ width: '13px', height: '13px' }} /> Send Notification
        </button>
      </div>

      {/* ── Stats ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
        <StatCard title="Total Sent" value={String(stats.totalSent)} icon="tickets" />
        <StatCard title="Delivered Today" value={String(stats.deliveredToday)} icon="active-users" />
        <StatCard title="Failed Today" value={String(stats.failedToday)} icon="complaints-open" />
        <StatCard title="Active Tokens" value={String(stats.activeDeviceTokens)} icon="devices" />
      </div>

      {/* ── Filter bar ─── */}
      <div style={{ borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FFF', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: filtersOpen ? '1px solid #F3F4F6' : 'none' }}>
          <Search style={{ width: '13px', height: '13px', color: '#9CA3AF', flexShrink: 0 }} />
          <input placeholder="Search notifications…" value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: '#111827', fontFamily: "'Work Sans', sans-serif" }} />
          <button type="button" onClick={() => void loadData()}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #E5E7EB', background: '#FAFAFA', color: '#6B7280', cursor: 'pointer', fontSize: '11.5px', fontFamily: "'Work Sans', sans-serif" }}>
            <RefreshCw style={{ width: '10px', height: '10px' }} />
          </button>
          <button type="button" onClick={() => setFiltersOpen((p) => !p)}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: `1px solid ${activeFilters > 0 ? '#2563EB40' : '#E5E7EB'}`, background: activeFilters > 0 ? '#EFF6FF' : '#FAFAFA', color: activeFilters > 0 ? '#2563EB' : '#6B7280', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif" }}>
            <SlidersHorizontal style={{ width: '11px', height: '11px' }} />
            Filters
            {activeFilters > 0 && <span style={{ width: '15px', height: '15px', borderRadius: '50%', background: '#2563EB', color: '#FFF', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{activeFilters}</span>}
            <ChevronDown style={{ width: '10px', height: '10px', transform: filtersOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
          </button>
        </div>
        {filtersOpen && (
          <div style={{ padding: '10px 14px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filters.type} onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value as NotificationType | 'all' }))} style={{ ...selectStyle, width: '160px' }}>
              <option value="all">All Types</option>
              {TYPES.map((t) => <option key={t} value={t}>{humanizeEnum(t)}</option>)}
            </select>
            <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value as NotificationStatus | 'all' }))} style={{ ...selectStyle, width: '140px' }}>
              <option value="all">All Statuses</option>
              {(['SCHEDULED', 'PENDING', 'SENT', 'FAILED', 'READ'] as NotificationStatus[]).map((s) => <option key={s} value={s}>{humanizeEnum(s)}</option>)}
            </select>
            <select value={filters.channel} onChange={(e) => setFilters((p) => ({ ...p, channel: e.target.value as NotificationChannel | 'all' }))} style={{ ...selectStyle, width: '140px' }}>
              <option value="all">All Channels</option>
              {CHANNELS.map((c) => <option key={c} value={c}>{humanizeEnum(c)}</option>)}
            </select>
            <button type="button" onClick={() => void loadData()}
              style={{ padding: '6px 14px', borderRadius: '7px', background: '#111827', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
              Apply
            </button>
          </div>
        )}
      </div>

      {/* ── Notification list ─── */}
      <div style={{ borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FFF', overflow: 'hidden', marginBottom: '16px' }}>
        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto auto', gap: '12px', padding: '9px 14px', borderBottom: '1px solid #F3F4F6', background: '#FAFAFA' }}>
          {['Notification', 'Audience', 'Channels', 'Status', 'Sent', 'Actions'].map((h) => (
            <span key={h} style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Work Sans', sans-serif" }}>{h}</span>
          ))}
        </div>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ height: '54px', margin: '6px 10px', borderRadius: '7px', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%' }} />
          ))
        ) : filteredRows.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <Bell style={{ width: '28px', height: '28px', color: '#E5E7EB', margin: '0 auto 8px' }} />
            <p style={{ fontSize: '13px', color: '#9CA3AF', fontFamily: "'Work Sans', sans-serif" }}>No notifications found</p>
          </div>
        ) : filteredRows.map((row) => (
          <NotifRow key={row.id} row={row} onResend={() => void resendFailed(row.id)} resending={resendingId === row.id} onView={() => void viewNotification(row)} />
        ))}
      </div>

      {/* ── Templates ─── */}
      <div style={{ borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FFF', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Layers style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>Templates</span>
          <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: '#F3F4F6', color: '#9CA3AF', fontFamily: "'DM Mono', monospace" }}>{templates.length}</span>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={openNewTemplate}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '6px', background: '#111827', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '11.5px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
            <Plus style={{ width: '11px', height: '11px' }} /> New Template
          </button>
        </div>
        {/* Template headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: '12px', padding: '9px 14px', borderBottom: '1px solid #F3F4F6', background: '#FAFAFA' }}>
          {['Name', 'Type', 'Channels', 'Status', 'Actions'].map((h) => (
            <span key={h} style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Work Sans', sans-serif" }}>{h}</span>
          ))}
        </div>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ height: '44px', margin: '6px 10px', borderRadius: '7px', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%' }} />
          ))
        ) : templates.length === 0 ? (
          <p style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#9CA3AF' }}>No templates yet</p>
        ) : templates.map((t) => <TemplateRow key={t.id} row={t} onEdit={() => openEditTemplate(t)} onToggle={() => void toggleTemplate(t)} />)}
      </div>

      {/* ══ Send dialog ══════════════════════════════════════ */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent style={{ maxWidth: '560px', padding: 0, borderRadius: '12px', overflow: 'hidden', border: '1px solid #EBEBEB', fontFamily: "'Work Sans', sans-serif", maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: '3px', background: 'linear-gradient(90deg, #2563EB, #0D9488)', flexShrink: 0 }} />
          <div style={{ padding: '18px 24px 10px', flexShrink: 0 }}>
            <DialogHeader>
              <DialogTitle style={{ fontSize: '15px', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.01em' }}>
                Send Notification
              </DialogTitle>
              <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '3px' }}>Compose and dispatch a notification to your residents.</p>
            </DialogHeader>
          </div>

          <div style={{ overflowY: 'auto', padding: '0 24px 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Content section */}
            <div>
              <SectionLabel icon={<Bell style={{ width: '12px', height: '12px' }} />} label="Content" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Type" required>
                  <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as NotificationType }))} style={selectStyle}>
                    {TYPES.map((t) => <option key={t} value={t}>{humanizeEnum(t)}</option>)}
                  </select>
                </Field>
                <Field label="Title (EN)" required>
                  <input value={form.titleEn} onChange={(e) => setForm((p) => ({ ...p, titleEn: e.target.value }))} placeholder="e.g. Scheduled maintenance" style={inputStyle} />
                </Field>
                <Field label="Title (AR)" span2>
                  <input value={form.titleAr} onChange={(e) => setForm((p) => ({ ...p, titleAr: e.target.value }))} placeholder="e.g. صيانة مجدولة" style={{ ...inputStyle, direction: 'rtl' }} />
                </Field>
                <Field label="Message (EN)" required span2>
                  <textarea value={form.messageEn} onChange={(e) => setForm((p) => ({ ...p, messageEn: e.target.value }))} rows={3} style={textareaStyle} />
                </Field>
                <Field label="Message (AR)" span2>
                  <textarea value={form.messageAr} onChange={(e) => setForm((p) => ({ ...p, messageAr: e.target.value }))} rows={3} style={{ ...textareaStyle, direction: 'rtl' }} />
                </Field>
              </div>
            </div>

            {/* Delivery section */}
            <div>
              <SectionLabel icon={<Wifi style={{ width: '12px', height: '12px' }} />} label="Delivery Channels" />
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {CHANNELS.map((ch) => (
                  <ChannelToggle key={ch} channel={ch} checked={form.channels.includes(ch)}
                    onChange={() => setForm((p) => ({ ...p, channels: p.channels.includes(ch) ? p.channels.filter((x) => x !== ch) : [...p.channels, ch] }))} />
                ))}
              </div>
            </div>

            {/* Audience section */}
            <div>
              <SectionLabel icon={<Users style={{ width: '12px', height: '12px' }} />} label="Audience" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Field label="Target">
                  <select value={form.targetAudience} onChange={(e) => setForm((p) => ({ ...p, targetAudience: e.target.value as NotificationAudience }))} style={selectStyle}>
                    {AUDIENCES.map((a) => <option key={a} value={a}>{humanizeEnum(a)}</option>)}
                  </select>
                </Field>
                {form.targetAudience === 'SPECIFIC_RESIDENCES' && (
                  <Field label="Communities">
                    <SearchableCheckboxList
                      items={communityItems}
                      selected={form.communityIds}
                      onToggle={(id) => setForm((p) => ({
                        ...p,
                        communityIds: p.communityIds.includes(id) ? p.communityIds.filter((x) => x !== id) : [...p.communityIds, id],
                      }))}
                      searchValue={communitySearch}
                      onSearchChange={setCommunitySearch}
                    />
                  </Field>
                )}
                {form.targetAudience === 'SPECIFIC_BLOCKS' && (
                  <>
                    <Field label="Phase IDs (comma-separated)">
                      <input value={form.phaseIds.join(', ')} onChange={(e) => setForm((p) => ({ ...p, phaseIds: splitCsv(e.target.value) }))} placeholder="id1, id2, id3" style={inputStyle} />
                    </Field>
                    <Field label="Cluster IDs (comma-separated)">
                      <input value={form.clusterIds.join(', ')} onChange={(e) => setForm((p) => ({ ...p, clusterIds: splitCsv(e.target.value) }))} placeholder="id1, id2, id3" style={inputStyle} />
                    </Field>
                  </>
                )}
                {form.targetAudience === 'SPECIFIC_UNITS' && (
                  <Field label="Units">
                    <SearchableCheckboxList
                      items={unitItems}
                      selected={form.unitIds}
                      onToggle={(id) => setForm((p) => ({
                        ...p,
                        unitIds: p.unitIds.includes(id) ? p.unitIds.filter((x) => x !== id) : [...p.unitIds, id],
                      }))}
                      searchValue={unitSearch}
                      onSearchChange={setUnitSearch}
                    />
                  </Field>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: '12px 24px 20px', borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0, background: '#FFF' }}>
            <button type="button" disabled={saving} onClick={() => setSendOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '7px', border: '1px solid #E5E7EB', background: '#FFF', color: '#6B7280', cursor: 'pointer', fontSize: '12.5px', fontWeight: 500, fontFamily: "'Work Sans', sans-serif" }}>
              <X style={{ width: '12px', height: '12px' }} /> Cancel
            </button>
            <button type="button" disabled={saving} onClick={() => void submitSend()}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 20px', borderRadius: '7px', background: saving ? '#9CA3AF' : '#111827', color: '#FFF', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: '0 1px 4px rgba(0,0,0,0.15)', transition: 'background 120ms ease' }}>
              <Check style={{ width: '13px', height: '13px' }} />
              {saving ? 'Sending…' : 'Send Notification'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ View notification detail dialog ══════════════════ */}
      <Dialog open={viewNotif !== null} onOpenChange={(open) => { if (!open) { setViewNotif(null); setDetail(null); } }}>
        <DialogContent style={{ maxWidth: '560px', padding: 0, borderRadius: '12px', overflow: 'hidden', border: '1px solid #EBEBEB', fontFamily: "'Work Sans', sans-serif", maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: '3px', background: 'linear-gradient(90deg, #2563EB, #0D9488)', flexShrink: 0 }} />
          <div style={{ padding: '18px 24px 10px', flexShrink: 0 }}>
            <DialogHeader>
              <DialogTitle style={{ fontSize: '15px', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.01em' }}>
                Notification Details
              </DialogTitle>
              <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '3px' }}>{viewNotif?.title}</p>
            </DialogHeader>
          </div>

          <div style={{ overflowY: 'auto', padding: '0 24px 20px' }}>
            {loadingDetail ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <RefreshCw style={{ width: '20px', height: '20px', color: '#9CA3AF', margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />
                <p style={{ fontSize: '13px', color: '#9CA3AF' }}>Loading details...</p>
              </div>
            ) : detail ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Basic info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Title</span>
                    <p style={{ fontSize: '13px', color: '#111827', margin: '2px 0 0', fontWeight: 600 }}>{detail.title}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type</span>
                    <p style={{ fontSize: '13px', color: '#111827', margin: '2px 0 0' }}>{humanizeEnum(detail.type)}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Channels</span>
                    <p style={{ fontSize: '13px', color: '#111827', margin: '2px 0 0' }}>{detail.channels.map((c) => humanizeEnum(c)).join(', ')}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Audience</span>
                    <p style={{ fontSize: '13px', color: '#111827', margin: '2px 0 0' }}>{humanizeEnum(detail.targetAudience)}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</span>
                    <div style={{ marginTop: '2px' }}><StatusBadge value={detail.status} /></div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sent At</span>
                    <p style={{ fontSize: '12px', color: '#111827', margin: '2px 0 0', fontFamily: "'DM Mono', monospace" }}>{detail.sentAt ? formatDateTime(detail.sentAt) : '—'}</p>
                  </div>
                </div>

                {/* Messages */}
                <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '12px' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Message (EN)</span>
                  <p style={{ fontSize: '13px', color: '#111827', margin: '4px 0 0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{detail.messageEn}</p>
                </div>
                {detail.messageAr && (
                  <div>
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Message (AR)</span>
                    <p style={{ fontSize: '13px', color: '#111827', margin: '4px 0 0', lineHeight: 1.5, whiteSpace: 'pre-wrap', direction: 'rtl' }}>{detail.messageAr}</p>
                  </div>
                )}

                {/* Delivery stats */}
                <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '12px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', display: 'block' }}>Delivery Stats</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    {[
                      { label: 'Sent', value: detail.sentCount, color: '#2563EB' },
                      { label: 'Delivered', value: detail.deliveredCount, color: '#16A34A' },
                      { label: 'Failed', value: detail.failedCount, color: '#DC2626' },
                      { label: 'Read', value: detail.readCount, color: '#7C3AED' },
                    ].map((s) => (
                      <div key={s.label} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #F3F4F6', background: '#FAFAFA', textAlign: 'center' }}>
                        <p style={{ fontSize: '16px', fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
                        <p style={{ fontSize: '10px', fontWeight: 600, color: '#9CA3AF', margin: '2px 0 0', textTransform: 'uppercase' }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery breakdown */}
                {detail.deliveryBreakdown && detail.deliveryBreakdown.length > 0 && (
                  <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '12px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', display: 'block' }}>Breakdown by Channel</span>
                    <div style={{ borderRadius: '8px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(5, 1fr)', gap: '0', background: '#FAFAFA', padding: '6px 10px', borderBottom: '1px solid #F3F4F6' }}>
                        {['Channel', 'Attempted', 'Delivered', 'Failed', 'Pending', 'Read'].map((h) => (
                          <span key={h} style={{ fontSize: '10px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: h === 'Channel' ? 'left' : 'center' }}>{h}</span>
                        ))}
                      </div>
                      {detail.deliveryBreakdown.map((b) => (
                        <div key={b.channel} style={{ display: 'grid', gridTemplateColumns: 'auto repeat(5, 1fr)', gap: '0', padding: '6px 10px', borderBottom: '1px solid #F9FAFB' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>{humanizeEnum(b.channel)}</span>
                          <span style={{ fontSize: '12px', color: '#6B7280', textAlign: 'center' }}>{b.attempted}</span>
                          <span style={{ fontSize: '12px', color: '#16A34A', textAlign: 'center' }}>{b.delivered}</span>
                          <span style={{ fontSize: '12px', color: '#DC2626', textAlign: 'center' }}>{b.failed}</span>
                          <span style={{ fontSize: '12px', color: '#D97706', textAlign: 'center' }}>{b.pending}</span>
                          <span style={{ fontSize: '12px', color: '#7C3AED', textAlign: 'center' }}>{b.read}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: '#9CA3AF' }}>No details available</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ Template dialog ══════════════════════════════════ */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent style={{ maxWidth: '560px', padding: 0, borderRadius: '12px', overflow: 'hidden', border: '1px solid #EBEBEB', fontFamily: "'Work Sans', sans-serif", maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: '3px', background: 'linear-gradient(90deg, #2563EB, #0D9488)', flexShrink: 0 }} />
          <div style={{ padding: '18px 24px 10px', flexShrink: 0 }}>
            <DialogHeader>
              <DialogTitle style={{ fontSize: '15px', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.01em' }}>
                {editingTemplate ? 'Edit Template' : 'New Template'}
              </DialogTitle>
              <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '3px' }}>
                {editingTemplate ? 'Update the notification template.' : 'Create a reusable notification template.'}
              </p>
            </DialogHeader>
          </div>

          <div style={{ overflowY: 'auto', padding: '0 24px 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Template content */}
            <div>
              <SectionLabel icon={<Layers style={{ width: '12px', height: '12px' }} />} label="Template Info" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Name" required span2>
                  <input value={templateForm.name} onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Monthly Maintenance Reminder" style={inputStyle} />
                </Field>
                <Field label="Type" required>
                  <select value={templateForm.type} onChange={(e) => setTemplateForm((p) => ({ ...p, type: e.target.value as NotificationType }))} style={selectStyle}>
                    {TYPES.map((t) => <option key={t} value={t}>{humanizeEnum(t)}</option>)}
                  </select>
                </Field>
                <Field label="Active">
                  <button type="button" onClick={() => setTemplateForm((p) => ({ ...p, isActive: !p.isActive }))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '7px',
                      border: `1px solid ${templateForm.isActive ? '#16A34A40' : '#E5E7EB'}`,
                      background: templateForm.isActive ? '#F0FDF4' : '#FAFAFA',
                      color: templateForm.isActive ? '#16A34A' : '#9CA3AF',
                      cursor: 'pointer', fontSize: '12.5px', fontWeight: 600, fontFamily: "'Work Sans', sans-serif",
                    }}>
                    {templateForm.isActive ? <ToggleRight style={{ width: '14px', height: '14px' }} /> : <ToggleLeft style={{ width: '14px', height: '14px' }} />}
                    {templateForm.isActive ? 'Active' : 'Inactive'}
                  </button>
                </Field>
                <Field label="Title (EN)" required>
                  <input value={templateForm.titleEn} onChange={(e) => setTemplateForm((p) => ({ ...p, titleEn: e.target.value }))} placeholder="English title" style={inputStyle} />
                </Field>
                <Field label="Title (AR)">
                  <input value={templateForm.titleAr} onChange={(e) => setTemplateForm((p) => ({ ...p, titleAr: e.target.value }))} placeholder="Arabic title" style={{ ...inputStyle, direction: 'rtl' }} />
                </Field>
                <Field label="Message (EN)" required span2>
                  <textarea value={templateForm.messageEn} onChange={(e) => setTemplateForm((p) => ({ ...p, messageEn: e.target.value }))} rows={3} style={textareaStyle} />
                </Field>
                <Field label="Message (AR)" span2>
                  <textarea value={templateForm.messageAr} onChange={(e) => setTemplateForm((p) => ({ ...p, messageAr: e.target.value }))} rows={3} style={{ ...textareaStyle, direction: 'rtl' }} />
                </Field>
              </div>
            </div>

            {/* Channels */}
            <div>
              <SectionLabel icon={<Wifi style={{ width: '12px', height: '12px' }} />} label="Channels" />
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {CHANNELS.map((ch) => (
                  <ChannelToggle key={ch} channel={ch} checked={templateForm.channels.includes(ch)}
                    onChange={() => setTemplateForm((p) => ({ ...p, channels: p.channels.includes(ch) ? p.channels.filter((x) => x !== ch) : [...p.channels, ch] }))} />
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: '12px 24px 20px', borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0, background: '#FFF' }}>
            <button type="button" disabled={savingTemplate} onClick={() => setTemplateDialogOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '7px', border: '1px solid #E5E7EB', background: '#FFF', color: '#6B7280', cursor: 'pointer', fontSize: '12.5px', fontWeight: 500, fontFamily: "'Work Sans', sans-serif" }}>
              <X style={{ width: '12px', height: '12px' }} /> Cancel
            </button>
            <button type="button" disabled={savingTemplate} onClick={() => void submitTemplate()}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 20px', borderRadius: '7px', background: savingTemplate ? '#9CA3AF' : '#111827', color: '#FFF', border: 'none', cursor: savingTemplate ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: '0 1px 4px rgba(0,0,0,0.15)', transition: 'background 120ms ease' }}>
              <Check style={{ width: '13px', height: '13px' }} />
              {savingTemplate ? 'Saving…' : editingTemplate ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
