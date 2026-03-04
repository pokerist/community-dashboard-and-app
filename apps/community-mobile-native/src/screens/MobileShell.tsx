import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  useNavigationContainerRef,
} from '@react-navigation/native';
import {
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
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
import { PaymentsScreen } from './PaymentsScreen';
import { InvoicesViolationsScreen } from './InvoicesViolationsScreen';
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
import { SmartHomeScreen } from './SmartHomeScreen';
import { UnitPickerSheet } from '../components/mobile/UnitPickerSheet';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Vibration,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import { useAppToast } from '../components/mobile/AppToast';
import { BottomNavMetricsProvider } from '../features/layout/BottomNavMetricsContext';
import { FireEvacuationAlertModal } from '../components/mobile/FireEvacuationAlertModal';
import {
  type UploadedAttachment,
  uploadServiceAttachmentFile,
} from '../features/files/service';
import {
  acknowledgeFireEvacuation,
  createSosAlert,
  getMyFireEvacuationStatus,
  requestFireEvacuationHelp,
} from '../features/community/service';
import type { FireEvacuationStatus } from '../features/community/types';

type MobileShellProps = {
  session: AuthSession;
  isRefreshing: boolean;
  refreshError: string | null;
  onRefreshSession: () => Promise<void>;
  onLogout: () => Promise<void>;
};

type FireStatusBanner = {
  kind: 'safe' | 'help';
  title: string;
  description: string;
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
  Payments: undefined;
  InvoicesViolations: undefined;
  Household: undefined;
  Utilities: undefined;
  Discover: undefined;
  HelpCenter: undefined;
  SmartHome: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RootTabsParamList>();
const PRIMARY_TAB_ROUTES: Array<keyof RootTabsParamList> = ['Home', 'Access', 'Profile'];

function tabIcon(routeName: keyof RootTabsParamList, color: string, size: number) {
  switch (routeName) {
    case 'Home':
      return <Ionicons name="home-outline" size={size} color={color} />;
    case 'Access':
      return <Ionicons name="qr-code-outline" size={size} color={color} />;
    case 'Profile':
      return <Ionicons name="person-outline" size={size} color={color} />;
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
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [bootstrapProfile, setBootstrapProfile] = useState<AuthBootstrapProfile | null>(null);
  const [profileAvatarPreviewUri, setProfileAvatarPreviewUri] = useState<string | null>(null);
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
  const [fireHelpSubmitting, setFireHelpSubmitting] = useState(false);
  const [forceFireModal, setForceFireModal] = useState(false);
  const [fireStatusBanner, setFireStatusBanner] = useState<FireStatusBanner | null>(
    null,
  );
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [sosSubmitting, setSosSubmitting] = useState(false);
  const [sosLocating, setSosLocating] = useState(false);
  const [sosLocation, setSosLocation] = useState<{
    lat: number;
    lng: number;
    accuracy?: number;
    capturedAt?: string;
  } | null>(null);
  const [sosVoice, setSosVoice] = useState<UploadedAttachment | null>(null);
  const [sosRecording, setSosRecording] = useState<Audio.Recording | null>(null);
  const [sosRecordingBusy, setSosRecordingBusy] = useState(false);
  const [sosRecordingSeconds, setSosRecordingSeconds] = useState(0);
  const [sosNote, setSosNote] = useState('');
  const sosPulseAnim = useRef(new Animated.Value(1)).current;
  const units = useResidentUnits(props.session.accessToken, props.session.userId);
  const realtime = useNotificationRealtime();
  const toast = useAppToast();
  const lastFireAlertAtRef = useRef<string | null>(null);
  const fireActiveRef = useRef(false);
  const fireReconnectToastAtRef = useRef(0);
  const firePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const { brand } = useBranding();
  const brandPrimary = brand.primaryColor || akColors.primary;
  const isTabletLayout = viewportWidth >= 768;
  const effectiveBottomInset = Math.min(Math.max(insets.bottom, 0), 24);
  const tabBarBaseHeight = isTabletLayout ? 66 : 64;
  const tabBarHeight = tabBarBaseHeight + effectiveBottomInset;
  const tabBarBottom = Math.max(effectiveBottomInset, isTabletLayout ? 10 : 8);
  const tabBarHorizontalInset = 12;
  const tabBarWidth = isTabletLayout ? Math.min(640, viewportWidth - 24) : undefined;
  const tabBarVerticalPadding = isTabletLayout ? 8 : 7;
  const bottomContentInset = Math.ceil(tabBarHeight + tabBarBottom + 12);
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
    (fireStatus?.active &&
      fireStatus?.targeted &&
      !fireStatus?.acknowledged &&
      !fireStatus?.needsHelp) ||
      (forceFireModal &&
        fireStatus?.targeted !== false &&
        !fireStatus?.acknowledged &&
        !fireStatus?.needsHelp),
  );

  useEffect(() => {
    fireActiveRef.current = Boolean(fireStatus?.active && fireStatus?.targeted);
  }, [fireStatus]);

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
          setFireStatusBanner(null);
        }
      } catch {
        if (fireActiveRef.current) {
          const now = Date.now();
          if (now - fireReconnectToastAtRef.current > 20000) {
            fireReconnectToastAtRef.current = now;
            toast.info('Emergency status connection issue', 'Reconnecting automatically...');
          }
        }
      } finally {
        if (!forceAlarmHint) setFireChecking(false);
      }
    },
    [props.session.accessToken, t, toast],
  );

  const handleAcknowledgeFire = useCallback(async () => {
    setFireAckSubmitting(true);
    try {
      const next = await acknowledgeFireEvacuation(props.session.accessToken);
      setFireStatus(next);
      setForceFireModal(false);
      setFireStatusBanner({
        kind: 'safe',
        title: 'Evacuated and Safe',
        description: 'Security team has recorded your confirmation.',
      });
      toast.success(t('fire.confirmationSuccess'));
    } catch {
      toast.error(t('fire.confirmationFailed'));
    } finally {
      setFireAckSubmitting(false);
    }
  }, [props.session.accessToken, t, toast]);

  const handleNeedHelpFire = useCallback(async () => {
    setFireHelpSubmitting(true);
    try {
      let payload: {
        source: 'GPS' | 'NO_LOCATION';
        location?: { lat: number; lng: number; accuracy?: number; capturedAt?: string };
      } = {
        source: 'NO_LOCATION',
      };

      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status === 'granted') {
          const current = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            mayShowUserSettingsDialog: true,
          });
          payload = {
            source: 'GPS',
            location: {
              lat: current.coords.latitude,
              lng: current.coords.longitude,
              accuracy: current.coords.accuracy ?? undefined,
              capturedAt: new Date(current.timestamp).toISOString(),
            },
          };
        }
      } catch {
        payload = { source: 'NO_LOCATION' };
      }

      const next = await requestFireEvacuationHelp(props.session.accessToken, payload);
      setFireStatus(next);
      setForceFireModal(false);
      setFireStatusBanner({
        kind: 'help',
        title: 'Help requested',
        description: 'Security team has been notified and is responding.',
      });
      toast.success('Emergency help requested', 'Security team has been notified.');
    } catch {
      toast.error('Failed to request help', 'Please try again or call security.');
    } finally {
      setFireHelpSubmitting(false);
    }
  }, [props.session.accessToken, toast]);

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

  const openUnitPicker = useCallback(() => {
    if (units.units.length <= 1) return;
    setUnitPickerOpen(true);
  }, [units.units.length]);

  const resolveCurrentSosLocation = useCallback(async () => {
    setSosLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        toast.error('Location permission denied', 'Enable location permission then retry SOS.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: true,
      });
      setSosLocation({
        lat: current.coords.latitude,
        lng: current.coords.longitude,
        accuracy: current.coords.accuracy ?? undefined,
        capturedAt: new Date(current.timestamp).toISOString(),
      });
    } catch {
      toast.error('Location unavailable', 'Could not read your current location.');
    } finally {
      setSosLocating(false);
    }
  }, [toast]);

  const openSosModal = useCallback(() => {
    setSosNote('');
    setSosVoice(null);
    setSosLocation(null);
    setSosRecording(null);
    setSosRecordingSeconds(0);
    setSosModalOpen(true);
    void resolveCurrentSosLocation();
  }, [resolveCurrentSosLocation]);

  const stopAndUploadSosRecording = useCallback(async () => {
    if (!sosRecording) return;
    setSosRecordingBusy(true);
    try {
      await sosRecording.stopAndUnloadAsync();
      const uri = sosRecording.getURI();
      setSosRecording(null);
      setSosRecordingSeconds(0);
      if (!uri) {
        toast.error('Recording failed', 'Could not read recorded audio.');
        return;
      }

      const uploaded = await uploadServiceAttachmentFile(
        props.session.accessToken,
        {
          uri,
          name: `sos-voice-${Date.now()}.m4a`,
          mimeType: 'audio/m4a',
        },
      );
      setSosVoice(uploaded);
      toast.success('Voice note attached');
    } catch (error: any) {
      toast.error('Voice recording failed', error?.message ?? 'Please try again.');
      setSosRecording(null);
    } finally {
      setSosRecordingBusy(false);
    }
  }, [props.session.accessToken, sosRecording, toast]);

  const handleSosRecordToggle = useCallback(async () => {
    if (sosRecordingBusy) return;
    if (sosRecording) {
      await stopAndUploadSosRecording();
      return;
    }

    setSosRecordingBusy(true);
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        toast.error('Microphone permission denied', 'Enable microphone permission then try again.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      setSosVoice(null);
      setSosRecording(recording);
      setSosRecordingSeconds(0);
      toast.info('Recording started', 'Press again to stop and send voice note.');
    } catch (error: any) {
      toast.error('Failed to start recording', error?.message ?? 'Please try again.');
    }
    finally {
      setSosRecordingBusy(false);
    }
  }, [sosRecordingBusy, sosRecording, stopAndUploadSosRecording, toast]);

  const closeSosModal = useCallback(() => {
    if (sosSubmitting || sosRecordingBusy) return;
    if (sosRecording) {
      void sosRecording.stopAndUnloadAsync().catch(() => undefined);
      setSosRecording(null);
      setSosRecordingSeconds(0);
    }
    setSosModalOpen(false);
  }, [sosRecording, sosRecordingBusy, sosSubmitting]);

  useEffect(() => {
    return () => {
      if (sosRecording) {
        void sosRecording.stopAndUnloadAsync().catch(() => undefined);
      }
    };
  }, [sosRecording]);

  useEffect(() => {
    if (!sosRecording) return;
    const id = setInterval(() => {
      setSosRecordingSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [sosRecording]);

  useEffect(() => {
    if (!sosRecording) {
      sosPulseAnim.stopAnimation();
      sosPulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sosPulseAnim, {
          toValue: 1.35,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(sosPulseAnim, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      sosPulseAnim.setValue(1);
    };
  }, [sosPulseAnim, sosRecording]);

  const sosRecordingClock = useMemo(() => {
    const min = Math.floor(sosRecordingSeconds / 60)
      .toString()
      .padStart(2, '0');
    const sec = (sosRecordingSeconds % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  }, [sosRecordingSeconds]);

  const handleAttachSosVoice = useCallback(async () => {
    await handleSosRecordToggle();
  }, [handleSosRecordToggle]);

  const handleSubmitSos = useCallback(async () => {
    if (sosRecording) {
      toast.error('Stop recording first', 'Finish voice recording before sending SOS.');
      return;
    }
    setSosSubmitting(true);
    try {
      await createSosAlert(props.session.accessToken, {
        unitId: units.selectedUnitId || undefined,
        note: sosNote.trim() || undefined,
        voiceAttachmentId: sosVoice?.id,
        location: sosLocation || undefined,
      });
      setSosModalOpen(false);
      toast.success('SOS sent', 'Security team has been alerted.');
    } catch (error: any) {
      toast.error('Failed to send SOS', error?.message ?? 'Please try again.');
    } finally {
      setSosSubmitting(false);
    }
  }, [
    props.session.accessToken,
    sosLocation,
    sosNote,
    sosRecording,
    sosVoice?.id,
    toast,
    units.selectedUnitId,
  ]);

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
    const queueInvoiceViolationFocus = () => {
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
      queueInvoiceViolationFocus();
      navigationRef.navigate('InvoicesViolations');
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
      queueInvoiceViolationFocus();
      navigationRef.navigate('InvoicesViolations');
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

  return (
    <>
      <BottomNavMetricsProvider
        value={{
          contentInsetBottom: bottomContentInset,
          barHeight: tabBarHeight,
          barBottom: tabBarBottom,
          fabSize: 0,
          fabLiftPx: 0,
        }}
      >
      <NavigationContainer
        theme={navTheme}
        ref={navigationRef}
        onReady={() => undefined}
        onStateChange={() => {
          if (drawerOpen) setDrawerOpen(false);
        }}
      >
      <Tab.Navigator
        initialRouteName="Home"
        screenOptions={({ route }) => ({
          headerShown: false,
          sceneStyle: {
            backgroundColor: akColors.bg,
            paddingTop: 0,
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
            shadowOpacity: 0.08,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 8 },
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
              onOpenFinance={() => navigation.navigate('Payments')}
              onOpenSmartHome={() => navigation.navigate('SmartHome')}
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
              onOpenUnitPicker={openUnitPicker}
              onOpenFinance={() => navigationRef.navigate('Payments')}
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
              onOpenUnitPicker={openUnitPicker}
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
              onOpenUnitPicker={openUnitPicker}
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
              onOpenUnitPicker={openUnitPicker}
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
              onOpenUnitPicker={openUnitPicker}
              deepLinkAccessQrId={pendingAccessQrId}
              onConsumeDeepLinkAccessQrId={(qrId) =>
                setPendingAccessQrId((current) => (current === qrId ? null : current))
              }
            />
          )}
        </Tab.Screen>

        <Tab.Screen name="Payments" options={hiddenTabOptions}>
          {() => (
            <PaymentsScreen
              session={props.session}
              units={units.units}
              selectedUnitId={units.selectedUnitId}
              unitsRefreshing={units.isRefreshing}
              unitsLoading={units.isLoading}
              unitsErrorMessage={units.errorMessage}
              onOpenUnitPicker={openUnitPicker}
            />
          )}
        </Tab.Screen>

        <Tab.Screen name="InvoicesViolations" options={hiddenTabOptions}>
          {() => (
            <InvoicesViolationsScreen
              session={props.session}
              units={units.units}
              selectedUnitId={units.selectedUnitId}
              unitsRefreshing={units.isRefreshing}
              unitsLoading={units.isLoading}
              unitsErrorMessage={units.errorMessage}
              onOpenUnitPicker={openUnitPicker}
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

        <Tab.Screen name="SmartHome" options={hiddenTabOptions}>
          {() => <SmartHomeScreen />}
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
              onOpenUnitPicker={openUnitPicker}
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
              onProfileBootstrapUpdated={(next) => setBootstrapProfile(next)}
              profileAvatarPreviewUri={profileAvatarPreviewUri}
              onProfileAvatarPreviewUriChange={setProfileAvatarPreviewUri}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>
      </NavigationContainer>
      <ForegroundNotificationToast onPressToast={navigateFromPushPayload} />
      {fireStatusBanner ? (
        <Pressable
          onPress={() => setFireStatusBanner(null)}
          style={[
            shellStyles.fireStatusBannerWrap,
            fireStatusBanner.kind === 'safe'
              ? shellStyles.fireStatusBannerSafe
              : shellStyles.fireStatusBannerHelp,
          ]}
        >
          <Ionicons
            name={fireStatusBanner.kind === 'safe' ? 'checkmark-circle' : 'alert-circle'}
            size={18}
            color={fireStatusBanner.kind === 'safe' ? '#047857' : '#B45309'}
          />
          <View style={shellStyles.fireStatusBannerTextWrap}>
            <Text style={shellStyles.fireStatusBannerTitle}>{fireStatusBanner.title}</Text>
            <Text style={shellStyles.fireStatusBannerDesc}>{fireStatusBanner.description}</Text>
          </View>
          <Ionicons name="close" size={16} color="#475569" />
        </Pressable>
      ) : null}
      <FireEvacuationAlertModal
        visible={fireModalVisible}
        status={fireStatus}
        isSubmitting={fireAckSubmitting}
        isHelpSubmitting={fireHelpSubmitting}
        onConfirmSafe={() => void handleAcknowledgeFire()}
        onNeedHelp={() => void handleNeedHelpFire()}
        onCloseAcknowledged={() => setForceFireModal(false)}
        onRequestClose={() => {
          if (fireStatus?.acknowledged || fireStatus?.needsHelp || !fireStatus?.active) {
            setForceFireModal(false);
          }
        }}
      />
      <UnitPickerSheet
        visible={units.requiresSelection || unitPickerOpen}
        units={units.units}
        selectedUnitId={units.selectedUnitId}
        anchorTop={Math.max(insets.top, 8) + 22}
        anchorRight={10}
        isLoading={units.isLoading}
        isRefreshing={units.isRefreshing}
        onRefresh={() => void units.refresh()}
        onClose={() => {
          if (!units.requiresSelection) setUnitPickerOpen(false);
        }}
        onSelect={(unitId) => {
          units.setSelectedUnitId(unitId);
          setUnitPickerOpen(false);
        }}
      />

      <AppDrawerMenu
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        email={props.session.email}
        profile={bootstrapProfile}
        profileAvatarPreviewUri={profileAvatarPreviewUri}
        units={units.units}
        selectedUnitId={units.selectedUnitId}
        onSelectUnit={units.setSelectedUnitId}
        onNavigate={navigateToRoute}
        onLogout={() => void props.onLogout()}
        notificationUnreadCount={realtime.unreadCount}
      />
      <Pressable
        style={[
          shellStyles.sosFab,
          {
            right: 14,
            bottom: bottomContentInset + 14,
          },
        ]}
        onPress={openSosModal}
      >
        <Text style={shellStyles.sosFabText}>SOS</Text>
      </Pressable>

      <Modal
        transparent
        visible={sosModalOpen}
        animationType="fade"
        onRequestClose={() => {
          closeSosModal();
        }}
      >
        <View style={shellStyles.sosOverlay}>
          <View style={shellStyles.sosCard}>
            <Text style={shellStyles.sosTitle}>Emergency SOS</Text>
            <Text style={shellStyles.sosDescription}>
              Send your live location and optional voice note to security.
            </Text>

            <View style={shellStyles.sosLocationRow}>
              <Text style={shellStyles.sosLabel}>Location</Text>
              {sosLocating ? <ActivityIndicator size="small" color={brandPrimary} /> : null}
            </View>
            <Text style={shellStyles.sosValue}>
              {sosLocation
                ? `${sosLocation.lat.toFixed(5)}, ${sosLocation.lng.toFixed(5)}`
                : 'Not captured yet'}
            </Text>

            <Pressable
              style={shellStyles.sosSecondaryBtn}
              onPress={() => void resolveCurrentSosLocation()}
              disabled={sosLocating || sosSubmitting}
            >
              <Text style={shellStyles.sosSecondaryBtnText}>Refresh location</Text>
            </Pressable>

            <Pressable
              style={shellStyles.sosSecondaryBtn}
              onPress={() => void handleAttachSosVoice()}
              disabled={sosSubmitting || sosRecordingBusy}
            >
              <Text style={shellStyles.sosSecondaryBtnText}>
                {sosRecording
                  ? 'Stop recording'
                  : sosVoice
                    ? 'Re-record voice note'
                    : 'Record voice note'}
              </Text>
            </Pressable>
            {sosRecording ? (
              <View style={shellStyles.sosRecordingRow}>
                <Animated.View
                  style={[
                    shellStyles.sosRecordingDot,
                    { transform: [{ scale: sosPulseAnim }] },
                  ]}
                />
                <Text style={shellStyles.sosRecordingText}>
                  Recording... {sosRecordingClock}
                </Text>
              </View>
            ) : null}
            <Text style={shellStyles.sosHintText}>
              {sosRecording
                ? 'Recording in progress...'
                : sosVoice
                  ? `Attached: ${sosVoice.name}`
                  : 'No voice note recorded'}
            </Text>

            <TextInput
              style={shellStyles.sosNoteInput}
              placeholder="Optional note..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              value={sosNote}
              onChangeText={setSosNote}
              editable={!sosSubmitting}
            />

            <View style={shellStyles.sosActions}>
              <Pressable
                style={shellStyles.sosCancelBtn}
                disabled={sosSubmitting}
                onPress={closeSosModal}
              >
                <Text style={shellStyles.sosCancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[shellStyles.sosSendBtn, sosSubmitting && shellStyles.sosSendBtnDisabled]}
                disabled={sosSubmitting}
                onPress={() => void handleSubmitSos()}
              >
                <Text style={shellStyles.sosSendBtnText}>
                  {sosSubmitting ? 'Sending...' : 'Send SOS'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      </BottomNavMetricsProvider>
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
  toastWrap: {
    position: 'absolute',
    top: 48,
    left: 12,
    right: 12,
    zIndex: 999,
  },
  toastCard: {
    backgroundColor: akColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: akColors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fireStatusBannerWrap: {
    position: 'absolute',
    top: 92,
    left: 12,
    right: 12,
    zIndex: 999,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fireStatusBannerSafe: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  fireStatusBannerHelp: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  fireStatusBannerTextWrap: {
    flex: 1,
  },
  fireStatusBannerTitle: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
  },
  fireStatusBannerDesc: {
    color: '#475569',
    fontSize: 11,
    marginTop: 1,
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
  sosFab: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 7,
    zIndex: 998,
  },
  sosFabText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.4,
  },
  sosOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sosCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sosTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
  },
  sosDescription: {
    marginTop: 4,
    color: '#475569',
    fontSize: 12,
  },
  sosLocationRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sosLabel: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
  },
  sosValue: {
    marginTop: 4,
    color: '#334155',
    fontSize: 12,
  },
  sosSecondaryBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
  },
  sosSecondaryBtnText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '600',
  },
  sosHintText: {
    marginTop: 6,
    color: '#64748B',
    fontSize: 11,
  },
  sosRecordingRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sosRecordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
  },
  sosRecordingText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '700',
  },
  sosNoteInput: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    minHeight: 82,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0F172A',
    textAlignVertical: 'top',
    fontSize: 13,
  },
  sosActions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  sosCancelBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
  },
  sosCancelBtnText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  sosSendBtn: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    backgroundColor: '#DC2626',
  },
  sosSendBtnDisabled: {
    opacity: 0.7,
  },
  sosSendBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
