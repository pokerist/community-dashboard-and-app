import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Modal,
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
import { BrandedPageHero } from '../components/mobile/BrandedPageHero';
import { GeneratedQrModal } from '../components/mobile/GeneratedQrModal';
import { InlineError, ScreenCard } from '../components/mobile/Primitives';
import type { AuthSession } from '../features/auth/types';
import { createAccessQr, listAccessQrs, revokeAccessQr } from '../features/community/service';
import type { AccessQrRow, ResidentUnit } from '../features/community/types';
import { pickAndUploadServiceAttachment } from '../features/files/service';
import { useBranding } from '../features/branding/provider';
import { getBrandPalette } from '../features/branding/palette';
import { useBottomNavMetrics } from '../features/layout/BottomNavMetricsContext';
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
  onOpenUnitPicker?: () => void;
  deepLinkAccessQrId?: string | null;
  onConsumeDeepLinkAccessQrId?: (qrId: string) => void;
};

const QR_TYPES = ['VISITOR', 'DELIVERY', 'RIDESHARE', 'WORKER'] as const;
type QrTypeOption = (typeof QR_TYPES)[number];
const PRIMARY_TABS: QrTypeOption[] = ['VISITOR', 'DELIVERY', 'RIDESHARE', 'WORKER'];
const DELIVERY_COMPANIES = ['Talabat', 'Noon Minutes', 'Rabbit', 'Breadfast', 'Mrsool', 'Elmenus', 'InstaShop', 'Jumia Food', 'Chefaa', 'Other'];
const RIDE_COMPANIES = ['Uber', 'Careem', 'DIDI', 'InDrive', 'Bolt', 'Other'] as const;
const WORK_TYPES = ['Renovation', 'Electrical', 'Plumbing', 'Painting', 'Other'] as const;
const WORK_DURATIONS = [
  { value: '1 day', hours: 24 },
  { value: '2-3 days', hours: 72 },
  { value: 'Week', hours: 24 * 7 },
  { value: 'Month', hours: 24 * 30 },
  { value: 'Ongoing', hours: 24 * 60 },
] as const;
const WORK_REGULATIONS_TEXT = `Al Karma Compound Work Regulations
Please review and accept the following regulations before proceeding

Permitted Working Hours
• السبت - الخميس: 8:00 صباحاً - 6:00 مساءً
• الجمعة: ممنوع العمل
• يُمنع إصدار أي ضوضاء بعد الساعة 6:00 مساءً
Official Holidays - No Work Allowed
• عيد الفطر المبارك (3 أيام)
• عيد الأضحى المبارك (4 أيام)
• رأس السنة الميلادية (1 يناير)
• ثورة 25 يناير (25 يناير)
• عيد تحرير سيناء (25 أبريل)
• عيد العمال (1 مايو)
• ثورة 30 يونيو (30 يونيو)
• ثورة 23 يوليو (23 يوليو)
Safety & Conduct Rules
• يجب على جميع العمال ارتداء بطاقات التعريف المرئية
• استخدام معدات السلامة إلزامي (خوذة، أحذية أمان)
• التدخين محظور في الأماكن المغلقة
• يجب الحفاظ على نظافة موقع العمل
• احترام خصوصية السكان وممتلكاتهم
• عدم استخدام المصاعد العامة لنقل مواد البناء
Violations & Penalties
• العمل في أوقات غير مصرح بها: 500 جنيه
• العمل في أيام العطلات الرسمية: 1000 جنيه
• عدم ارتداء بطاقات التعريف: 200 جنيه
• إحداث ضوضاء زائدة: 300 جنيه
• عدم الالتزام بقواعد السلامة: 500 جنيه
• المخالفة المتكررة قد تؤدي إلى إلغاء التصريح نهائياً
إقرار المسؤولية: بالموافقة على هذه اللوائح، أتحمل كامل المسؤولية عن جميع العمال المسجلين تحت اسمي. أتعهد بالالتزام بجميع القواعد المذكورة أعلاه وسداد أي غرامات قد تنتج عن مخالفات العمال.`;

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

function formatStatusLabel(value?: string | null) {
  return String(value ?? 'UNKNOWN').replaceAll('_', ' ');
}

function typeMeta(value: string, palette: ReturnType<typeof getBrandPalette>) {
  const normalized = String(value).toUpperCase();
  switch (normalized) {
    case 'VISITOR':
      return { label: 'Visitors', icon: 'people-outline' as const, tint: palette.primary, tintBg: palette.primarySoft10 };
    case 'DELIVERY':
      return { label: 'Deliveries', icon: 'cube-outline' as const, tint: '#2563EB', tintBg: 'rgba(37,99,235,0.10)' };
    case 'RIDESHARE':
      return { label: 'Ride', icon: 'car-outline' as const, tint: '#9333EA', tintBg: 'rgba(147,51,234,0.10)' };
    case 'WORKER':
      return { label: 'Workers', icon: 'hammer-outline' as const, tint: '#EA580C', tintBg: 'rgba(234,88,12,0.10)' };
    default:
      return { label: formatTypeLabel(value), icon: 'qr-code-outline' as const, tint: palette.primary, tintBg: palette.accentSoft12 };
  }
}

