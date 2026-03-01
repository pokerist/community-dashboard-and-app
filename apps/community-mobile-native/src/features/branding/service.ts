import * as SecureStore from 'expo-secure-store';
import { http } from '../../lib/http';
import type {
  BrandConfig,
  MobileAppConfig,
  OnboardingConfig,
  OffersConfig,
} from './types';

const BRAND_CACHE_KEY = 'mobile_brand_config_v1';

export const defaultBrand: BrandConfig = {
  companyName: 'SSS Community',
  appDisplayName: 'SSS Community',
  primaryColor: '#2A3E35',
  secondaryColor: '#C9A961',
  accentColor: '#0B5FFF',
  tagline: 'Smart Living',
  logoFileId: null,
  logoPath: null,
  logoUrl: null,
  supportEmail: '',
  supportPhone: '',
};

export const defaultOnboarding: OnboardingConfig = {
  enabled: true,
  slides: [
    {
      title: 'Welcome to SSS Community',
      subtitle: 'SMART LIVING',
      description:
        'Experience premium living with services, payments, visitors, and community updates in one place.',
      imageUrl:
        'https://images.unsplash.com/photo-1560613654-ea1945efc370?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    },
    {
      title: 'Manage Your Compound',
      subtitle: 'ALL IN ONE',
      description:
        'Access your units, track requests, and stay connected with your community management team.',
      imageUrl:
        'https://images.unsplash.com/photo-1643892605308-70a6559cfd0a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    },
    {
      title: 'Secure & Connected',
      subtitle: 'ALWAYS INFORMED',
      description:
        'Generate access QR codes, view important notices, and receive trusted in-app updates.',
      imageUrl:
        'https://images.unsplash.com/photo-1633194883650-df448a10d554?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    },
  ],
};

export const defaultOffers: OffersConfig = {
  enabled: false,
  banners: [],
};

function normalizeOffers(raw: MobileAppConfig['offers']): OffersConfig {
  if (!raw || typeof raw !== 'object') return defaultOffers;
  const banners = Array.isArray(raw.banners)
    ? raw.banners
        .map((banner, index) => ({
          id: String(banner?.id ?? `offer-${index + 1}`).trim() || `offer-${index + 1}`,
          title: String(banner?.title ?? '').trim(),
          subtitle: String(banner?.subtitle ?? '').trim() || undefined,
          description: String(banner?.description ?? '').trim() || undefined,
          imageUrl: String(banner?.imageUrl ?? '').trim() || undefined,
          imageFileId: String(banner?.imageFileId ?? '').trim() || undefined,
          linkUrl: String(banner?.linkUrl ?? '').trim() || undefined,
          startAt: String(banner?.startAt ?? '').trim() || undefined,
          endAt: String(banner?.endAt ?? '').trim() || undefined,
          priority:
            typeof banner?.priority === 'number' && Number.isFinite(banner.priority)
              ? banner.priority
              : index + 1,
          active: banner?.active !== false,
        }))
        .filter((banner) => banner.title && (banner.imageUrl || banner.imageFileId))
        .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
    : [];
  return {
    enabled: raw.enabled === true,
    banners,
  };
}

function normalizeOnboarding(raw: MobileAppConfig['onboarding']): OnboardingConfig {
  if (!raw || typeof raw !== 'object') return defaultOnboarding;
  const slides = Array.isArray(raw.slides)
    ? raw.slides
        .map((slide) => ({
          title: String(slide?.title ?? '').trim(),
          subtitle: String(slide?.subtitle ?? '').trim() || undefined,
          description: String(slide?.description ?? '').trim() || undefined,
          imageUrl: String(slide?.imageUrl ?? '').trim() || undefined,
        }))
        .filter((slide) => slide.title)
    : [];
  return {
    enabled: raw.enabled !== false,
    slides: slides.length > 0 ? slides : defaultOnboarding.slides,
  };
}

export async function fetchMobileAppConfig(): Promise<MobileAppConfig> {
  const response = await http.get<MobileAppConfig>('/mobile/app-config');
  const data = response.data ?? { brand: defaultBrand };
  return {
    ...data,
    brand: {
      ...defaultBrand,
      ...(data.brand ?? {}),
    },
    onboarding: normalizeOnboarding(data.onboarding),
    offers: normalizeOffers(data.offers),
    capabilities: {
      push: Boolean(data.capabilities?.push),
      smsOtp: Boolean(data.capabilities?.smsOtp),
      smtpMail: Boolean(data.capabilities?.smtpMail),
      s3Storage: Boolean(data.capabilities?.s3Storage),
    },
  };
}

export async function readCachedBrandConfig(): Promise<MobileAppConfig | null> {
  try {
    const raw = await SecureStore.getItemAsync(BRAND_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MobileAppConfig;
    return {
      ...parsed,
      brand: {
        ...defaultBrand,
        ...(parsed.brand ?? {}),
      },
      onboarding: normalizeOnboarding(parsed.onboarding),
      offers: normalizeOffers(parsed.offers),
      capabilities: {
        push: Boolean(parsed.capabilities?.push),
        smsOtp: Boolean(parsed.capabilities?.smsOtp),
        smtpMail: Boolean(parsed.capabilities?.smtpMail),
        s3Storage: Boolean(parsed.capabilities?.s3Storage),
      },
    };
  } catch {
    return null;
  }
}

export async function cacheBrandConfig(config: MobileAppConfig) {
  try {
    await SecureStore.setItemAsync(BRAND_CACHE_KEY, JSON.stringify(config));
  } catch {
    // Best-effort cache only.
  }
}
