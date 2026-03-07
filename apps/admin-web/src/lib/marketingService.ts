import apiClient from './api-client';

export type ReferralStatus = 'NEW' | 'CONTACTED' | 'CONVERTED' | 'REJECTED';

export type MarketingStats = {
  totalProjects: number;
  totalReferrals: number;
  newReferrals: number;
  contactedReferrals: number;
  convertedReferrals: number;
  rejectedReferrals: number;
};

export type MarketingProject = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  descriptionEn: string;
  descriptionAr: string | null;
  mobileNumber: string;
  createdAt: string;
  updatedAt: string;
};

export type MarketingReferral = {
  id: string;
  friendFullName: string;
  friendMobile: string;
  message: string | null;
  status: ReferralStatus;
  createdAt: string;
  referrer: {
    id: string;
    name: string;
    phone: string | null;
  };
  convertedUser: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
};

export type MarketingReferralListResponse = {
  data: MarketingReferral[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type ListMarketingReferralsParams = {
  page?: number;
  limit?: number;
  status?: ReferralStatus;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
};

export type CreateMarketingProjectPayload = {
  nameEn: string;
  nameAr?: string;
  descriptionEn: string;
  descriptionAr?: string;
  mobileNumber: string;
};

export type UpdateMarketingProjectPayload = Partial<CreateMarketingProjectPayload>;

export type BannerAudience =
  | 'ALL'
  | 'SPECIFIC_RESIDENCES'
  | 'SPECIFIC_BLOCKS'
  | 'SPECIFIC_UNITS';

export type BannerStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED';

export type BannerPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type CampaignBanner = {
  id: string;
  titleEn: string;
  titleAr: string | null;
  imageFileId: string | null;
  description: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  targetAudience: BannerAudience;
  audienceMeta: Record<string, unknown> | null;
  startDate: string;
  endDate: string;
  status: BannerStatus;
  displayPriority: BannerPriority;
  views: number;
  clicks: number;
  ctr: number;
  createdAt: string;
  updatedAt: string;
};

export type ListCampaignsParams = {
  status?: BannerStatus;
  q?: string;
  activeOnly?: boolean;
  page?: number;
  limit?: number;
};

export type ListCampaignsResponse = {
  data: CampaignBanner[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type UpsertCampaignPayload = {
  titleEn: string;
  titleAr?: string;
  imageFileId?: string;
  description?: string;
  ctaText?: string;
  ctaUrl?: string;
  targetAudience: BannerAudience;
  audienceMeta?: Record<string, unknown>;
  startDate: string;
  endDate: string;
  status?: BannerStatus;
  displayPriority?: BannerPriority;
  views?: number;
  clicks?: number;
};

export type OnboardingSlide = {
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
};

export type OnboardingSettings = {
  enabled: boolean;
  slides: OnboardingSlide[];
};

export type OfferBanner = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  imageFileId: string;
  linkUrl: string;
  priority: number;
  active: boolean;
  startAt: string;
  endAt: string;
};

export type OffersSettings = {
  enabled: boolean;
  banners: OfferBanner[];
};

export type MarketingSettingsSnapshot = {
  onboarding: OnboardingSettings;
  offers: OffersSettings;
};

export type UpdateOnboardingPayload = {
  enabled?: boolean;
  slides?: OnboardingSlide[];
};

export type UpdateOffersPayload = {
  enabled?: boolean;
  banners?: OfferBanner[];
};

type UploadedFileResponse = {
  id: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toStringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toBooleanValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function toNumberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeOnboardingSettings(source: unknown): OnboardingSettings {
  const record = isRecord(source) ? source : {};
  const slidesRaw = Array.isArray(record.slides) ? record.slides : [];

  const slides: OnboardingSlide[] = slidesRaw
    .filter(isRecord)
    .map((slide) => ({
      title: toStringValue(slide.title),
      subtitle: toStringValue(slide.subtitle),
      description: toStringValue(slide.description),
      imageUrl: toStringValue(slide.imageUrl),
    }));

  return {
    enabled: toBooleanValue(record.enabled, true),
    slides,
  };
}

function normalizeOffersSettings(source: unknown): OffersSettings {
  const record = isRecord(source) ? source : {};
  const bannersRaw = Array.isArray(record.banners) ? record.banners : [];

  const banners: OfferBanner[] = bannersRaw
    .filter(isRecord)
    .map((banner, index) => ({
      id: toStringValue(banner.id) || `offer-${index + 1}`,
      title: toStringValue(banner.title),
      subtitle: toStringValue(banner.subtitle),
      description: toStringValue(banner.description),
      imageUrl: toStringValue(banner.imageUrl),
      imageFileId: toStringValue(banner.imageFileId),
      linkUrl: toStringValue(banner.linkUrl),
      priority: toNumberValue(banner.priority, index + 1),
      active: toBooleanValue(banner.active, true),
      startAt: toStringValue(banner.startAt),
      endAt: toStringValue(banner.endAt),
    }));

  return {
    enabled: toBooleanValue(record.enabled, false),
    banners,
  };
}

function normalizeMarketingSnapshot(payload: unknown): MarketingSettingsSnapshot {
  const root = isRecord(payload) ? payload : {};
  const data = isRecord(root.data) ? root.data : {};
  return {
    onboarding: normalizeOnboardingSettings(data.onboarding),
    offers: normalizeOffersSettings(data.offers),
  };
}

function normalizeUpdatedSectionData(payload: unknown): unknown {
  const root = isRecord(payload) ? payload : {};
  return root.data;
}

const marketingService = {
  async getStats(): Promise<MarketingStats> {
    const response = await apiClient.get<MarketingStats>('/marketing/stats');
    return response.data;
  },

  async listProjects(): Promise<MarketingProject[]> {
    const response = await apiClient.get<MarketingProject[]>('/marketing/projects');
    return Array.isArray(response.data) ? response.data : [];
  },

  async createProject(
    payload: CreateMarketingProjectPayload,
  ): Promise<MarketingProject> {
    const response = await apiClient.post<MarketingProject>(
      '/marketing/projects',
      payload,
    );
    return response.data;
  },

  async updateProject(
    projectId: string,
    payload: UpdateMarketingProjectPayload,
  ): Promise<MarketingProject> {
    const response = await apiClient.patch<MarketingProject>(
      `/marketing/projects/${projectId}`,
      payload,
    );
    return response.data;
  },

  async listReferrals(
    params: ListMarketingReferralsParams,
  ): Promise<MarketingReferralListResponse> {
    const response = await apiClient.get<MarketingReferralListResponse>(
      '/marketing/referrals',
      { params },
    );
    return response.data;
  },

  async updateReferralStatus(
    referralId: string,
    status: ReferralStatus,
  ): Promise<MarketingReferral> {
    const response = await apiClient.patch<MarketingReferral>(
      `/marketing/referrals/${referralId}/status`,
      { status },
    );
    return response.data;
  },

  async listCampaigns(
    params: ListCampaignsParams = {},
  ): Promise<ListCampaignsResponse> {
    const response = await apiClient.get<ListCampaignsResponse>('/banners', { params });
    return response.data;
  },

  async createCampaign(
    payload: UpsertCampaignPayload,
  ): Promise<CampaignBanner> {
    const response = await apiClient.post<CampaignBanner>('/banners', payload);
    return response.data;
  },

  async updateCampaign(
    bannerId: string,
    payload: Partial<UpsertCampaignPayload>,
  ): Promise<CampaignBanner> {
    const response = await apiClient.patch<CampaignBanner>(`/banners/${bannerId}`, payload);
    return response.data;
  },

  async updateCampaignStatus(
    bannerId: string,
    status: BannerStatus,
  ): Promise<CampaignBanner> {
    const response = await apiClient.patch<CampaignBanner>(`/banners/${bannerId}/status`, {
      status,
    });
    return response.data;
  },

  async deleteCampaign(bannerId: string): Promise<{ success: boolean }> {
    const response = await apiClient.delete<{ success: boolean }>(`/banners/${bannerId}`);
    return response.data;
  },

  async uploadCampaignImage(file: File): Promise<UploadedFileResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<UploadedFileResponse>(
      '/files/upload/service-attachment',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
    return response.data;
  },

  async uploadOfferImage(file: File): Promise<UploadedFileResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<UploadedFileResponse>(
      '/files/upload/offer-banner',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
    return response.data;
  },

  async getMarketingSettings(): Promise<MarketingSettingsSnapshot> {
    const response = await apiClient.get<unknown>('/system-settings');
    return normalizeMarketingSnapshot(response.data);
  },

  async updateOnboarding(
    payload: UpdateOnboardingPayload,
  ): Promise<OnboardingSettings> {
    const response = await apiClient.patch<unknown>('/system-settings/onboarding', payload);
    return normalizeOnboardingSettings(normalizeUpdatedSectionData(response.data));
  },

  async updateOffers(payload: UpdateOffersPayload): Promise<OffersSettings> {
    const response = await apiClient.patch<unknown>('/system-settings/offers', payload);
    return normalizeOffersSettings(normalizeUpdatedSectionData(response.data));
  },
};

export default marketingService;
