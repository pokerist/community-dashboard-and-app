import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandedPageHero } from '../components/mobile/BrandedPageHero';
import { InlineError, ScreenCard } from '../components/mobile/Primitives';
import { useAppToast } from '../components/mobile/AppToast';
import type { AuthSession } from '../features/auth/types';
import { useBottomNavMetrics } from '../features/layout/BottomNavMetricsContext';
import {
  listMyInvoices,
  listMyViolations,
  listViolationActions,
  submitViolationAction,
} from '../features/community/service';
import type { InvoiceRow, ResidentUnit, ViolationActionRow, ViolationRow } from '../features/community/types';
import { extractApiErrorMessage } from '../lib/http';
import { useBranding } from '../features/branding/provider';
import { getBrandPalette } from '../features/branding/palette';
import { formatCurrency, formatDateOnly, formatDateTime } from '../utils/format';
import { akColors, akRadius } from '../theme/alkarma';

type InvoicesViolationsScreenProps = {
  session: AuthSession;
  units: ResidentUnit[];
  selectedUnitId: string | null;
  unitsRefreshing: boolean;
  unitsLoading: boolean;
  unitsErrorMessage: string | null;
  onOpenUnitPicker?: () => void;
  deepLinkFocus?: { entityType: 'INVOICE' | 'VIOLATION'; entityId: string } | null;
  onConsumeDeepLinkFocus?: (entityType: 'INVOICE' | 'VIOLATION', entityId: string) => void;
};

