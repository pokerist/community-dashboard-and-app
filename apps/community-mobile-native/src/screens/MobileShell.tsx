import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { AuthSession } from '../features/auth/types';
import type { AuthBootstrapProfile } from '../features/auth/types';
import { getAuthBootstrapProfile } from '../features/auth/profile';
import { AppDrawerMenu, type AppDrawerRoute } from '../components/mobile/AppDrawerMenu';
import { useBranding } from '../features/branding/provider';
import { useI18n } from '../features/i18n/provider';
import { useResidentUnits } from '../features/units/useResidentUnits';
import { akColors } from '../theme/alkarma';
import { AccessQrScreen } from './AccessQrScreen';
import { BookingsScreen } from './BookingsScreen';
import { ComplaintsScreen } from './ComplaintsScreen';
import { FinanceScreen } from './FinanceScreen';
import {
  NotificationRealtimeProvider,
  useNotificationRealtime,
} from '../features/notifications/realtime';
import { ResidentHomeScreen } from './ResidentHomeScreen';
import { CommunityUpdatesScreen } from './CommunityUpdatesScreen';
import { NotificationsListScreen } from './NotificationsListScreen';
import { SessionHomeScreen } from './SessionHomeScreen';
import { ServicesRequestsScreen } from './ServicesRequestsScreen';
import { HouseholdHubScreen } from './HouseholdHubScreen';
import { UtilityTrackerScreen } from './UtilityTrackerScreen';
import { DiscoverScreen } from './DiscoverScreen';
import { HelpCenterScreen } from './HelpCenterScreen';
import { ManageMyUnitsScreen } from './ManageMyUnitsScreen';
import { UnitPickerSheet } from '../components/mobile/UnitPickerSheet';
import { Pressable, StyleSheet, Text, View, Vibration, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { useAppToast } from '../components/mobile/AppToast';
import { FireEvacuationAlertModal } from '../components/mobile/FireEvacuationAlertModal';
import {
  acknowledgeFireEvacuation,
  getMyFireEvacuationStatus,
} from '../features/community/service';
import type { FireEvacuationStatus } from '../features/community/types';

type MobileShellProps = {
  session: AuthSession;
  isRefreshing: boolean;
  refreshError: string | null;
  onRefreshSession: () => Promise<void>;
  onLogout: () => Promise<void>;
};

type RootTabsParamList = {
  Home: undefined;
  ManageUnits: undefined;
  CommunityUpdates: undefined;
  Notifications: undefined;
  Bookings: undefined;
  Services: undefined;
  Requests: undefined;
  Complaints: undefined;
  Access: undefined;
  Finance: undefined;
  Household: undefined;
  Utilities: undefined;
  Discover: undefined;
  HelpCenter: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RootTabsParamList>();

function tabIcon(routeName: keyof RootTabsParamList, color: string, size: number) {
  switch (routeName) {
    case 'Home':
      return <Ionicons name="home-outline" size={size} color={color} />;
    case 'ManageUnits':
      return <Ionicons name="business-outline" size={size} color={color} />;
    case 'Notifications':
      return <Ionicons name="notifications-outline" size={size} color={color} />;
    case 'CommunityUpdates':
      return <Ionicons name="megaphone-outline" size={size} color={color} />;
    case 'Bookings':
      return <Ionicons name="calendar-outline" size={size} color={color} />;
    case 'Services':
      return <Ionicons name="construct-outline" size={size} color={color} />;
    case 'Requests':
      return <Ionicons name="file-tray-outline" size={size} color={color} />;
    case 'Complaints':
      return <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />;
    case 'Access':
      return <MaterialCommunityIcons name="qrcode" size={size} color={color} />;
    case 'Finance':
      return <Ionicons name="card-outline" size={size} color={color} />;
    case 'Profile':
      return <Ionicons name="person-outline" size={size} color={color} />;
    case 'Household':
      return <Ionicons name="people-outline" size={size} color={color} />;
    case 'Utilities':
      return <Ionicons name="speedometer-outline" size={size} color={color} />;
    case 'Discover':
      return <Ionicons name="compass-outline" size={size} color={color} />;
    case 'HelpCenter':
      return <Ionicons name="help-circle-outline" size={size} color={color} />;
    default:
      return <Ionicons name="ellipse-outline" size={size} color={color} />;
  }
}

const hiddenTabOptions = {
  tabBarButton: () => null,
  tabBarItemStyle: { display: 'none' as const },
};

export function MobileShell(props: MobileShellProps) {
  return (
    <NotificationRealtimeProvider session={props.session}>
      <MobileShellInner {...props} />
    </NotificationRealtimeProvider>
  );
}

function MobileShellInner(props: MobileShellProps) {
  const { t } = useI18n();
  const navigationRef = useNavigationContainerRef<RootTabsParamList>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentRouteName, setCurrentRouteName] = useState<keyof RootTabsParamList>('Home');
  const [bootstrapProfile, setBootstrapProfile] = useState<AuthBootstrapProfile | null>(null);
  const [pendingServiceRequestFocus, setPendingServiceRequestFocus] = useState<{
    id: string;
    mode: 'services' | 'requests';
  } | null>(null);
  const [pendingBookingId, setPendingBookingId] = useState<string | null>(null);
  const [pendingComplaintId, setPendingComplaintId] = useState<string | null>(null);
  const [pendingAccessQrId, setPendingAccessQrId] = useState<string | null>(null);
  const [pendingFinanceFocus, setPendingFinanceFocus] = useState<{
    entityType: 'INVOICE' | 'VIOLATION';
    entityId: string;
  } | null>(null);
  const [fireStatus, setFireStatus] = useState<FireEvacuationStatus | null>(null);
  const [fireChecking, setFireChecking] = useState(false);
  const [fireAckSubmitting, setFireAckSubmitting] = useState(false);
  const [forceFireModal, setForceFireModal] = useState(false);
  const units = useResidentUnits(props.session.accessToken, props.session.userId);
  const realtime = useNotificationRealtime();
  const toast = useAppToast();
  const lastFireAlertAtRef = useRef<string | null>(null);
  const firePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const { brand } = useBranding();
  const brandPrimary = brand.primaryColor || akColors.primary;
  const selectedUnitAccesses = units.selectedUnit?.unitAccesses ?? [];
  const canGenerateQrByUnit =
    selectedUnitAccesses.length === 0 ||
    selectedUnitAccesses.some((access) => access.canGenerateQR !== false);
  const canUseQrFeature = bootstrapProfile?.featureAvailability?.canUseQr !== false;
  const hideQrTabForSelectedUnit = !canUseQrFeature || !canGenerateQrByUnit;
  const isTabletLayout = viewportWidth >= 768;
  const effectiveBottomInset = Math.min(Math.max(insets.bottom, 0), 24);
  const tabBarBaseHeight = isTabletLayout ? 66 : 64;
  const tabBarHeight = tabBarBaseHeight + effectiveBottomInset;
  const tabBarBottom = Math.max(effectiveBottomInset, isTabletLayout ? 10 : 8);
  const tabBarHorizontalInset = 12;
  const tabBarWidth = isTabletLayout ? Math.min(640, viewportWidth - 24) : undefined;
  const tabBarVerticalPadding = isTabletLayout ? 8 : 7;
  const navTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: akColors.bg,
        card: akColors.surface,
        border: akColors.border,
        text: akColors.text,
        primary: brandPrimary,
      },
    }),
    [brandPrimary],
  );
  const fireModalVisible = Boolean(
    (fireStatus?.active && fireStatus?.targeted) ||
      (forceFireModal && fireStatus?.targeted !== false),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await getAuthBootstrapProfile(props.session.accessToken);
        if (!cancelled) setBootstrapProfile(profile);
      } catch {
        if (!cancelled) setBootstrapProfile(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.session.accessToken]);

  const loadFireStatus = useCallback(
    async (forceAlarmHint = false) => {
      if (!forceAlarmHint) setFireChecking(true);
      try {
        const next = await getMyFireEvacuationStatus(props.session.accessToken);
        setFireStatus(next);
        if (next?.active && next?.targeted && !next?.acknowledged) {
          setForceFireModal(true);
          const marker = String(next.triggeredAt ?? 'ACTIVE');
          const shouldRing = forceAlarmHint || lastFireAlertAtRef.current !== marker;
          if (shouldRing) {
            lastFireAlertAtRef.current = marker;
            Vibration.vibrate([0, 500, 260, 620], false);
            try {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: next.titleEn || t('fire.title'),
                  body: next.messageEn || t('fire.message'),
                  sound: true,
                  data: {
                    route: '/fire-evacuation',
                    entityType: 'FIRE_EVACUATION',
                    entityId: 'ACTIVE_DRILL',
                  },
                },
                trigger: null,
              });
            } catch {
              // best effort only
            }
          }
        } else if (!next?.active) {
          setForceFireModal(false);
        }
      } catch {
        // fire drill endpoint is optional by design
      } finally {
        if (!forceAlarmHint) setFireChecking(false);
      }
    },
    [props.session.accessToken, t],
  );

  const handleAcknowledgeFire = useCallback(async () => {
    setFireAckSubmitting(true);
    try {
      const next = await acknowledgeFireEvacuation(props.session.accessToken);
      setFireStatus(next);
      toast.success(t('fire.confirmationSuccess'));
    } catch {
      toast.error(t('fire.confirmationFailed'));
    } finally {
      setFireAckSubmitting(false);
    }
  }, [props.session.accessToken, t, toast]);

  useEffect(() => {
    void loadFireStatus();
    if (firePollRef.current) clearInterval(firePollRef.current);
    firePollRef.current = setInterval(() => {
      void loadFireStatus();
    }, 15000);
    return () => {
      if (firePollRef.current) {
        clearInterval(firePollRef.current);
        firePollRef.current = null;
      }
    };
  }, [loadFireStatus]);

  const navigateToRoute = (route: AppDrawerRoute | keyof RootTabsParamList) => {
    setDrawerOpen(false);
    if (!navigationRef.isReady()) return;
    navigationRef.navigate(route as never);
  };

  const navigateFromPushPayload = (payload: {
    route?: string;
    entityType?: string;
    entityId?: string;
    notificationId?: string;
  }) => {
    if (!navigationRef.isReady()) return;

    const route = String(payload.route ?? '')
      .trim()
      .toLowerCase()
      .replace(/^\//, '');
    const entityType = String(payload.entityType ?? '').toUpperCase();
    const entityId = String(payload.entityId ?? '').trim();

    const queueServiceRequestFocus = (mode: 'services' | 'requests') => {
      if (entityType === 'SERVICE_REQUEST' && entityId) {
        setPendingServiceRequestFocus({ id: entityId, mode });
      }
    };
    const queueBookingFocus = () => {
      if (entityType === 'BOOKING' && entityId) setPendingBookingId(entityId);
    };
    const queueComplaintFocus = () => {
      if (entityType === 'COMPLAINT' && entityId) setPendingComplaintId(entityId);
    };
    const queueAccessQrFocus = () => {
      if (
        ['ACCESS_QR', 'ACCESS_QRCODE', 'QR_CODE'].includes(entityType) &&
        entityId
      ) {
        setPendingAccessQrId(entityId);
      }
    };
    const queueFinanceFocus = () => {
      if ((entityType === 'INVOICE' || entityType === 'VIOLATION') && entityId) {
        setPendingFinanceFocus({ entityType: entityType as 'INVOICE' | 'VIOLATION', entityId });
      }
    };

    if (route.includes('fire') || entityType === 'FIRE_EVACUATION') {
      setForceFireModal(true);
      void loadFireStatus(true);
      navigationRef.navigate('Notifications');
      return;
    }

    if (
      route.includes('payments') ||
      route.includes('finance') ||
      route.includes('invoices') ||
      route.includes('violations')
    ) {
      queueFinanceFocus();
      navigationRef.navigate('Finance');
      return;
    }
    if (
      route.includes('community-updates') ||
      route.includes('community') ||
      route.includes('announcement') ||
      ['ANNOUNCEMENT', 'EVENT_NOTIFICATION', 'MAINTENANCE_ALERT', 'EMERGENCY_ALERT'].includes(
        entityType,
      )
    ) {
      navigationRef.navigate('CommunityUpdates');
      return;
    }
    if (route.includes('booking')) {
      queueBookingFocus();
      navigationRef.navigate('Bookings');
      return;
    }
    if (route.includes('request')) {
      queueServiceRequestFocus('requests');
      navigationRef.navigate('Requests');
      return;
    }
    if (route.includes('service')) {
      queueServiceRequestFocus('services');
      navigationRef.navigate('Services');
      return;
    }
    if (route.includes('complaint')) {
      queueComplaintFocus();
      navigationRef.navigate('Complaints');
      return;
    }
    if (
      route.includes('qr') ||
      route.includes('access') ||
      route.includes('visitor')
    ) {
      queueAccessQrFocus();
      navigationRef.navigate('Access');
      return;
    }
    if (route.includes('profile') || route.includes('account')) {
      navigationRef.navigate('Profile');
      return;
    }
    if (route.includes('household') || route.includes('family')) {
      navigationRef.navigate('Household');
      return;
    }
    if (route.includes('utility') || route.includes('utilities')) {
      navigationRef.navigate('Utilities');
      return;
    }
    if (route.includes('discover')) {
      navigationRef.navigate('Discover');
      return;
    }
    if (route.includes('help')) {
      navigationRef.navigate('HelpCenter');
      return;
    }
    if (route.includes('notification')) {
      navigationRef.navigate('Notifications');
      return;
    }

    if (entityType === 'INVOICE' || entityType === 'VIOLATION') {
      queueFinanceFocus();
      navigationRef.navigate('Finance');
      return;
    }
    if (entityType === 'SERVICE_REQUEST') {
      queueServiceRequestFocus('requests');
      navigationRef.navigate('Requests');
      return;
    }
    if (entityType === 'BOOKING') {
      queueBookingFocus();
      navigationRef.navigate('Bookings');
      return;
    }
    if (['ACCESS_QR', 'ACCESS_QRCODE', 'QR_CODE'].includes(entityType)) {
      queueAccessQrFocus();
      navigationRef.navigate('Access');
      return;
    }
    if (entityType === 'COMPLAINT') {
      queueComplaintFocus();
      navigationRef.navigate('Complaints');
      return;
    }
    if (entityType === 'ACCESS_QR' || entityType === 'QR') {
      navigationRef.navigate('Access');
      return;
    }

    navigationRef.navigate('Notifications');
  };

  useEffect(() => {
    if (!realtime.pendingPushNavigation) return;
    navigateFromPushPayload(realtime.pendingPushNavigation);
    realtime.consumePendingPushNavigation();
  }, [realtime.pendingPushNavigation]);

  const syncCurrentRoute = () => {
    const current = navigationRef.getCurrentRoute()?.name as keyof RootTabsParamList | undefined;
    if (current) setCurrentRouteName(current);
  };

  return (
    <>
      <NavigationContainer
        theme={navTheme}
        ref={navigationRef}
        onReady={syncCurrentRoute}
        onStateChange={() => {
          syncCurrentRoute();
          if (drawerOpen) setDrawerOpen(false);
        }}
      >
      <Tab.Navigator
        initialRouteName="Home"
        screenOptions={({ route }) => ({
          headerShown: false,
          sceneStyle: {
            backgroundColor: akColors.bg,
            paddingTop:
              route.name === 'Home' ? 0 : Math.max(insets.top, 8) + 38,
            paddingBottom: 0,
          },
          tabBarStyle: {
            position: 'absolute',
            left: tabBarHorizontalInset,
            right: tabBarHorizontalInset,
            bottom: tabBarBottom,
            height: tabBarHeight,
            width: tabBarWidth,
            alignSelf: isTabletLayout ? 'center' : undefined,
            borderRadius: 22,
            backgroundColor: 'rgba(255,255,255,0.98)',
            borderTopColor: 'transparent',
            borderTopWidth: 0,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderBottomWidth: 1,
            borderColor: 'rgba(226,232,240,0.85)',
            paddingBottom: tabBarVerticalPadding + Math.max(effectiveBottomInset - 8, 0),
            paddingTop: tabBarVerticalPadding,
            paddingHorizontal: isTabletLayout ? 6 : 6,
            elevation: 10,
            shadowColor: '#000',
            shadowOpacity: isTabletLayout ? 0.08 : 0.08,
            shadowRadius: isTabletLayout ? 14 : 14,
            shadowOffset: { width: 0, height: isTabletLayout ? 8 : 8 },
          },
          tabBarActiveTintColor: brandPrimary,
          tabBarInactiveTintColor: akColors.textMuted,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '700',
          },
          tabBarItemStyle: {
            borderRadius: 14,
            marginHorizontal: 2,
          },
          tabBarIconStyle: {
            marginTop: 2,
          },
          tabBarIcon: ({ color, size }) =>
            tabIcon(route.name as keyof RootTabsParamList, color, size - 1),
        })}
      >
        <Tab.Screen
          name="Home"
          options={{
            tabBarLabel: t('tabs.home'),
          }}
        >
          {({ navigation }) => (
            <ResidentHomeScreen
              session={props.session}
              units={units.units}
              selectedUnitId={units.selectedUnitId}
              selectedUnit={units.selectedUnit}
              unitsLoading={units.isLoading}
              unitsRefreshing={units.isRefreshing}
              unitsErrorMessage={units.errorMessage}
              onSelectUnit={units.setSelectedUnitId}
              onRefreshUnits={units.refresh}
              onOpenMenu={() => setDrawerOpen(true)}
              onOpenNotifications={() => navigation.navigate('Notifications')}
              onOpenCommunityUpdates={() => navigation.navigate('CommunityUpdates')}
              onOpenBookings={() => navigation.navigate('Bookings')}
              onOpenServices={() => navigation.navigate('Services')}
              onOpenRequests={() => navigation.navigate('Requests')}
              onOpenComplaints={() => navigation.navigate('Complaints')}
              onOpenQr={() => navigation.navigate('Access')}
              onOpenFinance={() => navigation.navigate('Finance')}
              onOpenProfileTab={() => navigation.navigate('Profile')}
              bootstrapProfile={bootstrapProfile}
            />
          )}
        </Tab.Screen>

        <Tab.Screen name="ManageUnits" options={hiddenTabOptions}>
          {() => (
            <ManageMyUnitsScreen
              session={props.session}
              units={units.units}
              selectedUnitId={units.selectedUnitId}
              onSelectUnit={units.setSelectedUnitId}
            />
          )}
        </Tab.Screen>

        <Tab.Screen name="Notifications" options={hiddenTabOptions}>
          {() => (
            <NotificationsListScreen
              session={props.session}
              onOpenInAppRoute={(payload) => navigateFromPushPayload(payload)}
            />
          )}
        </Tab.Screen>

        <Tab.Screen name="CommunityUpdates" options={hiddenTabOptions}>
          {() => (
            <CommunityUpdatesScreen
              session={props.session}
              onOpenInAppRoute={(payload) => navigateFromPushPayload(payload)}
            />
          )}
        </Tab.Screen>

        <Tab.Screen name="Bookings" options={hiddenTabOptions}>
          {() => (
            <BookingsScreen
              session={props.session}
              units={units.units}
              selectedUnitId={units.selectedUnitId}
              selectedUnit={units.selectedUnit}
              unitsLoading={units.isLoading}
              unitsRefreshing={units.isRefreshing}
              unitsErrorMessage={units.errorMessage}
              onSelectUnit={units.setSelectedUnitId}
              onRefreshUnits={units.refresh}
              onOpenFinance={() => navigationRef.navigate('Finance')}
              deepLinkBookingId={pendingBookingId}
              onConsumeDeepLinkBookingId={(bookingId) =>
                setPendingBookingId((current) => (current === bookingId ? null : current))
              }
            />
          )}
        </Tab.Screen>

        <Tab.Screen name="Services" options={hiddenTabOptions}>
          {() => (
            <ServicesRequestsScreen
              mode="services"
              session={props.session}
              units={units.units}
              selectedUnitId={units.selectedUnitId}
              selectedUnit={units.selectedUnit}
              unitsLoading={units.isLoading}
              unitsRefreshing={units.isRefreshing}
              unitsErrorMessage={units.errorMessage}
              onSelectUnit={units.setSelectedUnitId}
              onRefreshUnits={units.refresh}
              deepLinkTicketId={
                pendingServiceRequestFocus?.mode === 'services'
                  ? pendingServiceRequestFocus.id
                  : null
              }
              onConsumeDeepLinkTicketId={(requestId) =>
                setPendingServiceRequestFocus((current) =>
                  current &&
                  current.mode === 'services' &&
                  current.id === requestId
                    ? null
                    : current,
                )
              }
            />
          )}
        </Tab.Screen>

        <Tab.Screen name="Requests" options={hiddenTabOptions}>
          {() => (
            <ServicesRequestsScreen
              mode="requests"
              session={props.session}
              units={units.units}
              selectedUnitId={units.selectedUnitId}
              selectedUnit={units.selectedUnit}
              unitsLoading={units.isLoading}
              unitsRefreshing={units.isRefreshing}
              unitsErrorMessage={units.errorMessage}
              onSelectUnit={units.setSelectedUnitId}
              onRefreshUnits={units.refresh}
              deepLinkTicketId={
                pendingServiceRequestFocus?.mode === 'requests'
                  ? pendingServiceRequestFocus.id
                  : null
              }
              onConsumeDeepLinkTicketId={(requestId) =>
                setPendingServiceRequestFocus((current) =>
                  current &&
                  current.mode === 'requests' &&
                  current.id === requestId
                    ? null
                    : current,
                )
              }
            />
          )}
        </Tab.Screen>

        <Tab.Screen name="Complaints" options={hiddenTabOptions}>
          {() => (
            <ComplaintsScreen
              session={props.session}
              units={units.units}
              selectedUnitId={units.selectedUnitId}
              selectedUnit={units.selectedUnit}
              unitsLoading={units.isLoading}
              unitsRefreshing={units.isRefreshing}
              unitsErrorMessage={units.errorMessage}
              onSelectUnit={units.setSelectedUnitId}
              onRefreshUnits={units.refresh}
              deepLinkComplaintId={pendingComplaintId}
              onConsumeDeepLinkComplaintId={(complaintId) =>
                setPendingComplaintId((current) =>
                  current === complaintId ? null : current,
                )
              }
            />
          )}
        </Tab.Screen>

        <Tab.Screen
          name="Access"
          options={{
            title: t('tabs.qrCodes'),
            tabBarLabel: t('tabs.qrCodes'),
            ...(hideQrTabForSelectedUnit
              ? hiddenTabOptions
              : null),
          }}
        >
          {() => (
            <AccessQrScreen
              session={props.session}
              units={units.units}
              selectedUnitId={units.selectedUnitId}
              selectedUnit={units.selectedUnit}
              unitsLoading={units.isLoading}
              unitsRefreshing={units.isRefreshing}
              unitsErrorMessage={units.errorMessage}
              onSelectUnit={units.setSelectedUnitId}
              onRefreshUnits={units.refresh}
              deepLinkAccessQrId={pendingAccessQrId}
              onConsumeDeepLinkAccessQrId={(qrId) =>
                setPendingAccessQrId((current) => (current === qrId ? null : current))
              }
            />
          )}
        </Tab.Screen>

        <Tab.Screen name="Finance" options={hiddenTabOptions}>
          {() => (
            <FinanceScreen
              session={props.session}
              units={units.units}
              selectedUnitId={units.selectedUnitId}
              onSelectUnit={units.setSelectedUnitId}
              onRefreshUnits={units.refresh}
              unitsRefreshing={units.isRefreshing}
              unitsLoading={units.isLoading}
              unitsErrorMessage={units.errorMessage}
              deepLinkFocus={pendingFinanceFocus}
              onConsumeDeepLinkFocus={(entityType, entityId) =>
                setPendingFinanceFocus((current) =>
                  current &&
                  current.entityType === entityType &&
                  current.entityId === entityId
                    ? null
                    : current,
                )
              }
            />
          )}
        </Tab.Screen>

        <Tab.Screen name="Household" options={hiddenTabOptions}>
          {() => (
            <HouseholdHubScreen
              session={props.session}
              units={units.units}
              selectedUnitId={units.selectedUnitId}
              selectedUnit={units.selectedUnit}
              unitsLoading={units.isLoading}
              unitsRefreshing={units.isRefreshing}
              unitsErrorMessage={units.errorMessage}
              onSelectUnit={units.setSelectedUnitId}
              onRefreshUnits={units.refresh}
            />
          )}
        </Tab.Screen>

        <Tab.Screen name="Utilities" options={hiddenTabOptions}>
          {() => (
            <UtilityTrackerScreen
              session={props.session}
              units={units.units}
              selectedUnitId={units.selectedUnitId}
              selectedUnit={units.selectedUnit}
              unitsLoading={units.isLoading}
              unitsRefreshing={units.isRefreshing}
              unitsErrorMessage={units.errorMessage}
              onSelectUnit={units.setSelectedUnitId}
              onRefreshUnits={units.refresh}
            />
          )}
        </Tab.Screen>

        <Tab.Screen name="Discover" options={hiddenTabOptions}>
          {() => <DiscoverScreen session={props.session} />}
        </Tab.Screen>

        <Tab.Screen name="HelpCenter" options={hiddenTabOptions}>
          {() => <HelpCenterScreen session={props.session} />}
        </Tab.Screen>

        <Tab.Screen
          name="Profile"
          options={{
            tabBarLabel: t('tabs.profile'),
          }}
        >
          {() => (
            <SessionHomeScreen
              session={props.session}
              isRefreshing={props.isRefreshing}
              refreshError={props.refreshError}
              onRefreshSession={props.onRefreshSession}
              onLogout={props.onLogout}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>
      </NavigationContainer>
      {currentRouteName !== 'Home' && !drawerOpen ? (
        <Pressable
          onPress={() => {
            if (navigationRef.isReady()) navigationRef.navigate('Home');
          }}
          style={[
            shellStyles.globalBackButton,
            { top: Math.max(insets.top, 8) + 4 },
          ]}
        >
          <Ionicons name="chevron-back" size={18} color={akColors.text} />
          <Text style={shellStyles.globalBackText}>{t('common.back')}</Text>
        </Pressable>
      ) : null}
      <ForegroundNotificationToast onPressToast={navigateFromPushPayload} />
      <FireEvacuationAlertModal
        visible={fireModalVisible}
        status={fireStatus}
        isSubmitting={fireAckSubmitting}
        onConfirmSafe={() => void handleAcknowledgeFire()}
        onCloseAcknowledged={() => setForceFireModal(false)}
      />
      <UnitPickerSheet
        visible={units.requiresSelection}
        units={units.units}
        selectedUnitId={units.selectedUnitId}
        anchorTop={Math.max(insets.top, 8) + 22}
        anchorRight={10}
        isLoading={units.isLoading}
        isRefreshing={units.isRefreshing}
        onRefresh={() => void units.refresh()}
        onClose={() => {
          // Gate is mandatory for multi-unit users.
        }}
        onSelect={units.setSelectedUnitId}
      />

      <AppDrawerMenu
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        email={props.session.email}
        profile={bootstrapProfile}
        units={units.units}
        selectedUnitId={units.selectedUnitId}
        onSelectUnit={units.setSelectedUnitId}
        onNavigate={navigateToRoute}
        onLogout={() => void props.onLogout()}
        notificationUnreadCount={realtime.unreadCount}
      />
    </>
  );
}

function ForegroundNotificationToast({
  onPressToast,
}: {
  onPressToast?: (payload: {
    route?: string;
    entityType?: string;
    entityId?: string;
    notificationId?: string;
  }) => void;
}) {
  const realtime = useNotificationRealtime();
  if (!realtime.foregroundToast) return null;

  return (
    <Pressable
      onPress={() => {
        onPressToast?.({
          route: realtime.foregroundToast?.route,
          entityType: realtime.foregroundToast?.entityType,
          entityId: realtime.foregroundToast?.entityId,
          notificationId: realtime.foregroundToast?.id,
        });
        realtime.dismissForegroundToast();
      }}
      style={shellStyles.toastWrap}
    >
      <View style={shellStyles.toastCard}>
        <Text numberOfLines={1} style={shellStyles.toastTitle}>
          {realtime.foregroundToast.title}
        </Text>
        {realtime.foregroundToast.body ? (
          <Text numberOfLines={2} style={shellStyles.toastBody}>
            {realtime.foregroundToast.body}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const shellStyles = StyleSheet.create({
  globalBackButton: {
    position: 'absolute',
    left: 12,
    zIndex: 990,
    minHeight: 36,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  globalBackText: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  toastWrap: {
    position: 'absolute',
    top: 48,
    left: 12,
    right: 12,
    zIndex: 999,
  },
  toastCard: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.95)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  toastTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: akColors.text,
  },
  toastBody: {
    marginTop: 2,
    fontSize: 12,
    color: akColors.textMuted,
  },
});
