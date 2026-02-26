import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DemoPaymentModal } from '../components/mobile/DemoPaymentModal';
import { useAppToast } from '../components/mobile/AppToast';
import { UnitPickerSheet } from '../components/mobile/UnitPickerSheet';
import { API_BASE_URL } from '../config/env';
import type { AuthBootstrapProfile, AuthSession } from '../features/auth/types';
import { useBranding } from '../features/branding/provider';
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
  const bannerScrollRef = useRef<ScrollView | null>(null);
  const toast = useAppToast();
  const { brand } = useBranding();
  const brandPrimary = brand.primaryColor || akColors.primary;
  const brandSecondary = brand.secondaryColor || akColors.bg;
  const brandAccent = brand.accentColor || akColors.gold;

  const notifications = useNotificationRealtime();

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

  const baseQuickActions = [
    {
      key: 'bookings',
      title: 'Bookings',
      subtitle: 'Facilities',
      bg: 'rgba(59,130,246,0.10)',
      iconColor: '#2563EB',
      icon: <Ionicons name="calendar-outline" size={20} color="#2563EB" />,
      onPress: onOpenBookings,
    },
    {
      key: 'services',
      title: 'Services',
      subtitle: 'Maintenance',
      bg: 'rgba(249,115,22,0.10)',
      iconColor: '#EA580C',
      icon: <Ionicons name="construct-outline" size={20} color="#EA580C" />,
      onPress: onOpenServices,
    },
    {
      key: 'requests',
      title: 'Requests',
      subtitle: 'Permits & admin',
      bg: 'rgba(168,85,247,0.10)',
      iconColor: '#9333EA',
      icon: <Ionicons name="file-tray-outline" size={20} color="#9333EA" />,
      onPress: onOpenRequests,
    },
    {
      key: 'access',
      title: 'QR Codes',
      subtitle: 'Visitors',
      bg: 'rgba(16,185,129,0.10)',
      iconColor: '#059669',
      icon: <MaterialCommunityIcons name="qrcode" size={20} color="#059669" />,
      onPress: onOpenQr,
    },
    {
      key: 'finance',
      title: 'Payments',
      subtitle: 'Invoices',
      bg: 'rgba(245,158,11,0.10)',
      iconColor: '#D97706',
      icon: <Ionicons name="card-outline" size={20} color="#D97706" />,
      onPress: onOpenFinance,
    },
    {
      key: 'profile',
      title: 'Profile',
      subtitle: 'Account',
      bg: 'rgba(42,62,53,0.10)',
      iconColor: akColors.primary,
      icon: <Ionicons name="person-outline" size={20} color={akColors.primary} />,
      onPress: onOpenProfileTab,
    },
  ];

  const quickActions = baseQuickActions
    .filter((action) => {
      switch (action.key) {
        case 'bookings':
          return !isPreDeliveryUnit && (featureFlags?.canUseBookings ?? true);
        case 'services':
          return !isPreDeliveryUnit && (featureFlags?.canUseServices ?? true);
        case 'complaints':
          return featureFlags?.canUseComplaints ?? true;
        case 'requests':
          return !isPreDeliveryUnit && (featureFlags?.canUseServices ?? true);
        case 'access':
          return !isPreDeliveryUnit && (featureFlags?.canUseQr ?? true);
        case 'finance':
          return !isPreDeliveryUnit && (featureFlags?.canViewFinance ?? true);
        default:
          return true;
      }
    });

  const greetingName =
    bootstrapProfile?.user?.nameEN?.trim() ||
    bootstrapProfile?.user?.nameAR?.trim() ||
    session.email.split('@')[0];

  const quickAccessTiles = useMemo(
    () => quickActions.filter((a) => ['access', 'services', 'requests'].includes(a.key)).slice(0, 3),
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
    const allPayables = buildPayables(snapshotRows.invoices, snapshotRows.violations);
    return filterPayablesByUnit(allPayables, selectedUnitId).slice(0, 2);
  }, [selectedUnitId, snapshotRows.invoices, snapshotRows.violations]);

  const handleConfirmDemoPayment = useCallback(
    async (payload: { paymentMethod: string; cardLast4?: string; notes?: string }) => {
      if (!activePaymentItem?.invoiceId) {
        toast.info(
          'Payment unavailable',
          'This item is not linked to an invoice yet. Open Finance to review details.',
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
        toast.success('Payment completed', 'Your payment was recorded successfully.');
        await loadSnapshot('refresh');
      } catch (error) {
        toast.error('Payment failed', extractApiErrorMessage(error));
      } finally {
        setIsPaying(false);
      }
    },
    [activePaymentItem, loadSnapshot, session.accessToken, toast],
  );

  const handleOpenBannerCta = useCallback(
    async (rawUrl?: string | null) => {
      const normalized = normalizeExternalUrl(rawUrl);
      if (!normalized) return;
      try {
        const canOpen = await Linking.canOpenURL(normalized);
        if (!canOpen) {
          toast.error('Unable to open link', 'This link format is not supported on your device.');
          return;
        }
        await Linking.openURL(normalized);
      } catch (error) {
        toast.error('Failed to open link', extractApiErrorMessage(error));
      }
    },
    [toast],
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: brandSecondary }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: Math.max(insets.top, 8) + 8, paddingBottom: 110 },
        ]}
      >
      <LinearGradient
        colors={[brandPrimary, akColors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
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
                {selectedUnit?.unitNumber ?? 'My Unit'}
              </Text>
              <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.9)" />
            </Pressable>
          </View>
        </View>

        <Text style={styles.heroTitle}>Good Morning, {greetingName} 👋</Text>
        <View style={styles.heroWelcomeRow}>
          <Text style={styles.heroSubtitle}>Welcome to </Text>
          <Text style={styles.heroBrand}>{selectedUnit?.projectName ?? 'AlKarma Gates'}</Text>
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
                            COMMUNITY UPDATES
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
                                  Image unavailable
                                </Text>
                              </View>
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
                        ) : null}
                        <Text style={styles.heroBannerTitle}>
                          {banner.titleEn || banner.titleAr || 'Community update'}
                        </Text>
                        {banner.description ? (
                          <Text style={styles.heroBannerText}>{banner.description}</Text>
                        ) : null}
                        {bannerError && isCurrent ? (
                          <Text style={styles.heroBannerText}>Banner feed issue: {bannerError}</Text>
                        ) : null}
                        <View style={styles.heroBannerActionsRow}>
                          {homeBanners.length > 1 ? (
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
                          ) : (
                            <View />
                          )}
                          {banner.ctaUrl ? (
                            <Pressable
                              style={styles.heroBannerCta}
                              onPress={() => void handleOpenBannerCta(banner.ctaUrl)}
                            >
                              <Text style={[styles.heroBannerCtaText, { color: brandAccent }]}>
                                {banner.ctaText?.trim() || 'Open'}
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </>
            ) : (
              <>
                <Text style={[styles.heroBannerTag, { color: brandAccent }]}>
                  COMMUNITY UPDATES
                </Text>
                <Text style={styles.heroBannerTitle}>No active banners right now</Text>
                <Text style={styles.heroBannerText}>
                  Admin-created banners will appear here automatically when active.
                </Text>
                {bannerError ? (
                  <Text style={styles.heroBannerText}>Banner feed issue: {bannerError}</Text>
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
        <Text style={styles.homeSectionTitle}>Quick Access</Text>
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
          <Text style={styles.homeSectionTitle}>Community Updates</Text>
          <Pressable onPress={onOpenCommunityUpdates}>
            <Text style={styles.linkText}>View All</Text>
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
            <Text style={styles.feedTitle}>No updates yet</Text>
            <Text style={styles.feedMeta}>New community announcements will appear here.</Text>
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
                  color={!item.isRead ? '#0284C7' : '#16A34A'}
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

      <View style={styles.homeSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.homeSectionTitle}>Upcoming Payments</Text>
          <Pressable onPress={onOpenFinance}>
            <Text style={styles.linkText}>View All</Text>
          </Pressable>
        </View>
        {snapshotLoading ? (
          <ActivityIndicator color={akColors.primary} />
        ) : upcomingPayments.length === 0 ? (
          <View style={styles.paymentCard}>
            <View style={[styles.paymentIconWrap, { backgroundColor: 'rgba(34,197,94,0.10)' }]}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#16A34A" />
            </View>
            <View style={styles.flex}>
              <Text style={styles.paymentTitle}>No pending payments</Text>
              <Text style={styles.paymentMeta}>All dues are clear for the selected unit.</Text>
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
                  Due {item.dueDate ? formatDateTime(item.dueDate).split(',')[0] : '—'}
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
                  <Text style={styles.payNowPillText}>Pay Now</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>

      <Pressable style={styles.smartHomeCard} onPress={() => setSmartHomeModalVisible(true)}>
        <LinearGradient
          colors={[brandPrimary, akColors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.smartHomeCardInner}
        >
          <View style={styles.smartHomeIconWrap}>
            <Ionicons name="home-outline" size={18} color={brandAccent} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.smartHomeTitle}>Smart Home Control</Text>
            <Text style={styles.smartHomeSub}>Feature availability depends on your unit</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
        </LinearGradient>
      </Pressable>
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
              colors={[brandPrimary, akColors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.comingSoonHero}
            >
              <View style={styles.comingSoonIconWrap}>
                <Ionicons name="bulb-outline" size={24} color={brandAccent} />
              </View>
              <Text style={styles.comingSoonTitle}>Smart Home Coming Soon</Text>
              <Text style={styles.comingSoonSubtitle}>
                You will be able to control supported devices inside your home directly from the app.
              </Text>
            </LinearGradient>

            <View style={styles.comingSoonBody}>
              <Text style={styles.comingSoonBullet}>
                • Lighting and scenes
              </Text>
              <Text style={styles.comingSoonBullet}>
                • AC and climate controls
              </Text>
              <Text style={styles.comingSoonBullet}>
                • Device status and quick actions
              </Text>
              <Text style={styles.comingSoonHint}>
                Availability depends on your unit setup and supported integrations.
              </Text>
            </View>

            <Pressable
              style={[styles.comingSoonCloseBtn, { backgroundColor: brandPrimary }]}
              onPress={() => setSmartHomeModalVisible(false)}
            >
              <Text style={styles.comingSoonCloseBtnText}>Got it</Text>
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
    padding: 16,
    gap: 14,
    backgroundColor: akColors.bg,
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
  heroBannerActionsRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  heroBannerDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  heroBannerCta: {
    borderRadius: 999,
    backgroundColor: 'rgba(201,169,97,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,97,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroBannerCtaText: {
    color: akColors.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
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
});
