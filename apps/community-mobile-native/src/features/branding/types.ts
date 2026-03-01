export type BrandConfig = {
  companyName: string;
  appDisplayName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  logoFileId?: string | null;
  logoPath?: string | null;
  logoUrl?: string | null;
  tagline?: string;
  supportEmail?: string;
  supportPhone?: string;
};

export type OnboardingSlide = {
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
};

export type OnboardingConfig = {
  enabled: boolean;
  slides: OnboardingSlide[];
};

export type OfferBanner = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  imageFileId?: string;
  linkUrl?: string;
  priority?: number;
  active?: boolean;
  startAt?: string;
  endAt?: string;
};

export type OffersConfig = {
  enabled: boolean;
  banners: OfferBanner[];
};

export type MobileAppConfig = {
  brand: BrandConfig;
  onboarding?: OnboardingConfig;
  offers?: OffersConfig;
  capabilities?: {
    push?: boolean;
    smsOtp?: boolean;
    smtpMail?: boolean;
    s3Storage?: boolean;
  };
  meta?: {
    version?: number;
    updatedAt?: string | null;
    onboardingUpdatedAt?: string | null;
    offersUpdatedAt?: string | null;
  };
};