export function InvoicesViolationsScreen({
  session,
  units,
  selectedUnitId,
  unitsRefreshing,
  unitsLoading,
  unitsErrorMessage,
  onOpenUnitPicker,
  deepLinkFocus,
  onConsumeDeepLinkFocus,
}: InvoicesViolationsScreenProps) {
  const { contentInsetBottom } = useBottomNavMetrics();
  const toast = useAppToast();
  const { brand } = useBranding();
  const palette = getBrandPalette(brand);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [violations, setViolations] = useState<ViolationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [selectedViolation, setSelectedViolation] = useState<ViolationRow | null>(null);
  const [violationActions, setViolationActions] = useState<ViolationActionRow[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const visibleInvoices = useMemo(
    () => (selectedUnitId ? invoices.filter((i) => i.unitId === selectedUnitId) : invoices),
    [invoices, selectedUnitId],
  );
  const visibleViolations = useMemo(
    () => (selectedUnitId ? violations.filter((v) => v.unitId === selectedUnitId) : violations),
    [violations, selectedUnitId],
  );

  useEffect(() => {
    if (!deepLinkFocus) return;
    if (deepLinkFocus.entityType === 'INVOICE') {
      const row = visibleInvoices.find((invoice) => invoice.id === deepLinkFocus.entityId);
      if (row) {
        setSelectedInvoice(row);
        onConsumeDeepLinkFocus?.(deepLinkFocus.entityType, deepLinkFocus.entityId);
      }
      return;
    }
    const violation = visibleViolations.find((row) => row.id === deepLinkFocus.entityId);
    if (violation) {
      setSelectedViolation(violation);
      onConsumeDeepLinkFocus?.(deepLinkFocus.entityType, deepLinkFocus.entityId);
    }
  }, [deepLinkFocus, onConsumeDeepLinkFocus, visibleInvoices, visibleViolations]);

  useEffect(() => {
    if (!selectedViolation?.id) {
      setViolationActions([]);
      return;
    }
    let cancelled = false;
    setActionsLoading(true);
    void listViolationActions(session.accessToken, selectedViolation.id)
      .then((rows) => {
        if (!cancelled) setViolationActions(rows);
      })
      .catch((error) => {
        if (!cancelled) toast.error('Failed to load actions', extractApiErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setActionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedViolation?.id, session.accessToken, toast]);

  const submitAction = useCallback(async (type: 'APPEAL' | 'FIX_SUBMISSION') => {
    if (!selectedViolation?.id) return;
    if (!note.trim()) {
      toast.info('Add note', 'Please enter a short note.');
      return;
    }
    setSubmitting(true);
    try {
      await submitViolationAction(session.accessToken, selectedViolation.id, {
        type,
        note: note.trim(),
      });
      toast.success('Request submitted', 'Management will review and update you.');
      setNote('');
      const rows = await listViolationActions(session.accessToken, selectedViolation.id);
      setViolationActions(rows);
      await loadData('refresh');
    } catch (error) {
      toast.error('Submission failed', extractApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }, [loadData, note, selectedViolation?.id, session.accessToken, toast]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: Math.max(110, contentInsetBottom) }]}>
        <BrandedPageHero title="Invoices & Violations" subtitle="History, statuses, and violation actions." />

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

        <ScreenCard title="Invoices" actionLabel={isRefreshing ? 'Refreshing...' : 'Refresh'} onActionPress={() => void loadData('refresh')}>
          <InlineError message={errorMessage} />
          {isLoading ? <ActivityIndicator color={palette.primary} /> : null}
          {!isLoading && visibleInvoices.length === 0 ? <Text style={styles.emptyText}>No invoices found.</Text> : null}
          {visibleInvoices.map((row) => (
            <Pressable key={row.id} style={styles.itemCard} onPress={() => setSelectedInvoice(row)}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{row.type?.replaceAll('_', ' ') ?? 'Invoice'}</Text>
                <Text style={styles.itemAmount}>{formatCurrency(Number(row.amount ?? 0))}</Text>
              </View>
              <Text style={styles.itemMeta}>Due {formatDateOnly(row.dueDate)} • {String(row.status ?? '').replaceAll('_', ' ')}</Text>
            </Pressable>
          ))}
        </ScreenCard>

        <ScreenCard title="Violations">
          {!isLoading && visibleViolations.length === 0 ? <Text style={styles.emptyText}>No violations found.</Text> : null}
          {visibleViolations.map((row) => (
            <Pressable key={row.id} style={styles.itemCard} onPress={() => setSelectedViolation(row)}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{row.type ?? 'Violation'}</Text>
                <Text style={styles.itemAmount}>{formatCurrency(Number(row.fineAmount ?? 0))}</Text>
              </View>
              <Text style={styles.itemMeta}>Status {String(row.status ?? '').replaceAll('_', ' ')} • {formatDateOnly(row.createdAt)}</Text>
            </Pressable>
          ))}
        </ScreenCard>
      </ScrollView>

      <Modal visible={Boolean(selectedInvoice)} transparent animationType="slide" onRequestClose={() => setSelectedInvoice(null)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelectedInvoice(null)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Invoice Details</Text>
            <Text style={styles.modalBody}>Amount: {formatCurrency(Number(selectedInvoice?.amount ?? 0))}</Text>
            <Text style={styles.modalBody}>Status: {String(selectedInvoice?.status ?? '').replaceAll('_', ' ')}</Text>
            <Text style={styles.modalBody}>Due: {formatDateOnly(selectedInvoice?.dueDate)}</Text>
            <Pressable style={[styles.modalBtn, { backgroundColor: palette.primary }]} onPress={() => setSelectedInvoice(null)}>
              <Text style={styles.modalBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(selectedViolation)} transparent animationType="slide" onRequestClose={() => setSelectedViolation(null)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelectedViolation(null)} />
          <View style={styles.modalSheetLarge}>
            <Text style={styles.modalTitle}>Violation Action</Text>
            <Text style={styles.modalBody}>{selectedViolation?.description || selectedViolation?.type || 'Violation'}</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              style={styles.input}
              placeholder="Add note for management"
              placeholderTextColor={akColors.textSoft}
              multiline
            />
            <View style={styles.actionRow}>
              <Pressable style={[styles.modalBtnSecondary]} onPress={() => void submitAction('APPEAL')} disabled={submitting}>
                <Text style={styles.modalBtnSecondaryText}>Submit Appeal</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: palette.primary }]} onPress={() => void submitAction('FIX_SUBMISSION')} disabled={submitting}>
                <Text style={styles.modalBtnText}>Submit Fix Proof</Text>
              </Pressable>
            </View>
            <Text style={styles.historyTitle}>Action History</Text>
            {actionsLoading ? <ActivityIndicator color={palette.primary} /> : null}
            {!actionsLoading && violationActions.length === 0 ? <Text style={styles.emptyText}>No actions submitted yet.</Text> : null}
            <ScrollView style={styles.historyList}>
              {violationActions.map((row) => (
                <View key={row.id} style={styles.historyItem}>
                  <Text style={styles.historyType}>{row.type.replaceAll('_', ' ')}</Text>
                  <Text style={styles.historyMeta}>{row.status.replaceAll('_', ' ')} • {formatDateTime(row.createdAt)}</Text>
                  {row.note ? <Text style={styles.historyNote}>{row.note}</Text> : null}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  itemCard: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: akRadius.md,
    backgroundColor: '#fff',
    padding: 12,
    gap: 6,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemTitle: { color: akColors.text, fontSize: 14, fontWeight: '700', flex: 1 },
  itemAmount: { color: akColors.text, fontSize: 14, fontWeight: '800' },
  itemMeta: { color: akColors.textMuted, fontSize: 12 },
  emptyText: { color: akColors.textMuted, fontSize: 12 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.35)' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    gap: 8,
    minHeight: 220,
  },
  modalSheetLarge: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    gap: 8,
    minHeight: 420,
    maxHeight: '86%',
  },
  modalTitle: { color: akColors.text, fontSize: 17, fontWeight: '800' },
  modalBody: { color: akColors.textMuted, fontSize: 13 },
  modalBtn: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 130,
  },
  modalBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  modalBtnSecondary: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: '#fff',
    minWidth: 130,
  },
  modalBtnSecondaryText: { color: akColors.text, fontWeight: '700', fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 72,
    textAlignVertical: 'top',
    color: akColors.text,
    fontSize: 13,
  },
  historyTitle: { color: akColors.text, fontSize: 13, fontWeight: '800' },
  historyList: { maxHeight: 220 },
  historyItem: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  historyType: { color: akColors.text, fontSize: 12, fontWeight: '700' },
  historyMeta: { color: akColors.textMuted, fontSize: 11, marginTop: 2 },
  historyNote: { color: akColors.textMuted, fontSize: 12, marginTop: 6 },
});
