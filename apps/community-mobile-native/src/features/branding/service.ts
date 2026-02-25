import * as SecureStore from 'expo-secure-store';
import { http } from '../../lib/http';
import type { BrandConfig, MobileAppConfig } from './types';

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

export async function fetchMobileAppConfig(): Promise<MobileAppConfig> {
  const response = await http.get<MobileAppConfig>('/mobile/app-config');
  const data = response.data ?? { brand: defaultBrand };
  return {
    ...data,
    brand: {
      ...defaultBrand,
      ...(data.brand ?? {}),
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
