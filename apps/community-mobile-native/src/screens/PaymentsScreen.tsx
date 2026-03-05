import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DemoPaymentModal } from '../components/mobile/DemoPaymentModal';
import { BrandedPageHero } from '../components/mobile/BrandedPageHero';
import { InlineError, ScreenCard } from '../components/mobile/Primitives';
import { useAppToast } from '../components/mobile/AppToast';
import type { AuthSession } from '../features/auth/types';
import { useBottomNavMetrics } from '../features/layout/BottomNavMetricsContext';
import {
  listMyInvoices,
  listMyViolations,
  simulateInvoiceSelfPayment,
} from '../features/community/service';
import { buildPayables, filterPayablesByUnit } from '../features/community/payables';
import type { InvoiceRow, PayableItem, ResidentUnit, ViolationRow } from '../features/community/types';
import { extractApiErrorMessage } from '../lib/http';
import { useNetworkStatus } from '../features/network/useNetworkStatus';
import { useBranding } from '../features/branding/provider';
import { getBrandPalette } from '../features/branding/palette';
import { formatCurrency, formatDateOnly } from '../utils/format';
import { akColors, akRadius, akShadow } from '../theme/alkarma';

type PaymentsScreenProps = {
  session: AuthSession;
  units: ResidentUnit[];
  selectedUnitId: string | null;
  unitsRefreshing: boolean;
  unitsLoading: boolean;
  unitsErrorMessage: string | null;
  onOpenUnitPicker?: () => void;
};

type PaymentTab = 'ALL' | 'UPCOMING' | 'OVERDUE' | 'PAID';

