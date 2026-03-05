import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppToast } from '../components/mobile/AppToast';
import { BrandedPageHero } from '../components/mobile/BrandedPageHero';
import { InlineError, ScreenCard } from '../components/mobile/Primitives';
import type { AuthSession } from '../features/auth/types';
import { pickAndUploadServiceAttachment } from '../features/files/service';
import type { UploadedAttachment } from '../features/files/service';
import {
  addServiceRequestComment,
  cancelServiceRequest,
  createServiceRequest,
  getServiceRequestById,
  listMyServiceRequests,
  listServiceRequestComments,
  listServices,
} from '../features/community/service';
import type {
  CommunityService,
  CreateServiceRequestInput,
  CancelServiceRequestInput,
  DynamicFieldValueInput,
  ResidentUnit,
  ServiceField,
  ServiceRequestCommentRow,
  ServiceRequestRow,
} from '../features/community/types';
import { extractApiErrorMessage } from '../lib/http';
import {
  priorityDisplayLabel,
  serviceRequestStatusDisplayLabel,
} from '../features/presentation/status';
import { useBranding } from '../features/branding/provider';
import { getBrandPalette } from '../features/branding/palette';
import { useBottomNavMetrics } from '../features/layout/BottomNavMetricsContext';
import { useNetworkStatus } from '../features/network/useNetworkStatus';
import { akColors, akShadow } from '../theme/alkarma';
import { formatCurrency, formatDateTime } from '../utils/format';

type ServicesRequestsScreenProps = {
  mode?: 'services' | 'requests';
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
  deepLinkTicketId?: string | null;
  onConsumeDeepLinkTicketId?: (requestId: string) => void;
};

function humanizeEnumToken(value?: string | null): string {
  return String(value ?? '')
    .trim()
    .replace(/[-_]+/g, ' ')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function serviceCategoryLabel(value?: string | null): string {
  const key = String(value ?? '').toUpperCase();
  if (key === 'REQUESTS' || key === 'ADMIN') return 'Resident Request';
  if (key === 'MAINTENANCE') return 'Maintenance';
  if (key === 'UTILITY') return 'Utilities';
  if (key === 'SECURITY') return 'Security';
  if (key === 'OTHER') return 'General';
  return humanizeEnumToken(key || 'Service');
}

function eligibilityLabel(value?: string | null): string {
  const key = String(value ?? '').toUpperCase();
  switch (key) {
    case 'ALL':
      return 'Available for all units';
    case 'DELIVERED_ONLY':
      return 'Available for delivered units only';
    case 'OWNERS_ONLY':
      return 'Available for owners only';
    case 'TENANTS_ONLY':
      return 'Available for tenants only';
    default:
      return humanizeEnumToken(key || 'All Units');
  }
}

function fallbackServiceIcon(category?: string | null, isRequestsMode = false): keyof typeof Ionicons.glyphMap {
  const key = String(category ?? "").toUpperCase();
  if (isRequestsMode || key === "REQUESTS" || key === "ADMIN") return "file-tray-outline";
  if (key === "MAINTENANCE") return "construct-outline";
  if (key === "SECURITY") return "shield-checkmark-outline";
  if (key === "FITNESS") return "barbell-outline";
  if (key === "RECREATION" || key === "FACILITIES") return "calendar-outline";
  return "apps-outline";
}

function resolveIconTone(
  tone?: string | null,
  seed?: string | null,
): { bubbleBg: string; iconColor: string } {
  const paletteMap: Record<string, { bubbleBg: string; iconColor: string }> = {
    blue: { bubbleBg: "#EAF2FF", iconColor: "#2563EB" },
    orange: { bubbleBg: "#FFF2E8", iconColor: "#EA580C" },
    purple: { bubbleBg: "#F3ECFF", iconColor: "#7C3AED" },
    green: { bubbleBg: "#EAF9EF", iconColor: "#16A34A" },
    pink: { bubbleBg: "#FDEAF4", iconColor: "#DB2777" },
    teal: { bubbleBg: "#E8FAFA", iconColor: "#0F766E" },
  };

  if (tone && tone !== "auto" && paletteMap[tone]) return paletteMap[tone];

  const deterministic = ["blue", "orange", "purple", "green", "pink", "teal"];
  const hash = String(seed ?? "")
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return paletteMap[deterministic[hash % deterministic.length]];
}

function resolveServiceIcon(
  iconName: string | null | undefined,
  category: string | null | undefined,
  isRequestsMode: boolean,
): keyof typeof Ionicons.glyphMap {
  const requested = String(iconName ?? "").trim() as keyof typeof Ionicons.glyphMap;
  if (requested && Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, requested)) {
    return requested;
  }
  return fallbackServiceIcon(category, isRequestsMode);
}

function canUserCancelTicket(status?: string | null): boolean {
  return String(status ?? '').toUpperCase() === 'NEW';
}

function ticketStatusTone(status?: string | null): 'neutral' | 'success' | 'danger' | 'warning' {
  const key = String(status ?? '').toUpperCase();
  if (key === 'RESOLVED' || key === 'CLOSED') return 'success';
  if (key === 'REJECTED' || key === 'CANCELLED') return 'danger';
  if (key === 'IN_PROGRESS') return 'warning';
  return 'neutral';
}

function commentAuthorLabel(comment: ServiceRequestCommentRow, session: AuthSession): string {
  if (comment.createdById && comment.createdById === session.userId) return 'You';
  const display =
    comment.createdBy?.nameEN?.trim() ||
    comment.createdBy?.nameAR?.trim() ||
    comment.createdBy?.email?.trim() ||
    comment.createdBy?.phone?.trim();
  return display || 'Management';
}

