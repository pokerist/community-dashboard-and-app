import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { akColors, akShadow } from '../../theme/alkarma';

type ToastVariant = 'success' | 'error' | 'info';

type ToastItem = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  durationMs?: number;
};

type AppToastContextValue = {
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
};

const AppToastContext = createContext<AppToastContextValue | null>(null);

function variantMeta(variant: ToastVariant) {
  switch (variant) {
    case 'success':
      return {
        icon: 'checkmark-circle' as const,
        iconColor: '#059669',
        borderColor: '#A7F3D0',
        bg: '#ECFDF5',
      };
    case 'error':
      return {
        icon: 'alert-circle' as const,
        iconColor: '#DC2626',
        borderColor: '#FECACA',
        bg: '#FEF2F2',
      };
    default:
      return {
        icon: 'information-circle' as const,
        iconColor: '#2563EB',
        borderColor: '#BFDBFE',
        bg: '#EFF6FF',
      };
  }
}

export function AppToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissCurrent = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  const scheduleDismiss = useCallback((durationMs: number) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      dismissCurrent();
    }, durationMs);
  }, [dismissCurrent]);

  const showToast = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const item: ToastItem = {
        ...toast,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      };
      setQueue((prev) => {
        const next = [...prev, item];
        return next.slice(-3);
      });
      scheduleDismiss(toast.durationMs ?? 2600);
    },
    [scheduleDismiss],
  );

  const api = useMemo<AppToastContextValue>(
    () => ({
      showToast,
      success: (title, description) =>
        showToast({ title, description, variant: 'success' }),
      error: (title, description) =>
        showToast({ title, description, variant: 'error', durationMs: 3400 }),
      info: (title, description) =>
        showToast({ title, description, variant: 'info' }),
    }),
    [showToast],
  );

  const current = queue[0] ?? null;
  const meta = current ? variantMeta(current.variant) : null;

  return (
    <AppToastContext.Provider value={api}>
      {children}
      {current && meta ? (
        <Pressable style={styles.wrap} onPress={dismissCurrent}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: meta.bg,
                borderColor: meta.borderColor,
              },
            ]}
          >
            <View style={styles.iconWrap}>
              <Ionicons name={meta.icon} size={18} color={meta.iconColor} />
            </View>
            <View style={styles.textWrap}>
              <Text numberOfLines={2} style={styles.title}>
                {current.title}
              </Text>
              {current.description ? (
                <Text numberOfLines={3} style={styles.desc}>
                  {current.description}
                </Text>
              ) : null}
            </View>
          </View>
        </Pressable>
      ) : null}
    </AppToastContext.Provider>
  );
}

export function useAppToast() {
  const ctx = useContext(AppToastContext);
  if (!ctx) {
    throw new Error('useAppToast must be used inside AppToastProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 92,
    zIndex: 1000,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    ...akShadow.card,
  },
  iconWrap: {
    width: 20,
    alignItems: 'center',
    paddingTop: 1,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  desc: {
    color: akColors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
});

