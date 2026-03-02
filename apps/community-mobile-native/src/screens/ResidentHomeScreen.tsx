import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DemoPaymentModal } from '../components/mobile/DemoPaymentModal';
import { useAppToast } from '../components/mobile/AppToast';
import { InAppWebViewerModal } from '../components/mobile/InAppWebViewerModal';
import { UnitPickerSheet } from '../components/mobile/UnitPickerSheet';
import { API_BASE_URL } from '../config/env';
import type { AuthBootstrapProfile, AuthSession } from '../features/auth/types';
import { useBranding } from '../features/branding/provider';
import { getBrandPalette } from '../features/branding/palette';
import { useI18n } from '../features/i18n/provider';
import {
  listAccessQrs,
  listMobileBanners,
  listMyBookings,
  listMyComplaints,
  listMyInvoices,
  listMyServiceRequests,
  listMyViolations,
  simulateInvoiceSelfPayment,
} from '../features/community/service';
import type {
  AccessQrRow,
  Booking,
  ComplaintRow,
  InvoiceRow,
  MobileBanner,
  PayableItem,
  ResidentUnit,
  ServiceRequestRow,
  ViolationRow,
} from '../features/community/types';
import { buildPayables, filterPayablesByUnit } from '../features/community/payables';
import { useNotificationRealtime } from '../features/notifications/realtime';
import {
  communityUpdateTitle,
  isPersonalNotification,
  isCommunityUpdateNotification,
} from '../features/notifications/presentation';
import { extractApiErrorMessage } from '../lib/http';
import { akColors, akRadius, akShadow } from '../theme/alkarma';
import { formatCurrency, formatDateTime } from '../utils/format';

type ResidentHomeScreenProps = {
  session: AuthSession;
  units: ResidentUnit[];
  selectedUnitId: string | null;
  selectedUnit: ResidentUnit | null;
  unitsLoading: boolean;
  unitsRefreshing: boolean;
  unitsErrorMessage: string | null;
  onSelectUnit: (unitId: string) => void;
  onRefreshUnits: () => Promise<void>;
  onOpenNotifications: () => void;
  onOpenCommunityUpdates: () => void;
  onOpenMenu: () => void;
  onOpenBookings: () => void;
  onOpenServices: () => void;
  onOpenRequests: () => void;
  onOpenComplaints: () => void;
  onOpenQr: () => void;
  onOpenFinance: () => void;
  onOpenProfileTab: () => void;
  bootstrapProfile?: AuthBootstrapProfile | null;
};

function normalizeExternalUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function dayGreetingKey(now = new Date()): string {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return 'home.greeting.morning';
  if (hour >= 12 && hour < 17) return 'home.greeting.afternoon';
  if (hour >= 17 && hour < 22) return 'home.greeting.evening';
  return 'home.greeting.night';
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '').trim();
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => `${c}${c}`)
          .join('')
      : normalized;
  const r = Number.parseInt(expanded.slice(0, 2), 16);
  const g = Number.parseInt(expanded.slice(2, 4), 16);
  const b = Number.parseInt(expanded.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return `rgba(42,62,53,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function ResidentHomeScreen({
  session,
  units,
  selectedUnitId,
  selectedUnit,
  unitsLoading,
  unitsRefreshing,
  unitsErrorMessage,
  onSelectUnit,
  onRefreshUnits,
  onOpenNotifications,
  onOpenCommunityUpdates,
  onOpenMenu,
  onOpenBookings,
  onOpenServices,
  onOpenRequests,
  onOpenComplaints,
  onOpenQr,
  onOpenFinance,
  onOpenProfileTab,
  bootstrapProfile,
}: ResidentHomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const isTabletLayout = viewportWidth >= 768;
  const horizontalPadding = isTabletLayout ? 20 : 16;
  const contentMaxWidth = isTabletLayout ? Math.min(980, viewportWidth - 24) : undefined;
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [snapshotRefreshing, setSnapshotRefreshing] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [snapshotRows, setSnapshotRows] = useState<{
    bookings: Booking[];
    serviceRequests: ServiceRequestRow[];
    complaints: ComplaintRow[];
    accessQrs: AccessQrRow[];
    invoices: InvoiceRow[];
    violations: ViolationRow[];
  }>({
    bookings: [],
    serviceRequests: [],
    complaints: [],
    accessQrs: [],
    invoices: [],
    violations: [],
  });
  const [homeBanners, setHomeBanners] = useState<MobileBanner[]>([]);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [bannerViewportWidth, setBannerViewportWidth] = useState(0);
  const [bannerImageErrors, setBannerImageErrors] = useState<Record<string, boolean>>({});
  const [activePaymentItem, setActivePaymentItem] = useState<PayableItem | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [unitSheetOpen, setUnitSheetOpen] = useState(false);
  const [smartHomeModalVisible, setSmartHomeModalVisible] = useState(false);
  const [offersModalVisible, setOffersModalVisible] = useState(false);
  const [activeOfferId, setActiveOfferId] = useState<string | null>(null);
  const [webViewerState, setWebViewerState] = useState<{
    visible: boolean;
    url: string | null;
    title: string;
  }>({
    visible: false,
    url: null,
    title: '',
  });
  const bannerScrollRef = useRef<ScrollView | null>(null);
  const offerShownRef = useRef(false);
  const toast = useAppToast();
  const { t } = useI18n();
  const { brand, offers } = useBranding();
  const palette = getBrandPalette(brand);
  const brandPrimary = palette.primary;
  const brandPrimaryDark = palette.primaryDark;
  const brandSecondary = palette.secondary;
  const brandAccent = palette.accent;

  const notifications = useNotificationRealtime();

  const activeOffers = useMemo(
    () => {
      const now = Date.now();
      return (offers?.enabled ? offers.banners : [])
        .filter((banner) => banner.active !== false)
        .filter((banner) => {
          const startTs = banner.startAt ? Date.parse(banner.startAt) : NaN;
          const endTs = banner.endAt ? Date.parse(banner.endAt) : NaN;
          if (Number.isFinite(startTs) && startTs > now) return false;
          if (Number.isFinite(endTs) && endTs < now) return false;
          return true;
        })
        .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    },
    [offers],
  );
  const activeOffer = useMemo(
    () => activeOffers.find((offer) => offer.id === activeOfferId) ?? activeOffers[0] ?? null,
    [activeOfferId, activeOffers],
  );

  useEffect(() => {
    if (offerShownRef.current) return;
    if (!activeOffers.length) return;
    offerShownRef.current = true;
    setActiveOfferId(activeOffers[0].id);
    setOffersModalVisible(true);
  }, [activeOffers]);

  const loadSnapshot = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setSnapshotLoading(true);
      else setSnapshotRefreshing(true);
      setSnapshotError(null);
      setBannerError(null);

      const results = await Promise.allSettled([
        listMyBookings(session.accessToken),
        listMyServiceRequests(session.accessToken),
        listMyComplaints(session.accessToken),
        listAccessQrs(session.accessToken, { includeInactive: true }),
        listMyInvoices(session.accessToken),
        listMyViolations(session.accessToken),
        listMobileBanners(session.accessToken, { unitId: selectedUnitId }),
      ]);

      const firstError = results
        .slice(0, 6)
        .find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
      if (firstError) {
        setSnapshotError(extractApiErrorMessage(firstError.reason));
      }
      if (results[6].status === 'rejected') {
        setBannerError(extractApiErrorMessage(results[6].reason));
      }

      setSnapshotRows({
        bookings: results[0].status === 'fulfilled' ? results[0].value : [],
        serviceRequests: results[1].status === 'fulfilled' ? results[1].value : [],
        complaints: results[2].status === 'fulfilled' ? results[2].value : [],
        accessQrs: results[3].status === 'fulfilled' ? results[3].value : [],
        invoices: results[4].status === 'fulfilled' ? results[4].value : [],
        violations: results[5].status === 'fulfilled' ? results[5].value : [],
      });
      const nextBanners =
        results[6].status === 'fulfilled' ? results[6].value.data ?? [] : [];
      setHomeBanners(nextBanners);
      setBannerIndex((prev) => {
        if (!nextBanners.length) return 0;
        return Math.min(prev, Math.max(nextBanners.length - 1, 0));
      });

      setSnapshotLoading(false);
      setSnapshotRefreshing(false);
    },
    [selectedUnitId, session.accessToken],
  );

  useEffect(() => {
    void loadSnapshot('initial');
  }, [loadSnapshot]);

  const snapshotMetrics = useMemo(() => {
    const filterByUnit = <T extends { unitId?: string | null }>(rows: T[]) =>
      selectedUnitId ? rows.filter((r) => r.unitId === selectedUnitId) : rows;

    const bookings = filterByUnit(snapshotRows.bookings);
    const serviceRequests = filterByUnit(snapshotRows.serviceRequests);
    const complaints = filterByUnit(snapshotRows.complaints);
    const accessQrs = filterByUnit(snapshotRows.accessQrs);
    const invoices = filterByUnit(snapshotRows.invoices);
    const violations = filterByUnit(snapshotRows.violations);

    return {
      bookingsUpcoming: bookings.filter((b) =>
        ['PENDING', 'APPROVED'].includes(String(b.status).toUpperCase()),
      ).length,
      openRequests: serviceRequests.filter((r) =>
        ['NEW', 'IN_PROGRESS', 'ASSIGNED', 'PENDING'].includes(String(r.status).toUpperCase()),
      ).length,
      complaintsOpen: complaints.filter((c) =>
        !['RESOLVED', 'CLOSED'].includes(String(c.status).toUpperCase()),
      ).length,
      activeQrs: accessQrs.filter((q) => String(q.status).toUpperCase() === 'ACTIVE').length,
      pendingInvoices: invoices.filter((i) =>
        ['PENDING', 'OVERDUE'].includes(String(i.status).toUpperCase()),
      ).length,
      violationsOpen: violations.filter((v) =>
        !['RESOLVED', 'WAIVED', 'CLOSED', 'PAID'].includes(String(v.status).toUpperCase()),
      ).length,
    };
  }, [selectedUnitId, snapshotRows]);

  const activeBanner = homeBanners[bannerIndex] ?? null;
  const activeBannerImageUri =
    activeBanner?.imagePublicPath
      ? `${API_BASE_URL}${activeBanner.imagePublicPath}?v=${encodeURIComponent(
          activeBanner.updatedAt || activeBanner.createdAt || activeBanner.id,
        )}`
      : activeBanner?.imageStreamPath
        ? `${API_BASE_URL}${activeBanner.imageStreamPath}?v=${encodeURIComponent(
            activeBanner.updatedAt || activeBanner.createdAt || activeBanner.id,
          )}`
        : activeBanner?.imageFileId
          ? `${API_BASE_URL}/files/public/banner-image/${activeBanner.imageFileId}?v=${encodeURIComponent(
              activeBanner.id,
            )}`
          : null;
  const bannerPageWidth = Math.max(0, bannerViewportWidth - 28);

  const scrollToBanner = useCallback(
    (index: number) => {
      setBannerIndex(index);
      if (!bannerPageWidth) return;
      bannerScrollRef.current?.scrollTo({
        x: bannerPageWidth * index,
        animated: true,
      });
    },
    [bannerPageWidth],
  );

  const handleBannerMomentumEnd = useCallback(
    (event: any) => {
      if (!bannerPageWidth || homeBanners.length <= 1) return;
      const x = Number(event?.nativeEvent?.contentOffset?.x ?? 0);
      const nextIndex = Math.min(
        homeBanners.length - 1,
        Math.max(0, Math.round(x / bannerPageWidth)),
      );
      setBannerIndex(nextIndex);
    },
    [bannerPageWidth, homeBanners.length],
  );

  const featureFlags = bootstrapProfile?.featureAvailability;
  const isPreDeliveryUnit = String(selectedUnit?.status ?? '')
    .toUpperCase()
    .includes('NOT_DELIVERED');
  const selectedUnitAccesses = selectedUnit?.unitAccesses ?? [];
  const canBookFacilitiesByUnit =
    selectedUnitAccesses.length === 0 ||
    selectedUnitAccesses.some((access) => access.canBookFacilities !== false);
  const canViewFinanceByUnit =
    selectedUnitAccesses.length === 0 ||
    selectedUnitAccesses.some(
      (access) =>
        Boolean(access.canViewFinancials) || Boolean(access.canReceiveBilling),
    );

  const baseQuickActions = [
    {
      key: 'bookings',
      title: t('drawer.bookings'),
      subtitle: t('tabs.home'),
      bg: 'rgba(59,130,246,0.10)',
      iconColor: '#2563EB',
      icon: <Ionicons name="calendar-outline" size={20} color="#2563EB" />,
      onPress: onOpenBookings,
    },
    {
      key: 'services',
      title: t('drawer.services'),
      subtitle: t('home.communityUpdatesTitle'),
      bg: hexToRgba(brandPrimary, 0.10),
      iconColor: '#EA580C',
      icon: <Ionicons name="construct-outline" size={20} color="#EA580C" />,
      onPress: onOpenServices,
    },
    {
      key: 'requests',
      title: t('drawer.requests'),
      subtitle: t('drawer.manageHousehold'),
      bg: hexToRgba(brandSecondary, 0.14),
      iconColor: '#9333EA',
      icon: <Ionicons name="file-tray-outline" size={20} color="#9333EA" />,
      onPress: onOpenRequests,
    },
    {
      key: 'smart-home',
      title: t('home.smartHomeTitle'),
      subtitle: t('home.quickAccess'),
      bg: hexToRgba(brandAccent, 0.10),
      iconColor: brandPrimary,
      icon: <Ionicons name="home-outline" size={20} color={brandPrimary} />,
      onPress: () => setSmartHomeModalVisible(true),
    },
    {
      key: 'finance',
      title: t('drawer.payments'),
      subtitle: t('home.upcomingPayments'),
      bg: hexToRgba(brandSecondary, 0.14),
      iconColor: brandSecondary,
      icon: <Ionicons name="card-outline" size={20} color={brandSecondary} />,
      onPress: onOpenFinance,
    },
    {
      key: 'profile',
      title: t('tabs.profile'),
      subtitle: t('profile.title'),
      bg: hexToRgba(brandPrimary, 0.10),
      iconColor: brandPrimary,
      icon: <Ionicons name="person-outline" size={20} color={brandPrimary} />,
      onPress: onOpenProfileTab,
    },
  ];

  const quickActions = baseQuickActions
    .filter((action) => {
      switch (action.key) {
        case 'bookings':
          return (
            !isPreDeliveryUnit &&
            (featureFlags?.canUseBookings ?? true) &&
            canBookFacilitiesByUnit
          );
        case 'services':
          return !isPreDeliveryUnit && (featureFlags?.canUseServices ?? true);
        case 'complaints':
          return featureFlags?.canUseComplaints ?? true;
        case 'requests':
          return !isPreDeliveryUnit && (featureFlags?.canUseRequests ?? true);
        case 'smart-home':
          return true;
        case 'finance':
          return (
            !isPreDeliveryUnit &&
            (featureFlags?.canViewFinance ?? true) &&
            canViewFinanceByUnit
          );
        default:
          return true;
      }
    });

  const greetingName =
    bootstrapProfile?.user?.nameEN?.trim() ||
    bootstrapProfile?.user?.nameAR?.trim() ||
    session.email.split('@')[0];
  const greetingPrefix = t(dayGreetingKey());

  const quickAccessTiles = useMemo(
    () =>
      quickActions
        .filter((a) => ['smart-home', 'services', 'requests'].includes(a.key))
        .slice(0, 3),
    [quickActions],
  );

  const communityUpdates = useMemo(
    () =>
      notifications.rows
        .filter((item) => isCommunityUpdateNotification(item))
        .slice(0, 3),
    [notifications.rows],
  );
  const personalUnreadCount = useMemo(
    () => notifications.rows.filter((item) => !item.isRead && isPersonalNotification(item)).length,
    [notifications.rows],
  );
  const upcomingPayments = useMemo(() => {
    if (
      isPreDeliveryUnit ||
      !(featureFlags?.canViewFinance ?? true) ||
      !canViewFinanceByUnit
    ) {
      return [];
    }
    const allPayables = buildPayables(snapshotRows.invoices, snapshotRows.violations);
    return filterPayablesByUnit(allPayables, selectedUnitId).slice(0, 2);
  }, [
    canViewFinanceByUnit,
    featureFlags?.canViewFinance,
    isPreDeliveryUnit,
    selectedUnitId,
    snapshotRows.invoices,
    snapshotRows.violations,
  ]);

  const showPaymentsSection =
    !isPreDeliveryUnit &&
    (featureFlags?.canViewFinance ?? true) &&
    canViewFinanceByUnit;

  const handleConfirmDemoPayment = useCallback(
    async (payload: { paymentMethod: string; cardLast4?: string; notes?: string }) => {
      if (!activePaymentItem?.invoiceId) {
        toast.info(
          t('home.paymentUnavailable'),
          t('home.paymentUnavailableHint'),
        );
        return;
      }
      setIsPaying(true);
      try {
        await simulateInvoiceSelfPayment(
          session.accessToken,
          activePaymentItem.invoiceId,
          payload,
        );
        setActivePaymentItem(null);
        toast.success(t('home.paymentCompleted'), t('home.paymentCompletedHint'));
        await loadSnapshot('refresh');
      } catch (error) {
        toast.error(t('home.paymentFailed'), extractApiErrorMessage(error));
      } finally {
        setIsPaying(false);
      }
    },
    [activePaymentItem, loadSnapshot, session.accessToken, toast],
  );

  const handleOpenBannerCta = useCallback(
    (rawUrl?: string | null, title?: string | null) => {
      const normalized = normalizeExternalUrl(rawUrl);
      if (!normalized) return;
      setWebViewerState({
        visible: true,
        url: normalized,
        title: title?.trim() || t('communityUpdates.communityUpdate'),
      });
    },
    [t],
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: akColors.bg }]}
      edges={['left', 'right', 'bottom']}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: 0,
            paddingBottom: isTabletLayout ? 122 : 102,
            paddingHorizontal: horizontalPadding,
            alignItems: 'center',
          },
        ]}
      >
      <View
        style={[
          styles.contentFrame,
          {
            maxWidth: contentMaxWidth,
            gap: isTabletLayout ? 16 : 14,
          },
        ]}
      >
      <LinearGradient
        colors={[brandPrimary, brandPrimaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.hero,
          {
            marginHorizontal: isTabletLayout ? 0 : -horizontalPadding,
            paddingHorizontal: horizontalPadding,
            paddingTop: Math.max(insets.top, 8) + 10,
            borderTopLeftRadius: isTabletLayout ? 24 : 0,
            borderTopRightRadius: isTabletLayout ? 24 : 0,
          },
        ]}
      >
        <View style={styles.heroTopRow}>
          <Pressable onPress={onOpenMenu} style={styles.heroIconButton}>
            <Ionicons name="menu-outline" size={20} color="#fff" />
          </Pressable>
          <View style={styles.heroRightActions}>
            <Pressable onPress={onOpenNotifications} style={styles.heroIconButton}>
              <Ionicons name="notifications-outline" size={18} color="#fff" />
              {personalUnreadCount > 0 ? (
                <View style={styles.heroBellBadge}>
                  <Text style={styles.heroBellBadgeText}>
                    {personalUnreadCount > 9 ? '9+' : personalUnreadCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              onPress={() => setUnitSheetOpen(true)}
              style={styles.heroUnitPill}
            >
              <Ionicons name="home-outline" size={14} color="#fff" />
              <Text style={styles.heroUnitPillText}>
                {selectedUnit?.unitNumber ?? t('home.myUnit')}
              </Text>
              <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.9)" />
            </Pressable>
          </View>
        </View>

        <Text style={styles.heroTitle}>{greetingPrefix}, {greetingName} 👋</Text>
        <View style={styles.heroWelcomeRow}>
          <Text style={styles.heroSubtitle}>{t('home.welcomeTo')} </Text>
          <Text style={styles.heroBrand}>
            {(selectedUnit?.projectName ?? brand.companyName?.trim()) || 'SSS Community'}
          </Text>
        </View>
        <Text style={styles.heroEmail}>
          {selectedUnit?.block ? `Block ${selectedUnit.block} • ` : ''}
          {selectedUnit?.unitNumber ?? session.email}
        </Text>

        <View style={styles.heroBannerCard}>
          <LinearGradient
            colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']}
            style={styles.heroBannerInner}
            onLayout={(event) => {
              const width = Math.round(event.nativeEvent.layout.width);
              if (width > 0 && width !== bannerViewportWidth) {
                setBannerViewportWidth(width);
              }
            }}
          >
            {activeBanner ? (
              <>
                <ScrollView
                  ref={(ref) => {
                    bannerScrollRef.current = ref;
                  }}
                  horizontal
                  pagingEnabled
                  bounces={false}
                  showsHorizontalScrollIndicator={false}
                  style={styles.heroBannerPager}
                  onMomentumScrollEnd={handleBannerMomentumEnd}
                >
                  {homeBanners.map((banner) => {
                    const bannerImageUri =
                      banner.imagePublicPath
                        ? `${API_BASE_URL}${banner.imagePublicPath}?v=${encodeURIComponent(
                            banner.updatedAt || banner.createdAt || banner.id,
                          )}`
                        : banner.imageStreamPath
                          ? `${API_BASE_URL}${banner.imageStreamPath}?v=${encodeURIComponent(
                              banner.updatedAt || banner.createdAt || banner.id,
                            )}`
                          : banner.imageFileId
                            ? `${API_BASE_URL}/files/public/banner-image/${banner.imageFileId}?v=${encodeURIComponent(
                                banner.id,
                              )}`
                            : null;
                    const isCurrent = banner.id === activeBanner.id;
                    const visualIndex = homeBanners.findIndex((b) => b.id === banner.id);
                    const imageFailed = bannerImageErrors[banner.id] === true;
                    const bannerTitle =
                      banner.titleEn || banner.titleAr || t('communityUpdates.communityUpdate');
                    const bannerLink = normalizeExternalUrl(banner.ctaUrl);
                    const hasBannerLink = Boolean(bannerLink);
                    return (
                      <View
                        key={banner.id}
                        style={[
                          styles.heroBannerSlide,
                          bannerPageWidth > 0 ? { width: bannerPageWidth } : null,
                        ]}
                      >
                        <View style={styles.heroBannerTopRow}>
                          <Text style={[styles.heroBannerTag, { color: brandAccent }]}>
                            {t('home.communityUpdatesTag')}
                          </Text>
                          {homeBanners.length > 1 ? (
                            <Text style={styles.heroBannerCounter}>
                              {(isCurrent ? bannerIndex : visualIndex) + 1}/{homeBanners.length}
                            </Text>
                          ) : null}
                        </View>
                        {bannerImageUri ? (
                          <View style={styles.heroBannerImageWrap}>
                            {!imageFailed ? (
                              <Image
                                source={{ uri: bannerImageUri }}
                                style={styles.heroBannerImage}
                                resizeMode="cover"
                                onError={() =>
                                  setBannerImageErrors((prev) => ({
                                    ...prev,
                                    [banner.id]: true,
                                  }))
                                }
                              />
                            ) : (
                              <View
                                style={[
                                  styles.heroBannerImage,
                                  styles.heroBannerImageFallback,
                                ]}
                              >
                                <Ionicons
                                  name="image-outline"
                                  size={18}
                                  color="rgba(255,255,255,0.72)"
                                />
                                <Text style={styles.heroBannerImageFallbackText}>
                                  {t('home.imageUnavailable')}
                                </Text>
                              </View>
                            )}
                            {hasBannerLink ? (
                              <Pressable
                                style={styles.heroBannerTapLayer}
                                onPress={() =>
                                  handleOpenBannerCta(bannerLink, bannerTitle)
                                }
                              >
                                <LinearGradient
                                  colors={[
                                    'rgba(0,0,0,0.08)',
                                    'rgba(0,0,0,0.36)',
                                    'rgba(0,0,0,0.62)',
                                  ]}
                                  style={styles.heroBannerImageOverlay}
                                >
                                  <Text style={styles.heroBannerTitle}>{bannerTitle}</Text>
                                  {banner.description ? (
                                    <Text style={styles.heroBannerOverlayText} numberOfLines={2}>
                                      {banner.description}
                                    </Text>
                                  ) : null}
                                  {homeBanners.length > 1 ? (
                                    <View style={styles.heroBannerOverlayDotsWrap}>
                                      <View style={styles.heroBannerDotsRow}>
                                        {homeBanners.slice(0, 5).map((b, idx) => (
                                          <Pressable
                                            key={b.id}
                                            onPress={() => scrollToBanner(idx)}
                                            style={[
                                              styles.heroBannerDot,
                                              idx === bannerIndex && styles.heroBannerDotActive,
                                              idx === bannerIndex ? { backgroundColor: brandAccent } : null,
                                            ]}
                                          />
                                        ))}
                                      </View>
                                    </View>
                                  ) : null}
                                </LinearGradient>
                              </Pressable>
                            ) : (
                              <LinearGradient
                                pointerEvents="none"
                                colors={[
                                  'rgba(0,0,0,0.08)',
                                  'rgba(0,0,0,0.36)',
                                  'rgba(0,0,0,0.62)',
                                ]}
                                style={styles.heroBannerImageOverlay}
                              >
                                <Text style={styles.heroBannerTitle}>{bannerTitle}</Text>
                                {banner.description ? (
                                  <Text style={styles.heroBannerOverlayText} numberOfLines={2}>
                                    {banner.description}
                                  </Text>
                                ) : null}
                                {homeBanners.length > 1 ? (
                                  <View style={styles.heroBannerOverlayDotsWrap}>
                                    <View style={styles.heroBannerDotsRow}>
                                      {homeBanners.slice(0, 5).map((b, idx) => (
                                        <Pressable
                                          key={b.id}
                                          onPress={() => scrollToBanner(idx)}
                                          style={[
                                            styles.heroBannerDot,
                                            idx === bannerIndex && styles.heroBannerDotActive,
                                            idx === bannerIndex ? { backgroundColor: brandAccent } : null,
                                          ]}
                                        />
                                      ))}
                                    </View>
                                  </View>
                                ) : null}
                              </LinearGradient>
                            )}
                            {homeBanners.length > 1 ? (
                              <>
                                <Pressable
                                  style={[styles.heroBannerArrow, styles.heroBannerArrowLeft]}
                                  onPress={() =>
                                    scrollToBanner(
                                      visualIndex <= 0
                                        ? homeBanners.length - 1
                                        : visualIndex - 1,
                                    )
                                  }
                                >
                                  <Ionicons name="chevron-back" size={16} color="#fff" />
                                </Pressable>
                                <Pressable
                                  style={[styles.heroBannerArrow, styles.heroBannerArrowRight]}
                                  onPress={() =>
                                    scrollToBanner(
                                      visualIndex >= homeBanners.length - 1
                                        ? 0
                                        : visualIndex + 1,
                                    )
                                  }
                                >
                                  <Ionicons name="chevron-forward" size={16} color="#fff" />
                                </Pressable>
                              </>
                            ) : null}
                          </View>
                        ) : (
                          <>
                            <Text style={styles.heroBannerTitle}>{bannerTitle}</Text>
                            {banner.description ? (
                              <Text style={styles.heroBannerText}>{banner.description}</Text>
                            ) : null}
                          </>
                        )}
                        {bannerError && isCurrent ? (
                          <Text style={styles.heroBannerText}>
                            {t('home.bannerFeedIssue', { message: bannerError })}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </ScrollView>
              </>
            ) : (
              <>
                <Text style={[styles.heroBannerTag, { color: brandAccent }]}>
                  {t('home.communityUpdatesTag')}
                </Text>
                <Text style={styles.heroBannerTitle}>{t('home.noActiveBanners')}</Text>
                <Text style={styles.heroBannerText}>
                  {t('home.adminBannersHint')}
                </Text>
                {bannerError ? (
                  <Text style={styles.heroBannerText}>
                    {t('home.bannerFeedIssue', { message: bannerError })}
                  </Text>
                ) : null}
              </>
            )}
          </LinearGradient>
        </View>
      </LinearGradient>

      {unitsErrorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{unitsErrorMessage}</Text>
        </View>
      ) : null}

      {snapshotError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{snapshotError}</Text>
        </View>
      ) : null}

      <View style={styles.homeSection}>
        <Text style={styles.homeSectionTitle}>{t('home.quickAccess')}</Text>
        <View style={styles.homeQuickGrid}>
          {quickAccessTiles.map((tile) => (
            <Pressable
              key={tile.key}
              style={[
                styles.homeQuickTile,
                tile.key === 'access' && styles.homeQuickTileBlue,
                tile.key === 'services' && styles.homeQuickTileGreen,
                tile.key === 'requests' && styles.homeQuickTilePurple,
              ]}
              onPress={tile.onPress}
            >
              <View style={styles.homeQuickTileIconWrap}>{tile.icon}</View>
              <Text style={styles.homeQuickTileTitle}>{tile.title}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.homeSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.homeSectionTitle}>{t('home.communityUpdatesTitle')}</Text>
          <Pressable onPress={onOpenCommunityUpdates}>
            <Text style={styles.linkText}>{t('common.viewAll')}</Text>
          </Pressable>
        </View>
        {notifications.errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{notifications.errorMessage}</Text>
          </View>
        ) : notifications.isInitialLoading && communityUpdates.length === 0 ? (
          <ActivityIndicator color={akColors.primary} />
        ) : communityUpdates.length === 0 ? (
          <View style={styles.feedCard}>
            <Text style={styles.feedTitle}>{t('home.noUpdatesYet')}</Text>
            <Text style={styles.feedMeta}>{t('home.newAnnouncementsHint')}</Text>
          </View>
        ) : (
          communityUpdates.map((item) => (
            <Pressable key={item.id} style={styles.feedCard} onPress={onOpenCommunityUpdates}>
              <View
                style={[
                  styles.feedIconBubble,
                  !item.isRead ? styles.feedIconBubbleUnread : null,
                ]}
              >
                <Ionicons
                  name={!item.isRead ? 'notifications' : 'checkmark'}
                  size={14}
                  color={!item.isRead ? brandAccent : brandPrimary}
                />
              </View>
              <View style={styles.flex}>
                <Text style={styles.feedTitle} numberOfLines={1}>
                  {communityUpdateTitle(item)}
                </Text>
                <Text style={styles.feedMeta} numberOfLines={1}>
                  {formatDateTime(item.sentAt || item.createdAt)}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </View>

      {showPaymentsSection ? (
      <View style={styles.homeSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.homeSectionTitle}>{t('home.upcomingPayments')}</Text>
          <Pressable onPress={onOpenFinance}>
            <Text style={styles.linkText}>{t('common.viewAll')}</Text>
          </Pressable>
        </View>
        {snapshotLoading ? (
          <ActivityIndicator color={akColors.primary} />
        ) : upcomingPayments.length === 0 ? (
          <View style={styles.paymentCard}>
            <View style={[styles.paymentIconWrap, { backgroundColor: hexToRgba(brandPrimary, 0.10) }]}>
              <Ionicons name="checkmark-circle-outline" size={18} color={brandPrimary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.paymentTitle}>{t('home.noPendingPayments')}</Text>
              <Text style={styles.paymentMeta}>{t('home.duesClear')}</Text>
            </View>
          </View>
        ) : (
          upcomingPayments.map((item) => (
            <View key={item.key} style={styles.paymentCard}>
              <View style={styles.paymentIconWrap}>
                  <Ionicons name="cash-outline" size={18} color={brandAccent} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.paymentTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.paymentMeta}>
                  {t('home.duePrefix')} {item.dueDate ? formatDateTime(item.dueDate).split(',')[0] : '—'}
                </Text>
              </View>
              <View style={styles.paymentRight}>
                <Text style={styles.paymentAmount}>{formatCurrency(item.amount)}</Text>
                <Pressable
                  style={[
                    styles.payNowPill,
                    { backgroundColor: brandPrimary },
                    !item.invoiceId && styles.payNowPillDisabled,
                  ]}
                  onPress={() => {
                    if (item.invoiceId) {
                      setActivePaymentItem(item);
                    } else {
                      onOpenFinance();
                    }
                  }}
                >
                  <Text style={styles.payNowPillText}>{t('home.payNow')}</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>
      ) : null}

      </View>
      </ScrollView>
      <DemoPaymentModal
        visible={Boolean(activePaymentItem)}
        item={activePaymentItem}
        isSubmitting={isPaying}
        onClose={() => {
          if (isPaying) return;
          setActivePaymentItem(null);
        }}
        onConfirm={handleConfirmDemoPayment}
      />
      <UnitPickerSheet
        visible={unitSheetOpen}
        units={units}
        selectedUnitId={selectedUnitId}
        anchorTop={Math.max(insets.top, 8) + 62}
        anchorRight={14}
        isLoading={unitsLoading}
        isRefreshing={unitsRefreshing}
        onRefresh={() => void onRefreshUnits()}
        onClose={() => setUnitSheetOpen(false)}
        onSelect={onSelectUnit}
      />
      <Modal
        visible={offersModalVisible && Boolean(activeOffer)}
        transparent
        animationType="fade"
        onRequestClose={() => setOffersModalVisible(false)}
      >
        <View style={styles.offerRoot}>
          <Pressable
            style={styles.offerBackdrop}
            onPress={() => setOffersModalVisible(false)}
          />
          <View style={styles.offerCard}>
            <Pressable
              style={styles.offerCloseBtn}
              onPress={() => setOffersModalVisible(false)}
            >
              <Ionicons name="close" size={18} color={akColors.text} />
            </Pressable>

            <Pressable
              onPress={() => {
                const normalized = normalizeExternalUrl(activeOffer?.linkUrl);
                if (!normalized) return;
                setOffersModalVisible(false);
                setWebViewerState({
                  visible: true,
                  url: normalized,
                  title: activeOffer?.title?.trim() || t('home.offerTitle'),
                });
              }}
              style={[styles.offerImageWrap, { backgroundColor: brandPrimaryDark }]}
            >
              {activeOffer?.imageUrl ? (
                <Image
                  source={{ uri: activeOffer.imageUrl }}
                  style={styles.offerImage}
                  resizeMode="cover"
                />
              ) : activeOffer?.imageFileId ? (
                <Image
                  source={{
                    uri: `${API_BASE_URL}/files/public/offer-banner/${activeOffer.imageFileId}`,
                  }}
                  style={styles.offerImage}
                  resizeMode="cover"
                />
              ) : (
                <LinearGradient
                  colors={[brandPrimary, brandPrimaryDark]}
                  style={styles.offerImage}
                />
              )}
              <LinearGradient
                colors={[
                  'rgba(0,0,0,0.15)',
                  'rgba(0,0,0,0.45)',
                  'rgba(0,0,0,0.72)',
                ]}
                style={styles.offerOverlay}
              >
                <Text style={styles.offerTitle}>
                  {activeOffer?.title || t('home.offerTitle')}
                </Text>
                {activeOffer?.description ? (
                  <Text style={styles.offerDesc} numberOfLines={3}>
                    {activeOffer.description}
                  </Text>
                ) : null}
              </LinearGradient>
            </Pressable>
            <View style={styles.offerActions}>
              <Pressable
                style={styles.offerDismissBtn}
                onPress={() => setOffersModalVisible(false)}
              >
                <Text style={styles.offerDismissText}>{t('home.offerDismiss')}</Text>
              </Pressable>
              {activeOffer?.linkUrl ? (
                <Pressable
                  style={[styles.offerOpenBtn, { backgroundColor: brandPrimary }]}
                  onPress={() => {
                    const normalized = normalizeExternalUrl(activeOffer.linkUrl);
                    if (!normalized) return;
                    setOffersModalVisible(false);
                    setWebViewerState({
                      visible: true,
                      url: normalized,
                      title: activeOffer.title || t('home.offerTitle'),
                    });
                  }}
                >
                  <Text style={styles.offerOpenText}>{t('home.offerOpen')}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
      <InAppWebViewerModal
        visible={webViewerState.visible}
        url={webViewerState.url}
        title={webViewerState.title}
        onClose={() =>
          setWebViewerState({
            visible: false,
            url: null,
            title: '',
          })
        }
      />
      <Modal
        visible={smartHomeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSmartHomeModalVisible(false)}
      >
        <View style={styles.comingSoonRoot}>
          <Pressable
            style={styles.comingSoonBackdrop}
            onPress={() => setSmartHomeModalVisible(false)}
          />
          <View style={styles.comingSoonCard}>
            <LinearGradient
              colors={[brandPrimary, brandPrimaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.comingSoonHero}
            >
              <View style={styles.comingSoonIconWrap}>
                <Ionicons name="bulb-outline" size={24} color={brandAccent} />
              </View>
              <Text style={styles.comingSoonTitle}>{t('home.smartHomeTitle')}</Text>
              <Text style={styles.comingSoonSubtitle}>
                {t('home.smartHomeSubtitle')}
              </Text>
            </LinearGradient>

            <View style={styles.comingSoonBody}>
              <Text style={styles.comingSoonBullet}>
                {t('home.smartHomeBullet1')}
              </Text>
              <Text style={styles.comingSoonBullet}>
                {t('home.smartHomeBullet2')}
              </Text>
              <Text style={styles.comingSoonBullet}>
                {t('home.smartHomeBullet3')}
              </Text>
              <Text style={styles.comingSoonHint}>
                {t('home.smartHomeHint')}
              </Text>
            </View>

            <Pressable
              style={[styles.comingSoonCloseBtn, { backgroundColor: brandPrimary }]}
              onPress={() => setSmartHomeModalVisible(false)}
            >
              <Text style={styles.comingSoonCloseBtnText}>{t('home.smartHomeClose')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: akColors.bg,
  },
  container: {
    backgroundColor: akColors.bg,
  },
  contentFrame: {
    width: '100%',
  },
  flex: {
    flex: 1,
  },
  hero: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 8,
    ...akShadow.card,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  heroRightActions: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroUnitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroUnitPillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  heroIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heroBellBadge: {
    position: 'absolute',
    top: -3,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: '#EF4444',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBellBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  heroBadge: {
    color: akColors.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  heroWelcomeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 2,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    lineHeight: 18,
  },
  heroBrand: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    fontWeight: '600',
  },
  heroEmail: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '500',
  },
  heroBannerCard: {
    marginTop: 8,
    borderRadius: 18,
    overflow: 'hidden',
  },
  heroBannerInner: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: 14,
    gap: 4,
  },
  heroBannerPager: {
    width: '100%',
  },
  heroBannerSlide: {
    gap: 4,
  },
  heroBannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroBannerCounter: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 10,
    fontWeight: '600',
  },
  heroBannerTag: {
    color: akColors.gold,
    fontSize: 10,
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  heroBannerImage: {
    width: '100%',
    height: 138,
    borderRadius: 12,
    marginTop: 6,
    marginBottom: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  heroBannerImageWrap: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  heroBannerTapLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  heroBannerImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4,
  },
  heroBannerOverlayDotsWrap: {
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBannerOverlayText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
  heroBannerImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  heroBannerImageFallbackText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '500',
  },
  heroBannerArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  heroBannerArrowLeft: {
    left: 8,
  },
  heroBannerArrowRight: {
    right: 8,
  },
  heroBannerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  heroBannerText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    lineHeight: 15,
  },
  heroBannerDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },
  heroBannerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  heroBannerDotActive: {
    width: 14,
    backgroundColor: akColors.gold,
  },
  homeSection: {
    gap: 10,
  },
  homeSectionTitle: {
    color: akColors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  homeQuickGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  homeQuickTile: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 96,
  },
  homeQuickTileBlue: {
    backgroundColor: '#E8EEF9',
  },
  homeQuickTileGreen: {
    backgroundColor: '#E3F4E7',
  },
  homeQuickTilePurple: {
    backgroundColor: '#EFE7FA',
  },
  homeQuickTileIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  homeQuickTileTitle: {
    color: akColors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  feedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...akShadow.soft,
  },
  feedIconBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedIconBubbleUnread: {
    backgroundColor: '#E0F2FE',
  },
  feedTitle: {
    color: akColors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  feedMeta: {
    color: akColors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  paymentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...akShadow.soft,
  },
  paymentIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(245,158,11,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentTitle: {
    color: akColors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  paymentMeta: {
    color: akColors.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  paymentRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  paymentAmount: {
    color: akColors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  payNowPill: {
    backgroundColor: '#166534',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  payNowPillDisabled: {
    opacity: 0.7,
  },
  payNowPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  smartHomeCard: {
    borderRadius: 18,
    overflow: 'hidden',
    opacity: 0.95,
  },
  smartHomeCardInner: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  smartHomeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartHomeTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  smartHomeSub: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    marginTop: 2,
  },
  comingSoonRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  comingSoonBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.26)',
  },
  comingSoonCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...akShadow.card,
  },
  comingSoonHero: {
    padding: 16,
    gap: 8,
  },
  comingSoonIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  comingSoonTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  comingSoonSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    lineHeight: 18,
  },
  comingSoonBody: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 6,
  },
  comingSoonBullet: {
    color: akColors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  comingSoonHint: {
    marginTop: 4,
    color: akColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  comingSoonCloseBtn: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comingSoonCloseBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 6,
  },
  statCardHalf: {
    width: '48%',
    backgroundColor: akColors.surface,
    borderRadius: akRadius.lg,
    borderWidth: 1,
    borderColor: akColors.border,
    padding: 14,
    gap: 6,
  },
  statLabel: {
    color: akColors.textMuted,
    fontSize: 12,
  },
  statValue: {
    color: akColors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  statHint: {
    color: akColors.textSoft,
    fontSize: 11,
  },
  actionsCard: {
    backgroundColor: akColors.surface,
    borderRadius: akRadius.card,
    borderWidth: 1,
    borderColor: akColors.border,
    padding: 14,
    gap: 10,
    ...akShadow.soft,
  },
  sectionTitle: {
    color: akColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickTile: {
    width: '48%',
    borderRadius: 16,
    backgroundColor: akColors.surface,
    borderWidth: 1,
    borderColor: akColors.border,
    padding: 12,
    gap: 6,
  },
  quickTileIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  quickTileTitle: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  quickTileSub: {
    color: akColors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: akColors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonWide: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  helperText: {
    color: akColors.textMuted,
    fontSize: 12,
  },
  secondaryButtonText: {
    color: akColors.text,
    fontWeight: '600',
    fontSize: 13,
  },
  listCard: {
    backgroundColor: akColors.surface,
    borderRadius: akRadius.card,
    borderWidth: 1,
    borderColor: akColors.border,
    padding: 14,
    gap: 10,
    ...akShadow.soft,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkText: {
    color: akColors.primary,
    fontWeight: '600',
    fontSize: 12,
  },
  errorBox: {
    borderWidth: 1,
    borderColor: akColors.dangerBorder,
    backgroundColor: akColors.dangerBg,
    borderRadius: 10,
    padding: 10,
  },
  errorText: {
    color: akColors.danger,
    fontSize: 12,
    lineHeight: 17,
  },
  emptyText: {
    color: akColors.textMuted,
    fontSize: 13,
  },
  notificationItem: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationTitle: {
    flex: 1,
    color: akColors.text,
    fontWeight: '600',
    fontSize: 13,
  },
  notificationTitleUnread: {
    color: akColors.text,
    fontWeight: '700',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  statusDotUnread: {
    backgroundColor: akColors.gold,
  },
  statusDotRead: {
    backgroundColor: akColors.primary,
  },
  notificationMessage: {
    color: akColors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  notificationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  notificationMeta: {
    color: akColors.textSoft,
    fontSize: 11,
  },
  offerRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  offerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,6,23,0.58)',
  },
  offerCard: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fff',
    ...akShadow.card,
  },
  offerCloseBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 3,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  offerImageWrap: {
    position: 'relative',
    height: 300,
    backgroundColor: akColors.surfaceMuted,
  },
  offerImage: {
    width: '100%',
    height: '100%',
  },
  offerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  offerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  offerDesc: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  offerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: akColors.border,
  },
  offerDismissBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: akColors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  offerDismissText: {
    color: akColors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  offerOpenBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: akColors.primary,
  },
  offerOpenText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
});
