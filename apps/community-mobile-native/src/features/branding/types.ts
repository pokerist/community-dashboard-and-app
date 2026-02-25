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

export type MobileAppConfig = {
  brand: BrandConfig;
  meta?: {
    version?: number;
    updatedAt?: string | null;
  };
};

