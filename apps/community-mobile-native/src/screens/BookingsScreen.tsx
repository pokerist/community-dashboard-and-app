import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
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
import { InlineError, ScreenCard } from '../components/mobile/Primitives';
import { useBranding } from '../features/branding/provider';
import { getBrandPalette } from '../features/branding/palette';
import { useBottomNavMetrics } from '../features/layout/BottomNavMetricsContext';
import type { AuthSession } from '../features/auth/types';
import {
  cancelBooking,
  createBooking,
  listFacilities,
  listMyBookings,
} from '../features/community/service';
import type { Booking, Facility, ResidentUnit } from '../features/community/types';
import { extractApiErrorMessage } from '../lib/http';
import { bookingStatusDisplayLabel } from '../features/presentation/status';
import { akColors, akShadow } from '../theme/alkarma';
import { formatDateOnly, formatDateTime, todayIsoDate } from '../utils/format';

type BookingsScreenProps = {
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
  onOpenFinance?: () => void;
  deepLinkBookingId?: string | null;
  onConsumeDeepLinkBookingId?: (bookingId: string) => void;
};

type SlotOption = {
  startTime: string;
  endTime: string;
  label: string;
};

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime());
}

function parseDateOnlyValue(value: string): Date {
  if (isValidIsoDate(value)) {
    const parsed = new Date(`${value}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function buildDateTimeFromParts(dateValue: string, clockValue: string, fallbackHour = 10): Date {
  const dateObj = parseDateOnlyValue(dateValue);
  const mins = clockToMinutes(clockValue);
  if (mins === null) {
    dateObj.setHours(fallbackHour, 0, 0, 0);
    return dateObj;
  }
  dateObj.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return dateObj;
}

function toIsoDate(dateObj: Date): string {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeClock(value?: string | null): string | null {
  if (!value) return null;
  const parts = String(value).split(':');
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function clockToMinutes(clock?: string | null): number | null {
  const normalized = normalizeClock(clock);
  if (!normalized) return null;
  const [h, m] = normalized.split(':').map((v) => Number(v));
  return h * 60 + m;
}

function minutesToClock(totalMinutes: number): string {
  const safe = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function buildSlotOptions(facility: Facility | null, date: string): SlotOption[] {
  if (!facility?.slotConfig?.length) return [];
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return [];
  const dayIndex = parsed.getDay();
  const configs = facility.slotConfig
    .filter((s) => s.dayOfWeek === dayIndex)
    .sort((a, b) => {
      const aMin = clockToMinutes(a.startTime) ?? 0;
      const bMin = clockToMinutes(b.startTime) ?? 0;
      return aMin - bMin;
    });

  const options: SlotOption[] = [];
  for (const cfg of configs) {
    const startMin = clockToMinutes(cfg.startTime);
    const endMin = clockToMinutes(cfg.endTime);
    if (startMin === null || endMin === null || endMin <= startMin) continue;

    const duration =
      cfg.slotDurationMinutes && cfg.slotDurationMinutes > 0
        ? cfg.slotDurationMinutes
        : endMin - startMin;
    if (!Number.isFinite(duration) || duration <= 0) continue;

    for (let cursor = startMin; cursor + duration <= endMin; cursor += duration) {
      const slotStart = minutesToClock(cursor);
      const slotEnd = minutesToClock(cursor + duration);
      options.push({
        startTime: slotStart,
        endTime: slotEnd,
        label: `${slotStart} - ${slotEnd}`,
      });
      // If config does not define a duration, treat the whole range as one slot.
      if (!cfg.slotDurationMinutes || cfg.slotDurationMinutes <= 0) break;
    }
  }

  return options;
}

function suggestTimes(facility: Facility, date: string): { startTime: string; endTime: string } | null {
  if (!facility.slotConfig?.length) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  const dayIndex = parsed.getDay();
  const slot = facility.slotConfig.find((s) => s.dayOfWeek === dayIndex) ?? facility.slotConfig[0];
  if (!slot?.startTime || !slot?.endTime) return null;
  if (slot.slotDurationMinutes && slot.slotDurationMinutes > 0) {
    const [h, m] = slot.startTime.split(':').map((v) => Number(v));
    const mins = h * 60 + m + slot.slotDurationMinutes;
    const endH = String(Math.floor(mins / 60)).padStart(2, '0');
    const endM = String(mins % 60).padStart(2, '0');
    return { startTime: slot.startTime, endTime: `${endH}:${endM}` };
  }
  return { startTime: slot.startTime, endTime: slot.endTime };
}

export function BookingsScreen({
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
  onOpenFinance,
  deepLinkBookingId = null,
  onConsumeDeepLinkBookingId,
}: BookingsScreenProps) {
  const { brand } = useBranding();
  const palette = getBrandPalette(brand);
  const insets = useSafeAreaInsets();
  const { contentInsetBottom } = useBottomNavMetrics();
  const toast = useAppToast();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [date, setDate] = useState(todayIsoDate());
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [bookingFormOpen, setBookingFormOpen] = useState(false);

  const loadData = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setIsLoading(true);
      else setIsRefreshing(true);
      setLoadError(null);
      try {
        const [facilitiesResult, bookingsResult] = await Promise.all([
          listFacilities(session.accessToken),
          listMyBookings(session.accessToken),
        ]);
        setFacilities(facilitiesResult);
        setBookings(bookingsResult);
        setSelectedFacilityId((prev) => {
          if (prev && facilitiesResult.some((f) => f.id === prev)) return prev;
          return facilitiesResult[0]?.id ?? null;
        });
      } catch (error) {
        setLoadError(extractApiErrorMessage(error));
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

  const selectedFacility = useMemo(
    () => facilities.find((f) => f.id === selectedFacilityId) ?? null,
    [facilities, selectedFacilityId],
  );

  const slotOptions = useMemo(
    () => buildSlotOptions(selectedFacility, date),
    [selectedFacility, date],
  );

  useEffect(() => {
    if (!selectedFacility) return;
    const suggestion = suggestTimes(selectedFacility, date);
    if (!suggestion) return;
    setStartTime((prev) => (prev === '10:00' ? suggestion.startTime : prev));
    setEndTime((prev) => (prev === '11:00' ? suggestion.endTime : prev));
  }, [selectedFacility, date]);

  const filteredBookings = useMemo(
    () =>
      selectedUnitId
        ? bookings.filter((b) => b.unitId === selectedUnitId)
        : bookings,
    [bookings, selectedUnitId],
  );

  useEffect(() => {
    if (!deepLinkBookingId) return;
    const booking = bookings.find((row) => row.id === deepLinkBookingId) ?? null;
    if (booking) {
      setSelectedBooking(booking);
      onConsumeDeepLinkBookingId?.(deepLinkBookingId);
    }
  }, [bookings, deepLinkBookingId, onConsumeDeepLinkBookingId]);

  const submitBooking = useCallback(async () => {
    if (!selectedUnitId) {
      setSubmitError('Select a unit first.');
      toast.error('Missing unit', 'Select a unit before creating a booking.');
      return;
    }
    if (!selectedFacilityId) {
      setSubmitError('Select a facility first.');
      toast.error('Missing facility', 'Choose a facility before submitting the booking.');
      return;
    }
    if (!isValidIsoDate(date.trim())) {
      setSubmitError('Date must be in YYYY-MM-DD format.');
      toast.error('Invalid date', 'Date must be in YYYY-MM-DD format.');
      return;
    }
    const startMins = clockToMinutes(startTime);
    const endMins = clockToMinutes(endTime);
    if (startMins === null || endMins === null) {
      setSubmitError('Start/End time must be in HH:MM format.');
      toast.error('Invalid time', 'Start and end times must be in HH:MM format.');
      return;
    }
    if (endMins <= startMins) {
      setSubmitError('End time must be later than start time.');
      toast.error('Invalid range', 'End time must be later than start time.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);
    try {
      await createBooking(session.accessToken, {
        facilityId: selectedFacilityId,
        unitId: selectedUnitId,
        date,
        startTime,
        endTime,
      });
      setSuccessMessage('Booking request submitted.');
      setBookingFormOpen(false);
      toast.success('Booking submitted', 'Your booking request was submitted successfully.');
      await loadData('refresh');
    } catch (error) {
      const msg = extractApiErrorMessage(error);
      setSubmitError(msg);
      toast.error('Booking failed', msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [date, endTime, loadData, selectedFacilityId, selectedUnitId, session.accessToken, startTime, toast]);

  const handleCancel = useCallback(
    async (bookingId: string) => {
      setCancellingId(bookingId);
      setSubmitError(null);
      try {
        await cancelBooking(session.accessToken, bookingId);
        toast.success('Booking cancelled', 'The booking was cancelled successfully.');
        await loadData('refresh');
      } catch (error) {
        const msg = extractApiErrorMessage(error);
        setSubmitError(msg);
        toast.error('Cancel failed', msg);
      } finally {
        setCancellingId(null);
      }
    },
    [loadData, session.accessToken, toast],
  );

  const onDatePicked = useCallback((event: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS !== 'ios') setShowDatePicker(false);
    if (event.type === 'dismissed' || !picked) return;
    setDate(toIsoDate(picked));
    setSubmitError(null);
  }, []);

  const onStartTimePicked = useCallback((event: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS !== 'ios') setShowStartTimePicker(false);
    if (event.type === 'dismissed' || !picked) return;
    setStartTime(`${String(picked.getHours()).padStart(2, '0')}:${String(picked.getMinutes()).padStart(2, '0')}`);
    setSubmitError(null);
  }, []);

  const onEndTimePicked = useCallback((event: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS !== 'ios') setShowEndTimePicker(false);
    if (event.type === 'dismissed' || !picked) return;
    setEndTime(`${String(picked.getHours()).padStart(2, '0')}:${String(picked.getMinutes()).padStart(2, '0')}`);
    setSubmitError(null);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: 0, paddingBottom: Math.max(110, contentInsetBottom) },
        ]}
      >
      <BrandedPageHero
        title="Bookings"
        subtitle="Facilities and reservation management"
      />

      <LinearGradient
        colors={[palette.primary, palette.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTopRow}>
          <View style={styles.heroPill}>
            <Ionicons name="calendar-outline" size={13} color={akColors.white} />
            <Text style={styles.heroPillText}>Amenities Booking</Text>
          </View>
          <View style={styles.heroPillMuted}>
            <Text style={styles.heroPillMutedText}>My bookings: {filteredBookings.length}</Text>
          </View>
        </View>
        <Text style={styles.heroTitle}>Reserve community facilities</Text>
        <Text style={styles.heroSubtitle}>
          Select a facility, choose a slot, and manage upcoming reservations from one place.
        </Text>
      </LinearGradient>

      <ScreenCard title="Unit Context">
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

      <ScreenCard title="Create Booking" actionLabel={isRefreshing ? 'Refreshing...' : 'Reload'} onActionPress={() => void loadData('refresh')}>
        <InlineError message={loadError} />
        {/* submit/cancel feedback is shown as toasts */}
        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

        {isLoading ? (
          <ActivityIndicator color={palette.primary} />
        ) : (
          <>
            <Text style={styles.label}>Step 1: Choose Facility</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {facilities.map((facility) => {
                const active = facility.id === selectedFacilityId;
                return (
                  <Pressable
                    key={facility.id}
                    onPress={() => {
                      setSelectedFacilityId(facility.id);
                      setSubmitError(null);
                      setBookingFormOpen(true);
                    }}
                    style={[styles.choiceChip, active && styles.choiceChipActive]}
                  >
                    <Text style={[styles.choiceChipTitle, active && styles.choiceChipTitleActive]}>
                      {facility.name}
                    </Text>
                    <Text style={[styles.choiceChipMeta, active && styles.choiceChipMetaActive]}>
                      {(facility.type ?? 'CUSTOM').replaceAll('_', ' ')}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {selectedFacility ? (
              <View style={styles.facilityInfoBox}>
                <Text style={styles.facilityInfoText}>
                  {selectedFacility.description || 'No description'}
                </Text>
                <Text style={styles.facilityInfoMeta}>
                  Capacity: {selectedFacility.capacity ?? '—'} • Max/day:{' '}
                  {selectedFacility.maxReservationsPerDay ?? '—'}
                </Text>
                <Pressable
                  style={[styles.secondaryButton, { alignSelf: 'flex-start' }]}
                  onPress={() => setBookingFormOpen(true)}
                >
                  <Text style={[styles.secondaryButtonText, { color: palette.primary }]}>Step 2: Pick Date & Slot</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.slotHintText}>Choose a facility to continue.</Text>
            )}
          </>
        )}
      </ScreenCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>My Bookings</Text>
        <Text style={[styles.sectionCount, { color: palette.primary }]}>{filteredBookings.length}</Text>
      </View>
      <ScreenCard>
        {filteredBookings.length === 0 ? (
          <Text style={styles.emptyText}>No bookings found for the selected unit.</Text>
        ) : (
          filteredBookings.map((booking) => {
            const isPendingPayment =
              String(booking.status ?? '').toUpperCase() === 'PENDING_PAYMENT';
            const cancellable =
              booking.status === 'PENDING' || booking.status === 'APPROVED';
            return (
              <Pressable
                key={booking.id}
                style={styles.itemCard}
                onPress={() => setSelectedBooking(booking)}
              >
                <View style={styles.itemHeader}>
                  <View style={styles.flex}>
                    <Text style={styles.itemTitle}>{booking.facility?.name ?? 'Facility Booking'}</Text>
                    <Text style={styles.itemSub}>
                      {formatDateOnly(booking.date)} • {booking.startTime} - {booking.endTime}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, statusBadgeStyle(booking.status)]}>
                    <Text style={[styles.statusBadgeText, statusBadgeTextStyle(booking.status)]}>
                      {booking.status ?? '—'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.itemSub}>
                  Unit: {booking.unit?.unitNumber ?? '—'} • Updated {formatDateTime(booking.cancelledAt || booking.createdAt)}
                </Text>
                {isPendingPayment ? (
                  <Pressable
                    onPress={() => onOpenFinance?.()}
                    style={styles.secondaryButton}
                  >
                    <Text style={[styles.secondaryButtonText, { color: palette.primary }]}>
                      Pay Booking Fee
                    </Text>
                  </Pressable>
                ) : null}
                {cancellable ? (
                  <Pressable
                    onPress={() => void handleCancel(booking.id)}
                    style={[styles.secondaryButton, cancellingId === booking.id && styles.buttonDisabled]}
                    disabled={cancellingId === booking.id}
                  >
                    <Text style={[styles.secondaryButtonText, { color: palette.primary }]}>
                      {cancellingId === booking.id ? 'Cancelling...' : 'Cancel Booking'}
                    </Text>
                  </Pressable>
                ) : null}
              </Pressable>
            );
          })
        )}
      </ScreenCard>
      </ScrollView>
      <Modal
        visible={bookingFormOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setBookingFormOpen(false)}
      >
        <View style={styles.detailModalRoot}>
          <Pressable style={styles.detailModalBackdrop} onPress={() => setBookingFormOpen(false)} />
          <View style={[styles.detailModalSheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <View style={styles.detailHandle} />
            <View style={styles.detailHeader}>
              <View style={styles.flex}>
                <Text style={styles.detailTitle}>Step 2: Pick Date & Slot</Text>
                <Text style={styles.detailSubtitle}>{selectedFacility?.name ?? 'Facility'}</Text>
              </View>
              <Pressable style={styles.detailCloseButton} onPress={() => setBookingFormOpen(false)}>
                <Ionicons name="close" size={18} color={akColors.textMuted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.detailContent}>
              <InlineError message={submitError} />

              <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
              <View style={styles.inlinePickersRow}>
                <Pressable onPress={() => setShowDatePicker((v) => !v)} style={styles.inlineGhostButton}>
                  <Text style={styles.inlineGhostButtonText}>
                    {showDatePicker ? 'Hide Date Picker' : 'Pick Date'}
                  </Text>
                </Pressable>
              </View>
              {showDatePicker && Platform.OS !== 'web' ? (
                <DateTimePicker
                  mode="date"
                  value={parseDateOnlyValue(date)}
                  onChange={onDatePicked}
                />
              ) : null}
              <TextInput value={date} onChangeText={setDate} style={styles.input} />

              {slotOptions.length > 0 ? (
                <View style={styles.slotSuggestionsBlock}>
                  <Text style={styles.slotSuggestionsLabel}>Available Slots</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.slotSuggestionsRow}
                  >
                    {slotOptions.map((slot) => {
                      const active = slot.startTime === startTime && slot.endTime === endTime;
                      return (
                        <Pressable
                          key={`${slot.startTime}-${slot.endTime}`}
                          onPress={() => {
                            setStartTime(slot.startTime);
                            setEndTime(slot.endTime);
                          }}
                          style={[styles.slotChip, active && styles.slotChipActive]}
                        >
                          <Text style={[styles.slotChipText, active && styles.slotChipTextActive]}>
                            {slot.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : (
                <Text style={styles.slotHintText}>
                  No configured slots for this day. Enter time manually.
                </Text>
              )}

              <View style={styles.row}>
                <View style={styles.flex}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Start (HH:MM)</Text>
                    <Pressable onPress={() => setShowStartTimePicker((v) => !v)} style={styles.inlineMiniButton}>
                      <Text style={styles.inlineMiniButtonText}>{showStartTimePicker ? 'Hide' : 'Pick'}</Text>
                    </Pressable>
                  </View>
                  {showStartTimePicker && Platform.OS !== 'web' ? (
                    <DateTimePicker
                      mode="time"
                      value={buildDateTimeFromParts(date, startTime, 10)}
                      onChange={onStartTimePicked}
                    />
                  ) : null}
                  <TextInput value={startTime} onChangeText={setStartTime} style={styles.input} />
                </View>
                <View style={styles.flex}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>End (HH:MM)</Text>
                    <Pressable onPress={() => setShowEndTimePicker((v) => !v)} style={styles.inlineMiniButton}>
                      <Text style={styles.inlineMiniButtonText}>{showEndTimePicker ? 'Hide' : 'Pick'}</Text>
                    </Pressable>
                  </View>
                  {showEndTimePicker && Platform.OS !== 'web' ? (
                    <DateTimePicker
                      mode="time"
                      value={buildDateTimeFromParts(date, endTime, 11)}
                      onChange={onEndTimePicked}
                    />
                  ) : null}
                  <TextInput value={endTime} onChangeText={setEndTime} style={styles.input} />
                </View>
              </View>

              <Pressable
                style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
                onPress={() => void submitBooking()}
                disabled={isSubmitting}
              >
                <LinearGradient colors={[palette.primary, palette.primaryDark]} style={styles.primaryButtonInner}>
                  {isSubmitting ? <ActivityIndicator size="small" color={akColors.white} /> : null}
                  <Text style={styles.primaryButtonText}>
                    {isSubmitting ? 'Submitting...' : 'Confirm Booking'}
                  </Text>
                </LinearGradient>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        visible={Boolean(selectedBooking)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedBooking(null)}
      >
        <View style={styles.detailModalRoot}>
          <Pressable style={styles.detailModalBackdrop} onPress={() => setSelectedBooking(null)} />
          <View style={[styles.detailModalSheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <View style={styles.detailHandle} />
            <View style={styles.detailHeader}>
              <View style={styles.flex}>
                <Text style={styles.detailTitle}>Booking Details</Text>
                <Text style={styles.detailSubtitle}>
                  Review booking status, unit, and timing details.
                </Text>
              </View>
              <Pressable style={styles.detailCloseButton} onPress={() => setSelectedBooking(null)}>
                <Ionicons name="close" size={18} color={akColors.textMuted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.detailContent}>
              {selectedBooking ? (
                <View style={styles.detailCard}>
                  <View style={styles.detailSummaryCard}>
                    <View style={styles.detailSummaryTop}>
                      <View style={styles.flex}>
                        <Text style={styles.detailSummaryTitle}>
                          {selectedBooking.facility?.name ?? 'Facility Booking'}
                        </Text>
                        <Text style={styles.detailSummarySub}>
                          {formatDateOnly(selectedBooking.date)} • {selectedBooking.startTime} - {selectedBooking.endTime}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.detailStatusPill,
                          statusBadgeStyle(selectedBooking.status),
                        ]}
                      >
                        <Text
                          style={[
                            styles.detailStatusPillText,
                            statusBadgeTextStyle(selectedBooking.status),
                          ]}
                        >
                          {bookingStatusLabel(selectedBooking.status)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.detailSummaryHint}>
                      Unit {selectedBooking.unit?.unitNumber ?? '—'} • Booking #{selectedBooking.id.slice(0, 8)}
                    </Text>
                  </View>

                  <DetailRow label="Facility" value={selectedBooking.facility?.name ?? 'Facility Booking'} />
                  <DetailRow label="Status" value={bookingStatusLabel(selectedBooking.status)} />
                  <DetailRow label="Date" value={formatDateOnly(selectedBooking.date)} />
                  <DetailRow label="Time" value={`${selectedBooking.startTime} - ${selectedBooking.endTime}`} />
                  <DetailRow label="Unit" value={selectedBooking.unit?.unitNumber ?? '—'} />
                  <DetailRow
                    label="Created / Updated"
                    value={formatDateTime(selectedBooking.cancelledAt || selectedBooking.createdAt)}
                  />
                  <View style={styles.detailBlockCard}>
                    <Text style={styles.detailBlockCardLabel}>Timeline</Text>
                    {bookingTimelineRows(selectedBooking).map((line, idx) => (
                      <View key={`${selectedBooking.id}-tl-${idx}`} style={styles.detailTimelineRow}>
                        <View style={[styles.detailTimelineDot, idx === 0 ? styles.detailTimelineDotActive : null]} />
                        <Text style={styles.detailTimelineText}>{line}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.detailPolicyBox}>
                    <Ionicons name="information-circle-outline" size={14} color={akColors.textMuted} />
                    <Text style={styles.detailPolicyText}>
                      You can cancel a booking while it is pending or approved. Cancelled bookings remain visible in history.
                    </Text>
                  </View>
                  {String(selectedBooking.status ?? '').toUpperCase() === 'PENDING_PAYMENT' ? (
                    <Pressable
                      onPress={() => onOpenFinance?.()}
                      style={[styles.detailActionPrimary, { borderColor: palette.primarySoft18, backgroundColor: palette.primarySoft8 }]}
                    >
                      <Text style={[styles.detailActionPrimaryText, { color: palette.primary }]}>
                        Open Payments to Complete Booking
                      </Text>
                    </Pressable>
                  ) : null}
                  {['PENDING', 'APPROVED'].includes(String(selectedBooking.status).toUpperCase()) ? (
                    <Pressable
                      onPress={() => void handleCancel(selectedBooking.id)}
                      disabled={cancellingId === selectedBooking.id}
                      style={[styles.detailActionDanger, cancellingId === selectedBooking.id && styles.buttonDisabled]}
                    >
                      <Text style={styles.detailActionDangerText}>
                        {cancellingId === selectedBooking.id ? 'Cancelling...' : 'Cancel Booking'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </ScrollView>
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

function statusBadgeStyle(status?: string) {
  switch (String(status).toUpperCase()) {
    case 'APPROVED':
      return { backgroundColor: 'rgba(16,185,129,0.10)', borderColor: 'rgba(16,185,129,0.18)' };
    case 'PENDING_PAYMENT':
      return { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.22)' };
    case 'PENDING':
      return { backgroundColor: 'rgba(201,169,97,0.12)', borderColor: 'rgba(201,169,97,0.22)' };
    case 'CANCELLED':
    case 'REJECTED':
      return { backgroundColor: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.18)' };
    default:
      return { backgroundColor: akColors.surfaceMuted, borderColor: akColors.border };
  }
}

function statusBadgeTextStyle(status?: string) {
  switch (String(status).toUpperCase()) {
    case 'APPROVED':
      return { color: akColors.success };
    case 'PENDING_PAYMENT':
      return { color: akColors.gold };
    case 'PENDING':
      return { color: akColors.gold };
    case 'CANCELLED':
    case 'REJECTED':
      return { color: akColors.danger };
    default:
      return { color: akColors.textMuted };
  }
}

function bookingStatusLabel(status?: string) {
  return bookingStatusDisplayLabel(status);
}

function bookingTimelineRows(booking: Booking): string[] {
  const rows = [`Request submitted • ${formatDateTime(booking.createdAt)}`];
  const status = String(booking.status ?? '').toUpperCase();
  if (status === 'PENDING_PAYMENT') {
    rows.push('Awaiting payment confirmation');
    rows.push('Open Payments tab to pay and activate this booking');
  }
  if (status === 'APPROVED') rows.push('Booking approved by management');
  if (status === 'PENDING') rows.push('Waiting for approval');
  if (status === 'REJECTED') rows.push('Booking request was rejected');
  if (status === 'CANCELLED') rows.push(`Cancelled • ${formatDateTime(booking.cancelledAt || booking.createdAt)}`);
  return rows;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: akColors.bg,
  },
  container: {
    padding: 16,
    gap: 14,
    backgroundColor: akColors.bg,
  },
  headerCard: {
    backgroundColor: akColors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: akColors.border,
    paddingHorizontal: 18,
    paddingVertical: 16,
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
    borderRadius: 18,
    padding: 16,
    gap: 6,
    ...akShadow.soft,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroPill: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroPillText: {
    color: akColors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  heroPillMuted: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroPillMutedText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontWeight: '600',
  },
  heroBadge: {
    color: akColors.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroTitle: {
    color: akColors.white,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    lineHeight: 18,
  },
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
  inlinePickersRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inlineGhostButton: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 999,
    backgroundColor: akColors.surface,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineGhostButtonText: {
    color: akColors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  presetDateRow: {
    gap: 8,
    paddingRight: 8,
  },
  datePresetChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(201,169,97,0.22)',
    backgroundColor: 'rgba(201,169,97,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  datePresetChipText: {
    color: akColors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  label: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  inlineMiniButton: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 999,
    backgroundColor: akColors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inlineMiniButtonText: {
    color: akColors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 12,
    backgroundColor: akColors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: akColors.text,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  primaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
    ...akShadow.soft,
  },
  primaryButtonInner: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: akColors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: akColors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: akColors.surface,
    marginTop: 8,
  },
  secondaryButtonText: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  successText: {
    color: akColors.success,
    backgroundColor: akColors.successBg,
    borderRadius: 12,
    padding: 10,
    fontSize: 12,
    borderWidth: 1,
    borderColor: akColors.successBorder,
  },
  chipsRow: {
    gap: 8,
    paddingRight: 8,
  },
  choiceChip: {
    width: 180,
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 14,
    padding: 10,
    gap: 4,
    backgroundColor: akColors.surface,
  },
  choiceChipActive: {
    backgroundColor: 'rgba(42,62,53,0.08)',
    borderColor: 'rgba(42,62,53,0.2)',
  },
  choiceChipTitle: {
    color: akColors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  choiceChipTitleActive: {
    color: akColors.primary,
  },
  choiceChipMeta: {
    color: akColors.textMuted,
    fontSize: 11,
  },
  choiceChipMetaActive: {
    color: akColors.primary,
  },
  facilityInfoBox: {
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surfaceMuted,
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  facilityInfoText: {
    color: akColors.text,
    fontSize: 12,
    lineHeight: 17,
  },
  facilityInfoMeta: {
    color: akColors.textMuted,
    fontSize: 11,
  },
  slotSuggestionsBlock: {
    gap: 6,
  },
  slotSuggestionsLabel: {
    color: akColors.text,
    fontSize: 11,
    fontWeight: '600',
  },
  slotSuggestionsRow: {
    gap: 8,
    paddingRight: 8,
  },
  slotChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  slotChipActive: {
    backgroundColor: 'rgba(201,169,97,0.10)',
    borderColor: 'rgba(201,169,97,0.25)',
  },
  slotChipText: {
    color: akColors.text,
    fontSize: 11,
    fontWeight: '600',
  },
  slotChipTextActive: {
    color: akColors.primary,
  },
  slotHintText: {
    color: akColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
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
    borderColor: akColors.border,
    borderRadius: 14,
    padding: 12,
    gap: 4,
    backgroundColor: akColors.surface,
  },
  detailModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  detailModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.35)',
  },
  detailModalSheet: {
    backgroundColor: akColors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '86%',
    paddingTop: 8,
    ...akShadow.card,
  },
  detailHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: akColors.border,
    marginBottom: 8,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  detailTitle: {
    color: akColors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  detailSubtitle: {
    color: akColors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  detailCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: akColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: akColors.surfaceMuted,
  },
  detailContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  detailCard: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 16,
    backgroundColor: akColors.surfaceMuted,
    padding: 12,
    gap: 8,
  },
  detailSummaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    padding: 10,
    gap: 6,
  },
  detailSummaryTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  detailSummaryTitle: {
    color: akColors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  detailSummarySub: {
    marginTop: 2,
    color: akColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  detailSummaryHint: {
    color: akColors.textSoft,
    fontSize: 10,
  },
  detailStatusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  detailStatusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailBlockCard: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    padding: 10,
    gap: 6,
  },
  detailBlockCardLabel: {
    color: akColors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  detailTimelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  detailTimelineDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: akColors.border,
  },
  detailTimelineDotActive: {
    backgroundColor: akColors.primary,
  },
  detailTimelineText: {
    flex: 1,
    color: akColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  detailPolicyBox: {
    marginTop: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: 'rgba(42,62,53,0.04)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  detailPolicyText: {
    flex: 1,
    color: akColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  detailRowLabel: {
    flex: 1,
    color: akColors.textMuted,
    fontSize: 12,
  },
  detailRowValue: {
    flex: 1,
    textAlign: 'right',
    color: akColors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  detailActionPrimary: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(11,95,255,0.20)',
    backgroundColor: 'rgba(11,95,255,0.08)',
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailActionPrimaryText: {
    color: akColors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  detailActionDanger: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.16)',
    backgroundColor: 'rgba(220,38,38,0.06)',
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailActionDangerText: {
    color: akColors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
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
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
