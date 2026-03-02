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
  TextInput,
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
  listViolationActions,
  listMyInvoices,
  listMyViolations,
  submitViolationAction,
  simulateInvoiceSelfPayment,
} from '../features/community/service';
import { buildPayables, filterPayablesByUnit } from '../features/community/payables';
import type {
  InvoiceRow,
  PayableItem,
  ResidentUnit,
  ViolationRow,
  ViolationActionRow,
} from '../features/community/types';
import { extractApiErrorMessage } from '../lib/http';
import {
  invoiceStatusDisplayLabel,
  violationStatusDisplayLabel,
} from '../features/presentation/status';
import { useI18n } from '../features/i18n/provider';
import { useBranding } from '../features/branding/provider';
import { getBrandPalette } from '../features/branding/palette';
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
  const { t } = useI18n();
  const { brand } = useBranding();
  const palette = getBrandPalette(brand);
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
  const [activeTab, setActiveTab] = useState<'ALL' | 'UPCOMING' | 'OVERDUE' | 'PAID'>('ALL');
  const [violationActions, setViolationActions] = useState<ViolationActionRow[]>([]);
  const [violationActionsLoading, setViolationActionsLoading] = useState(false);
  const [violationActionSubmitting, setViolationActionSubmitting] = useState(false);
  const [violationActionModal, setViolationActionModal] = useState<{
    visible: boolean;
    type: 'APPEAL' | 'FIX_SUBMISSION';
  }>({ visible: false, type: 'APPEAL' });
  const [violationActionNote, setViolationActionNote] = useState('');

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

  const tabFilteredPayables = useMemo(() => {
    const now = Date.now();
    if (activeTab === 'ALL') return filteredPayables;
    if (activeTab === 'PAID') return [];
    if (activeTab === 'UPCOMING') {
      return filteredPayables.filter((row) => {
        const status = String(row.status ?? '').toUpperCase();
        if (status === 'OVERDUE') return false;
        const dueTs = row.dueDate ? Date.parse(row.dueDate) : Number.NaN;
        if (!Number.isFinite(dueTs)) return status === 'PENDING';
        return dueTs >= now;
      });
    }
    return filteredPayables.filter((row) => {
      const status = String(row.status ?? '').toUpperCase();
      if (status === 'OVERDUE') return true;
      const dueTs = row.dueDate ? Date.parse(row.dueDate) : Number.NaN;
      return Number.isFinite(dueTs) && dueTs < now && status !== 'PAID';
    });
  }, [activeTab, filteredPayables]);

  const tabFilteredInvoices = useMemo(() => {
    if (activeTab === 'ALL') return filteredInvoices;
    if (activeTab === 'PAID') {
      return filteredInvoices.filter((row) => String(row.status ?? '').toUpperCase() === 'PAID');
    }
    if (activeTab === 'UPCOMING') {
      return filteredInvoices.filter((row) => String(row.status ?? '').toUpperCase() === 'PENDING');
    }
    return filteredInvoices.filter((row) => String(row.status ?? '').toUpperCase() === 'OVERDUE');
  }, [activeTab, filteredInvoices]);

  const paymentCategoryLabel = useCallback((row: InvoiceRow) => {
    const type = String(row.type ?? '').toUpperCase();
    if (type.includes('UTILITY') || type.includes('WATER') || type.includes('ELECTRIC') || type.includes('GAS')) {
      return 'Utility';
    }
    if (type.includes('INSTALLMENT') || type.includes('CHEQUE')) return 'Installment';
    if (type.includes('BOOKING')) return 'Amenities';
    if (type.includes('FINE') || type.includes('VIOLATION')) return 'Violations/Fines';
    return 'Other';
  }, []);

  const handleConfirmDemoPayment = useCallback(
    async (payload: { paymentMethod: string; cardLast4?: string; notes?: string }) => {
      if (!activePaymentItem?.invoiceId) {
        toast.info(t('home.paymentUnavailable'), t('home.paymentUnavailableHint'));
        return;
      }
      setIsPaying(true);
      try {
        await simulateInvoiceSelfPayment(session.accessToken, activePaymentItem.invoiceId, payload);
        setActivePaymentItem(null);
        toast.success(t('home.paymentCompleted'), t('home.paymentCompletedHint'));
        await loadData('refresh');
      } catch (error) {
        toast.error(t('home.paymentFailed'), extractApiErrorMessage(error));
      } finally {
        setIsPaying(false);
      }
    },
    [activePaymentItem, loadData, session.accessToken, t, toast],
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

  useEffect(() => {
    let cancelled = false;
    if (!selectedViolation?.id) {
      setViolationActions([]);
      return;
    }
    setViolationActionsLoading(true);
    void listViolationActions(session.accessToken, selectedViolation.id)
      .then((rows) => {
        if (cancelled) return;
        setViolationActions(Array.isArray(rows) ? rows : []);
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error('Failed to load violation actions', extractApiErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setViolationActionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedViolation?.id, session.accessToken, toast]);

  const handleSubmitViolationAction = useCallback(async () => {
    if (!selectedViolation?.id) return;
    if (!violationActionNote.trim()) {
      toast.error('Missing note', 'Please provide a short note before submitting.');
      return;
    }
    setViolationActionSubmitting(true);
    try {
      const created = await submitViolationAction(session.accessToken, selectedViolation.id, {
        type: violationActionModal.type,
        note: violationActionNote.trim(),
      });
      setViolationActions((prev) => [created, ...prev]);
      setViolationActionModal((prev) => ({ ...prev, visible: false }));
      setViolationActionNote('');
      toast.success(
        violationActionModal.type === 'APPEAL' ? 'Appeal submitted' : 'Fix proof submitted',
        'Management will review your request and notify you.',
      );
    } catch (error) {
      toast.error('Unable to submit action', extractApiErrorMessage(error));
    } finally {
      setViolationActionSubmitting(false);
    }
  }, [
    selectedViolation?.id,
    session.accessToken,
    toast,
    violationActionModal.type,
    violationActionNote,
  ]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: Math.max(insets.top, 8) + 8 },
        ]}
      >
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>{t('drawer.payments')}</Text>
        <Text style={styles.headerSubtitle}>{t('finance.subtitle')}</Text>
      </View>

      <LinearGradient
        colors={[palette.primary, palette.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Text style={styles.heroBadge}>{t('finance.badge')}</Text>
        <Text style={styles.heroTitle}>{t('finance.heroTitle')}</Text>
        <Text style={styles.heroSubtitle}>
          {t('finance.heroSubtitle')}
        </Text>
        <Text style={styles.heroHint}>
          Track invoices by status and category, then open any item for details or actions.
        </Text>
      </LinearGradient>

      <ScreenCard title={t('finance.selectedUnit')}>
        {units.length > 1 ? (
          <UnitPicker
            units={units}
            selectedUnitId={selectedUnitId}
            onSelect={onSelectUnit}
            onRefresh={() => void onRefreshUnits()}
            isRefreshing={unitsRefreshing}
          />
        ) : null}
        <InlineError message={unitsErrorMessage} />
        {unitsLoading ? <ActivityIndicator color={palette.primary} /> : null}
      </ScreenCard>

      <ScreenCard
        title={t('finance.summary')}
        actionLabel={isRefreshing ? t('common.refreshing') : t('common.refresh')}
        onActionPress={() => void loadData('refresh')}
      >
        <InlineError message={errorMessage} />
        {isLoading ? (
          <ActivityIndicator color={palette.primary} />
        ) : (
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>{t('finance.pendingInvoices')}</Text>
              <Text style={styles.metricValue}>{metrics.pendingInvoiceCount}</Text>
              <Text style={styles.metricHint}>{t('finance.totalAmount')}: {formatCurrency(metrics.pendingInvoiceTotal)}</Text>
              </View>
              <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>{t('finance.payablesCount')}</Text>
              <Text style={styles.metricValue}>{metrics.payableCount}</Text>
              <Text style={styles.metricHint}>{t('finance.totalDue')}: {formatCurrency(metrics.payableTotal)}</Text>
              </View>
            </View>
          )}
      </ScreenCard>

      <View style={styles.tabRow}>
        {[
          { key: 'ALL', label: 'All' },
          { key: 'UPCOMING', label: 'Upcoming' },
          { key: 'OVERDUE', label: 'Overdue' },
          { key: 'PAID', label: 'Paid' },
        ].map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key as 'ALL' | 'UPCOMING' | 'OVERDUE' | 'PAID')}
              style={[
                styles.tabChip,
                active && {
                  borderColor: palette.primary,
                  backgroundColor: palette.primarySoft10,
                },
              ]}
            >
              <Text style={[styles.tabChipText, active && { color: palette.primary }]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('finance.payablesTitle')}</Text>
        <Text style={[styles.sectionCount, { color: palette.primary }]}>{tabFilteredPayables.length}</Text>
      </View>
      <ScreenCard>
        {!isLoading && tabFilteredPayables.length === 0 ? (
          <Text style={styles.emptyText}>{t('finance.noPayables')}</Text>
        ) : null}
        {tabFilteredPayables.map((row) => (
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
                  {row.kind === 'VIOLATION_FINE' ? t('finance.violationFine') : t('finance.invoice')} • {invoiceStatusDisplayLabel(row.status)}
                </Text>
              </View>
              <Text style={styles.itemAmount}>{formatCurrency(row.amount)}</Text>
            </View>
            <Text style={styles.itemSub}>
              {t('home.duePrefix')}: {formatDateOnly(row.dueDate)} {row.invoiceId ? `• ${t('finance.payableNow')}` : ''}
            </Text>
            <View style={styles.itemActionsRow}>
              <Pressable
                style={[
                  styles.payNowButton,
                  { backgroundColor: palette.primary },
                  !row.invoiceId && styles.payNowButtonDisabled,
                ]}
                onPress={() => {
                  if (row.invoiceId) setActivePaymentItem(row);
                }}
                disabled={!row.invoiceId}
              >
                <Ionicons name="card-outline" size={14} color="#fff" />
                <Text style={styles.payNowButtonText}>{t('home.payNow')}</Text>
              </Pressable>
            </View>
          </Pressable>
        ))}
      </ScreenCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('finance.invoicesTitle')}</Text>
        <Text style={[styles.sectionCount, { color: palette.primary }]}>{tabFilteredInvoices.length}</Text>
      </View>
      <ScreenCard>
        {!isLoading && tabFilteredInvoices.length === 0 ? (
          <Text style={styles.emptyText}>{t('finance.noInvoices')}</Text>
        ) : null}
        {tabFilteredInvoices.map((row) => (
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
                  {row.type ?? t('finance.invoice').toUpperCase()} • {invoiceStatusDisplayLabel(row.status)}
                </Text>
              </View>
              <Text style={styles.itemAmount}>{formatCurrency(row.amount)}</Text>
            </View>
            <Text style={styles.itemSub}>
              {t('home.duePrefix')}: {formatDateOnly(row.dueDate)} {row.paidDate ? `• ${t('finance.paid')}: ${formatDateOnly(row.paidDate)}` : ''}
            </Text>
            <View style={styles.inlineGroup}>
              <View style={styles.inlineTag}>
                <Text style={styles.inlineTagText}>{paymentCategoryLabel(row)}</Text>
              </View>
            </View>
            <Text style={styles.itemSub}>
              {t('finance.unit')}: {row.unit?.unitNumber ?? '—'} {row.unit?.projectName ? `• ${row.unit.projectName}` : ''}
            </Text>
          </Pressable>
        ))}
      </ScreenCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('drawer.violations')}</Text>
        <Text style={[styles.sectionCount, { color: palette.primary }]}>{filteredViolations.length}</Text>
      </View>
      <ScreenCard>
        {!isLoading && filteredViolations.length === 0 ? (
          <Text style={styles.emptyText}>{t('finance.noViolations')}</Text>
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
                  {row.type ?? t('drawer.violations').toUpperCase()} • {violationStatusDisplayLabel(row.status)}
                </Text>
              </View>
              <Text style={styles.itemAmount}>{formatCurrency(row.fineAmount)}</Text>
            </View>
            {row.description ? <Text style={styles.itemDesc}>{row.description}</Text> : null}
            <Text style={styles.itemSub}>{t('finance.created')}: {formatDateTime(row.createdAt)}</Text>
            <Text style={styles.itemSub}>{t('finance.unit')}: {row.unit?.unitNumber ?? '—'}</Text>
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
                  {selectedInvoice ? t('finance.invoiceDetails') : selectedViolation ? t('finance.violationDetails') : t('finance.details')}
                </Text>
                <Text style={styles.detailSubtitle}>
                  {selectedInvoice
                    ? t('finance.invoiceDetailsHint')
                    : t('finance.violationDetailsHint')}
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
                  <DetailRow label={t('finance.invoiceNumber')} value={selectedInvoice.invoiceNumber ?? selectedInvoice.id} />
                  <DetailRow label={t('finance.type')} value={String(selectedInvoice.type ?? 'INVOICE')} />
                  <DetailRow label={t('finance.status')} value={invoiceStatusDisplayLabel(selectedInvoice.status)} />
                  <DetailRow label={t('finance.amount')} value={formatCurrency(selectedInvoice.amount)} />
                  <DetailRow label={t('finance.dueDate')} value={formatDateOnly(selectedInvoice.dueDate)} />
                  {selectedInvoice.paidDate ? (
                    <DetailRow label={t('finance.paidDate')} value={formatDateOnly(selectedInvoice.paidDate)} />
                  ) : null}
                  <DetailRow
                    label={t('finance.unit')}
                    value={`${selectedInvoice.unit?.unitNumber ?? '—'}${selectedInvoice.unit?.projectName ? ` • ${selectedInvoice.unit.projectName}` : ''}`}
                  />
                </View>
              ) : null}

              {selectedViolation ? (
                <View style={styles.detailCard}>
                  <DetailRow label={t('finance.violationNumber')} value={selectedViolation.violationNumber ?? selectedViolation.id} />
                  <DetailRow label={t('finance.type')} value={String(selectedViolation.type ?? 'VIOLATION')} />
                  <DetailRow label={t('finance.status')} value={violationStatusDisplayLabel(selectedViolation.status)} />
                  <DetailRow label={t('finance.fineAmount')} value={formatCurrency(selectedViolation.fineAmount)} />
                  <DetailRow label={t('finance.created')} value={formatDateTime(selectedViolation.createdAt)} />
                  <DetailRow label={t('finance.unit')} value={selectedViolation.unit?.unitNumber ?? '—'} />
                  {selectedViolation.description ? (
                    <View style={styles.detailBlock}>
                      <Text style={styles.detailBlockLabel}>{t('finance.description')}</Text>
                      <Text style={styles.detailBlockValue}>{selectedViolation.description}</Text>
                    </View>
                  ) : null}
                  <View style={styles.detailActionsRow}>
                    <Pressable
                      style={[styles.appealButton, { backgroundColor: palette.primary }]}
                      onPress={() => setViolationActionModal({ visible: true, type: 'APPEAL' })}
                    >
                      <Ionicons name="shield-checkmark-outline" size={14} color="#fff" />
                      <Text style={styles.appealButtonText}>Submit Appeal</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.appealButton, { backgroundColor: palette.secondary }, styles.fixButton]}
                      onPress={() => setViolationActionModal({ visible: true, type: 'FIX_SUBMISSION' })}
                    >
                      <Ionicons name="build-outline" size={14} color="#fff" />
                      <Text style={styles.appealButtonText}>Submit Fix Proof</Text>
                    </Pressable>
                  </View>
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailBlockLabel}>Action Requests</Text>
                    {violationActionsLoading ? (
                      <ActivityIndicator color={palette.primary} />
                    ) : violationActions.length === 0 ? (
                      <Text style={styles.detailBlockValue}>No actions submitted yet.</Text>
                    ) : (
                      <View style={styles.inlineGroup}>
                        {violationActions.map((action) => (
                          <View key={action.id} style={styles.inlineTag}>
                            <Text style={styles.inlineTagText}>
                              {String(action.type).replace(/_/g, ' ')} • {String(action.status).replace(/_/g, ' ')}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                  {selectedViolation.invoices?.length ? (
                    <View style={styles.detailBlock}>
                      <Text style={styles.detailBlockLabel}>{t('finance.linkedInvoices')}</Text>
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
      <Modal
        visible={violationActionModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (violationActionSubmitting) return;
          setViolationActionModal((prev) => ({ ...prev, visible: false }));
        }}
      >
        <View style={styles.actionModalRoot}>
          <Pressable
            style={styles.actionModalBackdrop}
            onPress={() => {
              if (violationActionSubmitting) return;
              setViolationActionModal((prev) => ({ ...prev, visible: false }));
            }}
          />
          <View style={[styles.actionModalCard, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <Text style={styles.actionModalTitle}>
              {violationActionModal.type === 'APPEAL' ? 'Submit Appeal' : 'Submit Fix Proof'}
            </Text>
            <Text style={styles.actionModalHint}>
              Add a concise note for management review.
            </Text>
            <TextInput
              value={violationActionNote}
              onChangeText={setViolationActionNote}
              style={styles.actionModalInput}
              placeholder="Write your note..."
              placeholderTextColor={akColors.textSoft}
              multiline
              numberOfLines={4}
            />
            <View style={styles.actionModalActions}>
              <Pressable
                style={styles.actionCancelButton}
                onPress={() => setViolationActionModal((prev) => ({ ...prev, visible: false }))}
                disabled={violationActionSubmitting}
              >
                <Text style={styles.actionCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.actionSubmitButton, violationActionSubmitting && styles.buttonDisabled]}
                onPress={() => void handleSubmitViolationAction()}
                disabled={violationActionSubmitting}
              >
                <Text style={styles.actionSubmitText}>
                  {violationActionSubmitting ? 'Submitting...' : 'Submit'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  heroHint: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    marginTop: 4,
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
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tabChip: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: akColors.surface,
  },
  tabChipActive: {
    borderColor: akColors.primary,
    backgroundColor: 'rgba(42,62,53,0.1)',
  },
  tabChipText: {
    color: akColors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  tabChipTextActive: {
    color: akColors.primary,
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
  detailActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  appealButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#0F766E',
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  fixButton: {
    backgroundColor: '#334155',
  },
  appealButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  actionModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  actionModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.42)',
  },
  actionModalCard: {
    backgroundColor: akColors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: akColors.border,
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
  },
  actionModalTitle: {
    color: akColors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  actionModalHint: {
    color: akColors.textMuted,
    fontSize: 12,
  },
  actionModalInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 12,
    backgroundColor: akColors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: akColors.text,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  actionModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  actionCancelButton: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: akColors.surface,
  },
  actionCancelText: {
    color: akColors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  actionSubmitButton: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: akColors.primary,
  },
  actionSubmitText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
