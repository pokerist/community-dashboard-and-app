import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { DemoPaymentModal } from '../components/mobile/DemoPaymentModal';
import { useAppToast } from '../components/mobile/AppToast';
import { InlineError, ScreenCard } from '../components/mobile/Primitives';
import { UnitPicker } from '../components/mobile/UnitPicker';
import type { AuthSession } from '../features/auth/types';
import {
  listMyInvoices,
  listMyViolations,
  simulateInvoiceSelfPayment,
} from '../features/community/service';
import { buildPayables, filterPayablesByUnit } from '../features/community/payables';
import type {
  InvoiceRow,
  PayableItem,
  ResidentUnit,
  ViolationRow,
} from '../features/community/types';
import { extractApiErrorMessage } from '../lib/http';
import {
  invoiceStatusDisplayLabel,
  violationStatusDisplayLabel,
} from '../features/presentation/status';
import { akColors, akRadius, akShadow } from '../theme/alkarma';
import { formatCurrency, formatDateOnly, formatDateTime } from '../utils/format';

type FinanceScreenProps = {
  session: AuthSession;
  units: ResidentUnit[];
  selectedUnitId: string | null;
  onSelectUnit: (unitId: string) => void;
  onRefreshUnits: () => Promise<void>;
  unitsRefreshing: boolean;
  unitsLoading: boolean;
  unitsErrorMessage: string | null;
  deepLinkFocus?: { entityType: 'INVOICE' | 'VIOLATION'; entityId: string } | null;
  onConsumeDeepLinkFocus?: (entityType: 'INVOICE' | 'VIOLATION', entityId: string) => void;
};

