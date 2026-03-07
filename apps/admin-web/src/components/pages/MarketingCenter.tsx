import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, RefreshCw, Search, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable, type DataTableColumn } from '../DataTable';
import { EmptyState } from '../EmptyState';
import { PageHeader } from '../PageHeader';
import { SkeletonTable } from '../SkeletonTable';
import { StatCard } from '../StatCard';
import { StatusBadge } from '../StatusBadge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
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

const audienceOptions: BannerAudience[] = ['ALL', 'SPECIFIC_RESIDENCES', 'SPECIFIC_BLOCKS', 'SPECIFIC_UNITS'];
const priorityOptions: BannerPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const statusOptions: BannerStatus[] = ['ACTIVE', 'INACTIVE', 'EXPIRED'];
const secondaryActionButtonClass = 'marketing-btn marketing-btn-secondary';
const primaryActionButtonClass = 'marketing-btn marketing-btn-primary';
const tableSecondaryActionButtonClass = 'marketing-btn marketing-btn-secondary marketing-btn-table';
const tableSecondaryIconButtonClass = 'marketing-btn marketing-btn-secondary marketing-btn-icon disabled:opacity-40';
const tableDangerActionButtonClass = 'marketing-btn marketing-btn-danger marketing-btn-table';

type CampaignFormState = {
  id: string | null;
  titleEn: string;
  titleAr: string;
  description: string;
  ctaText: string;
  ctaUrl: string;
  targetAudience: BannerAudience;
  audienceValues: string;
  startDateLocal: string;
  endDateLocal: string;
  status: BannerStatus;
  displayPriority: BannerPriority;
  imageFileId: string;
  imageFile: File | null;
};

type SlideFormState = {
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
};

type OfferFormState = {
  id: string | null;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  imageFileId: string;
  linkUrl: string;
  priority: string;
  active: boolean;
  startAtLocal: string;
  endAtLocal: string;
  imageFile: File | null;
};

type OnboardingRow = { id: string; index: number; slide: OnboardingSlide };
type OfferRow = { id: string; index: number; offer: OfferBanner };

function splitCsv(value: string): string[] {
  return value.split(',').map((part) => part.trim()).filter((part) => part.length > 0);
}

function toLocalDateTimeValue(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
}

function fromLocalDateTimeValue(local: string): string {
  if (!local.trim()) return '';
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function readArray(meta: Record<string, unknown> | null, key: string): string[] {
  if (!meta) return [];
  const raw = meta[key];
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => (typeof item === 'string' ? item.trim() : '')).filter((item) => item.length > 0);
}

function readAudienceValues(targetAudience: BannerAudience, audienceMeta: Record<string, unknown> | null): string {
  if (targetAudience === 'ALL') return '';
  if (targetAudience === 'SPECIFIC_RESIDENCES') {
    const userIds = readArray(audienceMeta, 'userIds');
    if (userIds.length > 0) return userIds.join(', ');
    return readArray(audienceMeta, 'communityIds').join(', ');
  }
  if (targetAudience === 'SPECIFIC_BLOCKS') return readArray(audienceMeta, 'blocks').join(', ');
  return readArray(audienceMeta, 'unitIds').join(', ');
}

function buildAudienceMeta(targetAudience: BannerAudience, audienceValues: string): Record<string, unknown> | undefined {
  if (targetAudience === 'ALL') return {};
  const values = splitCsv(audienceValues);
  if (values.length === 0) return undefined;
  if (targetAudience === 'SPECIFIC_RESIDENCES') return { userIds: values };
  if (targetAudience === 'SPECIFIC_BLOCKS') return { blocks: values };
  return { unitIds: values };
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (toIndex < 0 || toIndex >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (moved === undefined) return items;
  next.splice(toIndex, 0, moved);
  return next;
}

function createDefaultCampaignForm(): CampaignFormState {
  const now = new Date();
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    id: null,
    titleEn: '',
    titleAr: '',
    description: '',
    ctaText: '',
    ctaUrl: '',
    targetAudience: 'ALL',
    audienceValues: '',
    startDateLocal: toLocalDateTimeValue(now.toISOString()),
    endDateLocal: toLocalDateTimeValue(end.toISOString()),
    status: 'ACTIVE',
    displayPriority: 'MEDIUM',
    imageFileId: '',
    imageFile: null,
  };
}

const defaultSlideForm: SlideFormState = { title: '', subtitle: '', description: '', imageUrl: '' };

function createDefaultOfferForm(priorityValue: number): OfferFormState {
  return {
    id: null,
    title: '',
    subtitle: '',
    description: '',
    imageUrl: '',
    imageFileId: '',
    linkUrl: '',
    priority: String(priorityValue),
    active: true,
    startAtLocal: '',
    endAtLocal: '',
    imageFile: null,
  };
}