export function PaymentsScreen({
  session,
  units,
  selectedUnitId,
  unitsRefreshing,
  unitsLoading,
  unitsErrorMessage,
  onOpenUnitPicker,
}: PaymentsScreenProps) {
  const { contentInsetBottom } = useBottomNavMetrics();
  const toast = useAppToast();
  const { brand } = useBranding();
  const palette = getBrandPalette(brand);
  const network = useNetworkStatus();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [violations, setViolations] = useState<ViolationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PaymentTab>('ALL');
  const [activePaymentItem, setActivePaymentItem] = useState<PayableItem | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  const selectedUnit = useMemo(
    () => units.find((u) => u.id === selectedUnitId) ?? null,
    [selectedUnitId, units],
  );

  const loadData = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setIsLoading(true);
    else setIsRefreshing(true);
    setErrorMessage(null);
    try {
      const [invoiceRows, violationRows] = await Promise.all([
        listMyInvoices(session.accessToken),
        listMyViolations(session.accessToken),
      ]);
      setInvoices(invoiceRows);
      setViolations(violationRows);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [session.accessToken]);

  useEffect(() => {
    void loadData('initial');
  }, [loadData]);

  const payables = useMemo(
    () => filterPayablesByUnit(buildPayables(invoices, violations), selectedUnitId),
    [invoices, violations, selectedUnitId],
  );

  const visiblePayables = useMemo(() => {
    if (activeTab === 'ALL') return payables;
    const now = Date.now();
    if (activeTab === 'PAID') {
      return payables.filter((row) => String(row.status ?? '').toUpperCase() === 'PAID');
    }
    if (activeTab === 'OVERDUE') {
      return payables.filter((row) => {
        const status = String(row.status ?? '').toUpperCase();
        if (status === 'OVERDUE') return true;
        const dueTs = row.dueDate ? Date.parse(row.dueDate) : Number.NaN;
        return Number.isFinite(dueTs) ? dueTs < now && status !== 'PAID' : false;
      });
    }
    return payables.filter((row) => {
      const status = String(row.status ?? '').toUpperCase();
      if (status === 'PAID') return false;
      const dueTs = row.dueDate ? Date.parse(row.dueDate) : Number.NaN;
      return Number.isFinite(dueTs) ? dueTs >= now : status === 'PENDING';
    });
  }, [activeTab, payables]);

  const totals = useMemo(() => {
    return visiblePayables.reduce(
      (acc, row) => {
        acc.count += 1;
        acc.total += Number(row.amount ?? 0) || 0;
        return acc;
      },
      { count: 0, total: 0 },
    );
  }, [visiblePayables]);

  const completePayment = useCallback(async (payload: { paymentMethod: string; cardLast4?: string; notes?: string; }) => {
    if (!network.isOnline) {
      toast.info('Offline', 'Connect to internet to continue.');
      return;
    }
    if (!activePaymentItem?.invoiceId) {
      toast.info('Payment unavailable', 'This amount is linked to a pending invoice sync.');
      return;
    }
    setIsPaying(true);
    try {
      await simulateInvoiceSelfPayment(session.accessToken, activePaymentItem.invoiceId, payload);
      setActivePaymentItem(null);
      toast.success('Payment completed', 'Invoice marked as paid.');
      await loadData('refresh');
    } catch (error) {
      toast.error('Payment failed', extractApiErrorMessage(error));
    } finally {
      setIsPaying(false);
    }
  }, [activePaymentItem?.invoiceId, loadData, network.isOnline, session.accessToken, toast]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: Math.max(110, contentInsetBottom) }]}>
        <BrandedPageHero title="Payments" subtitle="Upcoming and overdue amounts for your selected unit." />

        {units.length > 1 ? (
          <ScreenCard title="Current Unit">
            <View style={styles.unitRow}>
              <Text style={styles.unitText}>{selectedUnit?.unitNumber ?? 'Select unit'}</Text>
              <Pressable style={styles.changeButton} onPress={onOpenUnitPicker}>
                <Text style={styles.changeButtonText}>Change</Text>
              </Pressable>
            </View>
            <InlineError message={unitsErrorMessage} />
            {unitsLoading || unitsRefreshing ? <ActivityIndicator color={palette.primary} /> : null}
          </ScreenCard>
        ) : (
          <InlineError message={unitsErrorMessage} />
        )}

        <ScreenCard title="Amounts" actionLabel={isRefreshing ? 'Refreshing...' : 'Refresh'} onActionPress={() => void loadData('refresh')}>
          <InlineError message={errorMessage} />
          <View style={styles.tabsRow}>
            {(['ALL', 'UPCOMING', 'OVERDUE', 'PAID'] as const).map((tab) => {
              const active = activeTab === tab;
              return (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[
                    styles.tabChip,
                    active && { borderColor: palette.primary, backgroundColor: palette.primarySoft10 },
                  ]}
                >
                  <Text style={[styles.tabChipText, active && { color: palette.primary }]}>{tab}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.summaryText}>
            {totals.count} item(s) • {formatCurrency(totals.total)}
          </Text>

          {isLoading ? <ActivityIndicator color={palette.primary} /> : null}
          {!isLoading && visiblePayables.length === 0 ? (
            <Text style={styles.emptyText}>No payments in this view.</Text>
          ) : null}

          {visiblePayables.map((item) => (
            <View key={item.key} style={styles.payableCard}>
              <View style={styles.payableHeader}>
                <Text style={styles.payableTitle}>{item.title}</Text>
                <Text style={styles.payableAmount}>{formatCurrency(item.amount)}</Text>
              </View>
              <Text style={styles.payableMeta}>Due {formatDateOnly(item.dueDate)} • {String(item.status ?? '').replaceAll('_', ' ')}</Text>
              {String(item.status ?? '').toUpperCase() !== 'PAID' ? (
                <Pressable
                  onPress={() => setActivePaymentItem(item)}
                  disabled={!network.isOnline}
                  style={[styles.payButton, { backgroundColor: palette.secondary }]}
                >
                  <Text style={styles.payButtonText}>Pay Now</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </ScreenCard>
      </ScrollView>

      <DemoPaymentModal
        visible={Boolean(activePaymentItem)}
        item={activePaymentItem}
        isSubmitting={isPaying}
        onClose={() => {
          if (!isPaying) setActivePaymentItem(null);
        }}
        onConfirm={completePayment}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: akColors.bg },
  container: { paddingHorizontal: 16, gap: 12, paddingTop: 0 },
  unitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  unitText: { fontSize: 13, color: akColors.text, fontWeight: '700' },
  changeButton: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  changeButtonText: { color: akColors.textMuted, fontSize: 12, fontWeight: '700' },
  tabsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tabChip: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  tabChipText: { color: akColors.textMuted, fontSize: 12, fontWeight: '700' },
  summaryText: { color: akColors.textMuted, fontSize: 12, fontWeight: '600' },
  payableCard: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: akRadius.md,
    backgroundColor: '#fff',
    padding: 12,
    gap: 6,
    ...akShadow.card,
  },
  payableHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  payableTitle: { color: akColors.text, fontSize: 14, fontWeight: '700', flex: 1 },
  payableAmount: { color: akColors.text, fontSize: 15, fontWeight: '800' },
  payableMeta: { color: akColors.textMuted, fontSize: 12 },
  payButton: {
    alignSelf: 'flex-end',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  payButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  emptyText: { color: akColors.textMuted, fontSize: 12 },
});