export function FinanceScreen({
  session,
  units,
  selectedUnitId,
  onSelectUnit,
  onRefreshUnits,
  unitsRefreshing,
  unitsLoading,
  unitsErrorMessage,
  deepLinkFocus = null,
  onConsumeDeepLinkFocus,
}: FinanceScreenProps) {
  const insets = useSafeAreaInsets();
  const toast = useAppToast();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [violations, setViolations] = useState<ViolationRow[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activePaymentItem, setActivePaymentItem] = useState<PayableItem | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [selectedViolation, setSelectedViolation] = useState<ViolationRow | null>(null);

  const loadData = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
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
    },
    [session.accessToken],
  );

  useEffect(() => {
    void loadData('initial');
  }, [loadData]);

  const filteredInvoices = useMemo(
    () => (selectedUnitId ? invoices.filter((i) => i.unitId === selectedUnitId) : invoices),
    [invoices, selectedUnitId],
  );
  const filteredViolations = useMemo(
    () => (selectedUnitId ? violations.filter((v) => v.unitId === selectedUnitId) : violations),
    [violations, selectedUnitId],
  );
  const filteredPayables = useMemo(
    () => filterPayablesByUnit(buildPayables(invoices, violations), selectedUnitId),
    [invoices, violations, selectedUnitId],
  );

  const metrics = useMemo(() => {
    const pendingInvoices = filteredInvoices.filter(
      (i) => String(i.status).toUpperCase() === 'PENDING' || String(i.status).toUpperCase() === 'OVERDUE',
    );
    const invoiceTotal = pendingInvoices.reduce((sum, row) => {
      const value = Number(row.amount ?? 0);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);

    const payableTotal = filteredPayables.reduce((sum, row) => {
      const value = Number(row.amount ?? 0);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);

    return {
      pendingInvoiceCount: pendingInvoices.length,
      pendingInvoiceTotal: invoiceTotal,
      payableCount: filteredPayables.length,
      payableTotal,
      violationCount: filteredViolations.length,
    };
  }, [filteredInvoices, filteredPayables, filteredViolations]);

  const handleConfirmDemoPayment = useCallback(
    async (payload: { paymentMethod: string; cardLast4?: string; notes?: string }) => {
      if (!activePaymentItem?.invoiceId) {
        toast.info('Payment unavailable', 'This item is not linked to an invoice yet.');
        return;
      }
      setIsPaying(true);
      try {
        await simulateInvoiceSelfPayment(session.accessToken, activePaymentItem.invoiceId, payload);
        setActivePaymentItem(null);
        toast.success('Payment completed', 'Invoice was marked as paid successfully.');
        await loadData('refresh');
      } catch (error) {
        toast.error('Payment failed', extractApiErrorMessage(error));
      } finally {
        setIsPaying(false);
      }
    },
    [activePaymentItem, loadData, session.accessToken, toast],
  );

  useEffect(() => {
    if (!deepLinkFocus) return;

    if (deepLinkFocus.entityType === 'INVOICE') {
      const invoice = invoices.find((row) => row.id === deepLinkFocus.entityId) ?? null;
      if (invoice) {
        setSelectedViolation(null);
        setSelectedInvoice(invoice);
        onConsumeDeepLinkFocus?.('INVOICE', deepLinkFocus.entityId);
      }
      return;
    }

    const violation = violations.find((row) => row.id === deepLinkFocus.entityId) ?? null;
    if (violation) {
      setSelectedInvoice(null);
      setSelectedViolation(violation);
      onConsumeDeepLinkFocus?.('VIOLATION', deepLinkFocus.entityId);
    }
  }, [deepLinkFocus, invoices, violations, onConsumeDeepLinkFocus]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: Math.max(insets.top, 8) + 8 },
        ]}
      >
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>Payments</Text>
        <Text style={styles.headerSubtitle}>Invoices, dues and violation fines</Text>
      </View>

      <LinearGradient
        colors={[akColors.primary, akColors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Text style={styles.heroBadge}>PAYMENTS & BILLS</Text>
        <Text style={styles.heroTitle}>Invoices & Violations</Text>
        <Text style={styles.heroSubtitle}>
          Manage your financial obligations for the selected unit.
        </Text>

        <View style={styles.outstandingCard}>
          <Text style={styles.outstandingLabel}>Total Outstanding</Text>
          <View style={styles.outstandingRow}>
            <Text style={styles.outstandingAmount}>
              {formatCurrency(metrics.payableTotal)}
            </Text>
            <Text style={styles.outstandingCurrency}>EGP</Text>
          </View>
          <Text style={styles.outstandingHint}>
            Payables: {metrics.payableCount} • Violations: {metrics.violationCount}
          </Text>
        </View>
      </LinearGradient>

      <ScreenCard title="Unit Context">
        <UnitPicker
          units={units}
          selectedUnitId={selectedUnitId}
          onSelect={onSelectUnit}
          onRefresh={() => void onRefreshUnits()}
          isRefreshing={unitsRefreshing}
        />
        <InlineError message={unitsErrorMessage} />
        {unitsLoading ? <ActivityIndicator color={akColors.primary} /> : null}
      </ScreenCard>

      <ScreenCard title="Summary" actionLabel={isRefreshing ? 'Refreshing...' : 'Refresh'} onActionPress={() => void loadData('refresh')}>
        <InlineError message={errorMessage} />
        {isLoading ? (
          <ActivityIndicator color={akColors.primary} />
        ) : (
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Pending/Overdue Invoices</Text>
              <Text style={styles.metricValue}>{metrics.pendingInvoiceCount}</Text>
              <Text style={styles.metricHint}>Total amount: {formatCurrency(metrics.pendingInvoiceTotal)}</Text>
              </View>
              <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Payables</Text>
              <Text style={styles.metricValue}>{metrics.payableCount}</Text>
              <Text style={styles.metricHint}>Total due: {formatCurrency(metrics.payableTotal)}</Text>
              </View>
            </View>
          )}
      </ScreenCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Payables</Text>
        <Text style={styles.sectionCount}>{filteredPayables.length}</Text>
      </View>
      <ScreenCard>
        {!isLoading && filteredPayables.length === 0 ? (
          <Text style={styles.emptyText}>No pending payables for this unit.</Text>
        ) : null}
        {filteredPayables.map((row) => (
          <Pressable
            key={row.key}
            style={styles.itemCard}
            onPress={() => {
              if (row.invoiceId) {
                const invoice = invoices.find((inv) => inv.id === row.invoiceId) ?? null;
                if (invoice) {
                  setSelectedViolation(null);
                  setSelectedInvoice(invoice);
                  return;
                }
              }
              if (row.violationId) {
                const violation = violations.find((v) => v.id === row.violationId) ?? null;
                if (violation) {
                  setSelectedInvoice(null);
                  setSelectedViolation(violation);
                }
              }
            }}
          >
            <View style={styles.itemHeader}>
              <View style={styles.flex}>
                <Text style={styles.itemTitle}>{row.title}</Text>
                <Text style={styles.itemSub}>
                  {row.kind === 'VIOLATION_FINE' ? 'Violation fine' : 'Invoice'} • {invoiceStatusDisplayLabel(row.status)}
                </Text>
              </View>
              <Text style={styles.itemAmount}>{formatCurrency(row.amount)}</Text>
            </View>
            <Text style={styles.itemSub}>
              Due: {formatDateOnly(row.dueDate)} {row.invoiceId ? '• Payable now' : ''}
            </Text>
            <View style={styles.itemActionsRow}>
              <Pressable
                style={[styles.payNowButton, !row.invoiceId && styles.payNowButtonDisabled]}
                onPress={() => {
                  if (row.invoiceId) setActivePaymentItem(row);
                }}
                disabled={!row.invoiceId}
              >
                <Ionicons name="card-outline" size={14} color="#fff" />
                <Text style={styles.payNowButtonText}>Pay Now</Text>
              </Pressable>
            </View>
          </Pressable>
        ))}
      </ScreenCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Invoices</Text>
        <Text style={styles.sectionCount}>{filteredInvoices.length}</Text>
      </View>
      <ScreenCard>
        {!isLoading && filteredInvoices.length === 0 ? (
          <Text style={styles.emptyText}>No invoices found.</Text>
        ) : null}
        {filteredInvoices.map((row) => (
          <Pressable
            key={row.id}
            style={styles.itemCard}
            onPress={() => {
              setSelectedViolation(null);
              setSelectedInvoice(row);
            }}
          >
            <View style={styles.itemHeader}>
              <View style={styles.flex}>
                <Text style={styles.itemTitle}>{row.invoiceNumber ?? row.id}</Text>
                <Text style={styles.itemSub}>
                  {row.type ?? 'INVOICE'} • {invoiceStatusDisplayLabel(row.status)}
                </Text>
              </View>
              <Text style={styles.itemAmount}>{formatCurrency(row.amount)}</Text>
            </View>
            <Text style={styles.itemSub}>
              Due: {formatDateOnly(row.dueDate)} {row.paidDate ? `• Paid: ${formatDateOnly(row.paidDate)}` : ''}
            </Text>
            <Text style={styles.itemSub}>
              Unit: {row.unit?.unitNumber ?? '—'} {row.unit?.projectName ? `• ${row.unit.projectName}` : ''}
            </Text>
          </Pressable>
        ))}
      </ScreenCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Violations</Text>
        <Text style={styles.sectionCount}>{filteredViolations.length}</Text>
      </View>
      <ScreenCard>
        {!isLoading && filteredViolations.length === 0 ? (
          <Text style={styles.emptyText}>No violations found.</Text>
        ) : null}
        {filteredViolations.map((row) => (
          <Pressable
            key={row.id}
            style={styles.itemCard}
            onPress={() => {
              setSelectedInvoice(null);
              setSelectedViolation(row);
            }}
          >
            <View style={styles.itemHeader}>
              <View style={styles.flex}>
                <Text style={styles.itemTitle}>{row.violationNumber ?? row.id}</Text>
                <Text style={styles.itemSub}>
                  {row.type ?? 'VIOLATION'} • {violationStatusDisplayLabel(row.status)}
                </Text>
              </View>
              <Text style={styles.itemAmount}>{formatCurrency(row.fineAmount)}</Text>
            </View>
            {row.description ? <Text style={styles.itemDesc}>{row.description}</Text> : null}
            <Text style={styles.itemSub}>Created: {formatDateTime(row.createdAt)}</Text>
            <Text style={styles.itemSub}>Unit: {row.unit?.unitNumber ?? '—'}</Text>
            {row.invoices?.length ? (
              <View style={styles.inlineGroup}>
                {row.invoices.map((inv) => (
                  <View key={inv.id} style={styles.inlineTag}>
                    <Text style={styles.inlineTagText}>
                      {inv.invoiceNumber ?? inv.id} • {invoiceStatusDisplayLabel(inv.status)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Pressable>
        ))}
      </ScreenCard>
      </ScrollView>
      <Modal
        visible={Boolean(selectedInvoice || selectedViolation)}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setSelectedInvoice(null);
          setSelectedViolation(null);
        }}
      >
        <View style={styles.detailModalRoot}>
          <Pressable
            style={styles.detailModalBackdrop}
            onPress={() => {
              setSelectedInvoice(null);
              setSelectedViolation(null);
            }}
          />
          <View style={[styles.detailModalSheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <View style={styles.detailHandle} />
            <View style={styles.detailHeader}>
              <View style={styles.flex}>
                <Text style={styles.detailTitle}>
                  {selectedInvoice ? 'Invoice Details' : selectedViolation ? 'Violation Details' : 'Details'}
                </Text>
                <Text style={styles.detailSubtitle}>
                  {selectedInvoice
                    ? 'Review invoice amount, status and payment details.'
                    : 'Review violation details and linked invoices.'}
                </Text>
              </View>
              <Pressable
                style={styles.detailCloseButton}
                onPress={() => {
                  setSelectedInvoice(null);
                  setSelectedViolation(null);
                }}
              >
                <Ionicons name="close" size={18} color={akColors.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.detailContent}>
              {selectedInvoice ? (
                <View style={styles.detailCard}>
                  <DetailRow label="Invoice #" value={selectedInvoice.invoiceNumber ?? selectedInvoice.id} />
                  <DetailRow label="Type" value={String(selectedInvoice.type ?? 'INVOICE')} />
                  <DetailRow label="Status" value={invoiceStatusDisplayLabel(selectedInvoice.status)} />
                  <DetailRow label="Amount" value={formatCurrency(selectedInvoice.amount)} />
                  <DetailRow label="Due Date" value={formatDateOnly(selectedInvoice.dueDate)} />
                  {selectedInvoice.paidDate ? (
                    <DetailRow label="Paid Date" value={formatDateOnly(selectedInvoice.paidDate)} />
                  ) : null}
                  <DetailRow
                    label="Unit"
                    value={`${selectedInvoice.unit?.unitNumber ?? '—'}${selectedInvoice.unit?.projectName ? ` • ${selectedInvoice.unit.projectName}` : ''}`}
                  />
                </View>
              ) : null}

              {selectedViolation ? (
                <View style={styles.detailCard}>
                  <DetailRow label="Violation #" value={selectedViolation.violationNumber ?? selectedViolation.id} />
                  <DetailRow label="Type" value={String(selectedViolation.type ?? 'VIOLATION')} />
                  <DetailRow label="Status" value={violationStatusDisplayLabel(selectedViolation.status)} />
                  <DetailRow label="Fine Amount" value={formatCurrency(selectedViolation.fineAmount)} />
                  <DetailRow label="Created" value={formatDateTime(selectedViolation.createdAt)} />
                  <DetailRow label="Unit" value={selectedViolation.unit?.unitNumber ?? '—'} />
                  {selectedViolation.description ? (
                    <View style={styles.detailBlock}>
                      <Text style={styles.detailBlockLabel}>Description</Text>
                      <Text style={styles.detailBlockValue}>{selectedViolation.description}</Text>
                    </View>
                  ) : null}
                  {selectedViolation.invoices?.length ? (
                    <View style={styles.detailBlock}>
                      <Text style={styles.detailBlockLabel}>Linked Invoices</Text>
                      <View style={styles.inlineGroup}>
                        {selectedViolation.invoices.map((inv) => (
                          <Pressable
                            key={inv.id}
                            style={styles.inlineTag}
                            onPress={() => {
                              const invoice = invoices.find((row) => row.id === inv.id);
                              if (invoice) {
                                setSelectedViolation(null);
                                setSelectedInvoice(invoice);
                              }
                            }}
                          >
                            <Text style={styles.inlineTagText}>
                              {inv.invoiceNumber ?? inv.id} • {invoiceStatusDisplayLabel(inv.status)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailRowLabel}>{label}</Text>
      <Text style={styles.detailRowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: akColors.bg,
  },
  container: {
    padding: 16,
    gap: 16,
    backgroundColor: akColors.bg,
    paddingBottom: 110,
  },
  headerCard: {
    backgroundColor: akColors.surface,
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 18,
    ...akShadow.soft,
  },
  headerTitle: {
    color: akColors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  headerSubtitle: {
    marginTop: 4,
    color: akColors.textMuted,
    fontSize: 13,
  },
  hero: {
    borderRadius: 24,
    padding: 16,
    gap: 6,
    ...akShadow.card,
  },
  heroBadge: {
    color: akColors.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    lineHeight: 18,
  },
  outstandingCard: {
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    gap: 4,
  },
  outstandingLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
  },
  outstandingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  outstandingAmount: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  outstandingCurrency: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    marginBottom: 4,
  },
  outstandingHint: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.9)',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 5,
    ...akShadow.soft,
  },
  metricLabel: {
    color: akColors.textMuted,
    fontSize: 12,
  },
  metricValue: {
    color: akColors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  metricHint: {
    color: akColors.textMuted,
    fontSize: 11,
  },
  emptyText: {
    color: akColors.textMuted,
    fontSize: 13,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: 2,
  },
  sectionTitle: {
    color: akColors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionCount: {
    color: akColors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  itemCard: {
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.9)',
    borderRadius: 16,
    padding: 13,
    gap: 5,
    backgroundColor: '#FFFFFF',
    ...akShadow.soft,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  flex: { flex: 1 },
  itemTitle: {
    color: akColors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  itemSub: {
    color: akColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  itemAmount: {
    color: akColors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  itemDesc: {
    color: akColors.text,
    fontSize: 12,
    lineHeight: 17,
  },
  itemActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  payNowButton: {
    borderRadius: 999,
    backgroundColor: akColors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  payNowButtonDisabled: {
    opacity: 0.55,
  },
  payNowButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  inlineGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  inlineTag: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(201,169,97,0.35)',
    backgroundColor: akColors.goldSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inlineTagText: {
    color: '#7a6122',
    fontSize: 10,
    fontWeight: '600',
  },
  detailModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  detailModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.14)',
  },
  detailModalSheet: {
    backgroundColor: akColors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.9)',
    paddingHorizontal: 16,
    paddingTop: 12,
    maxHeight: '78%',
    ...akShadow.card,
  },
  detailHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginBottom: 10,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  detailTitle: {
    color: akColors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  detailSubtitle: {
    marginTop: 3,
    color: akColors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  detailCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: akColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: akColors.surfaceMuted,
  },
  detailContent: {
    paddingTop: 12,
    paddingBottom: 6,
    gap: 10,
  },
  detailCard: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 14,
    backgroundColor: akColors.surface,
    padding: 12,
    gap: 8,
  },
  detailRow: {
    gap: 3,
  },
  detailRowLabel: {
    color: akColors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  detailRowValue: {
    color: akColors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  detailBlock: {
    marginTop: 4,
    gap: 4,
  },
  detailBlockLabel: {
    color: akColors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  detailBlockValue: {
    color: akColors.text,
    fontSize: 12,
    lineHeight: 18,
  },
});
