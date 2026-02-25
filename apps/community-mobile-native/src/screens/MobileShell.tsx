import { useEffect, useMemo, useState } from 'react';
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
import { NotificationsListScreen } from './NotificationsListScreen';
import { SessionHomeScreen } from './SessionHomeScreen';
import { ServicesRequestsScreen } from './ServicesRequestsScreen';
import { HouseholdHubScreen } from './HouseholdHubScreen';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type MobileShellProps = {
  session: AuthSession;
  isRefreshing: boolean;
  refreshError: string | null;
  onRefreshSession: () => Promise<void>;
  onLogout: () => Promise<void>;
};

type RootTabsParamList = {
  Home: undefined;
  Notifications: undefined;
  Bookings: undefined;
  Services: undefined;
  Requests: undefined;
  Complaints: undefined;
  Access: undefined;
  Finance: undefined;
  Household: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RootTabsParamList>();

function tabIcon(routeName: keyof RootTabsParamList, color: string, size: number) {
  switch (routeName) {
    case 'Home':
      return <Ionicons name="home-outline" size={size} color={color} />;
    case 'Notifications':
      return <Ionicons name="notifications-outline" size={size} color={color} />;
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
  const navigationRef = useNavigationContainerRef<RootTabsParamList>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentRouteName, setCurrentRouteName] = useState<keyof RootTabsParamList>('Home');
  const [bootstrapProfile, setBootstrapProfile] = useState<AuthBootstrapProfile | null>(null);
  const units = useResidentUnits(props.session.accessToken);
  const realtime = useNotificationRealtime();
  const insets = useSafeAreaInsets();
  const { brand } = useBranding();
  const brandPrimary = brand.primaryColor || akColors.primary;
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

    const route = String(payload.route ?? '').toLowerCase();
    if (route.includes('payments') || route.includes('violations')) {
      navigationRef.navigate('Finance');
      return;
    }
    if (route.includes('booking')) {
      navigationRef.navigate('Bookings');
      return;
    }
    if (route.includes('request')) {
      navigationRef.navigate('Requests');
      return;
    }
    if (route.includes('service')) {
      navigationRef.navigate('Services');
      return;
    }
    if (route.includes('complaint')) {
      navigationRef.navigate('Complaints');
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
            paddingBottom: 78,
          },
          tabBarStyle: {
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: 10,
            height: 72,
            borderRadius: 22,
            backgroundColor: 'rgba(255,255,255,0.98)',
            borderTopColor: 'transparent',
            borderWidth: 1,
            borderColor: 'rgba(226,232,240,0.85)',
            paddingBottom: 8,
            paddingTop: 8,
            paddingHorizontal: 6,
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
        <Tab.Screen name="Home">
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

        <Tab.Screen name="Notifications" options={hiddenTabOptions}>
          {() => <NotificationsListScreen session={props.session} />}
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
            />
          )}
        </Tab.Screen>

        <Tab.Screen
          name="Access"
          options={{
            title: 'Access QR',
            tabBarLabel: 'QR Codes',
            ...(bootstrapProfile?.featureAvailability?.canUseQr === false
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

        <Tab.Screen
          name="Profile"
          options={{
            tabBarLabel: 'Profile',
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
          <Text style={shellStyles.globalBackText}>Back</Text>
        </Pressable>
      ) : null}
      <ForegroundNotificationToast onPressToast={navigateFromPushPayload} />

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