export function MarketingCenter() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignBanner[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingSettings>({ enabled: true, slides: [] });
  const [offers, setOffers] = useState<OffersSettings>({ enabled: false, banners: [] });

  const [campaignSearch, setCampaignSearch] = useState('');
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<BannerStatus | 'all'>('ACTIVE');
  const [campaignAudienceFilter, setCampaignAudienceFilter] = useState<BannerAudience | 'all'>('all');
  const [campaignPriorityFilter, setCampaignPriorityFilter] = useState<BannerPriority | 'all'>('all');

  const [offerSearch, setOfferSearch] = useState('');
  const [offerActivityFilter, setOfferActivityFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [campaignDrawerOpen, setCampaignDrawerOpen] = useState(false);
  const [campaignForm, setCampaignForm] = useState<CampaignFormState>(createDefaultCampaignForm);
  const [campaignSaving, setCampaignSaving] = useState(false);

  const [slideDrawerOpen, setSlideDrawerOpen] = useState(false);
  const [slideForm, setSlideForm] = useState<SlideFormState>(defaultSlideForm);
  const [slideEditingIndex, setSlideEditingIndex] = useState<number | null>(null);
  const [onboardingSaving, setOnboardingSaving] = useState(false);

  const [offerDrawerOpen, setOfferDrawerOpen] = useState(false);
  const [offerForm, setOfferForm] = useState<OfferFormState>(() => createDefaultOfferForm(1));
  const [offerEditingIndex, setOfferEditingIndex] = useState<number | null>(null);
  const [offerSaving, setOfferSaving] = useState(false);
  const [offersSaving, setOffersSaving] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const [campaignResponse, settingsResponse] = await Promise.all([
        marketingService.listCampaigns({ page: 1, limit: 200 }),
        marketingService.getMarketingSettings(),
      ]);

      const sortedCampaigns = [...campaignResponse.data].sort(
        (left, right) => new Date(right.startDate).getTime() - new Date(left.startDate).getTime(),
      );

      setCampaigns(sortedCampaigns);
      setOnboarding(settingsResponse.onboarding);
      setOffers(settingsResponse.offers);
    } catch (error: unknown) {
      toast.error('Failed to load marketing data', { description: errorMessage(error) });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const campaignStats = useMemo(() => {
    const now = Date.now();
    const activeRows = campaigns.filter((row) => row.status === 'ACTIVE');
    const liveNow = activeRows.filter((row) => {
      const start = new Date(row.startDate).getTime();
      const end = new Date(row.endDate).getTime();
      return start <= now && now <= end;
    }).length;
    const scheduled = activeRows.filter((row) => new Date(row.startDate).getTime() > now).length;
    const totalClicks = activeRows.reduce((sum, row) => sum + row.clicks, 0);
    return { activeCampaigns: activeRows.length, liveNow, scheduled, totalClicks };
  }, [campaigns]);

  const filteredCampaigns = useMemo(() => {
    const searchNeedle = campaignSearch.trim().toLowerCase();
    return campaigns.filter((row) => {
      if (campaignStatusFilter !== 'all' && row.status !== campaignStatusFilter) return false;
      if (campaignAudienceFilter !== 'all' && row.targetAudience !== campaignAudienceFilter) return false;
      if (campaignPriorityFilter !== 'all' && row.displayPriority !== campaignPriorityFilter) return false;
      if (!searchNeedle) return true;
      const blob = [row.titleEn, row.titleAr ?? '', row.description ?? '', row.ctaText ?? ''].join(' ').toLowerCase();
      return blob.includes(searchNeedle);
    });
  }, [campaigns, campaignSearch, campaignStatusFilter, campaignAudienceFilter, campaignPriorityFilter]);

  const filteredOfferRows = useMemo(() => {
    const needle = offerSearch.trim().toLowerCase();
    return offers.banners
      .map((offer, index) => ({ offer, index }))
      .filter(({ offer }) => {
        if (offerActivityFilter === 'active' && !offer.active) return false;
        if (offerActivityFilter === 'inactive' && offer.active) return false;
        if (!needle) return true;
        const blob = [offer.title, offer.subtitle, offer.description, offer.linkUrl].join(' ').toLowerCase();
        return blob.includes(needle);
      })
      .map<OfferRow>(({ offer, index }) => ({ id: offer.id || `offer-${index + 1}`, index, offer }));
  }, [offerActivityFilter, offerSearch, offers.banners]);

  const onboardingRows = useMemo<OnboardingRow[]>(() => onboarding.slides.map((slide, index) => ({ id: `slide-${index + 1}`, index, slide })), [onboarding.slides]);

  const openCreateCampaign = () => {
    setCampaignForm(createDefaultCampaignForm());
    setCampaignDrawerOpen(true);
  };

  const openEditCampaign = (campaign: CampaignBanner) => {
    setCampaignForm({
      id: campaign.id,
      titleEn: campaign.titleEn,
      titleAr: campaign.titleAr ?? '',
      description: campaign.description ?? '',
      ctaText: campaign.ctaText ?? '',
      ctaUrl: campaign.ctaUrl ?? '',
      targetAudience: campaign.targetAudience,
      audienceValues: readAudienceValues(campaign.targetAudience, campaign.audienceMeta),
      startDateLocal: toLocalDateTimeValue(campaign.startDate),
      endDateLocal: toLocalDateTimeValue(campaign.endDate),
      status: campaign.status,
      displayPriority: campaign.displayPriority,
      imageFileId: campaign.imageFileId ?? '',
      imageFile: null,
    });
    setCampaignDrawerOpen(true);
  };
  const saveCampaign = async () => {
    if (!campaignForm.titleEn.trim()) {
      toast.error('Campaign title is required');
      return;
    }

    const startDateIso = fromLocalDateTimeValue(campaignForm.startDateLocal);
    const endDateIso = fromLocalDateTimeValue(campaignForm.endDateLocal);
    if (!startDateIso || !endDateIso) {
      toast.error('Campaign start and end are required');
      return;
    }
    if (new Date(startDateIso).getTime() >= new Date(endDateIso).getTime()) {
      toast.error('Campaign end must be after start');
      return;
    }

    const audienceMeta = buildAudienceMeta(campaignForm.targetAudience, campaignForm.audienceValues);
    if (campaignForm.targetAudience !== 'ALL' && !audienceMeta) {
      toast.error('Audience values are required for the selected audience');
      return;
    }

    setCampaignSaving(true);
    try {
      let imageFileId = campaignForm.imageFileId.trim();
      if (campaignForm.imageFile) {
        const uploaded = await marketingService.uploadCampaignImage(campaignForm.imageFile);
        imageFileId = uploaded.id;
      }

      const payload: UpsertCampaignPayload = {
        titleEn: campaignForm.titleEn.trim(),
        titleAr: campaignForm.titleAr.trim() || undefined,
        description: campaignForm.description.trim() || undefined,
        ctaText: campaignForm.ctaText.trim() || undefined,
        ctaUrl: campaignForm.ctaUrl.trim() || undefined,
        targetAudience: campaignForm.targetAudience,
        audienceMeta,
        startDate: startDateIso,
        endDate: endDateIso,
        status: campaignForm.status,
        displayPriority: campaignForm.displayPriority,
        imageFileId: imageFileId || undefined,
      };

      if (campaignForm.id) await marketingService.updateCampaign(campaignForm.id, payload);
      else await marketingService.createCampaign(payload);

      setCampaignDrawerOpen(false);
      setCampaignForm(createDefaultCampaignForm());
      await loadData(true);
      toast.success(campaignForm.id ? 'Campaign updated' : 'Campaign created');
    } catch (error: unknown) {
      toast.error('Failed to save campaign', { description: errorMessage(error) });
    } finally {
      setCampaignSaving(false);
    }
  };

  const deleteCampaign = async (campaign: CampaignBanner) => {
    const ok = window.confirm(`Delete campaign "${campaign.titleEn}"?`);
    if (!ok) return;
    try {
      await marketingService.deleteCampaign(campaign.id);
      toast.success('Campaign deleted');
      await loadData(true);
    } catch (error: unknown) {
      toast.error('Failed to delete campaign', { description: errorMessage(error) });
    }
  };

  const toggleCampaignStatus = async (campaign: CampaignBanner) => {
    const nextStatus: BannerStatus = campaign.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await marketingService.updateCampaignStatus(campaign.id, nextStatus);
      toast.success(`Campaign ${nextStatus.toLowerCase()}`);
      await loadData(true);
    } catch (error: unknown) {
      toast.error('Failed to update campaign status', { description: errorMessage(error) });
    }
  };

  const openCreateSlide = () => {
    setSlideEditingIndex(null);
    setSlideForm(defaultSlideForm);
    setSlideDrawerOpen(true);
  };

  const openEditSlide = (index: number) => {
    const slide = onboarding.slides[index];
    if (!slide) return;
    setSlideEditingIndex(index);
    setSlideForm({ title: slide.title, subtitle: slide.subtitle, description: slide.description, imageUrl: slide.imageUrl });
    setSlideDrawerOpen(true);
  };

  const saveSlideDraft = () => {
    if (!slideForm.title.trim()) {
      toast.error('Slide title is required');
      return;
    }

    const nextSlide: OnboardingSlide = {
      title: slideForm.title.trim(),
      subtitle: slideForm.subtitle.trim(),
      description: slideForm.description.trim(),
      imageUrl: slideForm.imageUrl.trim(),
    };

    setOnboarding((current) => {
      if (slideEditingIndex === null) {
        if (current.slides.length >= 8) {
          toast.error('Onboarding is limited to 8 slides');
          return current;
        }
        return { ...current, slides: [...current.slides, nextSlide] };
      }
      const nextSlides = [...current.slides];
      nextSlides[slideEditingIndex] = nextSlide;
      return { ...current, slides: nextSlides };
    });

    setSlideDrawerOpen(false);
    setSlideEditingIndex(null);
    setSlideForm(defaultSlideForm);
  };

  const deleteSlide = (index: number) => {
    if (onboarding.slides.length <= 1) {
      toast.error('At least one onboarding slide is required');
      return;
    }
    setOnboarding((current) => ({ ...current, slides: current.slides.filter((_, position) => position !== index) }));
  };

  const moveSlide = (index: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? index - 1 : index + 1;
    setOnboarding((current) => ({ ...current, slides: moveItem(current.slides, index, toIndex) }));
  };

  const persistOnboarding = async () => {
    if (onboarding.slides.length === 0) {
      toast.error('At least one onboarding slide is required');
      return;
    }
    setOnboardingSaving(true);
    try {
      const updated = await marketingService.updateOnboarding({ enabled: onboarding.enabled, slides: onboarding.slides });
      setOnboarding(updated);
      toast.success('Onboarding settings saved');
    } catch (error: unknown) {
      toast.error('Failed to save onboarding settings', { description: errorMessage(error) });
    } finally {
      setOnboardingSaving(false);
    }
  };

  const openCreateOffer = () => {
    setOfferEditingIndex(null);
    setOfferForm(createDefaultOfferForm(offers.banners.length + 1));
    setOfferDrawerOpen(true);
  };

  const openEditOffer = (index: number) => {
    const offer = offers.banners[index];
    if (!offer) return;
    setOfferEditingIndex(index);
    setOfferForm({
      id: offer.id,
      title: offer.title,
      subtitle: offer.subtitle,
      description: offer.description,
      imageUrl: offer.imageUrl,
      imageFileId: offer.imageFileId,
      linkUrl: offer.linkUrl,
      priority: String(offer.priority),
      active: offer.active,
      startAtLocal: toLocalDateTimeValue(offer.startAt),
      endAtLocal: toLocalDateTimeValue(offer.endAt),
      imageFile: null,
    });
    setOfferDrawerOpen(true);
  };

  const saveOfferDraft = async () => {
    if (!offerForm.title.trim()) {
      toast.error('Offer title is required');
      return;
    }
    setOfferSaving(true);
    try {
      let imageFileId = offerForm.imageFileId.trim();
      if (offerForm.imageFile) {
        const uploaded = await marketingService.uploadOfferImage(offerForm.imageFile);
        imageFileId = uploaded.id;
      }
      if (!offerForm.imageUrl.trim() && !imageFileId) {
        toast.error('Offer must include image URL or uploaded image');
        return;
      }

      const startAt = fromLocalDateTimeValue(offerForm.startAtLocal);
      const endAt = fromLocalDateTimeValue(offerForm.endAtLocal);
      if (startAt && endAt && new Date(endAt).getTime() < new Date(startAt).getTime()) {
        toast.error('Offer end time must be after start time');
        return;
      }

      const parsedPriority = Number.parseInt(offerForm.priority, 10);
      const priority = Number.isFinite(parsedPriority) && parsedPriority > 0 ? parsedPriority : 1;

      const nextOffer: OfferBanner = {
        id: offerForm.id?.trim() || `offer-${Date.now()}`,
        title: offerForm.title.trim(),
        subtitle: offerForm.subtitle.trim(),
        description: offerForm.description.trim(),
        imageUrl: offerForm.imageUrl.trim(),
        imageFileId,
        linkUrl: offerForm.linkUrl.trim(),
        priority,
        active: offerForm.active,
        startAt,
        endAt,
      };

      setOffers((current) => {
        if (offerEditingIndex === null) return { ...current, banners: [...current.banners, nextOffer] };
        const nextBanners = [...current.banners];
        nextBanners[offerEditingIndex] = nextOffer;
        return { ...current, banners: nextBanners };
      });

      setOfferDrawerOpen(false);
      setOfferEditingIndex(null);
      setOfferForm(createDefaultOfferForm(offers.banners.length + 1));
    } catch (error: unknown) {
      toast.error('Failed to save offer draft', { description: errorMessage(error) });
    } finally {
      setOfferSaving(false);
    }
  };

  const deleteOffer = (index: number) => {
    setOffers((current) => ({ ...current, banners: current.banners.filter((_, position) => position !== index) }));
  };

  const moveOffer = (index: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? index - 1 : index + 1;
    setOffers((current) => ({ ...current, banners: moveItem(current.banners, index, toIndex) }));
  };

  const persistOffers = async () => {
    for (let i = 0; i < offers.banners.length; i += 1) {
      const offer = offers.banners[i];
      if (!offer.title.trim()) {
        toast.error(`Offer ${i + 1} is missing title`);
        return;
      }
      if (!offer.imageUrl.trim() && !offer.imageFileId.trim()) {
        toast.error(`Offer ${i + 1} must include image URL or image file`);
        return;
      }
    }

    setOffersSaving(true);
    try {
      const updated = await marketingService.updateOffers({ enabled: offers.enabled, banners: offers.banners });
      setOffers(updated);
      toast.success('Promotional offers saved');
    } catch (error: unknown) {
      toast.error('Failed to save offers', { description: errorMessage(error) });
    } finally {
      setOffersSaving(false);
    }
  };

  const campaignColumns: DataTableColumn<CampaignBanner>[] = useMemo(
    () => [
      { key: 'campaign', header: 'Campaign', className: 'py-4 px-4 min-w-[220px]', render: (row) => <div><p className="text-sm text-gray-900">{row.titleEn}</p>{row.description ? <p className="text-xs text-gray-400 mt-1 line-clamp-2">{row.description}</p> : null}</div> },
      { key: 'audience', header: 'Audience', className: 'py-4 px-4', render: (row) => <div><p className="text-sm text-gray-700">{humanizeEnum(row.targetAudience)}</p>{row.targetAudience !== 'ALL' ? <p className="text-xs text-gray-400 mt-1">{readAudienceValues(row.targetAudience, row.audienceMeta) || 'No targeting values'}</p> : null}</div> },
      { key: 'schedule', header: 'Schedule', className: 'py-4 px-4', render: (row) => <div><p className="text-sm text-gray-700">{formatDateTime(row.startDate)}</p><p className="text-xs text-gray-400 mt-1">to {formatDateTime(row.endDate)}</p></div> },
      { key: 'priority', header: 'Priority', className: 'py-4 px-4', render: (row) => <StatusBadge value={row.displayPriority} /> },
      { key: 'status', header: 'Status', className: 'py-4 px-4', render: (row) => <StatusBadge value={row.status} /> },
      { key: 'performance', header: 'Performance', className: 'py-4 px-4', render: (row) => <div><p className="text-sm text-gray-700">{row.views} views / {row.clicks} clicks</p><p className="text-xs text-gray-400 mt-1">CTR {row.ctr.toFixed(2)}%</p></div> },
      { key: 'actions', header: 'Actions', className: 'py-4 px-4 text-right', render: (row) => <div className="flex items-center justify-end gap-2"><button type="button" onClick={() => openEditCampaign(row)} className={tableSecondaryActionButtonClass}>Edit</button><button type="button" onClick={() => void toggleCampaignStatus(row)} className={tableSecondaryActionButtonClass}>{row.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button><button type="button" onClick={() => void deleteCampaign(row)} className={tableDangerActionButtonClass}>Delete</button></div> },
    ],
    [],
  );

  const onboardingColumns: DataTableColumn<OnboardingRow>[] = useMemo(
    () => [
      { key: 'order', header: '#', className: 'py-4 px-4 w-16', render: (row) => <span className="text-sm text-gray-700">{row.index + 1}</span> },
      { key: 'title', header: 'Screen', className: 'py-4 px-4 min-w-[220px]', render: (row) => <div><p className="text-sm text-gray-900">{row.slide.title}</p>{row.slide.subtitle ? <p className="text-xs text-gray-400 mt-1">{row.slide.subtitle}</p> : null}</div> },
      { key: 'description', header: 'Description', className: 'py-4 px-4', render: (row) => <p className="text-sm text-gray-700 line-clamp-2">{row.slide.description || 'No description'}</p> },
      { key: 'image', header: 'Image URL', className: 'py-4 px-4', render: (row) => row.slide.imageUrl ? <a href={row.slide.imageUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:text-blue-300 underline">Open image</a> : <span className="text-xs text-gray-400">Not set</span> },
      { key: 'actions', header: 'Actions', className: 'py-4 px-4 text-right', render: (row) => <div className="flex items-center justify-end gap-2"><button type="button" onClick={() => moveSlide(row.index, 'up')} disabled={row.index === 0} className={tableSecondaryIconButtonClass}><ArrowUp className="w-4 h-4" /></button><button type="button" onClick={() => moveSlide(row.index, 'down')} disabled={row.index === onboarding.slides.length - 1} className={tableSecondaryIconButtonClass}><ArrowDown className="w-4 h-4" /></button><button type="button" onClick={() => openEditSlide(row.index)} className={tableSecondaryActionButtonClass}>Edit</button><button type="button" onClick={() => deleteSlide(row.index)} className={tableDangerActionButtonClass}>Delete</button></div> },
    ],
    [onboarding.slides.length],
  );

  const offerColumns: DataTableColumn<OfferRow>[] = useMemo(
    () => [
      { key: 'offer', header: 'Offer', className: 'py-4 px-4 min-w-[220px]', render: (row) => <div><p className="text-sm text-gray-900">{row.offer.title}</p>{row.offer.subtitle ? <p className="text-xs text-gray-400 mt-1">{row.offer.subtitle}</p> : null}</div> },
      { key: 'window', header: 'Display Window', className: 'py-4 px-4', render: (row) => <div><p className="text-sm text-gray-700">{row.offer.startAt ? formatDateTime(row.offer.startAt) : 'No start date'}</p><p className="text-xs text-gray-400 mt-1">{row.offer.endAt ? `to ${formatDateTime(row.offer.endAt)}` : 'No end date'}</p></div> },
      { key: 'priority', header: 'Priority', className: 'py-4 px-4', render: (row) => <span className="text-sm text-gray-700">{row.offer.priority}</span> },
      { key: 'status', header: 'Status', className: 'py-4 px-4', render: (row) => <StatusBadge value={row.offer.active ? 'ACTIVE' : 'INACTIVE'} /> },
      { key: 'actions', header: 'Actions', className: 'py-4 px-4 text-right', render: (row) => <div className="flex items-center justify-end gap-2"><button type="button" onClick={() => moveOffer(row.index, 'up')} disabled={row.index === 0} className={tableSecondaryIconButtonClass}><ArrowUp className="w-4 h-4" /></button><button type="button" onClick={() => moveOffer(row.index, 'down')} disabled={row.index === offers.banners.length - 1} className={tableSecondaryIconButtonClass}><ArrowDown className="w-4 h-4" /></button><button type="button" onClick={() => openEditOffer(row.index)} className={tableSecondaryActionButtonClass}>Edit</button><button type="button" onClick={() => deleteOffer(row.index)} className={tableDangerActionButtonClass}>Delete</button></div> },
    ],
    [offers.banners.length],
  );
  return (
    <div className="-m-6 bg-white p-8 min-h-[calc(100vh-120px)] text-gray-900 space-y-6">
      <PageHeader
        title="Marketing"
        description="Campaign execution, onboarding screens, and promotional offers in one place."
        actions={
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={refreshing}
            className={`${secondaryActionButtonClass} flex items-center gap-2 disabled:opacity-60`}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <div className="grid grid-cols-4 gap-4">
        <StatCard title="Active Campaigns" value={String(campaignStats.activeCampaigns)} icon="occupancy"  />
        <StatCard title="Live Now" value={String(campaignStats.liveNow)} icon="active-users"  />
        <StatCard title="Scheduled" value={String(campaignStats.scheduled)} icon="tickets"  />
        <StatCard title="Total Clicks" value={String(campaignStats.totalClicks)} icon="visitors"  />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-0">
        <div className="p-4 border-b border-gray-200 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={campaignSearch}
              onChange={(event) => setCampaignSearch(event.target.value)}
              placeholder="Search campaigns"
              className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <select value={campaignStatusFilter} onChange={(event) => setCampaignStatusFilter(event.target.value as BannerStatus | 'all')} className="w-40 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50 appearance-none">
            <option value="all">All Statuses</option>
            {statusOptions.map((status) => <option key={status} value={status}>{humanizeEnum(status)}</option>)}
          </select>
          <select value={campaignAudienceFilter} onChange={(event) => setCampaignAudienceFilter(event.target.value as BannerAudience | 'all')} className="w-44 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50 appearance-none">
            <option value="all">All Audiences</option>
            {audienceOptions.map((audience) => <option key={audience} value={audience}>{humanizeEnum(audience)}</option>)}
          </select>
          <select value={campaignPriorityFilter} onChange={(event) => setCampaignPriorityFilter(event.target.value as BannerPriority | 'all')} className="w-40 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50 appearance-none">
            <option value="all">All Priority</option>
            {priorityOptions.map((priority) => <option key={priority} value={priority}>{humanizeEnum(priority)}</option>)}
          </select>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={openCreateCampaign} className={`${primaryActionButtonClass} flex items-center gap-2`}>
              <Plus className="w-4 h-4" />
              Add Campaign
            </button>
          </div>
        </div>
        <div className="p-6">
          {loading ? (
            <SkeletonTable columns={7} rows={6}  />
          ) : (
            <DataTable columns={campaignColumns} rows={filteredCampaigns} rowKey={(row) => row.id}  emptyTitle="No campaigns found" emptyDescription="Create a campaign or adjust filters." />
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-0">
        <div className="p-4 border-b border-gray-200 flex items-center gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-gray-900">Onboarding Screens</h3>
          <select value={onboarding.enabled ? 'enabled' : 'disabled'} onChange={(event) => setOnboarding((current) => ({ ...current, enabled: event.target.value === 'enabled' }))} className="w-40 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50 appearance-none">
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={openCreateSlide} className={`${secondaryActionButtonClass} flex items-center gap-2`}>
              <Plus className="w-4 h-4" />
              Add Screen
            </button>
            <button type="button" onClick={() => void persistOnboarding()} disabled={onboardingSaving} className={`${primaryActionButtonClass} disabled:opacity-60`}>
              {onboardingSaving ? 'Saving...' : 'Save Onboarding'}
            </button>
          </div>
        </div>
        <div className="p-6">
          {loading ? (
            <SkeletonTable columns={5} rows={4}  />
          ) : onboardingRows.length === 0 ? (
            <EmptyState  title="No onboarding screens" description="Add your first screen to guide app users." />
          ) : (
            <DataTable columns={onboardingColumns} rows={onboardingRows} rowKey={(row) => row.id}  emptyTitle="No onboarding screens" />
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-0">
        <div className="p-4 border-b border-gray-200 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={offerSearch}
              onChange={(event) => setOfferSearch(event.target.value)}
              placeholder="Search offers"
              className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <select value={offerActivityFilter} onChange={(event) => setOfferActivityFilter(event.target.value as 'all' | 'active' | 'inactive')} className="w-40 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50 appearance-none">
            <option value="all">All Offers</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
          <select value={offers.enabled ? 'enabled' : 'disabled'} onChange={(event) => setOffers((current) => ({ ...current, enabled: event.target.value === 'enabled' }))} className="w-40 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50 appearance-none">
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={openCreateOffer} className={`${secondaryActionButtonClass} flex items-center gap-2`}>
              <Plus className="w-4 h-4" />
              Add Offer
            </button>
            <button type="button" onClick={() => void persistOffers()} disabled={offersSaving} className={`${primaryActionButtonClass} disabled:opacity-60`}>
              {offersSaving ? 'Saving...' : 'Save Offers'}
            </button>
          </div>
        </div>
        <div className="p-6">
          {loading ? (
            <SkeletonTable columns={5} rows={4}  />
          ) : (
            <DataTable columns={offerColumns} rows={filteredOfferRows} rowKey={(row) => `${row.id}-${row.index}`}  emptyTitle="No promotional offers" emptyDescription="Create offers to highlight announcements and promotions." />
          )}
        </div>
      </div>
      <Dialog
        open={campaignDrawerOpen}
        onOpenChange={setCampaignDrawerOpen}
      >
        <DialogContent className="marketing-dialog-content max-w-4xl max-h-[92vh] overflow-y-auto p-0">
          <DialogHeader className="marketing-dialog-header">
            <DialogTitle className="text-base font-semibold text-gray-900">{campaignForm.id ? 'Edit Campaign' : 'Create Campaign'}</DialogTitle>
            <DialogDescription className="marketing-dialog-description">Campaigns are delivered via the banners API.</DialogDescription>
          </DialogHeader>
          <div className="marketing-dialog-body space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Title (EN)</label>
              <input value={campaignForm.titleEn} onChange={(event) => setCampaignForm((current) => ({ ...current, titleEn: event.target.value }))} className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Title (AR)</label>
              <input value={campaignForm.titleAr} onChange={(event) => setCampaignForm((current) => ({ ...current, titleAr: event.target.value }))} className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Description</label>
            <textarea value={campaignForm.description} rows={3} onChange={(event) => setCampaignForm((current) => ({ ...current, description: event.target.value }))} className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">CTA Text</label>
              <input value={campaignForm.ctaText} onChange={(event) => setCampaignForm((current) => ({ ...current, ctaText: event.target.value }))} className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label className="text-xs text-gray-500">CTA URL</label>
              <input value={campaignForm.ctaUrl} onChange={(event) => setCampaignForm((current) => ({ ...current, ctaUrl: event.target.value }))} className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Audience</label>
              <select value={campaignForm.targetAudience} onChange={(event) => setCampaignForm((current) => ({ ...current, targetAudience: event.target.value as BannerAudience, audienceValues: '' }))} className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50 appearance-none">
                {audienceOptions.map((audience) => <option key={audience} value={audience}>{humanizeEnum(audience)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Audience Values</label>
              <input value={campaignForm.audienceValues} onChange={(event) => setCampaignForm((current) => ({ ...current, audienceValues: event.target.value }))} disabled={campaignForm.targetAudience === 'ALL'} placeholder={campaignForm.targetAudience === 'ALL' ? 'Not required for ALL' : 'Comma-separated values'} className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 disabled:opacity-60 focus:outline-none focus:border-blue-500/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Start</label>
              <input type="datetime-local" value={campaignForm.startDateLocal} onChange={(event) => setCampaignForm((current) => ({ ...current, startDateLocal: event.target.value }))} className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label className="text-xs text-gray-500">End</label>
              <input type="datetime-local" value={campaignForm.endDateLocal} onChange={(event) => setCampaignForm((current) => ({ ...current, endDateLocal: event.target.value }))} className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Status</label>
              <select value={campaignForm.status} onChange={(event) => setCampaignForm((current) => ({ ...current, status: event.target.value as BannerStatus }))} className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50 appearance-none">
                {statusOptions.map((status) => <option key={status} value={status}>{humanizeEnum(status)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Priority</label>
              <select value={campaignForm.displayPriority} onChange={(event) => setCampaignForm((current) => ({ ...current, displayPriority: event.target.value as BannerPriority }))} className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50 appearance-none">
                {priorityOptions.map((priority) => <option key={priority} value={priority}>{humanizeEnum(priority)}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Image File ID</label>
              <input value={campaignForm.imageFileId} onChange={(event) => setCampaignForm((current) => ({ ...current, imageFileId: event.target.value }))} className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Upload Image</label>
              <label className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 flex items-center justify-between gap-2 cursor-pointer hover:border-gray-300 transition-colors">
                <span className="truncate">{campaignForm.imageFile ? campaignForm.imageFile.name : 'Choose image'}</span>
                <Upload className="w-4 h-4" />
                <input type="file" accept="image/*" onChange={(event) => setCampaignForm((current) => ({ ...current, imageFile: event.target.files?.[0] ?? null }))} className="hidden" />
              </label>
            </div>
          </div>
          </div>
          <DialogFooter className="marketing-dialog-footer">
            <button type="button" onClick={() => setCampaignDrawerOpen(false)} className={secondaryActionButtonClass}>Cancel</button>
            <button type="button" onClick={() => void saveCampaign()} disabled={campaignSaving} className={`${primaryActionButtonClass} disabled:opacity-60`}>{campaignSaving ? 'Saving...' : 'Save'}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={slideDrawerOpen}
        onOpenChange={setSlideDrawerOpen}
      >
        <DialogContent className="marketing-dialog-content max-w-2xl max-h-[92vh] overflow-y-auto p-0">
          <DialogHeader className="marketing-dialog-header">
            <DialogTitle className="text-base font-semibold text-gray-900">{slideEditingIndex === null ? 'Add Onboarding Screen' : 'Edit Onboarding Screen'}</DialogTitle>
            <DialogDescription className="marketing-dialog-description">Changes are local until you click Save Onboarding.</DialogDescription>
          </DialogHeader>
          <div className="marketing-dialog-body space-y-4">
          <div>
            <label className="text-xs text-gray-500">Title</label>
            <input value={slideForm.title} onChange={(event) => setSlideForm((current) => ({ ...current, title: event.target.value }))} className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Subtitle</label>
            <input value={slideForm.subtitle} onChange={(event) => setSlideForm((current) => ({ ...current, subtitle: event.target.value }))} className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Description</label>
            <textarea value={slideForm.description} rows={3} onChange={(event) => setSlideForm((current) => ({ ...current, description: event.target.value }))} className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Image URL</label>
            <input value={slideForm.imageUrl} onChange={(event) => setSlideForm((current) => ({ ...current, imageUrl: event.target.value }))} className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50" />
          </div>
          </div>
          <DialogFooter className="marketing-dialog-footer">
            <button type="button" onClick={() => setSlideDrawerOpen(false)} className={secondaryActionButtonClass}>Cancel</button>
            <button type="button" onClick={saveSlideDraft} className={primaryActionButtonClass}>Save</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={offerDrawerOpen}
        onOpenChange={setOfferDrawerOpen}
      >
        <DialogContent className="marketing-dialog-content max-w-4xl max-h-[92vh] overflow-y-auto p-0">
          <DialogHeader className="marketing-dialog-header">
            <DialogTitle className="text-base font-semibold text-gray-900">{offerEditingIndex === null ? 'Add Promotional Offer' : 'Edit Promotional Offer'}</DialogTitle>
            <DialogDescription className="marketing-dialog-description">Changes are local until you click Save Offers.</DialogDescription>
          </DialogHeader>
          <div className="marketing-dialog-body space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Title</label>
              <input value={offerForm.title} onChange={(event) => setOfferForm((current) => ({ ...current, title: event.target.value }))} className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Subtitle</label>
              <input value={offerForm.subtitle} onChange={(event) => setOfferForm((current) => ({ ...current, subtitle: event.target.value }))} className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Description</label>
            <textarea value={offerForm.description} rows={3} onChange={(event) => setOfferForm((current) => ({ ...current, description: event.target.value }))} className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Image URL</label>
              <input value={offerForm.imageUrl} onChange={(event) => setOfferForm((current) => ({ ...current, imageUrl: event.target.value }))} className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Image File ID</label>
              <input value={offerForm.imageFileId} onChange={(event) => setOfferForm((current) => ({ ...current, imageFileId: event.target.value }))} className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Upload Image</label>
            <label className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 flex items-center justify-between gap-2 cursor-pointer hover:border-gray-300 transition-colors">
              <span className="truncate">{offerForm.imageFile ? offerForm.imageFile.name : 'Choose image'}</span>
              <Upload className="w-4 h-4" />
              <input type="file" accept="image/*" onChange={(event) => setOfferForm((current) => ({ ...current, imageFile: event.target.files?.[0] ?? null }))} className="hidden" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Link URL</label>
              <input value={offerForm.linkUrl} onChange={(event) => setOfferForm((current) => ({ ...current, linkUrl: event.target.value }))} className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Priority</label>
              <input type="number" min={1} value={offerForm.priority} onChange={(event) => setOfferForm((current) => ({ ...current, priority: event.target.value }))} className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Start</label>
              <input type="datetime-local" value={offerForm.startAtLocal} onChange={(event) => setOfferForm((current) => ({ ...current, startAtLocal: event.target.value }))} className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label className="text-xs text-gray-500">End</label>
              <input type="datetime-local" value={offerForm.endAtLocal} onChange={(event) => setOfferForm((current) => ({ ...current, endAtLocal: event.target.value }))} className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Status</label>
            <select value={offerForm.active ? 'ACTIVE' : 'INACTIVE'} onChange={(event) => setOfferForm((current) => ({ ...current, active: event.target.value === 'ACTIVE' }))} className="mt-1 w-40 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-500/50 appearance-none">
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          </div>
          <DialogFooter className="marketing-dialog-footer">
            <button type="button" onClick={() => setOfferDrawerOpen(false)} className={secondaryActionButtonClass}>Cancel</button>
            <button type="button" onClick={() => void saveOfferDraft()} disabled={offerSaving} className={`${primaryActionButtonClass} disabled:opacity-60`}>{offerSaving ? 'Saving...' : 'Save'}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
