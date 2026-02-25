import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { extractApiErrorMessage } from '../../lib/http';
import {
  cacheBrandConfig,
  defaultBrand,
  fetchMobileAppConfig,
  readCachedBrandConfig,
} from './service';
import type { BrandConfig } from './types';

type BrandingContextValue = {
  brand: BrandConfig;
  isBootstrapping: boolean;
  errorMessage: string | null;
  refreshBranding: () => Promise<void>;
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrand] = useState<BrandConfig>(defaultBrand);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshBranding = useCallback(async () => {
    try {
      const config = await fetchMobileAppConfig();
      setBrand({ ...defaultBrand, ...(config.brand ?? {}) });
      setErrorMessage(null);
      await cacheBrandConfig(config);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = await readCachedBrandConfig();
        if (!cancelled && cached?.brand) {
          setBrand({ ...defaultBrand, ...(cached.brand ?? {}) });
        }
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
      if (!cancelled) {
        void refreshBranding();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshBranding]);

  const value = useMemo<BrandingContextValue>(
    () => ({
      brand,
      isBootstrapping,
      errorMessage,
      refreshBranding,
    }),
    [brand, errorMessage, isBootstrapping, refreshBranding],
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error('useBranding must be used inside BrandingProvider');
  return ctx;
}

