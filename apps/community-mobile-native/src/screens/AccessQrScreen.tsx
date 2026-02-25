import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppToast } from '../components/mobile/AppToast';
import { GeneratedQrModal } from '../components/mobile/GeneratedQrModal';
import { InlineError, ScreenCard } from '../components/mobile/Primitives';
import { UnitPicker } from '../components/mobile/UnitPicker';
import type { AuthSession } from '../features/auth/types';
import { createAccessQr, listAccessQrs, revokeAccessQr } from '../features/community/service';
import type { AccessQrRow, ResidentUnit } from '../features/community/types';
import { extractApiErrorMessage } from '../lib/http';
import { akColors, akShadow } from '../theme/alkarma';
import { formatDateTime, plusHoursIso } from '../utils/format';

type AccessQrScreenProps = {
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

const QR_TYPES = ['VISITOR', 'DELIVERY', 'WORKER', 'SERVICE_PROVIDER', 'RIDESHARE', 'SELF'] as const;
type QrTypeOption = (typeof QR_TYPES)[number];
const VALIDITY_PRESETS = [2, 4, 8, 24] as const;
const PRIMARY_TABS: QrTypeOption[] = ['VISITOR', 'DELIVERY', 'RIDESHARE', 'WORKER'];

function buildValidityWindow(hours: number) {
  const from = new Date();
  const to = new Date(from.getTime() + hours * 60 * 60 * 1000);
  return {
    validFrom: from.toISOString(),
    validTo: to.toISOString(),
  };
}

function isValidIsoDateTime(value: string): boolean {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function parseIsoOrNow(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function mergeIsoDatePart(currentIso: string, picked: Date): string {
  const current = parseIsoOrNow(currentIso);
  current.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
  return current.toISOString();
}

function mergeIsoTimePart(currentIso: string, picked: Date): string {
  const current = parseIsoOrNow(currentIso);
  current.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
  return current.toISOString();
}

function formatTypeLabel(value?: string | null) {
  return String(value ?? 'QR').replaceAll('_', ' ');
}

function typeMeta(value: string) {
  const normalized = String(value).toUpperCase();
  switch (normalized) {
    case 'VISITOR':
      return { label: 'Visitors', icon: 'people-outline' as const, tint: '#2a3e35', tintBg: 'rgba(42,62,53,0.10)' };
    case 'DELIVERY':
      return { label: 'Deliveries', icon: 'cube-outline' as const, tint: '#2563EB', tintBg: 'rgba(37,99,235,0.10)' };
    case 'RIDESHARE':
      return { label: 'Ride', icon: 'car-outline' as const, tint: '#9333EA', tintBg: 'rgba(147,51,234,0.10)' };
    case 'WORKER':
      return { label: 'Workers', icon: 'hammer-outline' as const, tint: '#EA580C', tintBg: 'rgba(234,88,12,0.10)' };
    case 'SERVICE_PROVIDER':
      return { label: 'Service', icon: 'construct-outline' as const, tint: '#0F766E', tintBg: 'rgba(15,118,110,0.10)' };
    case 'SELF':
      return { label: 'Self', icon: 'person-outline' as const, tint: '#475569', tintBg: 'rgba(71,85,105,0.10)' };
    default:
      return { label: formatTypeLabel(value), icon: 'qr-code-outline' as const, tint: akColors.primary, tintBg: 'rgba(201,169,97,0.12)' };
  }
}

function statusBadgeColors(status?: string | null) {
  const normalized = String(status ?? '').toUpperCase();
  if (normalized === 'ACTIVE') {
    return { bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.18)', text: '#059669' };
  }
  if (normalized === 'REVOKED' || normalized === 'EXPIRED' || normalized === 'INACTIVE') {
    return { bg: 'rgba(100,116,139,0.10)', border: 'rgba(148,163,184,0.24)', text: '#64748B' };
  }
  return { bg: 'rgba(201,169,97,0.12)', border: 'rgba(201,169,97,0.22)', text: akColors.gold };
}

function typeHint(type: QrTypeOption) {
  switch (type) {
    case 'VISITOR':
      return 'Guest visit with named visitor and limited-time access.';
    case 'DELIVERY':
      return 'Fast entry for food or courier deliveries. Visitor name optional.';
    case 'RIDESHARE':
      return 'Single-purpose access for Uber/Careem drivers.';
    case 'WORKER':
      return 'Temporary access for workers/technicians within allowed time window.';
    case 'SERVICE_PROVIDER':
      return 'Use for service vendors or maintenance teams.';
    case 'SELF':
      return 'Personal access QR linked to your selected unit.';
    default:
      return 'Temporary access linked to your selected unit.';
  }
}

export function AccessQrScreen({
  session,
  units,
  selectedUnitId,
  selectedUnit,
  unitsLoading,
  unitsRefreshing,
  unitsErrorMessage,
  onSelectUnit,
  onRefreshUnits,
}: AccessQrScreenProps) {
  const insets = useSafeAreaInsets();
  const toast = useAppToast();
  const [rows, setRows] = useState<AccessQrRow[]>([]);
  const [type, setType] = useState<QrTypeOption>('VISITOR');
  const [visitorName, setVisitorName] = useState('');
  const [notes, setNotes] = useState('');
  const [validFrom, setValidFrom] = useState(new Date().toISOString());
  const [validTo, setValidTo] = useState(plusHoursIso(4));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastCreatedQrId, setLastCreatedQrId] = useState<string | null>(null);
  const [generatedQrRow, setGeneratedQrRow] = useState<AccessQrRow | null>(null);
  const [generatedQrImageBase64, setGeneratedQrImageBase64] = useState<string | null>(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [showFromDatePicker, setShowFromDatePicker] = useState(false);
  const [showFromTimePicker, setShowFromTimePicker] = useState(false);
  const [showToDatePicker, setShowToDatePicker] = useState(false);
  const [showToTimePicker, setShowToTimePicker] = useState(false);

  const loadData = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setIsLoading(true);
      else setIsRefreshing(true);
      setLoadError(null);
      try {
        const result = await listAccessQrs(session.accessToken, {
          unitId: selectedUnitId ?? undefined,
          includeInactive: true,
        });
        setRows(result);
      } catch (error) {
        setLoadError(extractApiErrorMessage(error));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedUnitId, session.accessToken],
  );

  useEffect(() => {
    void loadData('initial');
  }, [loadData]);

  const activeRows = useMemo(
    () => rows.filter((row) => String(row.status).toUpperCase() === 'ACTIVE'),
    [rows],
  );

  const recentRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const aTime = new Date(a.createdAt ?? 0).getTime();
        const bTime = new Date(b.createdAt ?? 0).getTime();
        return bTime - aTime;
      }),
    [rows],
  );

  const requiresVisitorName = type === 'VISITOR';
  const selectedTypeMeta = typeMeta(type);
  const extraTypes = QR_TYPES.filter((v) => !PRIMARY_TABS.includes(v));

  useEffect(() => {
    if (requiresVisitorName) return;
    setVisitorName('');
  }, [requiresVisitorName]);

  const submitQr = useCallback(async () => {
    if (!selectedUnitId) {
      setSubmitError('Select a unit first.');
      toast.error('Missing unit', 'Select a unit before generating a QR code.');
      return;
    }
    if (requiresVisitorName && !visitorName.trim()) {
      setSubmitError('Visitor name is required for VISITOR QR.');
      toast.error('Missing visitor name', 'Visitor name is required for visitor access.');
      return;
    }
    if (!isValidIsoDateTime(validFrom.trim())) {
      setSubmitError('Valid From must be a valid ISO datetime.');
      toast.error('Invalid date', 'Valid From must be a valid date/time.');
      return;
    }
    if (!isValidIsoDateTime(validTo.trim())) {
      setSubmitError('Valid To must be a valid ISO datetime.');
      toast.error('Invalid date', 'Valid To must be a valid date/time.');
      return;
    }
    if (new Date(validTo).getTime() <= new Date(validFrom).getTime()) {
      setSubmitError('Valid To must be later than Valid From.');
      toast.error('Invalid validity window', 'Valid To must be later than Valid From.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);
    try {
      const created = await createAccessQr(session.accessToken, {
        unitId: selectedUnitId,
        type,
        visitorName: visitorName.trim() || undefined,
        validFrom: validFrom.trim() || undefined,
        validTo: validTo.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setLastCreatedQrId(created.qrCode.qrId ?? created.qrCode.id);
      setSuccessMessage('Access permit generated successfully.');
      setGeneratedQrRow(created.qrCode);
      setGeneratedQrImageBase64(created.qrImageBase64 ?? null);
      setQrModalVisible(true);
      if (type === 'VISITOR') setVisitorName('');
      setNotes('');
      toast.success('QR code generated', 'Access permit is ready to share.');
      await loadData('refresh');
    } catch (error) {
      const msg = extractApiErrorMessage(error);
      setSubmitError(msg);
      toast.error('Failed to generate QR', msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [loadData, notes, requiresVisitorName, selectedUnitId, session.accessToken, toast, type, validFrom, validTo, visitorName]);

  const handleRevoke = useCallback(
    async (id: string) => {
      setRevokingId(id);
      setSubmitError(null);
      try {
        await revokeAccessQr(session.accessToken, id);
        toast.success('QR revoked', 'The access code was revoked successfully.');
        await loadData('refresh');
      } catch (error) {
        const msg = extractApiErrorMessage(error);
        setSubmitError(msg);
        toast.error('Failed to revoke QR', msg);
      } finally {
        setRevokingId(null);
      }
    },
    [loadData, session.accessToken, toast],
  );

  const applyPreset = useCallback((hours: number) => {
    const next = buildValidityWindow(hours);
    setValidFrom(next.validFrom);
    setValidTo(next.validTo);
    setSubmitError(null);
  }, []);

  const resetStartNow = useCallback(() => {
    setValidFrom(new Date().toISOString());
    setSubmitError(null);
  }, []);

  const onFromDatePicked = useCallback((event: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS !== 'ios') setShowFromDatePicker(false);
    if (event.type === 'dismissed' || !picked) return;
    setValidFrom((prev) => mergeIsoDatePart(prev, picked));
    setSubmitError(null);
  }, []);

  const onFromTimePicked = useCallback((event: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS !== 'ios') setShowFromTimePicker(false);
    if (event.type === 'dismissed' || !picked) return;
    setValidFrom((prev) => mergeIsoTimePart(prev, picked));
    setSubmitError(null);
  }, []);

  const onToDatePicked = useCallback((event: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS !== 'ios') setShowToDatePicker(false);
    if (event.type === 'dismissed' || !picked) return;
    setValidTo((prev) => mergeIsoDatePart(prev, picked));
    setSubmitError(null);
  }, []);

  const onToTimePicked = useCallback((event: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS !== 'ios') setShowToTimePicker(false);
    if (event.type === 'dismissed' || !picked) return;
    setValidTo((prev) => mergeIsoTimePart(prev, picked));
    setSubmitError(null);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: Math.max(insets.top, 8) + 8, paddingBottom: 110 },
        ]}
      >
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>QR Codes</Text>
        <Text style={styles.headerSubtitle}>Generate and manage access codes</Text>
      </View>

      <ScreenCard title="Unit Context">
        <UnitPicker
          units={units}
          selectedUnitId={selectedUnitId}
          onSelect={onSelectUnit}
          onRefresh={() => void onRefreshUnits()}
          isRefreshing={unitsRefreshing}
          title="Choose Unit"
        />
        <InlineError message={unitsErrorMessage} />
        {unitsLoading ? <ActivityIndicator color={akColors.primary} /> : null}
        {selectedUnit ? (
          <View style={styles.unitHintRow}>
            <Ionicons name="home-outline" size={14} color={akColors.primary} />
            <Text style={styles.helperText}>Generating codes for unit {selectedUnit.unitNumber ?? selectedUnit.id}</Text>
          </View>
        ) : null}
      </ScreenCard>

      <View style={styles.tabsCard}>
        <View style={styles.tabsGrid}>
          {PRIMARY_TABS.map((value) => {
            const meta = typeMeta(value);
            const active = type === value;
            return (
              <Pressable key={value} onPress={() => setType(value)} style={[styles.tabButton, active && styles.tabButtonActive]}>
                <Ionicons name={meta.icon} size={16} color={active ? akColors.white : akColors.textMuted} />
                <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{meta.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.extraTypeRow}>
          {extraTypes.map((value) => {
            const active = type === value;
            return (
              <Pressable key={value} onPress={() => setType(value)} style={[styles.extraTypeChip, active && styles.extraTypeChipActive]}>
                <Text style={[styles.extraTypeChipText, active && styles.extraTypeChipTextActive]}>{typeMeta(value).label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScreenCard title="Generate Access Permit" actionLabel={isRefreshing ? 'Refreshing...' : 'Reload'} onActionPress={() => void loadData('refresh')}>
        <InlineError message={loadError} />
        {/* submit/revoke errors are shown as toasts to reduce visual clutter */}

        <View style={styles.typeBanner}>
          <View style={[styles.typeBannerIcon, { backgroundColor: selectedTypeMeta.tintBg }]}>
            <Ionicons name={selectedTypeMeta.icon} size={18} color={selectedTypeMeta.tint} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.typeBannerTitle}>{selectedTypeMeta.label} Permit</Text>
            <Text style={styles.typeBannerSubtitle}>{typeHint(type)}</Text>
          </View>
        </View>

        {successMessage ? (
          <LinearGradient colors={['rgba(42,62,53,0.10)', 'rgba(201,169,97,0.08)']} style={styles.successCard}>
            <View style={styles.successTopRow}>
              <View style={styles.successIconWrap}>
                <Ionicons name="checkmark-circle" size={20} color={akColors.success} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.successTitle}>{successMessage}</Text>
                {lastCreatedQrId ? <Text style={styles.successCode}>ID: {lastCreatedQrId}</Text> : null}
              </View>
            </View>
            <View style={styles.qrPreviewBox}>
              <MaterialCommunityIcons name="qrcode" size={46} color={akColors.primary} />
              <Text style={styles.qrPreviewText}>Access permit is ready and listed below.</Text>
            </View>
          </LinearGradient>
        ) : null}

        <Text style={styles.label}>Visitor Name</Text>
        <View style={[styles.inputShell, !requiresVisitorName && styles.inputShellDisabled]}>
          <Ionicons name="person-outline" size={18} color={akColors.textMuted} />
          <TextInput
            value={visitorName}
            onChangeText={setVisitorName}
            style={[styles.input, !requiresVisitorName && styles.inputDisabled]}
            placeholder={requiresVisitorName ? 'Mohamed Ibrahim' : 'Not required for this permit type'}
            placeholderTextColor={akColors.textSoft}
            editable={requiresVisitorName}
          />
        </View>
        {!requiresVisitorName ? (
          <Text style={styles.helperText}>Visitor name is optional for {selectedTypeMeta.label.toLowerCase()} access.</Text>
        ) : null}

        <Text style={styles.label}>Valid From</Text>
        <View style={styles.inlineButtonsWrap}>
          <Pressable onPress={resetStartNow} style={styles.inlineGhostButton}><Text style={styles.inlineGhostButtonText}>Now</Text></Pressable>
          <Pressable onPress={() => setShowFromDatePicker((v) => !v)} style={styles.inlineGhostButton}>
            <Ionicons name="calendar-outline" size={14} color={akColors.textMuted} />
            <Text style={styles.inlineGhostButtonText}>Date</Text>
          </Pressable>
          <Pressable onPress={() => setShowFromTimePicker((v) => !v)} style={styles.inlineGhostButton}>
            <Ionicons name="time-outline" size={14} color={akColors.textMuted} />
            <Text style={styles.inlineGhostButtonText}>Time</Text>
          </Pressable>
        </View>
        {showFromDatePicker && Platform.OS !== 'web' ? <DateTimePicker mode="date" value={parseIsoOrNow(validFrom)} onChange={onFromDatePicked} /> : null}
        {showFromTimePicker && Platform.OS !== 'web' ? <DateTimePicker mode="time" value={parseIsoOrNow(validFrom)} onChange={onFromTimePicked} /> : null}
        <TextInput value={validFrom} onChangeText={setValidFrom} style={styles.textField} placeholder="2026-02-24T10:00:00.000Z" placeholderTextColor={akColors.textSoft} />

        <Text style={styles.label}>Validity Presets</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
          {VALIDITY_PRESETS.map((hours) => (
            <Pressable key={hours} onPress={() => applyPreset(hours)} style={styles.presetChip}>
              <Text style={styles.presetChipText}>{hours}h</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>Valid To</Text>
        <View style={styles.inlineButtonsWrap}>
          <Pressable onPress={() => setShowToDatePicker((v) => !v)} style={styles.inlineGhostButton}>
            <Ionicons name="calendar-outline" size={14} color={akColors.textMuted} />
            <Text style={styles.inlineGhostButtonText}>Date</Text>
          </Pressable>
          <Pressable onPress={() => setShowToTimePicker((v) => !v)} style={styles.inlineGhostButton}>
            <Ionicons name="time-outline" size={14} color={akColors.textMuted} />
            <Text style={styles.inlineGhostButtonText}>Time</Text>
          </Pressable>
        </View>
        {showToDatePicker && Platform.OS !== 'web' ? <DateTimePicker mode="date" value={parseIsoOrNow(validTo)} onChange={onToDatePicked} /> : null}
        {showToTimePicker && Platform.OS !== 'web' ? <DateTimePicker mode="time" value={parseIsoOrNow(validTo)} onChange={onToTimePicked} /> : null}
        <TextInput value={validTo} onChangeText={setValidTo} style={styles.textField} placeholder="2026-02-24T14:00:00.000Z" placeholderTextColor={akColors.textSoft} />

        <View style={styles.previewRow}>
          <Ionicons name="time-outline" size={14} color={akColors.primary} />
          <Text style={styles.previewText}>{formatDateTime(validFrom)} → {formatDateTime(validTo)}</Text>
        </View>

        <Text style={styles.label}>Notes (optional)</Text>
        <View style={[styles.inputShell, styles.multilineShell]}>
          <Ionicons name="document-text-outline" size={18} color={akColors.textMuted} style={styles.multilineIcon} />
          <TextInput
            value={notes}
            onChangeText={setNotes}
            style={[styles.input, styles.multilineInput]}
            multiline
            numberOfLines={3}
            placeholder="Order number, technician name, gate note..."
            placeholderTextColor={akColors.textSoft}
          />
        </View>

        <Pressable onPress={() => void submitQr()} disabled={isSubmitting} style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}>
          <LinearGradient colors={[akColors.primary, akColors.primaryDark]} style={styles.submitButtonGradient}>
            {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : null}
            <Text style={styles.submitButtonText}>{isSubmitting ? 'Generating...' : 'Send Access Permit to Security'}</Text>
          </LinearGradient>
        </Pressable>
      </ScreenCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent QR Codes</Text>
        <Text style={styles.sectionLink}>Active: {activeRows.length}</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingCard}><ActivityIndicator color={akColors.primary} /></View>
      ) : null}

      {!isLoading && recentRows.length === 0 ? (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons name="qrcode-scan" size={28} color={akColors.textSoft} />
          <Text style={styles.emptyTitle}>No QR codes yet</Text>
          <Text style={styles.emptyText}>Generate your first access permit using the form above.</Text>
        </View>
      ) : null}

      {recentRows.map((row) => {
        const isActive = String(row.status).toUpperCase() === 'ACTIVE';
        const badge = statusBadgeColors(row.status);
        const meta = typeMeta(row.type ?? 'QR');
        return (
          <View key={row.id} style={styles.historyCard}>
            <View style={styles.historyTopRow}>
              <View style={[styles.historyIconWrap, { backgroundColor: meta.tintBg }]}>
                <Ionicons name={meta.icon} size={18} color={meta.tint} />
              </View>
              <View style={styles.flex}>
                <View style={styles.historyTitleRow}>
                  <Text style={styles.historyId}>{row.qrId ?? row.id}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                    <Text style={[styles.statusBadgeText, { color: badge.text }]}>{String(row.status ?? 'UNKNOWN')}</Text>
                  </View>
                </View>
                <Text style={styles.historySub}>{formatTypeLabel(row.type)}{row.visitorName ? ` • ${row.visitorName}` : ''}</Text>
                <Text style={styles.historyTime}>{formatDateTime(row.validFrom)} → {formatDateTime(row.validTo)}</Text>
              </View>
            </View>
            {row.notes ? <Text style={styles.historyNote}>{row.notes}</Text> : null}
            <View style={styles.historyFooter}>
              <Text style={styles.historyCreated}>Created {formatDateTime(row.createdAt)}</Text>
              {isActive ? (
                <Pressable onPress={() => void handleRevoke(row.id)} disabled={revokingId === row.id} style={[styles.revokeButton, revokingId === row.id && styles.buttonDisabled]}>
                  <Text style={styles.revokeButtonText}>{revokingId === row.id ? 'Revoking...' : 'Revoke'}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}
      </ScrollView>
      <GeneratedQrModal
        visible={qrModalVisible}
        qrRow={generatedQrRow}
        qrImageBase64={generatedQrImageBase64}
        onClose={() => setQrModalVisible(false)}
        onToast={(variant, title, description) => {
          if (variant === 'error') toast.error(title, description);
          else if (variant === 'success') toast.success(title, description);
          else toast.info(title, description);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: akColors.bg },
  container: { padding: 16, gap: 14, backgroundColor: akColors.bg },
  headerCard: {
    backgroundColor: akColors.surface,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: akColors.border,
    ...akShadow.soft,
  },
  headerTitle: { color: akColors.text, fontSize: 22, fontWeight: '700' },
  headerSubtitle: { marginTop: 4, color: akColors.textMuted, fontSize: 13 },
  unitHintRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  helperText: { color: akColors.textMuted, fontSize: 12, lineHeight: 17 },
  tabsCard: {
    backgroundColor: akColors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: akColors.border,
    padding: 10,
    gap: 8,
    ...akShadow.soft,
  },
  tabsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tabButton: {
    minWidth: '47%',
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabButtonActive: { backgroundColor: akColors.primary, borderColor: akColors.primary },
  tabButtonText: { color: akColors.text, fontSize: 12, fontWeight: '700' },
  tabButtonTextActive: { color: akColors.white },
  extraTypeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  extraTypeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  extraTypeChipActive: { borderColor: akColors.gold, backgroundColor: 'rgba(201,169,97,0.12)' },
  extraTypeChipText: { color: akColors.textMuted, fontSize: 11, fontWeight: '700' },
  extraTypeChipTextActive: { color: akColors.primary },
  typeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    backgroundColor: akColors.surfaceMuted,
    borderWidth: 1,
    borderColor: akColors.border,
    padding: 10,
  },
  typeBannerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  typeBannerTitle: { color: akColors.text, fontSize: 13, fontWeight: '700' },
  typeBannerSubtitle: { color: akColors.textMuted, fontSize: 11, lineHeight: 16 },
  successCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(201,169,97,0.25)',
    padding: 12,
    gap: 10,
  },
  successTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  successIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(5,150,105,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { color: akColors.primary, fontSize: 13, fontWeight: '700' },
  successCode: { color: akColors.textMuted, fontSize: 11 },
  qrPreviewBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: 'rgba(255,255,255,0.75)',
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  qrPreviewText: { color: akColors.textMuted, fontSize: 12, textAlign: 'center' },
  label: { color: akColors.text, fontSize: 12, fontWeight: '600', marginTop: 2 },
  inputShell: {
    borderRadius: 14,
    backgroundColor: akColors.surfaceMuted,
    borderWidth: 1,
    borderColor: akColors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputShellDisabled: { opacity: 0.82 },
  input: { flex: 1, padding: 0, color: akColors.text, fontSize: 14, minHeight: 20 },
  inputDisabled: { color: akColors.textSoft },
  inlineButtonsWrap: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  inlineGhostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  inlineGhostButtonText: { color: akColors.textMuted, fontSize: 11, fontWeight: '700' },
  textField: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 12,
    backgroundColor: akColors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: akColors.text,
    fontSize: 13,
  },
  presetRow: { gap: 8, paddingRight: 8 },
  presetChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(201,169,97,0.28)',
    backgroundColor: 'rgba(201,169,97,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  presetChipText: { color: akColors.primary, fontSize: 11, fontWeight: '700' },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(42,62,53,0.05)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  previewText: { flex: 1, color: akColors.textMuted, fontSize: 12 },
  multilineShell: { alignItems: 'flex-start' },
  multilineIcon: { marginTop: 2 },
  multilineInput: { minHeight: 70, textAlignVertical: 'top' },
  submitButton: { borderRadius: 14, overflow: 'hidden', ...akShadow.soft },
  submitButtonGradient: {
    paddingVertical: 13,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  submitButtonText: { color: akColors.white, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  buttonDisabled: { opacity: 0.6 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, paddingHorizontal: 2 },
  sectionTitle: { color: akColors.text, fontSize: 16, fontWeight: '700' },
  sectionLink: { color: akColors.primary, fontSize: 12, fontWeight: '600' },
  loadingCard: {
    backgroundColor: akColors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: akColors.border,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    backgroundColor: akColors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: akColors.border,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: { color: akColors.text, fontSize: 14, fontWeight: '700' },
  emptyText: { color: akColors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 17 },
  historyCard: {
    backgroundColor: akColors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: akColors.border,
    padding: 12,
    gap: 10,
    ...akShadow.soft,
  },
  historyTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  historyIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  historyTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  historyId: { color: akColors.primary, fontSize: 13, fontWeight: '700' },
  statusBadge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  historySub: { marginTop: 2, color: akColors.text, fontSize: 12, fontWeight: '500' },
  historyTime: { marginTop: 2, color: akColors.textMuted, fontSize: 11, lineHeight: 16 },
  historyNote: { color: akColors.textMuted, fontSize: 12, lineHeight: 17, borderTopWidth: 1, borderColor: akColors.border, paddingTop: 8 },
  historyFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  historyCreated: { color: akColors.textSoft, fontSize: 10 },
  revokeButton: {
    borderRadius: 999,
    backgroundColor: 'rgba(220,38,38,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.14)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  revokeButtonText: { color: '#B91C1C', fontSize: 11, fontWeight: '700' },
  flex: { flex: 1 },
});
