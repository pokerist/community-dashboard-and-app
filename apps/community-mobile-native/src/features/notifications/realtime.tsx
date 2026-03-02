import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { extractApiErrorMessage } from '../../lib/http';
import type { AuthSession } from '../auth/types';
import { useBranding } from '../branding/provider';
import { getBrandPalette } from '../branding/palette';
import {
  listMyNotificationChanges,
  listMyNotifications,
  markNotificationAsRead,
  registerPushDeviceToken,
  revokePushDeviceToken,
} from './service';
import type { MobileNotificationRow } from './types';

// Expo Go / device-specific notification support can vary.
// Never let notification handler setup crash app boot.
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: false,
      shouldShowList: false,
    }),
  });
} catch {
  // Fallback to polling-only mode if notifications runtime isn't available.
}

type ConnectionState = 'idle' | 'syncing' | 'polling' | 'backoff' | 'error';

type ForegroundToast = {
  id: string;
  title: string;
  body?: string;
  route?: string;
  entityType?: string;
  entityId?: string;
};

type NotificationRealtimeContextValue = {
  rows: MobileNotificationRow[];
  unreadCount: number;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  markingId: string | null;
  errorMessage: string | null;
  connectionState: ConnectionState;
  lastSyncAt: string | null;
  refreshNow: () => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
  foregroundToast: ForegroundToast | null;
  dismissForegroundToast: () => void;
  pendingPushNavigation: {
    route?: string;
    entityType?: string;
    entityId?: string;
    notificationId?: string;
  } | null;
  consumePendingPushNavigation: () => void;
};

const NotificationRealtimeContext =
  createContext<NotificationRealtimeContextValue | null>(null);

function normalizeCreatedAt(value?: string | null): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

function sanitizeCursor(value?: string | null): string | null {
  if (!value) return null;
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return null;
  const maxAllowed = Date.now() + 60_000;
  const safeTs = Math.min(ts, maxAllowed);
  return new Date(safeTs).toISOString();
}

function mergeRows(
  prev: MobileNotificationRow[],
  incoming: MobileNotificationRow[],
): MobileNotificationRow[] {
  const byId = new Map<string, MobileNotificationRow>();
  for (const row of prev) byId.set(row.id, row);
  for (const row of incoming) {
    const existing = byId.get(row.id);
    byId.set(row.id, existing ? { ...existing, ...row } : row);
  }
  return Array.from(byId.values())
    .sort((a, b) => normalizeCreatedAt(b.createdAt || b.sentAt) - normalizeCreatedAt(a.createdAt || a.sentAt))
    .slice(0, 200);
}

function inferPlatform(): 'ANDROID' | 'IOS' | 'WEB' {
  if (Platform.OS === 'ios') return 'IOS';
  if (Platform.OS === 'android') return 'ANDROID';
  return 'WEB';
}

async function getExpoPushTokenSafe(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return null;
    if (!Device.isDevice) return null;

    const permission = await Notifications.getPermissionsAsync();
    let finalStatus = permission.status;
    if (finalStatus !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      finalStatus = req.status;
    }
    if (finalStatus !== 'granted') return null;

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId ??
      undefined;

    const tokenResp = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    return tokenResp?.data ?? null;
  } catch {
    return null;
  }
}

async function getNativeDevicePushTokenSafe(): Promise<{
  token: string;
  provider: 'fcm';
} | null> {
  try {
    if (Platform.OS === 'web') return null;
    if (Platform.OS !== 'android') return null;
    if (!Device.isDevice) return null;

    const permission = await Notifications.getPermissionsAsync();
    let finalStatus = permission.status;
    if (finalStatus !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      finalStatus = req.status;
    }
    if (finalStatus !== 'granted') return null;

    const nativeToken = await Notifications.getDevicePushTokenAsync();
    const token =
      typeof nativeToken?.data === 'string'
        ? nativeToken.data
        : nativeToken?.data
          ? String(nativeToken.data)
          : '';
    if (!token.trim()) return null;

    return { token, provider: 'fcm' };
  } catch {
    return null;
  }
}

type ProviderProps = {
  session: AuthSession;
  onNavigateFromPush?: (payload: {
    route?: string;
    entityType?: string;
    entityId?: string;
    notificationId?: string;
  }) => void;
  children: React.ReactNode;
};