function userFieldLabel(field: ServiceField): string {
  const raw = String(field.label ?? '').trim();
  if (!raw) return 'Required Information';
  const normalized = raw.toLowerCase().replace(/[_\s-]+/g, '');
  if (normalized === 'description') return 'Additional Details';
  if (normalized === 'priority') return 'Service Priority';
  if (/^[a-z0-9_ -]+$/i.test(raw)) return humanizeEnumToken(raw);
  return raw;
}

function fieldTypeHint(type: string): string {
  switch (String(type).toUpperCase()) {
    case 'BOOLEAN':
      return 'Yes / No';
    case 'FILE':
      return 'Attachment';
    case 'DATE':
      return 'Date';
    case 'NUMBER':
      return 'Number';
    case 'MEMBER_SELECTOR':
      return 'Household Member';
    case 'TEXTAREA':
      return 'Details';
    default:
      return humanizeEnumToken(type);
  }
}

export function ServicesRequestsScreen({
  mode = 'services',
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
  deepLinkTicketId = null,
  onConsumeDeepLinkTicketId,
}: ServicesRequestsScreenProps) {
  const insets = useSafeAreaInsets();
  const { contentInsetBottom } = useBottomNavMetrics();
  const { brand } = useBranding();
  const palette = getBrandPalette(brand);
  const toast = useAppToast();
  const network = useNetworkStatus();
  const [services, setServices] = useState<CommunityService[]>([]);
  const [requests, setRequests] = useState<ServiceRequestRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [fieldTextDrafts, setFieldTextDrafts] = useState<Record<string, string>>({});
  const [fieldBoolDrafts, setFieldBoolDrafts] = useState<Record<string, boolean>>({});
  const [fieldFileDrafts, setFieldFileDrafts] = useState<Record<string, UploadedAttachment>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingFieldId, setUploadingFieldId] = useState<string | null>(null);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [activeTicket, setActiveTicket] = useState<ServiceRequestRow | null>(null);
  const [ticketComments, setTicketComments] = useState<ServiceRequestCommentRow[]>([]);
  const [ticketCommentDraft, setTicketCommentDraft] = useState('');
  const [ticketCommentSubmitting, setTicketCommentSubmitting] = useState(false);
  const [ticketCancelling, setTicketCancelling] = useState(false);
  const [requestFormModalOpen, setRequestFormModalOpen] = useState(false);
  const isRequestsMode = mode === 'requests';

  const loadData = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setIsLoading(true);
      else setIsRefreshing(true);
      setLoadError(null);
      try {
        const [servicesResult, requestsResult] = await Promise.all([
          listServices(session.accessToken),
          listMyServiceRequests(session.accessToken),
        ]);
        const filteredCatalog = servicesResult.filter((service) => {
          const category = String(service.category ?? '').toUpperCase();
          const isRequestCategory = category === 'REQUESTS' || category === 'ADMIN';
          return isRequestsMode ? isRequestCategory : !isRequestCategory;
        });
        setServices(filteredCatalog);
        setRequests(requestsResult);
        setSelectedServiceId((prev) => {
          if (prev && filteredCatalog.some((s) => s.id === prev)) return prev;
          return filteredCatalog[0]?.id ?? null;
        });
      } catch (error) {
        setLoadError(extractApiErrorMessage(error));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [isRequestsMode, session.accessToken],
  );

  useEffect(() => {
    void loadData('initial');
  }, [loadData]);

  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedServiceId) ?? null,
    [services, selectedServiceId],
  );

  useEffect(() => {
    setFieldTextDrafts({});
    setFieldBoolDrafts({});
    setFieldFileDrafts({});
  }, [selectedServiceId]);

  const visibleRequests = useMemo(() => {
    const scoped = selectedUnitId ? requests.filter((r) => r.unitId === selectedUnitId) : requests;
    const catalogIds = new Set(services.map((s) => s.id));
    return scoped.filter((r) => (r.serviceId ? catalogIds.has(r.serviceId) : true));
  }, [requests, selectedUnitId, services]);

  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return services;
    return services.filter((service) => {
      const hay = `${service.name ?? ''} ${service.description ?? ''} ${service.category ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [searchQuery, services]);

  const setFieldText = useCallback((fieldId: string, value: string) => {
    setFieldTextDrafts((prev) => ({ ...prev, [fieldId]: value }));
    setFieldFileDrafts((prev) => {
      const existing = prev[fieldId];
      if (!existing) return prev;
      if (existing.id === value.trim()) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }, []);

  const setFieldBool = useCallback((fieldId: string, value: boolean) => {
    setFieldBoolDrafts((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  const setFieldFile = useCallback((fieldId: string, file: UploadedAttachment | null) => {
    setFieldFileDrafts((prev) => {
      const next = { ...prev };
      if (file) next[fieldId] = file;
      else delete next[fieldId];
      return next;
    });
    setFieldTextDrafts((prev) => {
      const next = { ...prev };
      if (file) next[fieldId] = file.id;
      else delete next[fieldId];
      return next;
    });
  }, []);

  const buildFieldValues = useCallback((fields: ServiceField[]): DynamicFieldValueInput[] => {
    const result: DynamicFieldValueInput[] = [];
    for (const field of fields) {
      const type = String(field.type).toUpperCase();
      if (type === 'BOOLEAN') {
        if (Object.prototype.hasOwnProperty.call(fieldBoolDrafts, field.id)) {
          result.push({ fieldId: field.id, valueBool: fieldBoolDrafts[field.id] });
        }
        continue;
      }

      const raw = (fieldTextDrafts[field.id] ?? '').trim();
      if (!raw) continue;

      if (type === 'NUMBER') {
        const valueNumber = Number(raw);
        if (!Number.isFinite(valueNumber)) {
          throw new Error(`Please enter a valid number for "${userFieldLabel(field)}".`);
        }
        result.push({ fieldId: field.id, valueNumber });
      } else if (type === 'DATE') {
        const parsed = parseDateFieldInput(raw);
        if (!parsed) {
          throw new Error(
            `Please enter a valid date for "${userFieldLabel(field)}" in YYYY-MM-DD format.`,
          );
        }
        result.push({ fieldId: field.id, valueDate: raw });
      } else if (type === 'FILE') {
        result.push({ fieldId: field.id, fileAttachmentId: raw });
      } else {
        result.push({ fieldId: field.id, valueText: raw });
      }
    }
    return result;
  }, [fieldBoolDrafts, fieldTextDrafts]);

  const buildFallbackDescription = useCallback(
    (service: CommunityService, fields: ServiceField[]) => {
      const parts: string[] = [];

      for (const field of fields) {
        const type = String(field.type ?? '').toUpperCase();
        if (type === 'BOOLEAN') {
          if (!Object.prototype.hasOwnProperty.call(fieldBoolDrafts, field.id)) continue;
          parts.push(`${userFieldLabel(field)}: ${fieldBoolDrafts[field.id] ? 'Yes' : 'No'}`);
          continue;
        }

        if (type === 'FILE') {
          const file = fieldFileDrafts[field.id];
          if (!file) continue;
          parts.push(`${userFieldLabel(field)}: ${file.name || 'Attachment added'}`);
          continue;
        }

        const raw = (fieldTextDrafts[field.id] ?? '').trim();
        if (!raw) continue;
        parts.push(`${userFieldLabel(field)}: ${raw}`);
      }

      if (parts.length > 0) {
        return parts.join(' | ').slice(0, 900);
      }

      return `Submitted from resident mobile app for ${service.name}`;
    },
    [fieldBoolDrafts, fieldFileDrafts, fieldTextDrafts],
  );

  const submitRequest = useCallback(async () => {
    if (!network.isOnline) {
      setSubmitError('Connect to internet to continue.');
      toast.info('Offline', 'Connect to internet to continue.');
      return;
    }
    if (!selectedUnitId) {
      setSubmitError('Select a unit first.');
      toast.error('Missing unit', 'Select a unit before submitting your request.');
      return;
    }
    if (!selectedService) {
      setSubmitError('Select a service first.');
      toast.error(
        isRequestsMode ? 'Missing request type' : 'Missing service',
        isRequestsMode ? 'Select a request type first.' : 'Select a service first.',
      );
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const fieldValues = buildFieldValues(selectedService.formFields ?? []);
      const payload: CreateServiceRequestInput = {
        serviceId: selectedService.id,
        unitId: selectedUnitId,
        description: buildFallbackDescription(
          selectedService,
          selectedService.formFields ?? [],
        ),
        priority: selectedService.isUrgent ? 'CRITICAL' : undefined,
        fieldValues,
      };
      await createServiceRequest(session.accessToken, payload);
      toast.success(
        isRequestsMode ? 'Request submitted' : 'Service ticket submitted',
        'Your request has been sent successfully.',
      );
      setFieldTextDrafts({});
      setFieldBoolDrafts({});
      setFieldFileDrafts({});
      setRequestFormModalOpen(false);
      await loadData('refresh');
    } catch (error) {
      const msg = extractApiErrorMessage(error);
      setSubmitError(msg);
      toast.error(isRequestsMode ? 'Request failed' : 'Service ticket failed', msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    buildFieldValues,
    buildFallbackDescription,
    loadData,
    selectedService,
    selectedUnitId,
    session.accessToken,
    isRequestsMode,
    network.isOnline,
    toast,
  ]);

  const uploadDynamicFieldFile = useCallback(
    async (field: ServiceField) => {
      if (!network.isOnline) {
        toast.info('Offline', 'Connect to internet to continue.');
        return;
      }
      setSubmitError(null);
      setUploadingFieldId(field.id);
      try {
        const uploaded = await pickAndUploadServiceAttachment(session.accessToken);
        if (!uploaded) return;
        setFieldFile(field.id, uploaded);
        toast.success('File uploaded');
      } catch (error) {
        const msg = extractApiErrorMessage(error);
        setSubmitError(msg);
        toast.error('File upload failed', msg);
      } finally {
        setUploadingFieldId((current) => (current === field.id ? null : current));
      }
    },
    [network.isOnline, session.accessToken, setFieldFile, toast],
  );

  const loadTicketDetails = useCallback(
    async (requestId: string) => {
      setTicketLoading(true);
      try {
        const [ticket, comments] = await Promise.all([
          getServiceRequestById(session.accessToken, requestId),
          listServiceRequestComments(session.accessToken, requestId),
        ]);
        setActiveTicket(ticket);
        setTicketComments(comments);
      } catch (error) {
        const msg = extractApiErrorMessage(error);
        toast.error('Unable to open request details', msg);
      } finally {
        setTicketLoading(false);
      }
    },
    [session.accessToken, toast],
  );

  const openTicket = useCallback(
    async (ticket: ServiceRequestRow) => {
      setTicketModalOpen(true);
      setActiveTicket(ticket);
      setTicketComments(ticket.comments ?? []);
      setTicketCommentDraft('');
      await loadTicketDetails(ticket.id);
    },
    [loadTicketDetails],
  );

  const closeTicketModal = useCallback(() => {
    setTicketModalOpen(false);
    setTicketCommentDraft('');
  }, []);

  useEffect(() => {
    if (!deepLinkTicketId) return;
    let cancelled = false;

    (async () => {
      setTicketModalOpen(true);
      setActiveTicket(null);
      setTicketComments([]);
      setTicketCommentDraft('');
      await loadTicketDetails(deepLinkTicketId);
      if (!cancelled) {
        onConsumeDeepLinkTicketId?.(deepLinkTicketId);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deepLinkTicketId, loadTicketDetails, onConsumeDeepLinkTicketId]);

  const submitTicketComment = useCallback(async () => {
    if (!network.isOnline) {
      toast.info('Offline', 'Connect to internet to continue.');
      return;
    }
    if (!activeTicket) return;
    const body = ticketCommentDraft.trim();
    if (!body) {
      toast.info('Add a comment', 'Write a short message before sending.');
      return;
    }

    setTicketCommentSubmitting(true);
    try {
      const created = await addServiceRequestComment(session.accessToken, activeTicket.id, {
        body,
      });
      setTicketComments((prev) => [...prev, created]);
      setTicketCommentDraft('');
      toast.success('Comment added');
      await loadData('refresh');
    } catch (error) {
      toast.error('Unable to add comment', extractApiErrorMessage(error));
    } finally {
      setTicketCommentSubmitting(false);
    }
  }, [
    activeTicket,
    ticketCommentDraft,
    toast,
    session.accessToken,
    loadData,
    network.isOnline,
  ]);

  const cancelActiveTicket = useCallback(async () => {
    if (!network.isOnline) {
      toast.info('Offline', 'Connect to internet to continue.');
      return;
    }
    if (!activeTicket) return;
    if (!canUserCancelTicket(activeTicket.status)) {
      toast.info(
        'Cancellation unavailable',
        'This request is already under review or completed.',
      );
      return;
    }
    setTicketCancelling(true);
    try {
      const payload: CancelServiceRequestInput = {};
      const updated = await cancelServiceRequest(session.accessToken, activeTicket.id, payload);
      setActiveTicket(updated);
      toast.success(
        isRequestsMode ? 'Request cancelled' : 'Service ticket cancelled',
      );
      await loadTicketDetails(activeTicket.id);
      await loadData('refresh');
    } catch (error) {
      toast.error('Unable to cancel request', extractApiErrorMessage(error));
    } finally {
      setTicketCancelling(false);
    }
  }, [
    activeTicket,
    isRequestsMode,
    loadData,
    loadTicketDetails,
    session.accessToken,
    network.isOnline,
    toast,
  ]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: 0, paddingBottom: Math.max(110, contentInsetBottom) },
        ]}
      >
      <BrandedPageHero
        title={isRequestsMode ? 'Requests' : 'Services'}
      >
        <View style={styles.searchShell}>
          <Ionicons name="search-outline" size={18} color={akColors.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            placeholder={isRequestsMode ? 'Search requests...' : 'Search services...'}
            placeholderTextColor={akColors.textSoft}
          />
        </View>
      </BrandedPageHero>

      {units.length > 1 ? (
        <ScreenCard title="Current Unit">
          <View style={styles.unitRow}>
            <Text style={styles.unitRowText}>
              {selectedUnit?.unitNumber ?? selectedUnit?.id ?? 'Select unit'}
            </Text>
            <Pressable style={styles.unitRowChangeBtn} onPress={onOpenUnitPicker}>
              <Text style={styles.unitRowChangeText}>Change</Text>
            </Pressable>
          </View>
          <InlineError message={unitsErrorMessage} />
          {unitsRefreshing ? <ActivityIndicator size="small" color={palette.primary} /> : null}
        </ScreenCard>
      ) : null}

      {units.length <= 1 ? (
        <InlineError message={unitsErrorMessage} />
      ) : null}
      {unitsLoading ? <ActivityIndicator color={palette.primary} /> : null}

      <ScreenCard
        title={isRequestsMode ? 'Step 1: Choose Request Type' : 'Step 1: Choose Service'}
        actionLabel={isRefreshing ? 'Refreshing...' : 'Refresh'}
        onActionPress={() => void loadData('refresh')}
      >
        <InlineError message={loadError} />
        {isLoading ? (
          <ActivityIndicator color={palette.primary} />
        ) : (
          <>
            <Text style={styles.label}>{isRequestsMode ? 'Request Type' : 'Service Type'}</Text>
            {filteredServices.length === 0 ? (
              <View style={styles.noServicesBox}>
                <Ionicons name="search-outline" size={20} color={akColors.textSoft} />
                <Text style={styles.dynamicHint}>
                  {isRequestsMode ? 'No request types match your search.' : 'No services match your search.'}
                </Text>
              </View>
            ) : null}
            <View style={styles.serviceGrid}>
              {filteredServices.map((service) => {
                const active = service.id === selectedServiceId;
                const iconName = resolveServiceIcon(service.iconName, service.category, isRequestsMode);
                const iconTone = resolveIconTone(service.iconTone, service.id);
                return (
                  <Pressable
                    key={service.id}
                    onPress={() => {
                      setSelectedServiceId(service.id);
                      setSubmitError(null);
                      setRequestFormModalOpen(true);
                    }}
                    style={[
                      styles.serviceCard,
                      active && styles.serviceCardActive,
                    ]}
                  >
                    <View style={styles.serviceCardTop}>
                      <View style={[styles.serviceIconBubble, { backgroundColor: iconTone.bubbleBg }]}>
                        <Ionicons
                          name={iconName}
                          size={20}
                          color={iconTone.iconColor}
                        />
                      </View>
                      <Ionicons
                        name={active ? 'checkmark-circle' : 'chevron-forward-outline'}
                        size={16}
                        color={active ? palette.primary : akColors.textSoft}
                      />
                    </View>
                    <Text style={styles.serviceCardTitle} numberOfLines={2}>
                      {service.name}
                    </Text>
                    {service.description?.trim() ? (
                      <Text style={styles.serviceCardSubtitle} numberOfLines={2}>
                        {service.description.trim()}
                      </Text>
                    ) : null}
                    <Text style={styles.serviceCardMeta} numberOfLines={1}>
                      {serviceCategoryLabel(service.category)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </ScreenCard>

      <Modal
        visible={requestFormModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setRequestFormModalOpen(false)}
      >
        <View style={styles.ticketModalBackdrop}>
          <Pressable style={styles.ticketModalBackdropTap} onPress={() => setRequestFormModalOpen(false)} />
          <View style={styles.ticketModalSheet}>
            <View style={styles.ticketModalHandle} />
            <View style={styles.ticketModalHeader}>
              <Pressable
                style={styles.iconRoundButton}
                onPress={() => setRequestFormModalOpen(false)}
              >
                <Ionicons name="close" size={18} color={akColors.textMuted} />
              </Pressable>
              <View style={styles.flex}>
                <Text style={styles.ticketModalTitle}>
                  {isRequestsMode ? 'Step 2: Request Details' : 'Step 2: Service Details'}
                </Text>
                <Text style={styles.ticketModalSubtitle}>
                  {selectedService?.name ?? (isRequestsMode ? 'Request' : 'Service')}
                </Text>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.ticketCommentsListContent}>
              <InlineError message={submitError} />

              {(selectedService?.formFields?.length ?? 0) > 0 ? (
                <View style={styles.dynamicFieldsBlock}>
                  {(selectedService?.formFields ?? []).map((field) => (
                    <DynamicFieldInput
                      key={field.id}
                      field={field}
                      textValue={fieldTextDrafts[field.id] ?? ''}
                      boolValue={fieldBoolDrafts[field.id]}
                      fileValue={fieldFileDrafts[field.id] ?? null}
                      isUploadingFile={uploadingFieldId === field.id}
                      palette={palette}
                      onTextChange={(value) => setFieldText(field.id, value)}
                      onBoolChange={(value) => setFieldBool(field.id, value)}
                      onUploadFile={() => void uploadDynamicFieldFile(field)}
                      onClearFile={() => setFieldFile(field.id, null)}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceInfoBody}>No additional fields required.</Text>
                </View>
              )}
            </ScrollView>

            <Pressable
              style={[styles.primaryButton, (isSubmitting || !network.isOnline) && styles.buttonDisabled]}
              onPress={() => void submitRequest()}
              disabled={isSubmitting || !network.isOnline}
            >
              <LinearGradient colors={[palette.primary, palette.primaryDark]} style={styles.primaryButtonInner}>
                {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : null}
                <Text style={styles.primaryButtonText}>
                  {isSubmitting
                    ? 'Submitting...'
                    : isRequestsMode
                      ? 'Submit Request'
                      : 'Submit Service Ticket'}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </Modal>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {isRequestsMode ? 'My Requests' : 'My Service Tickets'}
        </Text>
        <Text style={[styles.sectionCount, { color: palette.primary }]}>{visibleRequests.length}</Text>
      </View>
      <ScreenCard>
        {visibleRequests.length === 0 ? (
          <Text style={styles.emptyText}>No requests found for the selected unit yet.</Text>
        ) : (
          visibleRequests.map((row) => (
            <Pressable key={row.id} style={styles.itemCard} onPress={() => void openTicket(row)}>
              <View style={styles.itemHeader}>
                <View style={styles.flex}>
                  <Text style={styles.itemTitle}>{row.service?.name ?? 'Request Ticket'}</Text>
                  <Text style={styles.itemSub}>
                    {priorityDisplayLabel(row.priority)} • {serviceRequestStatusDisplayLabel(row.status)}
                  </Text>
                </View>
                <Text style={styles.itemMetaDate}>{formatDateTime(row.requestedAt)}</Text>
              </View>
              <Text style={styles.itemDesc}>{row.description ?? '—'}</Text>
              {row.comments?.[0]?.body ? (
                <View style={styles.ticketPreviewComment}>
                  <Ionicons name="chatbubble-ellipses-outline" size={13} color={akColors.textMuted} />
                  <Text style={styles.ticketPreviewCommentText} numberOfLines={1}>
                    {row.comments[0].body}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.itemSub}>Last update: {formatDateTime(row.updatedAt)}</Text>
            </Pressable>
          ))
        )}
      </ScreenCard>
      <Modal
        visible={ticketModalOpen}
        transparent
        animationType="slide"
        onRequestClose={closeTicketModal}
      >
        <View style={styles.ticketModalBackdrop}>
          <Pressable style={styles.ticketModalBackdropTap} onPress={closeTicketModal} />
          <View style={[styles.ticketModalSheet, { paddingBottom: Math.max(insets.bottom, 12) + 10 }]}>
            <View style={styles.ticketModalHandle} />
            <View style={styles.ticketModalHeader}>
              <View style={styles.flex}>
                <Text style={styles.ticketModalTitle}>
                  {activeTicket?.service?.name ?? (isRequestsMode ? 'Request' : 'Service Ticket')}
                </Text>
                <Text style={styles.ticketModalSubtitle}>
                  Request details, status updates, and conversation
                </Text>
              </View>
              <Pressable onPress={closeTicketModal} style={styles.iconRoundButton}>
                <Ionicons name="close" size={18} color={akColors.text} />
              </Pressable>
            </View>

            {ticketLoading ? (
              <View style={styles.ticketLoadingBox}>
                <ActivityIndicator color={palette.primary} />
              </View>
            ) : activeTicket ? (
              <>
                <View style={styles.ticketMetaCard}>
                  <View style={styles.ticketMetaRow}>
                    <Text style={styles.ticketMetaLabel}>Current status</Text>
                    <View
                      style={[
                        styles.ticketStatusPill,
                        ticketStatusTone(activeTicket.status) === 'success' && styles.ticketStatusPillSuccess,
                        ticketStatusTone(activeTicket.status) === 'danger' && styles.ticketStatusPillDanger,
                        ticketStatusTone(activeTicket.status) === 'warning' && styles.ticketStatusPillWarning,
                      ]}
                    >
                      <Text
                        style={[
                          styles.ticketStatusPillText,
                          ticketStatusTone(activeTicket.status) === 'success' && styles.ticketStatusPillTextSuccess,
                          ticketStatusTone(activeTicket.status) === 'danger' && styles.ticketStatusPillTextDanger,
                          ticketStatusTone(activeTicket.status) === 'warning' && styles.ticketStatusPillTextWarning,
                        ]}
                      >
                        {serviceRequestStatusDisplayLabel(activeTicket.status)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.ticketMetaValue}>
                    Submitted on: {formatDateTime(activeTicket.requestedAt)}
                  </Text>
                  <Text style={styles.ticketMetaValue}>
                    Last updated: {formatDateTime(activeTicket.updatedAt)}
                  </Text>
                  {activeTicket.description ? (
                    <View style={styles.ticketDescriptionBox}>
                      <Text style={styles.ticketMetaLabel}>Summary</Text>
                      <Text style={styles.ticketDescriptionText}>{activeTicket.description}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.ticketCommentsHeader}>
                  <Text style={styles.ticketCommentsTitle}>Conversation</Text>
                  <Text style={[styles.ticketCommentsCount, { color: palette.primary }]}>
                    {ticketComments.length}
                  </Text>
                </View>

                <ScrollView style={styles.ticketCommentsList} contentContainerStyle={styles.ticketCommentsListContent}>
                  {ticketComments.length === 0 ? (
                    <Text style={styles.ticketEmptyComments}>
                      No replies yet. You can send a message to management.
                    </Text>
                  ) : (
                    ticketComments.map((comment) => {
                      const mine = comment.createdById === session.userId;
                      return (
                        <View
                          key={comment.id}
                          style={[
                            styles.ticketCommentBubble,
                            mine ? styles.ticketCommentBubbleMine : styles.ticketCommentBubbleOther,
                          ]}
                        >
                          <Text
                            style={[
                              styles.ticketCommentAuthor,
                              !mine && { color: palette.primary },
                              mine && styles.ticketCommentAuthorMine,
                            ]}
                          >
                            {commentAuthorLabel(comment, session)}
                          </Text>
                          <Text
                            style={[
                              styles.ticketCommentBody,
                              mine && styles.ticketCommentBodyMine,
                            ]}
                          >
                            {comment.body}
                          </Text>
                          <Text
                            style={[
                              styles.ticketCommentTime,
                              mine && styles.ticketCommentTimeMine,
                            ]}
                          >
                            {formatDateTime(comment.createdAt)}
                          </Text>
                        </View>
                      );
                    })
                  )}
                </ScrollView>

                <View style={styles.ticketComposer}>
                  <TextInput
                    value={ticketCommentDraft}
                    onChangeText={setTicketCommentDraft}
                    style={[styles.input, styles.ticketComposerInput]}
                    placeholder="Write your message..."
                    placeholderTextColor="#94A3B8"
                    multiline
                    numberOfLines={3}
                  />
                  <View style={styles.ticketComposerActions}>
                    <Pressable
                      style={[
                        styles.ghostActionButton,
                        (!canUserCancelTicket(activeTicket.status) || ticketCancelling || !network.isOnline) && styles.buttonDisabled,
                      ]}
                      disabled={!canUserCancelTicket(activeTicket.status) || ticketCancelling || !network.isOnline}
                      onPress={() => void cancelActiveTicket()}
                    >
                      <Text style={styles.ghostActionButtonDangerText}>
                        {ticketCancelling ? 'Cancelling...' : 'Cancel Request'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.primarySolidButton,
                        { backgroundColor: palette.primary },
                        (ticketCommentSubmitting || !network.isOnline) && styles.buttonDisabled,
                      ]}
                      disabled={ticketCommentSubmitting || !network.isOnline}
                      onPress={() => void submitTicketComment()}
                    >
                      {ticketCommentSubmitting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="send" size={14} color="#fff" />
                          <Text style={styles.primarySolidButtonText}>Send Reply</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                  {!canUserCancelTicket(activeTicket.status) ? (
                    <Text style={styles.ticketCancelHint}>
                      You can cancel only while this request is still pending review.
                    </Text>
                  ) : null}
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

type DynamicFieldInputProps = {
  field: ServiceField;
  palette: ReturnType<typeof getBrandPalette>;
  textValue: string;
  boolValue?: boolean;
  fileValue?: UploadedAttachment | null;
  isUploadingFile?: boolean;
  onTextChange: (value: string) => void;
  onBoolChange: (value: boolean) => void;
  onUploadFile?: () => void;
  onClearFile?: () => void;
};

function DynamicFieldInput({
  field,
  palette,
  textValue,
  boolValue,
  fileValue,
  isUploadingFile,
  onTextChange,
  onBoolChange,
  onUploadFile,
  onClearFile,
}: DynamicFieldInputProps) {
  const type = String(field.type).toUpperCase();
  const label = `${userFieldLabel(field)}${field.required ? ' *' : ''}`;
  const [showDatePicker, setShowDatePicker] = useState(false);

  if (type === 'BOOLEAN') {
    return (
      <View style={styles.dynamicFieldRow}>
        <View style={styles.flex}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.dynamicMeta}>{fieldTypeHint(type)}</Text>
        </View>
        <Switch
          value={Boolean(boolValue)}
          onValueChange={onBoolChange}
          trackColor={{ false: '#CBD5E1', true: palette.primarySoft22 }}
          thumbColor={Boolean(boolValue) ? palette.primary : '#F8FAFC'}
        />
      </View>
    );
  }

  if (type === 'FILE') {
    return (
      <View style={styles.dynamicFieldBlock}>
        <View style={styles.attachmentsHeader}>
          <View style={styles.flex}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.dynamicMeta}>{fieldTypeHint(type)}</Text>
          </View>
          <Pressable
            onPress={onUploadFile}
            disabled={Boolean(isUploadingFile)}
            style={[styles.ghostButton, Boolean(isUploadingFile) && styles.buttonDisabled]}
          >
            <Text style={[styles.ghostButtonText, { color: palette.primary }]}>
              {isUploadingFile ? 'Uploading...' : fileValue ? 'Replace file' : 'Upload file'}
            </Text>
          </Pressable>
        </View>

        {fileValue ? (
          <View style={styles.attachmentItem}>
            <View style={styles.flex}>
              <Text style={styles.attachmentName} numberOfLines={1}>
                {fileValue.name}
              </Text>
              <Text style={styles.attachmentMeta}>Ready to submit</Text>
            </View>
            <Pressable onPress={onClearFile}>
              <Text style={styles.removeAttachmentText}>Remove</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.dynamicHint}>Upload a file for this field.</Text>
        )}

        {/* file ID is stored internally after upload; never shown to end users */}
      </View>
    );
  }

  if (type === 'DATE') {
    const parsedDate = parseDateFieldInput(textValue) ?? new Date();
    return (
      <View style={styles.dynamicFieldBlock}>
        <View style={styles.attachmentsHeader}>
          <View style={styles.flex}>
            <Text style={styles.label}>{label}</Text>
          <Text style={styles.dynamicMeta}>{fieldTypeHint(type)}</Text>
          </View>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            style={styles.ghostButton}
          >
            <Text style={[styles.ghostButtonText, { color: palette.primary }]}>Pick Date</Text>
          </Pressable>
        </View>

        <TextInput
          value={textValue}
          onChangeText={onTextChange}
          style={styles.input}
          placeholder={field.placeholder || 'YYYY-MM-DD'}
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.dynamicMeta}>Use date picker or enter YYYY-MM-DD.</Text>

        {showDatePicker ? (
          <DateTimePicker
            value={parsedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, pickedDate) => {
              if (Platform.OS !== 'ios') setShowDatePicker(false);
              if (!pickedDate) return;
              onTextChange(formatDateFieldValue(pickedDate));
            }}
          />
        ) : null}

        {Platform.OS === 'ios' && showDatePicker ? (
          <Pressable onPress={() => setShowDatePicker(false)} style={styles.ghostButton}>
            <Text style={[styles.ghostButtonText, { color: palette.primary }]}>Done</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.dynamicFieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={textValue}
        onChangeText={onTextChange}
        style={[styles.input, type === 'TEXTAREA' && styles.multilineInput]}
        multiline={type === 'TEXTAREA'}
        numberOfLines={type === 'TEXTAREA' ? 3 : 1}
        keyboardType={type === 'NUMBER' ? 'numeric' : 'default'}
        placeholder={field.placeholder || placeholderForType(type)}
        placeholderTextColor="#94A3B8"
      />
      <Text style={styles.dynamicMeta}>
        {type === 'MEMBER_SELECTOR'
          ? 'Select a household member by name.'
          : fieldTypeHint(type)}
      </Text>
    </View>
  );
}

function parseDateFieldInput(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const date = new Date(year, month, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function formatDateFieldValue(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function placeholderForType(type: string): string {
  switch (type) {
    case 'DATE':
      return 'YYYY-MM-DD';
    case 'NUMBER':
      return 'Enter number';
    case 'FILE':
      return 'Upload file';
    default:
      return 'Enter details';
  }
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
  },
  headerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: akColors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    ...akShadow.soft,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerTitle: {
    color: akColors.text,
    fontSize: 28,
    fontWeight: '700',
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: akColors.surfaceMuted,
  },
  unitRowChangeText: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  searchShell: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    padding: 0,
    color: akColors.text,
    fontSize: 14,
  },
  hero: {
    backgroundColor: akColors.primaryDark,
    borderRadius: 20,
    padding: 16,
    gap: 7,
    ...akShadow.card,
  },
  heroBadge: {
    color: akColors.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroTitle: {
    color: akColors.white,
    fontSize: 22,
    fontWeight: '700',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    lineHeight: 18,
  },
  label: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  chipsRow: {
    gap: 8,
    paddingRight: 8,
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  noServicesBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surfaceMuted,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceCard: {
    width: '48%',
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 18,
    padding: 14,
    gap: 7,
    backgroundColor: akColors.surface,
    minHeight: 165,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  serviceCardActive: {
    borderColor: "rgba(37,99,235,0.38)",
    shadowColor: "#1D4ED8",
    shadowOpacity: 0.14,
    elevation: 4,
  },
  serviceCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  serviceIconBubble: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceCardTitle: {
    color: akColors.text,
    fontWeight: "700",
    fontSize: 15,
    lineHeight: 20,
    marginTop: 2,
  },
  serviceCardSubtitle: {
    color: akColors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    minHeight: 34,
  },
  serviceCardMeta: {
    color: akColors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  serviceInfo: {
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.9)',
    borderRadius: 14,
    backgroundColor: akColors.surface,
    padding: 12,
    gap: 5,
    ...akShadow.soft,
  },
  serviceInfoTitle: {
    color: akColors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  serviceInfoBody: {
    color: akColors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  serviceInfoMeta: {
    color: akColors.textMuted,
    fontSize: 11,
  },
  priorityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  priorityChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: akColors.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: akColors.surface,
  },
  priorityChipActive: {
    backgroundColor: 'rgba(42,62,53,0.10)',
    borderColor: 'rgba(42,62,53,0.22)',
  },
  priorityChipText: {
    color: akColors.textMuted,
    fontWeight: '700',
    fontSize: 11,
  },
  priorityChipTextActive: {
    color: akColors.primary,
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
  multilineInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  attachmentsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: akColors.surface,
  },
  ghostButtonText: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  attachmentsList: {
    gap: 6,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: akColors.surface,
  },
  attachmentName: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  attachmentMeta: {
    color: akColors.textSoft,
    fontSize: 10,
  },
  removeAttachmentText: {
    color: akColors.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  dynamicFieldsBlock: {
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.9)',
    borderRadius: 16,
    backgroundColor: akColors.surface,
    padding: 12,
    gap: 10,
  },
  dynamicFieldsTitle: {
    color: akColors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  dynamicFieldBlock: {
    gap: 6,
  },
  dynamicFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'space-between',
  },
  dynamicMeta: {
    color: akColors.textSoft,
    fontSize: 10,
    textTransform: 'none',
  },
  dynamicHint: {
    color: akColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  primaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
    ...akShadow.soft,
  },
  primaryButtonInner: {
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: akColors.white,
    fontWeight: '700',
    fontSize: 13,
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
    gap: 6,
    backgroundColor: akColors.surface,
    ...akShadow.soft,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  itemTitle: {
    color: akColors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  itemSub: {
    color: akColors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  itemDesc: {
    color: akColors.text,
    fontSize: 12,
    lineHeight: 17,
  },
  itemMetaDate: {
    color: akColors.textSoft,
    fontSize: 10,
  },
  ticketPreviewComment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  ticketPreviewCommentText: {
    color: akColors.textMuted,
    fontSize: 11,
    flex: 1,
  },
  ticketModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.18)',
  },
  ticketModalBackdropTap: {
    flex: 1,
  },
  ticketModalSheet: {
    backgroundColor: akColors.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 8,
    maxHeight: '88%',
    borderTopWidth: 1,
    borderColor: akColors.border,
  },
  ticketModalHandle: {
    width: 46,
    height: 4,
    borderRadius: 999,
    backgroundColor: akColors.border,
    alignSelf: 'center',
    marginBottom: 10,
  },
  ticketModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  ticketModalTitle: {
    color: akColors.text,
    fontWeight: '700',
    fontSize: 16,
  },
  ticketModalSubtitle: {
    color: akColors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  iconRoundButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
  },
  ticketLoadingBox: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketMetaCard: {
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    borderRadius: 14,
    padding: 12,
    gap: 6,
    ...akShadow.soft,
  },
  ticketMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  ticketMetaLabel: {
    color: akColors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  ticketMetaValue: {
    color: akColors.text,
    fontSize: 12,
  },
  ticketDescriptionBox: {
    marginTop: 4,
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: akColors.border,
    paddingTop: 8,
  },
  ticketDescriptionText: {
    color: akColors.text,
    fontSize: 12,
    lineHeight: 18,
  },
  ticketStatusPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  ticketStatusPillSuccess: {
    borderColor: akColors.successBorder,
    backgroundColor: akColors.successBg,
  },
  ticketStatusPillDanger: {
    borderColor: 'rgba(239,68,68,0.25)',
    backgroundColor: 'rgba(254,226,226,0.75)',
  },
  ticketStatusPillWarning: {
    borderColor: 'rgba(245,158,11,0.28)',
    backgroundColor: 'rgba(254,243,199,0.75)',
  },
  ticketStatusPillText: {
    color: akColors.text,
    fontWeight: '700',
    fontSize: 11,
  },
  ticketStatusPillTextSuccess: {
    color: akColors.success,
  },
  ticketStatusPillTextDanger: {
    color: akColors.danger,
  },
  ticketStatusPillTextWarning: {
    color: akColors.gold,
  },
  ticketCommentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  ticketCommentsTitle: {
    color: akColors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  ticketCommentsCount: {
    color: akColors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  ticketCommentsList: {
    maxHeight: 240,
  },
  ticketCommentsListContent: {
    gap: 8,
    paddingBottom: 6,
  },
  ticketEmptyComments: {
    color: akColors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    paddingVertical: 8,
  },
  ticketCommentBubble: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
    maxWidth: '92%',
  },
  ticketCommentBubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(42,62,53,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(42,62,53,0.28)',
  },
  ticketCommentBubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: akColors.surface,
    borderWidth: 1,
    borderColor: akColors.border,
  },
  ticketCommentAuthor: {
    color: akColors.primary,
    fontWeight: '700',
    fontSize: 11,
  },
  ticketCommentAuthorMine: {
    color: 'rgba(255,255,255,0.86)',
  },
  ticketCommentBody: {
    color: akColors.text,
    fontSize: 12,
    lineHeight: 18,
  },
  ticketCommentBodyMine: {
    color: '#FFFFFF',
  },
  ticketCommentTime: {
    color: akColors.textSoft,
    fontSize: 10,
  },
  ticketCommentTimeMine: {
    color: 'rgba(255,255,255,0.72)',
  },
  ticketComposer: {
    marginTop: 10,
    gap: 8,
  },
  ticketComposerInput: {
    minHeight: 76,
    textAlignVertical: 'top',
  },
  ticketComposerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  ghostActionButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostActionButtonDangerText: {
    color: akColors.danger,
    fontWeight: '700',
    fontSize: 12,
  },
  primarySolidButton: {
    minWidth: 112,
    borderRadius: 12,
    backgroundColor: akColors.primary,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    ...akShadow.soft,
  },
  primarySolidButtonText: {
    color: akColors.white,
    fontWeight: '700',
    fontSize: 12,
  },
  ticketCancelHint: {
    color: akColors.textSoft,
    fontSize: 11,
    lineHeight: 16,
  },
});