function statusBadgeColors(
  status: string | null | undefined,
  palette: ReturnType<typeof getBrandPalette>,
) {
  const normalized = String(status ?? '').toUpperCase();
  if (normalized === 'ACTIVE') {
    return { bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.18)', text: '#059669' };
  }
  if (normalized === 'REVOKED' || normalized === 'EXPIRED' || normalized === 'INACTIVE') {
    return { bg: 'rgba(100,116,139,0.10)', border: 'rgba(148,163,184,0.24)', text: '#64748B' };
  }
  return { bg: palette.accentSoft12, border: palette.primarySoft22, text: palette.secondary };
}

export function AccessQrScreen({
  session,
  units,
  selectedUnitId,
  selectedUnit,
  unitsLoading,
  unitsRefreshing,
  unitsErrorMessage,
  onSelectUnit: _onSelectUnit,
  onRefreshUnits: _onRefreshUnits,
  onOpenUnitPicker,
  deepLinkAccessQrId = null,
  onConsumeDeepLinkAccessQrId,
}: AccessQrScreenProps) {
  const insets = useSafeAreaInsets();
  const { contentInsetBottom } = useBottomNavMetrics();
  const { brand } = useBranding();
  const palette = getBrandPalette(brand);
  const toast = useAppToast();
  const [rows, setRows] = useState<AccessQrRow[]>([]);
  const [type, setType] = useState<QrTypeOption>('VISITOR');
  const [visitorUsageMode, setVisitorUsageMode] = useState<'SINGLE_USE' | 'MULTI_USE'>('SINGLE_USE');
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [visitorPurpose, setVisitorPurpose] = useState('');
  const [deliveryCompany, setDeliveryCompany] = useState(DELIVERY_COMPANIES[0]);
  const [deliveryOtherCompany, setDeliveryOtherCompany] = useState('');
  const [rideCompany, setRideCompany] = useState<(typeof RIDE_COMPANIES)[number]>(RIDE_COMPANIES[0]);
  const [rideOtherCompany, setRideOtherCompany] = useState('');
  const [driverName, setDriverName] = useState('');
  const [carNumber, setCarNumber] = useState('');
  const [workersCount, setWorkersCount] = useState('1');
  const [workType, setWorkType] = useState<(typeof WORK_TYPES)[number]>(WORK_TYPES[0]);
  const [workDuration, setWorkDuration] = useState<(typeof WORK_DURATIONS)[number]['value']>(WORK_DURATIONS[0].value);
  const [workerIdFiles, setWorkerIdFiles] = useState<Array<{ id: string; name: string }>>([]);
  const [isUploadingWorkerId, setIsUploadingWorkerId] = useState(false);
  const [showRegulationsModal, setShowRegulationsModal] = useState(false);
  const [acceptedRegulations, setAcceptedRegulations] = useState(false);
  const [validFrom, setValidFrom] = useState(new Date().toISOString());
  const [validTo, setValidTo] = useState(plusHoursIso(4));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastCreatedQrId, setLastCreatedQrId] = useState<string | null>(null);
  const [generatedQrRow, setGeneratedQrRow] = useState<AccessQrRow | null>(null);
  const [generatedQrImageBase64, setGeneratedQrImageBase64] = useState<string | null>(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [selectedQr, setSelectedQr] = useState<AccessQrRow | null>(null);
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

  useEffect(() => {
    if (!deepLinkAccessQrId) return;
    const row = rows.find((r) => r.id === deepLinkAccessQrId) ?? null;
    if (row) {
      setSelectedQr(row);
      onConsumeDeepLinkAccessQrId?.(deepLinkAccessQrId);
    }
  }, [deepLinkAccessQrId, onConsumeDeepLinkAccessQrId, rows]);

  useEffect(() => {
    setSubmitError(null);
    setShowFromDatePicker(false);
    setShowFromTimePicker(false);
    setShowToDatePicker(false);
    setShowToTimePicker(false);
  }, [type]);

  const selectedTypeMeta = typeMeta(type, palette);
  const workerDurationHours = useMemo(
    () => WORK_DURATIONS.find((item) => item.value === workDuration)?.hours ?? 24,
    [workDuration],
  );
  const previewValidTo = useMemo(() => {
    if (type === 'WORKER') {
      const start = parseIsoOrNow(validFrom);
      return new Date(start.getTime() + workerDurationHours * 60 * 60 * 1000).toISOString();
    }
    return validTo;
  }, [type, validFrom, validTo, workerDurationHours]);

  const submitQr = useCallback(async () => {
    if (!selectedUnitId) {
      setSubmitError('Select a unit first.');
      toast.error('Missing unit', 'Select a unit before generating an access permit.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const now = new Date();
      let payloadVisitorName = visitorName.trim() || undefined;
      let payloadValidFrom = validFrom.trim() || now.toISOString();
      let payloadValidTo = validTo.trim() || plusHoursIso(4);
      const noteLines: string[] = [];

      if (type === 'VISITOR') {
        if (!visitorName.trim()) {
          setSubmitError('Visitor name is required for visitor permits.');
          toast.error('Missing visitor name', 'Visitor name is required.');
          return;
        }
        if (!visitorPhone.trim()) {
          setSubmitError('Phone number is required for visitor permits.');
          toast.error('Missing phone number', 'Phone number is required.');
          return;
        }
        payloadVisitorName = visitorName.trim();
        noteLines.push(`Phone: ${visitorPhone.trim()}`);
        if (visitorPurpose.trim()) noteLines.push(`Purpose: ${visitorPurpose.trim()}`);
      }

      if (type === 'DELIVERY') {
        const effectiveDeliveryCompany =
          deliveryCompany === 'Other' ? deliveryOtherCompany.trim() : deliveryCompany.trim();
        if (!effectiveDeliveryCompany) {
          setSubmitError('Select a delivery company.');
          toast.error('Missing company', 'Select a delivery company first.');
          return;
        }
        payloadVisitorName = `${effectiveDeliveryCompany} Courier`;
        payloadValidFrom = now.toISOString();
        payloadValidTo = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString();
        noteLines.push(`Delivery Company: ${effectiveDeliveryCompany}`);
      }

      if (type === 'RIDESHARE') {
        const effectiveRideCompany =
          rideCompany === 'Other' ? rideOtherCompany.trim() : rideCompany;
        payloadVisitorName = driverName.trim() || `${effectiveRideCompany || 'Ride'} Driver`;
        payloadValidFrom = now.toISOString();
        payloadValidTo = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
        noteLines.push(`Ride Company: ${effectiveRideCompany || 'Other'}`);
        if (driverName.trim()) noteLines.push(`Driver Name: ${driverName.trim()}`);
        if (carNumber.trim()) noteLines.push(`Car Number: ${carNumber.trim()}`);
      }

      if (type === 'WORKER') {
        const workers = Number(workersCount);
        if (!Number.isFinite(workers) || workers < 1) {
          setSubmitError('Workers count must be at least 1.');
          toast.error('Invalid workers count', 'Please enter a valid workers count.');
          return;
        }
        if (workerIdFiles.length < workers) {
          setSubmitError(`Upload ${workers} worker ID image(s) before submitting.`);
          toast.error('Missing worker IDs', `You selected ${workers} workers. Upload ${workers} ID image(s).`);
          return;
        }
        const startDate = new Date(payloadValidFrom);
        const day = startDate.getDay();
        const leadHours = (startDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (leadHours < 24) {
          setSubmitError('Workers permit must be requested at least 24 hours in advance.');
          toast.error('Invalid date', 'Workers permit must be requested at least 24 hours in advance.');
          return;
        }
        if (day === 5 || day === 6) {
          setSubmitError('Workers permit cannot start on Friday or Saturday.');
          toast.error('Invalid date', 'Workers permit cannot start on Friday or Saturday.');
          return;
        }
        const duration = WORK_DURATIONS.find((item) => item.value === workDuration)?.hours ?? 24;
        payloadVisitorName = `${workersCount} Worker(s)`;
        payloadValidFrom = validFrom.trim() || now.toISOString();
        payloadValidTo =
          new Date(new Date(payloadValidFrom).getTime() + duration * 60 * 60 * 1000).toISOString();
        noteLines.push(`Workers Count: ${workersCount}`);
        noteLines.push(`Work Type: ${workType}`);
        noteLines.push(`Expected Duration: ${workDuration}`);
        noteLines.push(`Worker IDs Attached: ${workerIdFiles.length}`);
      }

      if (!isValidIsoDateTime(payloadValidFrom)) {
        setSubmitError('Valid From must be a valid date/time.');
        toast.error('Invalid date', 'Start date and time are invalid.');
        return;
      }
      if (!isValidIsoDateTime(payloadValidTo)) {
        setSubmitError('Valid To must be a valid date/time.');
        toast.error('Invalid date', 'End date and time are invalid.');
        return;
      }
      if (new Date(payloadValidTo).getTime() <= new Date(payloadValidFrom).getTime()) {
        setSubmitError('Valid To must be later than Valid From.');
        toast.error('Invalid validity window', 'End date must be later than start date.');
        return;
      }

      const created = await createAccessQr(session.accessToken, {
        unitId: selectedUnitId,
        type,
        usageMode: type === 'VISITOR' ? visitorUsageMode : 'SINGLE_USE',
        visitorName: payloadVisitorName,
        validFrom: payloadValidFrom,
        validTo: payloadValidTo,
        notes: noteLines.length ? noteLines.join('\n') : undefined,
      });
      setLastCreatedQrId(created.qrCode.qrId ?? created.qrCode.id);
      if (type === 'WORKER' && created.pendingApproval) {
        setGeneratedQrRow(null);
        setGeneratedQrImageBase64(null);
        setQrModalVisible(false);
      } else {
        setGeneratedQrRow(created.qrCode);
        setGeneratedQrImageBase64(created.qrImageBase64 ?? null);
        setQrModalVisible(true);
      }
      if (type === 'VISITOR') setVisitorName('');
      if (type === 'VISITOR') {
        setVisitorPhone('');
        setVisitorPurpose('');
        setVisitorUsageMode('SINGLE_USE');
      }
      if (type === 'RIDESHARE') {
        setDriverName('');
        setCarNumber('');
        setRideOtherCompany('');
      }
      if (type === 'DELIVERY') {
        setDeliveryOtherCompany('');
      }
      if (type === 'WORKER') {
        setWorkersCount('1');
        setWorkerIdFiles([]);
        setAcceptedRegulations(false);
      }
      if (type === 'WORKER' && created.pendingApproval) {
        toast.info(
          'Worker permit submitted',
          'Request sent to management. QR will be generated after approval.',
        );
      } else {
        toast.success('Access permit generated', 'The QR code is ready to share.');
      }
      await loadData('refresh');
    } catch (error) {
      const msg = extractApiErrorMessage(error);
      setSubmitError(msg);
      toast.error('Failed to generate access permit', msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [carNumber, deliveryCompany, deliveryOtherCompany, driverName, loadData, selectedUnitId, session.accessToken, toast, type, validFrom, validTo, visitorName, visitorPhone, visitorPurpose, visitorUsageMode, workerIdFiles, workersCount, workDuration, workType, rideCompany, rideOtherCompany]);

  const handleRevoke = useCallback(
    async (id: string) => {
      setRevokingId(id);
      setSubmitError(null);
      try {
        await revokeAccessQr(session.accessToken, id);
        toast.success('Access permit revoked', 'The access permit was revoked successfully.');
        await loadData('refresh');
      } catch (error) {
        const msg = extractApiErrorMessage(error);
        setSubmitError(msg);
        toast.error('Failed to revoke access permit', msg);
      } finally {
        setRevokingId(null);
      }
    },
    [loadData, session.accessToken, toast],
  );

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

  const handleUploadWorkerId = useCallback(async () => {
    setIsUploadingWorkerId(true);
    try {
      const uploaded = await pickAndUploadServiceAttachment(session.accessToken);
      if (!uploaded) return;
      setWorkerIdFiles((prev) => {
        if (prev.some((file) => file.id === uploaded.id)) return prev;
        return [...prev, { id: uploaded.id, name: uploaded.name }];
      });
      toast.success('Worker ID uploaded', 'Worker ID image attached successfully.');
    } catch (error) {
      const msg = extractApiErrorMessage(error);
      setSubmitError(msg);
      toast.error('Failed to upload worker ID', msg);
    } finally {
      setIsUploadingWorkerId(false);
    }
  }, [session.accessToken, toast]);

  const removeWorkerIdFile = useCallback((fileId: string) => {
    setWorkerIdFiles((prev) => prev.filter((file) => file.id !== fileId));
  }, []);

  const handlePrimarySubmit = useCallback(() => {
    if (type === 'WORKER') {
      const workers = Number(workersCount);
      if (!Number.isFinite(workers) || workers < 1) {
        setSubmitError('Workers count must be at least 1.');
        toast.error('Invalid worker count', 'Please enter a valid number of workers.');
        return;
      }
      if (workerIdFiles.length < workers) {
        setSubmitError(`Upload ${workers} worker ID image(s) before submitting.`);
        toast.error('Missing worker IDs', `You selected ${workers} workers. Upload ${workers} worker ID image(s).`);
        return;
      }
      setShowRegulationsModal(true);
      return;
    }
    void submitQr();
  }, [submitQr, toast, type, workerIdFiles.length, workersCount]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: 0, paddingBottom: Math.max(32, contentInsetBottom) },
        ]}
      >
      <BrandedPageHero
        title="QR Codes"
        subtitle="Generate and manage access permits"
      />

      <ScreenCard title="Selected Unit">
        {units.length > 1 ? (
          <View style={styles.unitRow}>
            <Text style={styles.unitRowText}>
              {selectedUnit?.unitNumber ?? selectedUnit?.id ?? 'Select unit'}
            </Text>
            <Pressable style={styles.unitRowChangeBtn} onPress={onOpenUnitPicker}>
              <Text style={styles.unitRowChangeText}>Change</Text>
            </Pressable>
          </View>
        ) : null}
        <InlineError message={unitsErrorMessage} />
        {unitsLoading || unitsRefreshing ? <ActivityIndicator color={palette.primary} /> : null}
      </ScreenCard>

      <View style={styles.tabsCard}>
        <View style={styles.tabsGrid}>
          {PRIMARY_TABS.map((value) => {
            const meta = typeMeta(value, palette);
            const active = type === value;
            return (
              <Pressable
                key={value}
                onPress={() => setType(value)}
                style={[
                  styles.tabButton,
                  active && styles.tabButtonActive,
                  active && { backgroundColor: palette.primary, borderColor: palette.primary },
                ]}
              >
                <Ionicons name={meta.icon} size={16} color={active ? akColors.white : akColors.textMuted} />
                <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{meta.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScreenCard title="Generate Access Permit" actionLabel={isRefreshing ? 'Refreshing...' : 'Refresh'} onActionPress={() => void loadData('refresh')}>
        <InlineError message={loadError} />
        {/* submit/revoke errors are shown as toasts to reduce visual clutter */}

        <View style={styles.typeBanner}>
          <View style={[styles.typeBannerIcon, { backgroundColor: selectedTypeMeta.tintBg }]}>
            <Ionicons name={selectedTypeMeta.icon} size={18} color={selectedTypeMeta.tint} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.typeBannerTitle}>{selectedTypeMeta.label} Permit</Text>
          </View>
        </View>

        {type === 'VISITOR' ? (
          <>
            <Text style={styles.label}>Visitor Name</Text>
            <View style={styles.inputShell}>
              <Ionicons name="person-outline" size={18} color={akColors.textMuted} />
              <TextInput
                value={visitorName}
                onChangeText={setVisitorName}
                style={styles.input}
                placeholder="Mohamed Ibrahim"
                placeholderTextColor={akColors.textSoft}
              />
            </View>

            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.inputShell}>
              <Ionicons name="call-outline" size={18} color={akColors.textMuted} />
              <TextInput
                value={visitorPhone}
                onChangeText={setVisitorPhone}
                style={styles.input}
                keyboardType="phone-pad"
                placeholder="+20 111 222 3333"
                placeholderTextColor={akColors.textSoft}
              />
            </View>

            <Text style={styles.label}>Purpose of Visit</Text>
            <View style={[styles.inputShell, styles.multilineShell]}>
              <Ionicons name="document-text-outline" size={18} color={akColors.textMuted} style={styles.multilineIcon} />
              <TextInput
                value={visitorPurpose}
                onChangeText={setVisitorPurpose}
                style={[styles.input, styles.multilineInput]}
                multiline
                numberOfLines={2}
                placeholder="Family visit, business, etc."
                placeholderTextColor={akColors.textSoft}
              />
            </View>

            <Text style={styles.label}>Usage Mode</Text>
            <View style={styles.selectInlineRow}>
              {[
                { key: 'SINGLE_USE' as const, label: 'Single use' },
                { key: 'MULTI_USE' as const, label: 'Multi-time (until expiry)' },
              ].map((mode) => {
                const active = visitorUsageMode === mode.key;
                return (
                  <Pressable
                    key={mode.key}
                    onPress={() => setVisitorUsageMode(mode.key)}
                    style={[
                      styles.selectChip,
                      active && styles.selectChipActive,
                      active && { borderColor: palette.primary, backgroundColor: palette.primarySoft10 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.selectChipText,
                        active && styles.selectChipTextActive,
                        active && { color: palette.primary },
                      ]}
                    >
                      {mode.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {type === 'DELIVERY' ? (
          <>
            <Text style={styles.label}>Delivery Company</Text>
            <View style={styles.selectInlineRow}>
              {DELIVERY_COMPANIES.map((company) => {
                const active = company === deliveryCompany;
                return (
                  <Pressable
                    key={company}
                    onPress={() => setDeliveryCompany(company)}
                    style={[
                      styles.selectChip,
                      active && styles.selectChipActive,
                      active && { borderColor: palette.primary, backgroundColor: palette.primarySoft10 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.selectChipText,
                        active && styles.selectChipTextActive,
                        active && { color: palette.primary },
                      ]}
                    >
                      {company}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {deliveryCompany === 'Other' ? (
              <>
                <Text style={styles.label}>Company Name</Text>
                <View style={styles.inputShell}>
                  <Ionicons name="business-outline" size={18} color={akColors.textMuted} />
                  <TextInput
                    value={deliveryOtherCompany}
                    onChangeText={setDeliveryOtherCompany}
                    style={styles.input}
                    placeholder="Enter delivery company"
                    placeholderTextColor={akColors.textSoft}
                  />
                </View>
              </>
            ) : null}
          </>
        ) : null}

        {type === 'RIDESHARE' ? (
          <>
            <Text style={styles.label}>Ride Hailing Company</Text>
            <View style={styles.selectInlineRow}>
              {RIDE_COMPANIES.map((company) => {
                const active = company === rideCompany;
                return (
                  <Pressable
                    key={company}
                    onPress={() => setRideCompany(company)}
                    style={[
                      styles.selectChip,
                      active && styles.selectChipActive,
                      active && { borderColor: palette.primary, backgroundColor: palette.primarySoft10 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.selectChipText,
                        active && styles.selectChipTextActive,
                        active && { color: palette.primary },
                      ]}
                    >
                      {company}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {rideCompany === 'Other' ? (
              <>
                <Text style={styles.label}>Ride Company Name</Text>
                <View style={styles.inputShell}>
                  <Ionicons name="business-outline" size={18} color={akColors.textMuted} />
                  <TextInput
                    value={rideOtherCompany}
                    onChangeText={setRideOtherCompany}
                    style={styles.input}
                    placeholder="Enter company name"
                    placeholderTextColor={akColors.textSoft}
                  />
                </View>
              </>
            ) : null}

            <Text style={styles.label}>Driver Name (Optional)</Text>
            <View style={styles.inputShell}>
              <Ionicons name="person-outline" size={18} color={akColors.textMuted} />
              <TextInput
                value={driverName}
                onChangeText={setDriverName}
                style={styles.input}
                placeholder="Driver Name"
                placeholderTextColor={akColors.textSoft}
              />
            </View>

            <Text style={styles.label}>Car Number (Optional)</Text>
            <View style={styles.inputShell}>
              <Ionicons name="car-outline" size={18} color={akColors.textMuted} />
              <TextInput
                value={carNumber}
                onChangeText={setCarNumber}
                style={styles.input}
                placeholder="ABC-1234"
                placeholderTextColor={akColors.textSoft}
                autoCapitalize="characters"
              />
            </View>
          </>
        ) : null}

        {type === 'WORKER' ? (
          <>
            <Text style={styles.label}>Number of Workers</Text>
            <View style={styles.inputShell}>
              <Ionicons name="people-outline" size={18} color={akColors.textMuted} />
              <TextInput
                value={workersCount}
                onChangeText={setWorkersCount}
                style={styles.input}
                keyboardType="number-pad"
                placeholder="1"
                placeholderTextColor={akColors.textSoft}
              />
            </View>

            <Text style={styles.label}>Type of Work</Text>
            <View style={styles.selectInlineRow}>
              {WORK_TYPES.map((option) => {
                const active = option === workType;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setWorkType(option)}
                    style={[
                      styles.selectChip,
                      active && styles.selectChipActive,
                      active && { borderColor: palette.primary, backgroundColor: palette.primarySoft10 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.selectChipText,
                        active && styles.selectChipTextActive,
                        active && { color: palette.primary },
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Expected Duration</Text>
            <View style={styles.selectInlineRow}>
              {WORK_DURATIONS.map((option) => {
                const active = option.value === workDuration;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setWorkDuration(option.value)}
                    style={[
                      styles.selectChip,
                      active && styles.selectChipActive,
                      active && { borderColor: palette.primary, backgroundColor: palette.primarySoft10 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.selectChipText,
                        active && styles.selectChipTextActive,
                        active && { color: palette.primary },
                      ]}
                    >
                      {option.value}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Worker ID Images</Text>
            <Pressable
              onPress={() => void handleUploadWorkerId()}
              disabled={isUploadingWorkerId}
              style={[styles.uploadDocButton, isUploadingWorkerId && styles.buttonDisabled]}
            >
              {isUploadingWorkerId ? (
                <ActivityIndicator size="small" color={palette.primary} />
              ) : (
                <Ionicons name="cloud-upload-outline" size={16} color={palette.primary} />
              )}
              <Text style={styles.uploadDocButtonText}>
                {workerIdFiles.length
                  ? `Uploaded ${workerIdFiles.length} ID image(s)`
                  : 'Upload Worker ID Image'}
              </Text>
            </Pressable>
            <Text style={styles.helperText}>
              Required: {Math.max(Number(workersCount) || 1, 1)} image(s), one ID image per worker.
            </Text>
            {workerIdFiles.length ? (
              <View style={styles.workerFilesWrap}>
                {workerIdFiles.map((file, index) => (
                  <View key={file.id} style={styles.workerFileChip}>
                    <Text style={styles.workerFileChipText} numberOfLines={1}>
                      #{index + 1} {file.name}
                    </Text>
                    <Pressable onPress={() => removeWorkerIdFile(file.id)} style={styles.workerFileRemoveBtn}>
                      <Ionicons name="close" size={13} color={akColors.textMuted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        {type === 'VISITOR' || type === 'WORKER' ? (
          <>
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
            <View style={styles.datePreviewField}>
              <Ionicons name="time-outline" size={14} color={akColors.textMuted} />
              <Text style={styles.datePreviewText}>{formatDateTime(validFrom)}</Text>
            </View>

            {type !== 'WORKER' ? (
              <>
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
                <View style={styles.datePreviewField}>
                  <Ionicons name="time-outline" size={14} color={akColors.textMuted} />
                  <Text style={styles.datePreviewText}>{formatDateTime(validTo)}</Text>
                </View>
              </>
            ) : null}

            <View style={styles.previewRow}>
              <Ionicons name="time-outline" size={14} color={palette.primary} />
              <Text style={styles.previewText}>{formatDateTime(validFrom)} → {formatDateTime(previewValidTo)}</Text>
            </View>
          </>
        ) : null}

        <Pressable onPress={handlePrimarySubmit} disabled={isSubmitting} style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}>
          <LinearGradient colors={[palette.primary, palette.primaryDark]} style={styles.submitButtonGradient}>
            {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : null}
            <Text style={styles.submitButtonText}>
              {isSubmitting
                ? 'Generating...'
                : type === 'VISITOR'
                  ? 'Generate QR Code'
                  : type === 'WORKER'
                    ? 'Review Work Regulations & Submit'
                    : 'Send Access Permit to Security'}
            </Text>
          </LinearGradient>
        </Pressable>
      </ScreenCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Access Permits</Text>
        <Text style={[styles.sectionLink, { color: palette.primary }]}>Active permits: {activeRows.length}</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingCard}><ActivityIndicator color={palette.primary} /></View>
      ) : null}

      {!isLoading && recentRows.length === 0 ? (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons name="qrcode-scan" size={28} color={akColors.textSoft} />
          <Text style={styles.emptyTitle}>No permits yet</Text>
        </View>
      ) : null}

      {recentRows.map((row) => {
        const isActive = String(row.status).toUpperCase() === 'ACTIVE';
        const badge = statusBadgeColors(row.status, palette);
        const meta = typeMeta(row.type ?? 'QR', palette);
        return (
          <View key={row.id} style={styles.historyCard}>
            <Pressable style={styles.historyBodyPress} onPress={() => setSelectedQr(row)}>
              <View style={styles.historyTopRow}>
                <View style={[styles.historyIconWrap, { backgroundColor: meta.tintBg }]}>
                  <Ionicons name={meta.icon} size={18} color={meta.tint} />
                </View>
                <View style={styles.flex}>
                  <View style={styles.historyTitleRow}>
                    <Text style={[styles.historyId, { color: palette.primary }]}>{row.qrId ?? row.id}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                      <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                        {formatStatusLabel(row.status)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.historySub}>{formatTypeLabel(row.type)}{row.visitorName ? ` • ${row.visitorName}` : ''}</Text>
                  <Text style={styles.historyTime}>{formatDateTime(row.validFrom)} → {formatDateTime(row.validTo)}</Text>
                </View>
              </View>
              {row.notes ? <Text style={styles.historyNote}>{row.notes}</Text> : null}
            </Pressable>
            <View style={styles.historyFooter}>
              <Text style={styles.historyCreated}>Created on {formatDateTime(row.createdAt)}</Text>
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
      <Modal
        visible={showRegulationsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRegulationsModal(false)}
      >
        <View style={styles.detailRoot}>
          <Pressable style={styles.detailBackdrop} onPress={() => setShowRegulationsModal(false)} />
          <View style={styles.regulationsSheet}>
            <View style={styles.detailHandle} />
            <Text style={styles.regulationsTitle}>Work Regulations</Text>
            <ScrollView style={styles.regulationsBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.regulationsText}>{WORK_REGULATIONS_TEXT}</Text>
            </ScrollView>
            <Pressable onPress={() => setAcceptedRegulations((prev) => !prev)} style={styles.regulationsCheckRow}>
              <View
                style={[
                  styles.regulationsCheckbox,
                  acceptedRegulations && styles.regulationsCheckboxChecked,
                  acceptedRegulations && { backgroundColor: palette.primary, borderColor: palette.primary },
                ]}
              >
                {acceptedRegulations ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
              </View>
              <Text style={styles.regulationsCheckText}>I have read and accepted all regulations.</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (!acceptedRegulations) {
                  toast.error('Confirmation required', 'Please accept the regulations before submitting.');
                  return;
                }
                setShowRegulationsModal(false);
                void submitQr();
              }}
              style={[styles.regulationsSubmit, { backgroundColor: palette.primary }]}
            >
              <Text style={styles.regulationsSubmitText}>Submit Worker Permit</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
      <Modal
        visible={Boolean(selectedQr)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedQr(null)}
      >
        <View style={styles.detailRoot}>
          <Pressable style={styles.detailBackdrop} onPress={() => setSelectedQr(null)} />
          <View style={styles.detailSheet}>
            <View style={styles.detailHandle} />
            <View style={styles.detailHeaderRow}>
              <View style={styles.flex}>
                <Text style={styles.detailTitle}>QR Access Permit</Text>
                <Text style={styles.detailSubtitle}>
                  {selectedQr?.qrId ?? selectedQr?.id ?? '—'}
                </Text>
              </View>
              <Pressable style={styles.detailCloseBtn} onPress={() => setSelectedQr(null)}>
                <Ionicons name="close" size={18} color={akColors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.detailBody}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Type</Text>
                <Text style={styles.detailValue}>{formatTypeLabel(selectedQr?.type)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Usage</Text>
                <Text style={styles.detailValue}>
                  {String(selectedQr?.usageMode ?? 'SINGLE_USE') === 'MULTI_USE'
                    ? 'Multi-time'
                    : 'Single use'}
                  {typeof selectedQr?.scans === 'number' ? ` • Scans ${selectedQr.scans}` : ''}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status</Text>
                <Text style={styles.detailValue}>{formatStatusLabel(selectedQr?.status)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Visitor</Text>
                <Text style={styles.detailValue}>{selectedQr?.visitorName?.trim() || 'Not provided'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Validity</Text>
                <Text style={styles.detailValue}>
                  {formatDateTime(selectedQr?.validFrom)} {'\n'}→ {formatDateTime(selectedQr?.validTo)}
                </Text>
              </View>
              {selectedQr?.notes ? (
                <View style={[styles.detailNotesBox, { backgroundColor: palette.accentSoft12 }]}>
                  <Text style={[styles.detailNotesLabel, { color: palette.primary }]}>Notes</Text>
                  <Text style={styles.detailNotesText}>{selectedQr.notes}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.detailActions}>
              <Pressable style={styles.detailGhostBtn} onPress={() => setSelectedQr(null)}>
                <Text style={styles.detailGhostBtnText}>Close</Text>
              </Pressable>
              {String(selectedQr?.status).toUpperCase() === 'ACTIVE' && selectedQr?.id ? (
                <Pressable
                  onPress={async () => {
                    const id = selectedQr.id;
                    setSelectedQr(null);
                    await handleRevoke(id);
                  }}
                  style={[styles.detailDangerBtn, revokingId === selectedQr?.id && styles.buttonDisabled]}
                  disabled={revokingId === selectedQr?.id}
                >
                  <Text style={styles.detailDangerBtnText}>
                    {revokingId === selectedQr?.id ? 'Revoking...' : 'Revoke'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
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
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  unitRowText: {
    color: akColors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  unitRowChangeBtn: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 999,
    backgroundColor: akColors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  unitRowChangeText: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '700',
  },
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
  tabsGrid: { flexDirection: 'row', gap: 8 },
  tabButton: {
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
  selectInlineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  selectChipActive: {
    borderColor: akColors.primary,
    backgroundColor: 'rgba(42,62,53,0.10)',
  },
  selectChipText: { color: akColors.textMuted, fontSize: 11, fontWeight: '700' },
  selectChipTextActive: { color: akColors.primary },
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
  datePreviewField: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 12,
    backgroundColor: akColors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  datePreviewText: {
    flex: 1,
    color: akColors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  helperInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
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
  uploadDocButton: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadDocButtonText: { color: akColors.text, fontSize: 12, fontWeight: '700' },
  workerFilesWrap: { gap: 8, marginTop: 6 },
  workerFileChip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workerFileChipText: { flex: 1, color: akColors.textMuted, fontSize: 11, fontWeight: '600' },
  workerFileRemoveBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: akColors.surfaceMuted,
  },
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
  historyBodyPress: {
    gap: 10,
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
  detailRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15,23,42,0.18)',
  },
  detailBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.22)',
  },
  detailSheet: {
    backgroundColor: akColors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: akColors.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
    gap: 12,
    ...akShadow.soft,
  },
  detailHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: akColors.border,
    opacity: 0.85,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailTitle: {
    color: akColors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  detailSubtitle: {
    marginTop: 2,
    color: akColors.textMuted,
    fontSize: 12,
  },
  detailCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surfaceMuted,
  },
  detailBody: {
    gap: 10,
  },
  detailRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  detailLabel: {
    color: akColors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  detailValue: {
    color: akColors.text,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  detailNotesBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: 'rgba(201,169,97,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  detailNotesLabel: {
    color: akColors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  detailNotesText: {
    color: akColors.text,
    fontSize: 12,
    lineHeight: 18,
  },
  detailActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  detailGhostBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  detailGhostBtnText: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  detailDangerBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.18)',
    backgroundColor: 'rgba(220,38,38,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  detailDangerBtnText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '700',
  },
  regulationsSheet: {
    backgroundColor: akColors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: akColors.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
    gap: 12,
    ...akShadow.soft,
  },
  regulationsTitle: {
    color: akColors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  regulationsBody: {
    maxHeight: 320,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surfaceMuted,
    padding: 10,
  },
  regulationsText: {
    color: akColors.text,
    fontSize: 12,
    lineHeight: 19,
  },
  regulationsCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  regulationsCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regulationsCheckboxChecked: {
    backgroundColor: akColors.primary,
    borderColor: akColors.primary,
  },
  regulationsCheckText: {
    flex: 1,
    color: akColors.text,
    fontSize: 12,
    lineHeight: 17,
  },
  regulationsSubmit: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: akColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regulationsSubmitText: {
    color: akColors.white,
    fontSize: 13,
    fontWeight: '700',
  },
});

