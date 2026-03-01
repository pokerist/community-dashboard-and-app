import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { AuthSession } from '../features/auth/types';
import type { ResidentUnit } from '../features/community/types';
import { UnitPicker } from '../components/mobile/UnitPicker';
import { useBranding } from '../features/branding/provider';
import { useI18n } from '../features/i18n/provider';
import { akColors, akRadius, akShadow } from '../theme/alkarma';
import { formatCurrency } from '../utils/format';

type UtilityKey = 'water' | 'gas' | 'electricity' | 'internet';

type UtilityTrackerScreenProps = {
  session: AuthSession;
  units: ResidentUnit[];
  selectedUnitId: string | null;
  selectedUnit: ResidentUnit | null;
  unitsLoading: boolean;
  unitsRefreshing: boolean;
  unitsErrorMessage: string | null;
  onSelectUnit: (unitId: string) => void;
  onRefreshUnits: () => Promise<void>;
};

type UtilitySnapshot = {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  usageLabel: string;
  monthlyCap: number;
  currentUsage: number;
  remainingBalance: number;
  estimatedBill: number;
  trend: number[];
  accent: string;
};

const UTILITY_ORDER: UtilityKey[] = ['water', 'gas', 'electricity', 'internet'];

const DUMMY_UTILITY_DATA: Record<UtilityKey, UtilitySnapshot> = {
  water: {
    title: 'utility.water',
    icon: 'water-outline',
    usageLabel: 'm³',
    monthlyCap: 45,
    currentUsage: 18.6,
    remainingBalance: 26.4,
    estimatedBill: 540,
    trend: [12, 14, 15, 17, 19, 18.6],
    accent: '#0284C7',
  },
  gas: {
    title: 'utility.gas',
    icon: 'flame-outline',
    usageLabel: 'm³',
    monthlyCap: 80,
    currentUsage: 29.4,
    remainingBalance: 50.6,
    estimatedBill: 410,
    trend: [20, 24, 25, 27, 30, 29.4],
    accent: '#EA580C',
  },
  electricity: {
    title: 'utility.electricity',
    icon: 'flash-outline',
    usageLabel: 'kWh',
    monthlyCap: 650,
    currentUsage: 318,
    remainingBalance: 332,
    estimatedBill: 1260,
    trend: [260, 278, 290, 301, 322, 318],
    accent: '#D97706',
  },
  internet: {
    title: 'utility.internet',
    icon: 'wifi-outline',
    usageLabel: 'GB',
    monthlyCap: 200,
    currentUsage: 96,
    remainingBalance: 104,
    estimatedBill: 650,
    trend: [58, 66, 73, 82, 90, 96],
    accent: '#7C3AED',
  },
};

