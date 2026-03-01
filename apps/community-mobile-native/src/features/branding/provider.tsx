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
  defaultOnboarding,
  defaultOffers,
  fetchMobileAppConfig,
  readCachedBrandConfig,
} from './service';
import type { BrandConfig, OnboardingConfig, OffersConfig } from './types';

type BrandingContextValue = {
  brand: BrandConfig;
  capabilities: {
    push: boolean;
    smsOtp: boolean;
    smtpMail: boolean;
    s3Storage: boolean;
  };
  onboarding: OnboardingConfig;
  offers: OffersConfig;
  isBootstrapping: boolean;
  errorMessage: string | null;
  refreshBranding: () => Promise<void>;
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrand] = useState<BrandConfig>(defaultBrand);
  const [onboarding, setOnboarding] = useState<OnboardingConfig>(defaultOnboarding);
  const [offers, setOffers] = useState<OffersConfig>(defaultOffers);
  const [capabilities, setCapabilities] = useState({
    push: false,
    smsOtp: false,
    smtpMail: false,
    s3Storage: false,
  });
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshBranding = useCallback(async () => {
    try {
      const config = await fetchMobileAppConfig();
      setBrand({ ...defaultBrand, ...(config.brand ?? {}) });
      setOnboarding(config.onboarding ?? defaultOnboarding);
      setOffers(config.offers ?? defaultOffers);
      setCapabilities({
        push: Boolean(config.capabilities?.push),
        smsOtp: Boolean(config.capabilities?.smsOtp),
        smtpMail: Boolean(config.capabilities?.smtpMail),
        s3Storage: Boolean(config.capabilities?.s3Storage),
      });
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
          setOnboarding(cached.onboarding ?? defaultOnboarding);
          setOffers(cached.offers ?? defaultOffers);
          setCapabilities({
            push: Boolean(cached.capabilities?.push),
            smsOtp: Boolean(cached.capabilities?.smsOtp),
            smtpMail: Boolean(cached.capabilities?.smtpMail),
            s3Storage: Boolean(cached.capabilities?.s3Storage),
          });
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
      capabilities,
      onboarding,
      offers,
      isBootstrapping,
      errorMessage,
      refreshBranding,
    }),
    [
      brand,
      capabilities,
      onboarding,
      offers,
      errorMessage,
      isBootstrapping,
      refreshBranding,
    ],
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error('useBranding must be used inside BrandingProvider');
  return ctx;
}
