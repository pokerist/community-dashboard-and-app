import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus, RefreshCw, Search, ArrowUp, ArrowDown, Upload,
  X, Check, Image, Layers, Tag, SlidersHorizontal, ChevronDown,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { StatCard } from '../StatCard';
import { StatusBadge } from '../StatusBadge';
import marketingService, {
  type BannerAudience,
  type BannerPriority,
  type BannerStatus,
  type CampaignBanner,
  type OfferBanner,
  type OffersSettings,
  type OnboardingSettings,
  type OnboardingSlide,
  type UpsertCampaignPayload,
} from '../../lib/marketingService';
import { errorMessage, formatDateTime, humanizeEnum } from '../../lib/live-data';

// ─── Constants ────────────────────────────────────────────────

const AUDIENCE_OPTIONS: BannerAudience[] = ['ALL', 'SPECIFIC_RESIDENCES', 'SPECIFIC_BLOCKS', 'SPECIFIC_UNITS'];
const PRIORITY_OPTIONS: BannerPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUS_OPTIONS: BannerStatus[] = ['ACTIVE', 'INACTIVE', 'EXPIRED'];

// ─── Types ────────────────────────────────────────────────────

type BannerFormState = {
  id: string | null; titleEn: string; titleAr: string; descriptionEn: string; descriptionAr: string;
  ctaUrl: string; targetAudience: BannerAudience; audienceValues: string;
  startDateLocal: string; endDateLocal: string; status: BannerStatus;
  displayPriority: BannerPriority; imageFileId: string; imageFile: File | null;
};

type SlideFormState = { title: string; subtitle: string; description: string; imageUrl: string };

type OfferFormState = {
  id: string | null; title: string; subtitle: string; description: string;
  imageUrl: string; imageFileId: string; linkUrl: string; priority: string;
  active: boolean; startAtLocal: string; endAtLocal: string; imageFile: File | null;
};

type OnboardingRow = { id: string; index: number; slide: OnboardingSlide };
type OfferRow = { id: string; index: number; offer: OfferBanner };

// ─── Helpers ──────────────────────────────────────────────────

function splitCsv(v: string): string[] { return v.split(',').map((p) => p.trim()).filter(Boolean); }
function toLocalDT(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function fromLocalDT(local: string): string {
  if (!local.trim()) return '';
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}
function readArray(meta: Record<string, unknown> | null, key: string): string[] {
  if (!meta) return [];
  const raw = meta[key];
  if (!Array.isArray(raw)) return [];
  return raw.map((i) => (typeof i === 'string' ? i.trim() : '')).filter(Boolean);
}
function readAudienceValues(audience: BannerAudience, meta: Record<string, unknown> | null): string {
  if (audience === 'ALL') return '';
  if (audience === 'SPECIFIC_RESIDENCES') { const u = readArray(meta, 'userIds'); return u.length > 0 ? u.join(', ') : readArray(meta, 'communityIds').join(', '); }
  if (audience === 'SPECIFIC_BLOCKS') return readArray(meta, 'blocks').join(', ');
  return readArray(meta, 'unitIds').join(', ');
}
function buildAudienceMeta(audience: BannerAudience, values: string): Record<string, unknown> | undefined {
  if (audience === 'ALL') return {};
  const v = splitCsv(values);
  if (!v.length) return undefined;
  if (audience === 'SPECIFIC_RESIDENCES') return { userIds: v };
  if (audience === 'SPECIFIC_BLOCKS') return { blocks: v };
  return { unitIds: v };
}
function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const n = [...items]; const [m] = n.splice(from, 1); if (m === undefined) return items;
  n.splice(to, 0, m); return n;
}

function createDefaultBannerForm(): BannerFormState {
  const now = new Date(); const end = new Date(now.getTime() + 7 * 864e5);
  return { id: null, titleEn: '', titleAr: '', descriptionEn: '', descriptionAr: '', ctaUrl: '', targetAudience: 'ALL', audienceValues: '', startDateLocal: toLocalDT(now.toISOString()), endDateLocal: toLocalDT(end.toISOString()), status: 'ACTIVE', displayPriority: 'MEDIUM', imageFileId: '', imageFile: null };
}
function createDefaultOfferForm(priority: number): OfferFormState {
  return { id: null, title: '', subtitle: '', description: '', imageUrl: '', imageFileId: '', linkUrl: '', priority: String(priority), active: true, startAtLocal: '', endAtLocal: '', imageFile: null };
}
const DEFAULT_SLIDE: SlideFormState = { title: '', subtitle: '', description: '', imageUrl: '' };

// ─── Design tokens ────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: '7px',
  border: '1px solid #E5E7EB', fontSize: '13px', color: '#111827',
  background: '#FFF', outline: 'none', fontFamily: "'Work Sans', sans-serif",
  boxSizing: 'border-box', height: '36px',
};
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };
const textareaStyle: React.CSSProperties = { ...inputStyle, height: 'auto', resize: 'vertical' as const };

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

function IconBtn({ onClick, disabled, danger, children }: { onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ width: '28px', height: '28px', borderRadius: '6px', border: `1px solid ${danger ? '#FECACA' : '#E5E7EB'}`, background: danger ? '#FFF5F5' : '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'not-allowed' : 'pointer', color: danger ? '#DC2626' : '#6B7280', opacity: disabled ? 0.35 : 1, transition: 'all 120ms ease', flexShrink: 0 }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.background = danger ? '#DC2626' : '#111827'; e.currentTarget.style.color = '#FFF'; } }}
      onMouseLeave={(e) => { e.currentTarget.style.background = danger ? '#FFF5F5' : '#FFF'; e.currentTarget.style.color = danger ? '#DC2626' : '#6B7280'; }}>
      {children}
    </button>
  );
}

// ─── Banner row ───────────────────────────────────────────────