export function UtilityTrackerScreen({
  units,
  selectedUnitId,
  selectedUnit,
  unitsLoading: _unitsLoading,
  unitsRefreshing,
  unitsErrorMessage,
  onSelectUnit,
  onRefreshUnits,
}: UtilityTrackerScreenProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { brand } = useBranding();
  const { t } = useI18n();
  const [activeUtility, setActiveUtility] = useState<UtilityKey>('water');
  const brandPrimary = brand.primaryColor || akColors.primary;
  const brandSecondary = brand.secondaryColor || akColors.gold;
  const snapshot = DUMMY_UTILITY_DATA[activeUtility];

  const usageRatio = useMemo(() => {
    if (!snapshot.monthlyCap || snapshot.monthlyCap <= 0) return 0;
    return Math.max(0, Math.min(1, snapshot.currentUsage / snapshot.monthlyCap));
  }, [snapshot.currentUsage, snapshot.monthlyCap]);

  const trendMax = useMemo(() => {
    return Math.max(...snapshot.trend, snapshot.monthlyCap, 1);
  }, [snapshot.monthlyCap, snapshot.trend]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: Math.max(insets.top, 8) + 8 },
        ]}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => {
              if ((navigation as any).canGoBack?.()) {
                (navigation as any).goBack();
                return;
              }
              (navigation as any).navigate?.('Home');
            }}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={18} color={akColors.text} />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </Pressable>
        </View>

        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>{t('utility.title')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('utility.subtitle')}
          </Text>
        </View>

        <UnitPicker
          units={units}
          selectedUnitId={selectedUnitId}
          onSelect={onSelectUnit}
          onRefresh={() => void onRefreshUnits()}
          isRefreshing={unitsRefreshing}
          title={t('utility.unitTitle')}
        />
        {unitsErrorMessage ? <Text style={styles.errorText}>{unitsErrorMessage}</Text> : null}

        <View style={styles.tabsRow}>
          {UTILITY_ORDER.map((key) => {
            const item = DUMMY_UTILITY_DATA[key];
            const active = key === activeUtility;
            return (
              <Pressable
                key={key}
                onPress={() => setActiveUtility(key)}
                style={[
                  styles.tabItem,
                  active && {
                    backgroundColor: `${brandPrimary}14`,
                    borderColor: brandPrimary,
                  },
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={16}
                  color={active ? brandPrimary : akColors.textMuted}
                />
                <Text
                  style={[
                    styles.tabText,
                    active && { color: brandPrimary, fontWeight: '700' },
                  ]}
                >
                  {t(item.title)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={[styles.utilityIcon, { backgroundColor: `${snapshot.accent}1A` }]}>
              <Ionicons name={snapshot.icon} size={22} color={snapshot.accent} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.heroTitle}>{t(snapshot.title)} {t('utility.consumption')}</Text>
              <Text style={styles.heroSubtitle}>
                {selectedUnit?.unitNumber ?? 'Selected unit'} • {t('utility.monthlyCycle')}
              </Text>
            </View>
          </View>

          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${usageRatio * 100}%`,
                    backgroundColor: snapshot.accent,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {snapshot.currentUsage} / {snapshot.monthlyCap} {snapshot.usageLabel}
            </Text>
          </View>

          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>{t('utility.currentUsage')}</Text>
              <Text style={styles.metricValue}>
                {snapshot.currentUsage} {snapshot.usageLabel}
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>{t('utility.remaining')}</Text>
              <Text style={styles.metricValue}>
                {snapshot.remainingBalance} {snapshot.usageLabel}
              </Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>{t('utility.estimatedBill')}</Text>
              <Text style={styles.metricValue}>{formatCurrency(snapshot.estimatedBill)}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>{t('utility.rechargeLeft')}</Text>
              <Text style={[styles.metricValue, { color: brandSecondary }]}>
                {formatCurrency(Math.max(0, snapshot.estimatedBill * 0.38))}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.trendCard}>
          <Text style={styles.trendTitle}>{t('utility.usageTrend')}</Text>
          <View style={styles.chartRow}>
            {snapshot.trend.map((point, idx) => {
              const ratio = Math.max(0.12, Math.min(1, point / trendMax));
              return (
                <View key={`${activeUtility}-trend-${idx}`} style={styles.barWrap}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: 120 * ratio,
                        backgroundColor:
                          idx === snapshot.trend.length - 1
                            ? snapshot.accent
                            : `${snapshot.accent}66`,
                      },
                    ]}
                  />
                </View>
              );
            })}
          </View>
          <Text style={styles.trendHint}>
            {t('utility.demoHint')}
          </Text>
        </View>
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
    paddingBottom: 24,
    gap: 14,
    backgroundColor: akColors.bg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingRight: 8,
  },
  backText: {
    color: akColors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  headerCard: {
    backgroundColor: akColors.surface,
    borderRadius: akRadius.card,
    borderWidth: 1,
    borderColor: akColors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerTitle: {
    color: akColors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitle: {
    marginTop: 4,
    color: akColors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    color: akColors.danger,
    fontSize: 12,
  },
  tabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabText: {
    color: akColors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  heroCard: {
    borderRadius: akRadius.card,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: '#fff',
    padding: 14,
    gap: 12,
    ...akShadow.soft,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  utilityIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: akColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  heroSubtitle: {
    marginTop: 2,
    color: akColors.textMuted,
    fontSize: 12,
  },
  flex: {
    flex: 1,
  },
  progressWrap: {
    gap: 6,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressText: {
    color: akColors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricCard: {
    width: '48%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: '#F8FAFC',
    padding: 10,
    gap: 4,
  },
  metricLabel: {
    color: akColors.textMuted,
    fontSize: 11,
  },
  metricValue: {
    color: akColors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  trendCard: {
    borderRadius: akRadius.card,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: '#fff',
    padding: 14,
    gap: 10,
    ...akShadow.soft,
  },
  trendTitle: {
    color: akColors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  chartRow: {
    height: 130,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingTop: 8,
  },
  barWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    borderRadius: 8,
    minHeight: 12,
  },
  trendHint: {
    color: akColors.textSoft,
    fontSize: 11,
  },
});
