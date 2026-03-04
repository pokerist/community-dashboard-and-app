import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandedPageHero } from '../components/mobile/BrandedPageHero';
import { ScreenCard } from '../components/mobile/Primitives';
import { useAppToast } from '../components/mobile/AppToast';
import { useBranding } from '../features/branding/provider';
import { getBrandPalette } from '../features/branding/palette';
import { useBottomNavMetrics } from '../features/layout/BottomNavMetricsContext';
import { akColors, akRadius } from '../theme/alkarma';

type DeviceState = {
  id: string;
  name: string;
  room: string;
  type: 'light' | 'ac' | 'curtain' | 'lock';
  enabled: boolean;
  value?: number;
};

const INITIAL_DEVICES: DeviceState[] = [
  { id: 'lr-light-1', room: 'Living Room', name: 'Main Lights', type: 'light', enabled: true, value: 72 },
  { id: 'lr-ac-1', room: 'Living Room', name: 'AC', type: 'ac', enabled: true, value: 23 },
  { id: 'mb-curtain', room: 'Master Bedroom', name: 'Curtains', type: 'curtain', enabled: false, value: 0 },
  { id: 'main-lock', room: 'Entry', name: 'Main Door Lock', type: 'lock', enabled: true },
  { id: 'k-light', room: 'Kitchen', name: 'Kitchen Lights', type: 'light', enabled: false, value: 0 },
  { id: 'bd2-ac', room: 'Bedroom 2', name: 'Bedroom AC', type: 'ac', enabled: false, value: 25 },
];

function deviceIcon(type: DeviceState['type']): React.ComponentProps<typeof Ionicons>['name'] {
  if (type === 'light') return 'bulb-outline';
  if (type === 'ac') return 'snow-outline';
  if (type === 'curtain') return 'apps-outline';
  return 'lock-closed-outline';
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function SmartHomeScreen() {
  const toast = useAppToast();
  const { brand } = useBranding();
  const palette = getBrandPalette(brand);
  const { contentInsetBottom } = useBottomNavMetrics();
  const [devices, setDevices] = useState<DeviceState[]>(INITIAL_DEVICES);

  const grouped = useMemo(() => {
    const map = new Map<string, DeviceState[]>();
    for (const device of devices) {
      const rows = map.get(device.room) ?? [];
      rows.push(device);
      map.set(device.room, rows);
    }
    return Array.from(map.entries());
  }, [devices]);

  const updateDevice = (id: string, patch: Partial<DeviceState>) => {
    setDevices((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const bumpDeviceValue = (device: DeviceState, delta: number) => {
    const current = Number(device.value ?? 0);
    if (device.type === 'light' || device.type === 'curtain') {
      const next = clamp(current + delta, 0, 100);
      updateDevice(device.id, { value: next, enabled: next > 0 });
      return;
    }
    if (device.type === 'ac') {
      const next = clamp(current + delta, 16, 30);
      updateDevice(device.id, { value: next, enabled: true });
    }
  };

  const applyScene = (scene: 'Away' | 'Night' | 'Welcome') => {
    setDevices((prev) =>
      prev.map((row) => {
        if (scene === 'Away') {
          if (row.type === 'lock') return { ...row, enabled: true };
          return { ...row, enabled: false };
        }
        if (scene === 'Night') {
          if (row.type === 'light') return { ...row, enabled: true, value: 25 };
          if (row.type === 'ac') return { ...row, enabled: true, value: 24 };
          if (row.type === 'curtain') return { ...row, enabled: true, value: 100 };
          return row;
        }
        if (row.type === 'light') return { ...row, enabled: true, value: 80 };
        if (row.type === 'ac') return { ...row, enabled: true, value: 22 };
        if (row.type === 'curtain') return { ...row, enabled: false, value: 0 };
        return row;
      }),
    );
    toast.success('Scene applied', `${scene} mode enabled.`);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(110, contentInsetBottom) }]}
      >
        <BrandedPageHero title="Smart Home" subtitle="Control your home devices instantly." />

        <ScreenCard title="Scenes">
          <View style={styles.sceneRow}>
            {(['Away', 'Night', 'Welcome'] as const).map((scene) => (
              <Pressable
                key={scene}
                onPress={() => applyScene(scene)}
                style={[styles.sceneChip, { borderColor: palette.primarySoft22 }]}
              >
                <Text style={[styles.sceneChipText, { color: palette.primary }]}>{scene}</Text>
              </Pressable>
            ))}
          </View>
        </ScreenCard>

        {grouped.map(([room, rows]) => (
          <ScreenCard key={room} title={room}>
            <View style={styles.deviceList}>
              {rows.map((device) => (
                <View key={device.id} style={styles.deviceCard}>
                  <View style={styles.deviceTop}>
                    <View style={styles.deviceTitleRow}>
                      <View style={[styles.deviceIconWrap, { backgroundColor: palette.primarySoft10 }]}>
                        <Ionicons name={deviceIcon(device.type)} size={16} color={palette.primary} />
                      </View>
                      <Text style={styles.deviceName}>{device.name}</Text>
                    </View>
                    <Switch
                      value={device.enabled}
                      onValueChange={(value) => updateDevice(device.id, { enabled: value })}
                      thumbColor={device.enabled ? palette.secondary : '#CBD5E1'}
                      trackColor={{ false: '#E2E8F0', true: palette.primarySoft22 }}
                    />
                  </View>

                  {device.type !== 'lock' ? (
                    <View style={styles.inlineController}>
                      <Text style={styles.sliderLabel}>
                        {device.type === 'ac'
                          ? `Temperature ${Math.round(device.value ?? 24)}°C`
                          : `${device.type === 'curtain' ? 'Open' : 'Brightness'} ${Math.round(device.value ?? 0)}%`}
                      </Text>
                      <View style={styles.adjustButtonsRow}>
                        <Pressable
                          onPress={() => bumpDeviceValue(device, device.type === 'ac' ? -1 : -10)}
                          style={styles.adjustButton}
                        >
                          <Ionicons name="remove" size={16} color={akColors.textMuted} />
                        </Pressable>
                        <Pressable
                          onPress={() => bumpDeviceValue(device, device.type === 'ac' ? 1 : 10)}
                          style={styles.adjustButton}
                        >
                          <Ionicons name="add" size={16} color={akColors.textMuted} />
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </ScreenCard>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: akColors.bg,
  },
  container: {
    paddingHorizontal: 16,
    gap: 12,
    paddingTop: 0,
  },
  sceneRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  sceneChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: akColors.surface,
  },
  sceneChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  deviceList: {
    gap: 10,
  },
  deviceCard: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: akRadius.md,
    padding: 12,
    backgroundColor: '#fff',
    gap: 8,
  },
  deviceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  deviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  deviceIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceName: {
    color: akColors.text,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  inlineController: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sliderLabel: {
    color: akColors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  adjustButtonsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  adjustButton: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: akColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
});