export function NotificationRealtimeProvider({
  session,
  onNavigateFromPush,
  children,
}: ProviderProps) {
  const { brand } = useBranding();
  const palette = getBrandPalette(brand);
  const [rows, setRows] = useState<MobileNotificationRow[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [foregroundToast, setForegroundToast] = useState<ForegroundToast | null>(
    null,
  );
  const [pendingPushNavigation, setPendingPushNavigation] = useState<{
    route?: string;
    entityType?: string;
    entityId?: string;
    notificationId?: string;
  } | null>(null);

  const cursorRef = useRef<string | null>(null);
  const supportsChangesRef = useRef(true);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPollingRef = useRef(false);
  const backoffMsRef = useRef(5000);
  const emptyPollStreakRef = useRef(0);
  const recentIdsRef = useRef<string[]>([]);
  const backendDeviceTokenIdRef = useRef<string | null>(null);
  const unmountedRef = useRef(false);

  const trackRecentId = useCallback((id?: string | null) => {
    if (!id) return;
    recentIdsRef.current = [id, ...recentIdsRef.current.filter((x) => x !== id)].slice(
      0,
      200,
    );
  }, []);

  const applyRows = useCallback(
    (incoming: MobileNotificationRow[]) => {
      if (!incoming.length) return;
      for (const row of incoming) trackRecentId(row.id);
      setRows((prev) => mergeRows(prev, incoming));
    },
    [trackRecentId],
  );

  const setCursorFromRows = useCallback((incoming: MobileNotificationRow[]) => {
    const newestTs = incoming.reduce((maxTs, row) => {
      const ts = normalizeCreatedAt(row.createdAt || row.sentAt);
      return ts > maxTs ? ts : maxTs;
    }, 0);
    if (!newestTs) return;
    const clampedTs = Math.min(newestTs, Date.now() + 60_000);
    cursorRef.current = new Date(clampedTs).toISOString();
  }, []);

  const fullRefresh = useCallback(async () => {
    const result = await listMyNotifications(session.accessToken, {
      page: 1,
      limit: 50,
    });
    setRows(result.data);
    setCursorFromRows(result.data);
    result.data.forEach((row) => trackRecentId(row.id));
    setLastSyncAt(new Date().toISOString());
    setErrorMessage(null);
  }, [session.accessToken, setCursorFromRows, trackRecentId]);

  const deltaPoll = useCallback(async () => {
    if (!supportsChangesRef.current) {
      await fullRefresh();
      return;
    }

    const result = await listMyNotificationChanges(session.accessToken, {
      after: cursorRef.current,
      limit: 50,
    });
    if (result.data.length) {
      applyRows(result.data);
      emptyPollStreakRef.current = 0;
    } else {
      emptyPollStreakRef.current += 1;
      // Guard against stale cursors or drift: force a periodic full sync.
      if (emptyPollStreakRef.current >= 12) {
        emptyPollStreakRef.current = 0;
        await fullRefresh();
        return;
      }
    }
    const nextCursor = sanitizeCursor(result.meta.nextCursor);
    cursorRef.current = nextCursor ?? cursorRef.current;
    setLastSyncAt(result.meta.serverTime || new Date().toISOString());
    setErrorMessage(null);
  }, [applyRows, fullRefresh, session.accessToken]);

  const refreshNow = useCallback(async () => {
    setIsRefreshing(true);
    setConnectionState('syncing');
    try {
      await deltaPoll();
      backoffMsRef.current = 5000;
      setConnectionState('idle');
    } catch (error) {
      const message = extractApiErrorMessage(error);
      setErrorMessage(message);
      setConnectionState('error');
      if (
        typeof message === 'string' &&
        (message.includes('404') || message.includes('Cannot GET /notifications/me/changes'))
      ) {
        supportsChangesRef.current = false;
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [deltaPoll]);

  const markRead = useCallback(
    async (notificationId: string) => {
      setMarkingId(notificationId);
      try {
        const ok = await markNotificationAsRead(session.accessToken, notificationId);
        if (!ok) throw new Error('Notification not found or not accessible');
        setRows((prev) =>
          prev.map((row) =>
            row.id === notificationId
              ? {
                  ...row,
                  isRead: true,
                  logs: Array.isArray(row.logs)
                    ? row.logs.map((log) =>
                        String(log.channel).toUpperCase() === 'IN_APP'
                          ? { ...log, status: 'READ' }
                          : log,
                      )
                    : row.logs,
                }
              : row,
          ),
        );
      } catch (error) {
        setErrorMessage(extractApiErrorMessage(error));
      } finally {
        setMarkingId(null);
      }
    },
    [session.accessToken],
  );

  const scheduleNextPoll = useCallback(
    (delayMs: number) => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = setTimeout(async () => {
        if (unmountedRef.current) return;
        if (appStateRef.current !== 'active') {
          scheduleNextPoll(1000);
          return;
        }
        if (isPollingRef.current) {
          scheduleNextPoll(1000);
          return;
        }

        isPollingRef.current = true;
        setConnectionState(backoffMsRef.current > 5000 ? 'backoff' : 'polling');
        try {
          await deltaPoll();
          backoffMsRef.current = 5000;
          setConnectionState('idle');
          scheduleNextPoll(5000);
        } catch (error) {
          const message = extractApiErrorMessage(error);
          setErrorMessage(message);
          setConnectionState('error');
          backoffMsRef.current = Math.min(backoffMsRef.current * 2, 30000);
          scheduleNextPoll(backoffMsRef.current);
        } finally {
          isPollingRef.current = false;
        }
      }, delayMs);
    },
    [deltaPoll],
  );

  useEffect(() => {
    unmountedRef.current = false;
    supportsChangesRef.current = true;
    backoffMsRef.current = 5000;
    cursorRef.current = null;
    emptyPollStreakRef.current = 0;

    (async () => {
      setIsInitialLoading(true);
      setConnectionState('syncing');
      try {
        await fullRefresh();
        setConnectionState('idle');
      } catch (error) {
        setErrorMessage(extractApiErrorMessage(error));
        setConnectionState('error');
      } finally {
        setIsInitialLoading(false);
        scheduleNextPoll(5000);
      }
    })();

    return () => {
      unmountedRef.current = true;
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    };
  }, [fullRefresh, scheduleNextPoll]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if (prev.match(/inactive|background/) && nextState === 'active') {
        void refreshNow();
      }
    });
    return () => sub.remove();
  }, [refreshNow]);

  useEffect(() => {
    let cancelled = false;
    let receivedSub: Notifications.EventSubscription | null = null;
    let responseSub: Notifications.EventSubscription | null = null;

    (async () => {
      if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: palette.primary,
          });
        } catch {
          // Ignore channel setup failures in Expo Go / unsupported environments.
        }
      }

      try {
        const nativePush = await getNativeDevicePushTokenSafe();
        const expoToken = nativePush ? null : await getExpoPushTokenSafe();
        const tokenToRegister = nativePush?.token ?? expoToken;
        const provider =
          nativePush?.provider ?? (expoToken ? 'expo' : null);

        if (!cancelled && tokenToRegister && provider) {
          try {
            const androidId =
              Platform.OS === 'android'
                ? Application.getAndroidId()
                : null;
            const registered = await registerPushDeviceToken(session.accessToken, {
              token: tokenToRegister,
              platform: inferPlatform(),
              deviceId: androidId ?? ((Constants as any).sessionId ?? undefined),
              appVersion:
                Application.nativeApplicationVersion ??
                Constants.expoConfig?.version ??
                undefined,
              metadata: {
                pushProvider: provider,
                expoProjectId:
                  Constants?.expoConfig?.extra?.eas?.projectId ??
                  (Constants as any)?.easConfig?.projectId ??
                  null,
                platformOs: Platform.OS,
                deviceName: Device.deviceName ?? null,
                osVersion: Device.osVersion ?? null,
                tokenSource: nativePush ? 'native-device-token' : 'expo-token',
              },
            });
            backendDeviceTokenIdRef.current = registered.id || null;
          } catch (error) {
            // Do not break realtime polling if push token registration fails.
            setErrorMessage(extractApiErrorMessage(error));
          }
        }

        receivedSub = Notifications.addNotificationReceivedListener((event) => {
          const data = (event.request.content.data ?? {}) as Record<string, unknown>;
          const notificationId =
            typeof data.notificationId === 'string' ? data.notificationId : null;
          if (notificationId) trackRecentId(notificationId);
          setForegroundToast({
            id: notificationId || `local-${Date.now()}`,
            title: String(event.request.content.title ?? 'New notification'),
            body: String(event.request.content.body ?? ''),
            route: typeof data.route === 'string' ? data.route : undefined,
            entityType:
              typeof data.entityType === 'string' ? data.entityType : undefined,
            entityId: typeof data.entityId === 'string' ? data.entityId : undefined,
          });
          void refreshNow();
        });

        responseSub = Notifications.addNotificationResponseReceivedListener((res) => {
          const data = (res.notification.request.content.data ?? {}) as Record<
            string,
            unknown
          >;
          onNavigateFromPush?.({
            route: typeof data.route === 'string' ? data.route : undefined,
            entityType:
              typeof data.entityType === 'string' ? data.entityType : undefined,
            entityId: typeof data.entityId === 'string' ? data.entityId : undefined,
            notificationId:
              typeof data.notificationId === 'string'
                ? data.notificationId
                : undefined,
          });
          setPendingPushNavigation({
            route: typeof data.route === 'string' ? data.route : undefined,
            entityType:
              typeof data.entityType === 'string' ? data.entityType : undefined,
            entityId: typeof data.entityId === 'string' ? data.entityId : undefined,
            notificationId:
              typeof data.notificationId === 'string'
                ? data.notificationId
                : undefined,
          });
          void refreshNow();
        });

        try {
          const lastResponse = await Notifications.getLastNotificationResponseAsync();
          const data = (lastResponse?.notification?.request?.content?.data ??
            {}) as Record<string, unknown>;
          if (
            typeof data.route === 'string' ||
            typeof data.notificationId === 'string' ||
            typeof data.entityId === 'string'
          ) {
            setPendingPushNavigation({
              route: typeof data.route === 'string' ? data.route : undefined,
              entityType:
                typeof data.entityType === 'string' ? data.entityType : undefined,
              entityId:
                typeof data.entityId === 'string' ? data.entityId : undefined,
              notificationId:
                typeof data.notificationId === 'string'
                  ? data.notificationId
                  : undefined,
            });
          }
        } catch {
          // Ignore if unavailable in current environment (e.g., Expo Go limitations).
        }
      } catch (error) {
        // Polling remains active even if the notifications runtime is unavailable.
        setErrorMessage(extractApiErrorMessage(error));
      }
    })();

    return () => {
      cancelled = true;
      receivedSub?.remove();
      responseSub?.remove();
      const tokenId = backendDeviceTokenIdRef.current;
      backendDeviceTokenIdRef.current = null;
      if (tokenId) {
        void revokePushDeviceToken(session.accessToken, tokenId).catch(() => undefined);
      }
    };
  }, [
    onNavigateFromPush,
    palette.primary,
    refreshNow,
    session.accessToken,
    trackRecentId,
  ]);

  const unreadCount = useMemo(
    () => rows.filter((row) => !row.isRead).length,
    [rows],
  );

  const value = useMemo<NotificationRealtimeContextValue>(
    () => ({
      rows,
      unreadCount,
      isInitialLoading,
      isRefreshing,
      markingId,
      errorMessage,
      connectionState,
      lastSyncAt,
      refreshNow,
      markRead,
      foregroundToast,
      dismissForegroundToast: () => setForegroundToast(null),
      pendingPushNavigation,
      consumePendingPushNavigation: () => setPendingPushNavigation(null),
    }),
    [
      rows,
      unreadCount,
      isInitialLoading,
      isRefreshing,
      markingId,
      errorMessage,
      connectionState,
      lastSyncAt,
      refreshNow,
      markRead,
      foregroundToast,
      pendingPushNavigation,
    ],
  );

  return (
    <NotificationRealtimeContext.Provider value={value}>
      {children}
    </NotificationRealtimeContext.Provider>
  );
}

export function useNotificationRealtime() {
  const ctx = useContext(NotificationRealtimeContext);
  if (!ctx) {
    throw new Error(
      'useNotificationRealtime must be used inside NotificationRealtimeProvider',
    );
  }
  return ctx;
}