function BannerRow({ row, onEdit, onToggle, onDelete }: { row: CampaignBanner; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto auto auto', alignItems: 'center', gap: '12px', padding: '11px 14px', borderBottom: '1px solid #F9FAFB', transition: 'background 100ms' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#FAFAFA'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}>
      {/* Title */}
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.titleEn}</p>
        {row.description && <p style={{ fontSize: '11.5px', color: '#9CA3AF', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description}</p>}
      </div>
      {/* Audience */}
      <span style={{ fontSize: '12px', color: '#6B7280', whiteSpace: 'nowrap' }}>{humanizeEnum(row.targetAudience)}</span>
      {/* Schedule */}
      <div style={{ textAlign: 'right' }}>
        <p style={{ fontSize: '11.5px', color: '#374151', margin: 0, fontFamily: "'DM Mono', monospace" }}>{formatDateTime(row.startDate)}</p>
        <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '1px 0 0', fontFamily: "'DM Mono', monospace" }}>→ {formatDateTime(row.endDate)}</p>
      </div>
      {/* Priority */}
      <StatusBadge value={row.displayPriority} />
      {/* Status */}
      <StatusBadge value={row.status} />
      {/* Performance */}
      <div style={{ textAlign: 'right' }}>
        <p style={{ fontSize: '12px', color: '#374151', margin: 0 }}>{row.views}v / {row.clicks}c</p>
        <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '1px 0 0' }}>CTR {row.ctr.toFixed(1)}%</p>
      </div>
      {/* Actions */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <button type="button" onClick={onEdit}
          style={{ padding: '0 8px', height: '28px', borderRadius: '6px', border: '1px solid #E5E7EB', background: '#FFF', cursor: 'pointer', fontSize: '11.5px', fontWeight: 600, color: '#6B7280', fontFamily: "'Work Sans', sans-serif", transition: 'all 120ms ease' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#111827'; e.currentTarget.style.color = '#FFF'; e.currentTarget.style.borderColor = '#111827'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#FFF'; e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.borderColor = '#E5E7EB'; }}>
          Edit
        </button>
        <button type="button" onClick={onToggle}
          style={{ padding: '0 8px', height: '28px', borderRadius: '6px', border: '1px solid #E5E7EB', background: '#FFF', cursor: 'pointer', fontSize: '11.5px', fontWeight: 600, color: '#6B7280', fontFamily: "'Work Sans', sans-serif", transition: 'all 120ms ease' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#F3F4F6'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#FFF'; }}>
          {row.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
        </button>
        <IconBtn onClick={onDelete} danger><X style={{ width: '10px', height: '10px' }} /></IconBtn>
      </div>
    </div>
  );
}

// ─── Onboarding row ───────────────────────────────────────────

function OnboardingRow({ row, total, onMoveUp, onMoveDown, onEdit, onDelete }: {
  row: OnboardingRow; total: number;
  onMoveUp: () => void; onMoveDown: () => void; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto auto auto', alignItems: 'center', gap: '12px', padding: '11px 14px', borderBottom: '1px solid #F9FAFB', transition: 'background 100ms' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#FAFAFA'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}>
      <span style={{ fontSize: '11px', fontWeight: 700, color: '#D1D5DB', fontFamily: "'DM Mono', monospace", textAlign: 'center' }}>{row.index + 1}</span>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0 }}>{row.slide.title}</p>
        {row.slide.subtitle && <p style={{ fontSize: '11.5px', color: '#9CA3AF', margin: '2px 0 0' }}>{row.slide.subtitle}</p>}
      </div>
      {row.slide.imageUrl ? (
        <a href={row.slide.imageUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11.5px', color: '#2563EB', textDecoration: 'underline' }}>Image</a>
      ) : <span style={{ fontSize: '11.5px', color: '#D1D5DB' }}>No image</span>}
      <div style={{ display: 'flex', gap: '4px' }}>
        <IconBtn onClick={onMoveUp} disabled={row.index === 0}><ArrowUp style={{ width: '10px', height: '10px' }} /></IconBtn>
        <IconBtn onClick={onMoveDown} disabled={row.index === total - 1}><ArrowDown style={{ width: '10px', height: '10px' }} /></IconBtn>
        <button type="button" onClick={onEdit}
          style={{ padding: '0 8px', height: '28px', borderRadius: '6px', border: '1px solid #E5E7EB', background: '#FFF', cursor: 'pointer', fontSize: '11.5px', fontWeight: 600, color: '#6B7280', fontFamily: "'Work Sans', sans-serif", transition: 'all 120ms ease' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#111827'; e.currentTarget.style.color = '#FFF'; e.currentTarget.style.borderColor = '#111827'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#FFF'; e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.borderColor = '#E5E7EB'; }}>
          Edit
        </button>
        <IconBtn onClick={onDelete} danger><X style={{ width: '10px', height: '10px' }} /></IconBtn>
      </div>
    </div>
  );
}

// ─── Offer row ────────────────────────────────────────────────

function OfferRowItem({ row, total, onMoveUp, onMoveDown, onEdit, onDelete }: {
  row: OfferRow; total: number;
  onMoveUp: () => void; onMoveDown: () => void; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', alignItems: 'center', gap: '12px', padding: '11px 14px', borderBottom: '1px solid #F9FAFB', transition: 'background 100ms' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#FAFAFA'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}>
      <div>
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0 }}>{row.offer.title}</p>
        {row.offer.subtitle && <p style={{ fontSize: '11.5px', color: '#9CA3AF', margin: '2px 0 0' }}>{row.offer.subtitle}</p>}
      </div>
      <div style={{ textAlign: 'right' }}>
        <p style={{ fontSize: '11.5px', color: '#374151', margin: 0, fontFamily: "'DM Mono', monospace" }}>{row.offer.startAt ? formatDateTime(row.offer.startAt) : '\u2014'}</p>
        <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '1px 0 0', fontFamily: "'DM Mono', monospace" }}>{row.offer.endAt ? `\u2192 ${formatDateTime(row.offer.endAt)}` : '\u2014'}</p>
      </div>
      <StatusBadge value={row.offer.active ? 'ACTIVE' : 'INACTIVE'} />
      <div style={{ display: 'flex', gap: '4px' }}>
        <IconBtn onClick={onMoveUp} disabled={row.index === 0}><ArrowUp style={{ width: '10px', height: '10px' }} /></IconBtn>
        <IconBtn onClick={onMoveDown} disabled={row.index === total - 1}><ArrowDown style={{ width: '10px', height: '10px' }} /></IconBtn>
        <button type="button" onClick={onEdit}
          style={{ padding: '0 8px', height: '28px', borderRadius: '6px', border: '1px solid #E5E7EB', background: '#FFF', cursor: 'pointer', fontSize: '11.5px', fontWeight: 600, color: '#6B7280', fontFamily: "'Work Sans', sans-serif", transition: 'all 120ms ease' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#111827'; e.currentTarget.style.color = '#FFF'; e.currentTarget.style.borderColor = '#111827'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#FFF'; e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.borderColor = '#E5E7EB'; }}>
          Edit
        </button>
        <IconBtn onClick={onDelete} danger><X style={{ width: '10px', height: '10px' }} /></IconBtn>
      </div>
    </div>
  );
}

// ─── Table column header row ──────────────────────────────────

function TableHeader({ columns }: { columns: string[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, 1fr)`, gap: '12px', padding: '9px 14px', borderBottom: '1px solid #F3F4F6', background: '#FAFAFA' }}>
      {columns.map((c) => (
        <span key={c} style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Work Sans', sans-serif" }}>{c}</span>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────

export function MarketingCenter() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [banners, setBanners] = useState<CampaignBanner[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingSettings>({ enabled: true, slides: [] });
  const [offers, setOffers] = useState<OffersSettings>({ enabled: false, banners: [] });

  // Banner filters
  const [bannerSearch, setBannerSearch] = useState('');
  const [bannerStatusFilter, setBannerStatusFilter] = useState<BannerStatus | 'all'>('ACTIVE');
  const [bannerAudienceFilter, setBannerAudienceFilter] = useState<BannerAudience | 'all'>('all');
  const [bannerPriorityFilter, setBannerPriorityFilter] = useState<BannerPriority | 'all'>('all');
  const [bannerFiltersOpen, setBannerFiltersOpen] = useState(false);

  // Offer filters
  const [offerSearch, setOfferSearch] = useState('');
  const [offerActivityFilter, setOfferActivityFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Banner dialog
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false);
  const [bannerForm, setBannerForm] = useState<BannerFormState>(createDefaultBannerForm);
  const [bannerSaving, setBannerSaving] = useState(false);

  // Slide dialog
  const [slideDialogOpen, setSlideDialogOpen] = useState(false);
  const [slideForm, setSlideForm] = useState<SlideFormState>(DEFAULT_SLIDE);
  const [slideEditingIndex, setSlideEditingIndex] = useState<number | null>(null);
  const [onboardingSaving, setOnboardingSaving] = useState(false);

  // Offer dialog
  const [offerDialogOpen, setOfferDialogOpen] = useState(false);
  const [offerForm, setOfferForm] = useState<OfferFormState>(() => createDefaultOfferForm(1));
  const [offerEditingIndex, setOfferEditingIndex] = useState<number | null>(null);
  const [offerSaving, setOfferSaving] = useState(false);
  const [offersSaving, setOffersSaving] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const [campRes, settingsRes] = await Promise.all([
        marketingService.listCampaigns({ page: 1, limit: 200 }),
        marketingService.getMarketingSettings(),
      ]);
      setBanners([...campRes.data].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
      setOnboarding(settingsRes.onboarding);
      setOffers(settingsRes.offers);
    } catch (e) { toast.error('Failed to load marketing data', { description: errorMessage(e) }); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const bannerStats = useMemo(() => {
    const now = Date.now();
    const active = banners.filter((b) => b.status === 'ACTIVE');
    return {
      activeBanners: active.length,
      liveNow: active.filter((b) => new Date(b.startDate).getTime() <= now && now <= new Date(b.endDate).getTime()).length,
      scheduled: active.filter((b) => new Date(b.startDate).getTime() > now).length,
      totalClicks: active.reduce((s, b) => s + b.clicks, 0),
    };
  }, [banners]);

  const filteredBanners = useMemo(() => {
    const needle = bannerSearch.trim().toLowerCase();
    return banners.filter((b) => {
      if (bannerStatusFilter !== 'all' && b.status !== bannerStatusFilter) return false;
      if (bannerAudienceFilter !== 'all' && b.targetAudience !== bannerAudienceFilter) return false;
      if (bannerPriorityFilter !== 'all' && b.displayPriority !== bannerPriorityFilter) return false;
      if (!needle) return true;
      return [b.titleEn, b.titleAr ?? '', b.description ?? ''].join(' ').toLowerCase().includes(needle);
    });
  }, [banners, bannerSearch, bannerStatusFilter, bannerAudienceFilter, bannerPriorityFilter]);

  const filteredOfferRows = useMemo<OfferRow[]>(() => {
    const needle = offerSearch.trim().toLowerCase();
    return offers.banners.map((o, i) => ({ offer: o, index: i, id: o.id || `offer-${i}` }))
      .filter(({ offer }) => {
        if (offerActivityFilter === 'active' && !offer.active) return false;
        if (offerActivityFilter === 'inactive' && offer.active) return false;
        if (!needle) return true;
        return [offer.title, offer.subtitle, offer.description].join(' ').toLowerCase().includes(needle);
      });
  }, [offerSearch, offerActivityFilter, offers.banners]);

  const onboardingRows = useMemo<OnboardingRow[]>(
    () => onboarding.slides.map((s, i) => ({ id: `slide-${i}`, index: i, slide: s })),
    [onboarding.slides],
  );

  // ── Banner CRUD ──────────────────────────────────────────────

  const openCreateBanner = () => { setBannerForm(createDefaultBannerForm()); setBannerDialogOpen(true); };
  const openEditBanner = (b: CampaignBanner) => {
    setBannerForm({ id: b.id, titleEn: b.titleEn, titleAr: b.titleAr ?? '', descriptionEn: (b as any).descriptionEn ?? b.description ?? '', descriptionAr: (b as any).descriptionAr ?? '', ctaUrl: b.ctaUrl ?? '', targetAudience: b.targetAudience, audienceValues: readAudienceValues(b.targetAudience, b.audienceMeta), startDateLocal: toLocalDT(b.startDate), endDateLocal: toLocalDT(b.endDate), status: b.status, displayPriority: b.displayPriority, imageFileId: b.imageFileId ?? '', imageFile: null });
    setBannerDialogOpen(true);
  };

  const saveBanner = async () => {
    if (!bannerForm.titleEn.trim()) { toast.error('Banner title is required'); return; }
    const start = fromLocalDT(bannerForm.startDateLocal); const end = fromLocalDT(bannerForm.endDateLocal);
    if (!start || !end) { toast.error('Start and end date are required'); return; }
    if (new Date(start) >= new Date(end)) { toast.error('End must be after start'); return; }
    const audienceMeta = buildAudienceMeta(bannerForm.targetAudience, bannerForm.audienceValues);
    if (bannerForm.targetAudience !== 'ALL' && !audienceMeta) { toast.error('Audience values required'); return; }
    setBannerSaving(true);
    try {
      let imageFileId = bannerForm.imageFileId.trim() || crypto.randomUUID();
      if (bannerForm.imageFile) { const u = await marketingService.uploadCampaignImage(bannerForm.imageFile); imageFileId = u.id; }
      const payload: UpsertCampaignPayload = { titleEn: bannerForm.titleEn.trim(), titleAr: bannerForm.titleAr.trim() || undefined, description: bannerForm.descriptionEn.trim() || undefined, ctaUrl: bannerForm.ctaUrl.trim() || undefined, targetAudience: bannerForm.targetAudience, audienceMeta, startDate: start, endDate: end, status: bannerForm.status, displayPriority: bannerForm.displayPriority, imageFileId: imageFileId || undefined };
      if (bannerForm.id) await marketingService.updateCampaign(bannerForm.id, payload);
      else await marketingService.createCampaign(payload);
      setBannerDialogOpen(false); await loadData(true);
      toast.success(bannerForm.id ? 'Banner updated' : 'Banner created');
    } catch (e) { toast.error('Failed to save banner', { description: errorMessage(e) }); }
    finally { setBannerSaving(false); }
  };

  const deleteBanner = async (b: CampaignBanner) => {
    if (!window.confirm(`Delete banner "${b.titleEn}"?`)) return;
    try { await marketingService.deleteCampaign(b.id); toast.success('Banner deleted'); await loadData(true); }
    catch (e) { toast.error('Failed to delete', { description: errorMessage(e) }); }
  };

  const toggleBannerStatus = async (b: CampaignBanner) => {
    const next: BannerStatus = b.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try { await marketingService.updateCampaignStatus(b.id, next); toast.success(`Banner ${next.toLowerCase()}`); await loadData(true); }
    catch (e) { toast.error('Failed to update status', { description: errorMessage(e) }); }
  };

  // ── Slide CRUD ───────────────────────────────────────────────

  const openCreateSlide = () => { setSlideEditingIndex(null); setSlideForm(DEFAULT_SLIDE); setSlideDialogOpen(true); };
  const openEditSlide = (i: number) => { const s = onboarding.slides[i]; if (!s) return; setSlideEditingIndex(i); setSlideForm({ title: s.title, subtitle: s.subtitle, description: s.description, imageUrl: s.imageUrl }); setSlideDialogOpen(true); };
  const saveSlideDraft = () => {
    if (!slideForm.title.trim()) { toast.error('Slide title is required'); return; }
    const next: OnboardingSlide = { title: slideForm.title.trim(), subtitle: slideForm.subtitle.trim(), description: slideForm.description.trim(), imageUrl: slideForm.imageUrl.trim() };
    setOnboarding((cur) => {
      if (slideEditingIndex === null) { if (cur.slides.length >= 8) { toast.error('Max 8 slides'); return cur; } return { ...cur, slides: [...cur.slides, next] }; }
      const s = [...cur.slides]; s[slideEditingIndex] = next; return { ...cur, slides: s };
    });
    setSlideDialogOpen(false);
  };
  const deleteSlide = (i: number) => { if (onboarding.slides.length <= 1) { toast.error('At least one slide required'); return; } setOnboarding((c) => ({ ...c, slides: c.slides.filter((_, idx) => idx !== i) })); };
  const moveSlide = (i: number, dir: 'up' | 'down') => setOnboarding((c) => ({ ...c, slides: moveItem(c.slides, i, dir === 'up' ? i - 1 : i + 1) }));

  const persistOnboarding = async () => {
    if (!onboarding.slides.length) { toast.error('At least one slide required'); return; }
    setOnboardingSaving(true);
    try { const u = await marketingService.updateOnboarding({ enabled: onboarding.enabled, slides: onboarding.slides }); setOnboarding(u); toast.success('Onboarding saved'); }
    catch (e) { toast.error('Failed to save onboarding', { description: errorMessage(e) }); }
    finally { setOnboardingSaving(false); }
  };

  // ── Offer CRUD ───────────────────────────────────────────────

  const openCreateOffer = () => { setOfferEditingIndex(null); setOfferForm(createDefaultOfferForm(offers.banners.length + 1)); setOfferDialogOpen(true); };
  const openEditOffer = (i: number) => {
    const o = offers.banners[i]; if (!o) return;
    setOfferEditingIndex(i);
    setOfferForm({ id: o.id, title: o.title, subtitle: o.subtitle, description: o.description, imageUrl: o.imageUrl, imageFileId: o.imageFileId, linkUrl: o.linkUrl, priority: String(o.priority), active: o.active, startAtLocal: toLocalDT(o.startAt), endAtLocal: toLocalDT(o.endAt), imageFile: null });
    setOfferDialogOpen(true);
  };
  const saveOfferDraft = async () => {
    if (!offerForm.title.trim()) { toast.error('Offer title required'); return; }
    setOfferSaving(true);
    try {
      let imageFileId = offerForm.imageFileId.trim();
      if (offerForm.imageFile) { const u = await marketingService.uploadOfferImage(offerForm.imageFile); imageFileId = u.id; }
      const startAt = fromLocalDT(offerForm.startAtLocal); const endAt = fromLocalDT(offerForm.endAtLocal);
      if (startAt && endAt && new Date(endAt) < new Date(startAt)) { toast.error('End must be after start'); return; }
      const priority = Math.max(1, parseInt(offerForm.priority, 10) || 1);
      const next: OfferBanner = { id: offerForm.id?.trim() || `offer-${Date.now()}`, title: offerForm.title.trim(), subtitle: offerForm.subtitle.trim(), description: offerForm.description.trim(), imageUrl: offerForm.imageUrl.trim(), imageFileId, linkUrl: offerForm.linkUrl.trim(), priority, active: offerForm.active, startAt, endAt };
      setOffers((cur) => { if (offerEditingIndex === null) return { ...cur, banners: [...cur.banners, next] }; const b = [...cur.banners]; b[offerEditingIndex] = next; return { ...cur, banners: b }; });
      setOfferDialogOpen(false);
    } catch (e) { toast.error('Failed to save offer', { description: errorMessage(e) }); }
    finally { setOfferSaving(false); }
  };
  const deleteOffer = (i: number) => setOffers((c) => ({ ...c, banners: c.banners.filter((_, idx) => idx !== i) }));
  const moveOffer = (i: number, dir: 'up' | 'down') => setOffers((c) => ({ ...c, banners: moveItem(c.banners, i, dir === 'up' ? i - 1 : i + 1) }));

  const persistOffers = async () => {
    for (let i = 0; i < offers.banners.length; i++) {
      const o = offers.banners[i];
      if (!o?.title.trim()) { toast.error(`Offer ${i + 1} missing title`); return; }
      if (!o.imageUrl.trim() && !o.imageFileId.trim()) { toast.error(`Offer ${i + 1} needs an image`); return; }
    }
    setOffersSaving(true);
    try { const u = await marketingService.updateOffers({ enabled: offers.enabled, banners: offers.banners }); setOffers(u); toast.success('Offers saved'); }
    catch (e) { toast.error('Failed to save offers', { description: errorMessage(e) }); }
    finally { setOffersSaving(false); }
  };

  const activeBannerFilters = [bannerStatusFilter !== 'all', bannerAudienceFilter !== 'all', bannerPriorityFilter !== 'all'].filter(Boolean).length;

  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* ── Header ─── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 900, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>Marketing</h1>
          <p style={{ marginTop: '4px', fontSize: '13px', color: '#6B7280' }}>Banners, onboarding screens, and promotional offers.</p>
        </div>
        <button type="button" onClick={() => void loadData(true)} disabled={refreshing}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: '#FFF', color: '#374151', border: '1px solid #E5E7EB', cursor: refreshing ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: "'Work Sans', sans-serif", opacity: refreshing ? 0.6 : 1 }}>
          <RefreshCw style={{ width: '13px', height: '13px', animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* ── Stats ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
        <StatCard title="Active Banners" value={String(bannerStats.activeBanners)} icon="occupancy" />
        <StatCard title="Live Now" value={String(bannerStats.liveNow)} icon="active-users" />
        <StatCard title="Scheduled" value={String(bannerStats.scheduled)} icon="tickets" />
        <StatCard title="Total Clicks" value={String(bannerStats.totalClicks)} icon="visitors" />
      </div>

      {/* ══ Banners section ══════════════════════════════════════ */}
      <div style={{ borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FFF', overflow: 'hidden', marginBottom: '16px' }}>
        {/* Filter bar */}
        <div style={{ borderBottom: bannerFiltersOpen ? '1px solid #F3F4F6' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px' }}>
            <Search style={{ width: '13px', height: '13px', color: '#9CA3AF', flexShrink: 0 }} />
            <input placeholder="Search banners\u2026" value={bannerSearch} onChange={(e) => setBannerSearch(e.target.value)}
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: '#111827', fontFamily: "'Work Sans', sans-serif" }} />
            <button type="button" onClick={() => setBannerFiltersOpen((p) => !p)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: `1px solid ${activeBannerFilters > 0 ? '#2563EB40' : '#E5E7EB'}`, background: activeBannerFilters > 0 ? '#EFF6FF' : '#FAFAFA', color: activeBannerFilters > 0 ? '#2563EB' : '#6B7280', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Work Sans', sans-serif" }}>
              <SlidersHorizontal style={{ width: '11px', height: '11px' }} />
              Filters
              {activeBannerFilters > 0 && <span style={{ width: '15px', height: '15px', borderRadius: '50%', background: '#2563EB', color: '#FFF', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{activeBannerFilters}</span>}
              <ChevronDown style={{ width: '10px', height: '10px', transform: bannerFiltersOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
            </button>
            <button type="button" onClick={openCreateBanner}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '7px', background: '#111827', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
              <Plus style={{ width: '11px', height: '11px' }} /> New Banner
            </button>
          </div>
          {bannerFiltersOpen && (
            <div style={{ padding: '10px 14px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select value={bannerStatusFilter} onChange={(e) => setBannerStatusFilter(e.target.value as BannerStatus | 'all')} style={{ ...selectStyle, width: '140px' }}>
                <option value="all">All Statuses</option>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{humanizeEnum(s)}</option>)}
              </select>
              <select value={bannerAudienceFilter} onChange={(e) => setBannerAudienceFilter(e.target.value as BannerAudience | 'all')} style={{ ...selectStyle, width: '160px' }}>
                <option value="all">All Audiences</option>
                {AUDIENCE_OPTIONS.map((a) => <option key={a} value={a}>{humanizeEnum(a)}</option>)}
              </select>
              <select value={bannerPriorityFilter} onChange={(e) => setBannerPriorityFilter(e.target.value as BannerPriority | 'all')} style={{ ...selectStyle, width: '140px' }}>
                <option value="all">All Priorities</option>
                {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{humanizeEnum(p)}</option>)}
              </select>
            </div>
          )}
        </div>
        {/* Table */}
        <div style={{ padding: '0 0 4px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto auto auto', gap: '12px', padding: '9px 14px', borderBottom: '1px solid #F3F4F6', background: '#FAFAFA' }}>
            {['Banner', 'Audience', 'Schedule', 'Priority', 'Status', 'Performance', 'Actions'].map((h) => (
              <span key={h} style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Work Sans', sans-serif" }}>{h}</span>
            ))}
          </div>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ height: '54px', margin: '6px 10px', borderRadius: '7px', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%' }} />
            ))
          ) : filteredBanners.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <Image style={{ width: '28px', height: '28px', color: '#E5E7EB', margin: '0 auto 8px' }} />
              <p style={{ fontSize: '13px', color: '#9CA3AF' }}>No banners found</p>
            </div>
          ) : filteredBanners.map((b) => (
            <BannerRow key={b.id} row={b} onEdit={() => openEditBanner(b)} onToggle={() => void toggleBannerStatus(b)} onDelete={() => void deleteBanner(b)} />
          ))}
        </div>
      </div>

      {/* ══ Onboarding section ═══════════════════════════════════ */}
      <div style={{ borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FFF', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Layers style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>Onboarding Screens</span>
          <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: '#F3F4F6', color: '#9CA3AF', fontFamily: "'DM Mono', monospace" }}>{onboarding.slides.length}</span>
          <select value={onboarding.enabled ? 'enabled' : 'disabled'} onChange={(e) => setOnboarding((c) => ({ ...c, enabled: e.target.value === 'enabled' }))} style={{ ...selectStyle, width: '120px', marginLeft: '4px' }}>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
            <button type="button" onClick={openCreateSlide}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '7px', background: '#FFF', color: '#374151', border: '1px solid #E5E7EB', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: "'Work Sans', sans-serif" }}>
              <Plus style={{ width: '11px', height: '11px' }} /> Add Screen
            </button>
            <button type="button" onClick={() => void persistOnboarding()} disabled={onboardingSaving}
              style={{ padding: '6px 14px', borderRadius: '7px', background: onboardingSaving ? '#9CA3AF' : '#111827', color: '#FFF', border: 'none', cursor: onboardingSaving ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
              {onboardingSaving ? 'Saving\u2026' : 'Save Onboarding'}
            </button>
          </div>
        </div>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} style={{ height: '44px', margin: '6px 10px', borderRadius: '7px', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%' }} />)
        ) : onboardingRows.length === 0 ? (
          <p style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#9CA3AF' }}>No onboarding screens. Add your first screen.</p>
        ) : onboardingRows.map((row) => (
          <OnboardingRow key={row.id} row={row} total={onboarding.slides.length}
            onMoveUp={() => moveSlide(row.index, 'up')} onMoveDown={() => moveSlide(row.index, 'down')}
            onEdit={() => openEditSlide(row.index)} onDelete={() => deleteSlide(row.index)} />
        ))}
      </div>

      {/* ══ Offers section ═══════════════════════════════════════ */}
      <div style={{ borderRadius: '10px', border: '1px solid #EBEBEB', background: '#FFF', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Search style={{ width: '13px', height: '13px', color: '#9CA3AF', flexShrink: 0 }} />
          <input placeholder="Search offers\u2026" value={offerSearch} onChange={(e) => setOfferSearch(e.target.value)}
            style={{ width: '180px', border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', color: '#111827', fontFamily: "'Work Sans', sans-serif" }} />
          <Tag style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>Promotional Offers</span>
          <select value={offerActivityFilter} onChange={(e) => setOfferActivityFilter(e.target.value as 'all' | 'active' | 'inactive')} style={{ ...selectStyle, width: '130px' }}>
            <option value="all">All Offers</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
          <select value={offers.enabled ? 'enabled' : 'disabled'} onChange={(e) => setOffers((c) => ({ ...c, enabled: e.target.value === 'enabled' }))} style={{ ...selectStyle, width: '120px' }}>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
            <button type="button" onClick={openCreateOffer}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '7px', background: '#FFF', color: '#374151', border: '1px solid #E5E7EB', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: "'Work Sans', sans-serif" }}>
              <Plus style={{ width: '11px', height: '11px' }} /> Add Offer
            </button>
            <button type="button" onClick={() => void persistOffers()} disabled={offersSaving}
              style={{ padding: '6px 14px', borderRadius: '7px', background: offersSaving ? '#9CA3AF' : '#111827', color: '#FFF', border: 'none', cursor: offersSaving ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
              {offersSaving ? 'Saving\u2026' : 'Save Offers'}
            </button>
          </div>
        </div>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} style={{ height: '44px', margin: '6px 10px', borderRadius: '7px', background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)', backgroundSize: '200% 100%' }} />)
        ) : filteredOfferRows.length === 0 ? (
          <p style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#9CA3AF' }}>No promotional offers.</p>
        ) : filteredOfferRows.map((row) => (
          <OfferRowItem key={`${row.id}-${row.index}`} row={row} total={offers.banners.length}
            onMoveUp={() => moveOffer(row.index, 'up')} onMoveDown={() => moveOffer(row.index, 'down')}
            onEdit={() => openEditOffer(row.index)} onDelete={() => deleteOffer(row.index)} />
        ))}
      </div>

      {/* ══ Banner dialog ════════════════════════════════════════ */}
      <Dialog open={bannerDialogOpen} onOpenChange={setBannerDialogOpen}>
        <DialogContent style={{ maxWidth: '640px', padding: 0, borderRadius: '12px', overflow: 'hidden', border: '1px solid #EBEBEB', fontFamily: "'Work Sans', sans-serif", maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: '3px', background: bannerForm.id ? 'linear-gradient(90deg, #2563EB, #0D9488)' : 'linear-gradient(90deg, #0D9488, #BE185D)', flexShrink: 0 }} />
          <div style={{ padding: '18px 24px 10px', flexShrink: 0 }}>
            <DialogHeader>
              <DialogTitle style={{ fontSize: '15px', fontWeight: 800, color: '#111827', margin: 0 }}>{bannerForm.id ? 'Edit Banner' : 'New Banner'}</DialogTitle>
              <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '3px' }}>Fill in required fields marked with *</p>
            </DialogHeader>
          </div>
          <div style={{ overflowY: 'auto', padding: '0 24px 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div>
              <SectionLabel icon={<Image style={{ width: '12px', height: '12px' }} />} label="Content" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Title (EN)" required><input value={bannerForm.titleEn} onChange={(e) => setBannerForm((p) => ({ ...p, titleEn: e.target.value }))} style={inputStyle} /></Field>
                <Field label="Title (AR)"><input value={bannerForm.titleAr} onChange={(e) => setBannerForm((p) => ({ ...p, titleAr: e.target.value }))} style={{ ...inputStyle, direction: 'rtl' }} /></Field>
                <Field label="Description (EN)"><textarea value={bannerForm.descriptionEn} onChange={(e) => setBannerForm((p) => ({ ...p, descriptionEn: e.target.value }))} rows={2} style={textareaStyle} /></Field>
                <Field label="Description (AR)"><textarea value={bannerForm.descriptionAr} onChange={(e) => setBannerForm((p) => ({ ...p, descriptionAr: e.target.value }))} rows={2} style={{ ...textareaStyle, direction: 'rtl' }} /></Field>
                <Field label="CTA URL" span2><input value={bannerForm.ctaUrl} onChange={(e) => setBannerForm((p) => ({ ...p, ctaUrl: e.target.value }))} style={inputStyle} /></Field>
              </div>
            </div>

            <div>
              <SectionLabel icon={<Upload style={{ width: '12px', height: '12px' }} />} label="Image" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                <Field label="Upload Image">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '7px', border: '1px dashed #D1D5DB', background: '#FAFAFA', cursor: 'pointer', fontSize: '12px', color: '#6B7280', height: '36px', boxSizing: 'border-box' }}>
                    <Upload style={{ width: '12px', height: '12px', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bannerForm.imageFile ? bannerForm.imageFile.name : 'Choose image'}</span>
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => setBannerForm((p) => ({ ...p, imageFile: e.target.files?.[0] ?? null }))} />
                  </label>
                </Field>
              </div>
            </div>

            <div>
              <SectionLabel icon={<Tag style={{ width: '12px', height: '12px' }} />} label="Targeting & Schedule" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Audience">
                  <select value={bannerForm.targetAudience} onChange={(e) => setBannerForm((p) => ({ ...p, targetAudience: e.target.value as BannerAudience, audienceValues: '' }))} style={selectStyle}>
                    {AUDIENCE_OPTIONS.map((a) => <option key={a} value={a}>{humanizeEnum(a)}</option>)}
                  </select>
                </Field>
                <Field label="Audience Values">
                  <input value={bannerForm.audienceValues} onChange={(e) => setBannerForm((p) => ({ ...p, audienceValues: e.target.value }))} disabled={bannerForm.targetAudience === 'ALL'} placeholder={bannerForm.targetAudience === 'ALL' ? 'Not required' : 'Comma-separated IDs'} style={{ ...inputStyle, opacity: bannerForm.targetAudience === 'ALL' ? 0.5 : 1 }} />
                </Field>
                <Field label="Start"><input type="datetime-local" value={bannerForm.startDateLocal} onChange={(e) => setBannerForm((p) => ({ ...p, startDateLocal: e.target.value }))} style={inputStyle} /></Field>
                <Field label="End"><input type="datetime-local" value={bannerForm.endDateLocal} onChange={(e) => setBannerForm((p) => ({ ...p, endDateLocal: e.target.value }))} style={inputStyle} /></Field>
                <Field label="Status">
                  <select value={bannerForm.status} onChange={(e) => setBannerForm((p) => ({ ...p, status: e.target.value as BannerStatus }))} style={selectStyle}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{humanizeEnum(s)}</option>)}
                  </select>
                </Field>
                <Field label="Priority">
                  <select value={bannerForm.displayPriority} onChange={(e) => setBannerForm((p) => ({ ...p, displayPriority: e.target.value as BannerPriority }))} style={selectStyle}>
                    {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{humanizeEnum(p)}</option>)}
                  </select>
                </Field>
              </div>
            </div>
          </div>
          <div style={{ padding: '12px 24px 20px', borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0, background: '#FFF' }}>
            <button type="button" onClick={() => setBannerDialogOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '7px', border: '1px solid #E5E7EB', background: '#FFF', color: '#6B7280', cursor: 'pointer', fontSize: '12.5px', fontWeight: 500, fontFamily: "'Work Sans', sans-serif" }}>
              <X style={{ width: '12px', height: '12px' }} /> Cancel
            </button>
            <button type="button" disabled={bannerSaving} onClick={() => void saveBanner()} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 20px', borderRadius: '7px', background: bannerSaving ? '#9CA3AF' : '#111827', color: '#FFF', border: 'none', cursor: bannerSaving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
              <Check style={{ width: '13px', height: '13px' }} />
              {bannerSaving ? 'Saving\u2026' : bannerForm.id ? 'Save Changes' : 'Create Banner'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ Slide dialog ═════════════════════════════════════════ */}
      <Dialog open={slideDialogOpen} onOpenChange={setSlideDialogOpen}>
        <DialogContent style={{ maxWidth: '480px', padding: 0, borderRadius: '12px', overflow: 'hidden', border: '1px solid #EBEBEB', fontFamily: "'Work Sans', sans-serif", maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: '3px', background: 'linear-gradient(90deg, #0D9488, #2563EB)', flexShrink: 0 }} />
          <div style={{ padding: '18px 24px 10px', flexShrink: 0 }}>
            <DialogHeader>
              <DialogTitle style={{ fontSize: '15px', fontWeight: 800, color: '#111827', margin: 0 }}>{slideEditingIndex === null ? 'Add Onboarding Screen' : 'Edit Onboarding Screen'}</DialogTitle>
              <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '3px' }}>Changes are local until you click Save Onboarding.</p>
            </DialogHeader>
          </div>
          <div style={{ overflowY: 'auto', padding: '0 24px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Field label="Title" required><input value={slideForm.title} onChange={(e) => setSlideForm((p) => ({ ...p, title: e.target.value }))} style={inputStyle} /></Field>
            <Field label="Subtitle"><input value={slideForm.subtitle} onChange={(e) => setSlideForm((p) => ({ ...p, subtitle: e.target.value }))} style={inputStyle} /></Field>
            <Field label="Description"><textarea value={slideForm.description} onChange={(e) => setSlideForm((p) => ({ ...p, description: e.target.value }))} rows={3} style={textareaStyle} /></Field>
            <Field label="Image URL"><input value={slideForm.imageUrl} onChange={(e) => setSlideForm((p) => ({ ...p, imageUrl: e.target.value }))} style={inputStyle} /></Field>
          </div>
          <div style={{ padding: '12px 24px 20px', borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0, background: '#FFF' }}>
            <button type="button" onClick={() => setSlideDialogOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '7px', border: '1px solid #E5E7EB', background: '#FFF', color: '#6B7280', cursor: 'pointer', fontSize: '12.5px', fontWeight: 500, fontFamily: "'Work Sans', sans-serif" }}>
              <X style={{ width: '12px', height: '12px' }} /> Cancel
            </button>
            <button type="button" onClick={saveSlideDraft} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 20px', borderRadius: '7px', background: '#111827', color: '#FFF', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
              <Check style={{ width: '13px', height: '13px' }} /> Save Screen
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ Offer dialog ═════════════════════════════════════════ */}
      <Dialog open={offerDialogOpen} onOpenChange={setOfferDialogOpen}>
        <DialogContent style={{ maxWidth: '560px', padding: 0, borderRadius: '12px', overflow: 'hidden', border: '1px solid #EBEBEB', fontFamily: "'Work Sans', sans-serif", maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: '3px', background: 'linear-gradient(90deg, #BE185D, #0D9488)', flexShrink: 0 }} />
          <div style={{ padding: '18px 24px 10px', flexShrink: 0 }}>
            <DialogHeader>
              <DialogTitle style={{ fontSize: '15px', fontWeight: 800, color: '#111827', margin: 0 }}>{offerEditingIndex === null ? 'Add Promotional Offer' : 'Edit Promotional Offer'}</DialogTitle>
              <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '3px' }}>Changes are local until you click Save Offers.</p>
            </DialogHeader>
          </div>
          <div style={{ overflowY: 'auto', padding: '0 24px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Title" required><input value={offerForm.title} onChange={(e) => setOfferForm((p) => ({ ...p, title: e.target.value }))} style={inputStyle} /></Field>
              <Field label="Subtitle"><input value={offerForm.subtitle} onChange={(e) => setOfferForm((p) => ({ ...p, subtitle: e.target.value }))} style={inputStyle} /></Field>
            </div>
            <Field label="Description"><textarea value={offerForm.description} onChange={(e) => setOfferForm((p) => ({ ...p, description: e.target.value }))} rows={2} style={textareaStyle} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Image URL"><input value={offerForm.imageUrl} onChange={(e) => setOfferForm((p) => ({ ...p, imageUrl: e.target.value }))} style={inputStyle} /></Field>
              <Field label="Image File ID"><input value={offerForm.imageFileId} onChange={(e) => setOfferForm((p) => ({ ...p, imageFileId: e.target.value }))} style={inputStyle} /></Field>
            </div>
            <Field label="Upload Image">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '7px', border: '1px dashed #D1D5DB', background: '#FAFAFA', cursor: 'pointer', fontSize: '12px', color: '#6B7280', height: '36px', boxSizing: 'border-box' }}>
                <Upload style={{ width: '12px', height: '12px', flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{offerForm.imageFile ? offerForm.imageFile.name : 'Choose image'}</span>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => setOfferForm((p) => ({ ...p, imageFile: e.target.files?.[0] ?? null }))} />
              </label>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Link URL"><input value={offerForm.linkUrl} onChange={(e) => setOfferForm((p) => ({ ...p, linkUrl: e.target.value }))} style={inputStyle} /></Field>
              <Field label="Priority"><input type="number" min={1} value={offerForm.priority} onChange={(e) => setOfferForm((p) => ({ ...p, priority: e.target.value }))} style={inputStyle} /></Field>
              <Field label="Start"><input type="datetime-local" value={offerForm.startAtLocal} onChange={(e) => setOfferForm((p) => ({ ...p, startAtLocal: e.target.value }))} style={inputStyle} /></Field>
              <Field label="End"><input type="datetime-local" value={offerForm.endAtLocal} onChange={(e) => setOfferForm((p) => ({ ...p, endAtLocal: e.target.value }))} style={inputStyle} /></Field>
            </div>
            <Field label="Status">
              <select value={offerForm.active ? 'ACTIVE' : 'INACTIVE'} onChange={(e) => setOfferForm((p) => ({ ...p, active: e.target.value === 'ACTIVE' }))} style={{ ...selectStyle, width: '140px' }}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </Field>
          </div>
          <div style={{ padding: '12px 24px 20px', borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0, background: '#FFF' }}>
            <button type="button" onClick={() => setOfferDialogOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '7px', border: '1px solid #E5E7EB', background: '#FFF', color: '#6B7280', cursor: 'pointer', fontSize: '12.5px', fontWeight: 500, fontFamily: "'Work Sans', sans-serif" }}>
              <X style={{ width: '12px', height: '12px' }} /> Cancel
            </button>
            <button type="button" disabled={offerSaving} onClick={() => void saveOfferDraft()} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 20px', borderRadius: '7px', background: offerSaving ? '#9CA3AF' : '#111827', color: '#FFF', border: 'none', cursor: offerSaving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
              <Check style={{ width: '13px', height: '13px' }} />
              {offerSaving ? 'Saving\u2026' : offerEditingIndex === null ? 'Create Offer' : 'Save Changes'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
