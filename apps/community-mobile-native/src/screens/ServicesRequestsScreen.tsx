import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  ActivityIndicator,
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
import { InlineError, ScreenCard } from '../components/mobile/Primitives';
import { UnitPicker } from '../components/mobile/UnitPicker';
import type { AuthSession } from '../features/auth/types';
import { pickAndUploadServiceAttachment } from '../features/files/service';
import type { UploadedAttachment } from '../features/files/service';
import {
  createServiceRequest,
  listMyServiceRequests,
  listServices,
} from '../features/community/service';
import type {
  CommunityService,
  CreateServiceRequestInput,
  DynamicFieldValueInput,
  ResidentUnit,
  ServiceField,
  ServiceRequestRow,
} from '../features/community/types';
import { extractApiErrorMessage } from '../lib/http';
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
};

const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
type PriorityOption = (typeof PRIORITY_OPTIONS)[number];

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
  if (key === 'REQUESTS' || key === 'ADMIN') return 'Request';
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

function priorityLabel(value?: string | null): string {
  switch (String(value ?? '').toUpperCase()) {
    case 'LOW':
      return 'Low';
    case 'MEDIUM':
      return 'Normal';
    case 'HIGH':
      return 'High';
    case 'CRITICAL':
      return 'Urgent';
    default:
      return humanizeEnumToken(value || 'Normal');
  }
}

function statusLabel(value?: string | null): string {
  return humanizeEnumToken(value || 'New');
}

function userFieldLabel(field: ServiceField): string {
  const raw = String(field.label ?? '').trim();
  if (!raw) return 'Field';
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
  onSelectUnit,
  onRefreshUnits,
}: ServicesRequestsScreenProps) {
  const insets = useSafeAreaInsets();
  const toast = useAppToast();
  const [services, setServices] = useState<CommunityService[]>([]);
  const [requests, setRequests] = useState<ServiceRequestRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<PriorityOption>('MEDIUM');
  const [fieldTextDrafts, setFieldTextDrafts] = useState<Record<string, string>>({});
  const [fieldBoolDrafts, setFieldBoolDrafts] = useState<Record<string, boolean>>({});
  const [fieldFileDrafts, setFieldFileDrafts] = useState<Record<string, UploadedAttachment>>({});
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [uploadingFieldId, setUploadingFieldId] = useState<string | null>(null);
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
          throw new Error(`Field "${field.label}" expects a numeric value.`);
        }
        result.push({ fieldId: field.id, valueNumber });
      } else if (type === 'DATE') {
        const parsed = parseDateFieldInput(raw);
        if (!parsed) {
          throw new Error(`Field "${field.label}" expects a valid date (YYYY-MM-DD).`);
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

  const submitRequest = useCallback(async () => {
    if (!selectedUnitId) {
      setSubmitError('Select a unit first.');
      toast.error('Missing unit', 'Select a unit before submitting a request.');
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
    if (!description.trim()) {
      setSubmitError('Description is required.');
      toast.error('Missing description', 'Please provide request details.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);
    try {
      const payload: CreateServiceRequestInput = {
        serviceId: selectedService.id,
        unitId: selectedUnitId,
        description: description.trim(),
        priority,
        attachmentIds: attachments.map((a) => a.id),
        fieldValues: buildFieldValues(selectedService.formFields ?? []),
      };
      await createServiceRequest(session.accessToken, payload);
      setSuccessMessage(isRequestsMode ? 'Request submitted.' : 'Service request submitted.');
      toast.success(
        isRequestsMode ? 'Request submitted' : 'Service request submitted',
        'Your request was sent successfully.',
      );
      setDescription('');
      setAttachments([]);
      setFieldTextDrafts({});
      setFieldBoolDrafts({});
      setFieldFileDrafts({});
      await loadData('refresh');
    } catch (error) {
      const msg = extractApiErrorMessage(error);
      setSubmitError(msg);
      toast.error(isRequestsMode ? 'Request failed' : 'Service request failed', msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    buildFieldValues,
    description,
    loadData,
    priority,
    selectedService,
    selectedUnitId,
    session.accessToken,
    attachments,
    isRequestsMode,
    toast,
  ]);

  const uploadAttachment = useCallback(async () => {
    setIsUploadingAttachment(true);
    setSubmitError(null);
    try {
      const uploaded = await pickAndUploadServiceAttachment(session.accessToken);
      if (!uploaded) return;
      setAttachments((prev) => [...prev, uploaded]);
      toast.success('Attachment uploaded');
    } catch (error) {
      const msg = extractApiErrorMessage(error);
      setSubmitError(msg);
      toast.error('Attachment upload failed', msg);
    } finally {
      setIsUploadingAttachment(false);
    }
  }, [session.accessToken, toast]);

  const removeAttachment = useCallback((fileId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== fileId));
  }, []);

  const uploadDynamicFieldFile = useCallback(
    async (field: ServiceField) => {
      setSubmitError(null);
      setUploadingFieldId(field.id);
      try {
        const uploaded = await pickAndUploadServiceAttachment(session.accessToken);
        if (!uploaded) return;
        setFieldFile(field.id, uploaded);
        toast.success('Field file uploaded');
      } catch (error) {
        const msg = extractApiErrorMessage(error);
        setSubmitError(msg);
        toast.error('Field upload failed', msg);
      } finally {
        setUploadingFieldId((current) => (current === field.id ? null : current));
      }
    },
    [session.accessToken, setFieldFile, toast],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: Math.max(insets.top, 8) + 8, paddingBottom: 110 },
        ]}
      >
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>{isRequestsMode ? 'Requests' : 'Services'}</Text>
        <Text style={styles.headerSubtitle}>
          {isRequestsMode
            ? 'Permits and administrative requests for your unit'
            : 'Browse available services and submit requests for your unit'}
        </Text>
        <View style={styles.searchShell}>
          <Ionicons name="search-outline" size={18} color={akColors.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            placeholder={isRequestsMode ? 'Search request types...' : 'Search services...'}
            placeholderTextColor={akColors.textSoft}
          />
        </View>
      </View>

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
        {selectedUnit ? (
          <Text style={styles.helperText}>
            Requests will be created for unit {selectedUnit.unitNumber ?? selectedUnit.id}
          </Text>
        ) : null}
      </ScreenCard>

      <ScreenCard
        title={isRequestsMode ? 'Submit Request' : 'Create Service Request'}
        actionLabel={isRefreshing ? 'Refreshing...' : 'Reload'}
        onActionPress={() => void loadData('refresh')}
      >
        <InlineError message={loadError} />
        {/* submit/upload feedback is shown as toasts */}
        {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

        {isLoading ? (
          <ActivityIndicator color={akColors.primary} />
        ) : (
          <>
            <Text style={styles.label}>{isRequestsMode ? 'Request Type' : 'Service'}</Text>
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
                return (
                  <Pressable
                    key={service.id}
                    onPress={() => setSelectedServiceId(service.id)}
                    style={[styles.choiceChip, active && styles.choiceChipActive]}
                  >
                    <View style={styles.choiceChipTopRow}>
                      <View style={styles.choiceChipLead}>
                        <Ionicons
                          name={isRequestsMode ? 'file-tray-outline' : 'construct-outline'}
                          size={18}
                          color={active ? akColors.white : akColors.primary}
                          style={styles.choiceChipIcon}
                        />
                        <Text
                          style={[
                            styles.choiceChipCategoryText,
                            active && styles.choiceChipCategoryTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {serviceCategoryLabel(service.category)}
                        </Text>
                      </View>
                      <Ionicons
                        name={active ? 'checkmark-circle' : 'chevron-forward'}
                        size={16}
                        color={active ? akColors.white : akColors.textSoft}
                      />
                    </View>
                    <Text style={[styles.choiceChipTitle, active && styles.choiceChipTitleActive]} numberOfLines={2}>
                      {service.name}
                    </Text>
                    <Text style={[styles.choiceChipSub, active && styles.choiceChipSubActive]} numberOfLines={2}>
                      {service.description?.trim() || 'Tap to view details and submit a request.'}
                    </Text>
                    <Text style={[styles.choiceChipMeta, active && styles.choiceChipMetaActive]} numberOfLines={1}>
                      {eligibilityLabel(service.unitEligibility)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {selectedService ? (
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceInfoTitle}>{selectedService.name}</Text>
                <Text style={styles.serviceInfoBody}>
                  {selectedService.description || 'No description'}
                </Text>
                <Text style={styles.serviceInfoMeta}>
                  {eligibilityLabel(selectedService.unitEligibility)} • Starting price:{' '}
                  {formatCurrency(selectedService.startingPrice)}
                </Text>
              </View>
            ) : null}

            <Text style={styles.label}>Priority</Text>
            <View style={styles.priorityRow}>
              {PRIORITY_OPTIONS.map((value) => {
                const active = priority === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setPriority(value)}
                    style={[styles.priorityChip, active && styles.priorityChipActive]}
                  >
                    <Text style={[styles.priorityChipText, active && styles.priorityChipTextActive]}>
                      {priorityLabel(value)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              style={[styles.input, styles.multilineInput]}
              placeholder="Describe the issue / request details"
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.attachmentsHeader}>
              <Text style={styles.label}>Attachments (optional)</Text>
              <Pressable
                onPress={() => void uploadAttachment()}
                disabled={isUploadingAttachment}
                style={[styles.ghostButton, isUploadingAttachment && styles.buttonDisabled]}
              >
                <Text style={styles.ghostButtonText}>
                  {isUploadingAttachment ? 'Uploading...' : 'Upload File'}
                </Text>
              </Pressable>
            </View>
            {attachments.length > 0 ? (
              <View style={styles.attachmentsList}>
                {attachments.map((file) => (
                  <View key={file.id} style={styles.attachmentItem}>
                    <View style={styles.flex}>
                      <Text style={styles.attachmentName} numberOfLines={1}>
                        {file.name}
                      </Text>
                      <Text style={styles.attachmentMeta}>{file.id}</Text>
                    </View>
                    <Pressable onPress={() => removeAttachment(file.id)}>
                      <Text style={styles.removeAttachmentText}>Remove</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.dynamicHint}>No attachments uploaded yet.</Text>
            )}

            {(selectedService?.formFields?.length ?? 0) > 0 ? (
              <View style={styles.dynamicFieldsBlock}>
                <Text style={styles.dynamicFieldsTitle}>Dynamic Fields</Text>
                {(selectedService?.formFields ?? []).map((field) => (
                  <DynamicFieldInput
                    key={field.id}
                    field={field}
                    textValue={fieldTextDrafts[field.id] ?? ''}
                    boolValue={fieldBoolDrafts[field.id]}
                    fileValue={fieldFileDrafts[field.id] ?? null}
                    isUploadingFile={uploadingFieldId === field.id}
                    onTextChange={(value) => setFieldText(field.id, value)}
                    onBoolChange={(value) => setFieldBool(field.id, value)}
                    onUploadFile={() => void uploadDynamicFieldFile(field)}
                    onClearFile={() => setFieldFile(field.id, null)}
                  />
                ))}
                <Text style={styles.dynamicHint}>
                  Dynamic field values are validated by the backend service template.
                </Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
              onPress={() => void submitRequest()}
              disabled={isSubmitting}
            >
              <LinearGradient colors={[akColors.primary, akColors.primaryDark]} style={styles.primaryButtonInner}>
                {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : null}
                <Text style={styles.primaryButtonText}>
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </Text>
              </LinearGradient>
            </Pressable>
          </>
        )}
      </ScreenCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {isRequestsMode ? 'My Requests' : 'My Service Requests'}
        </Text>
        <Text style={styles.sectionCount}>{visibleRequests.length}</Text>
      </View>
      <ScreenCard>
        {visibleRequests.length === 0 ? (
          <Text style={styles.emptyText}>No service requests yet for the selected unit.</Text>
        ) : (
          visibleRequests.map((row) => (
            <View key={row.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View style={styles.flex}>
                  <Text style={styles.itemTitle}>{row.service?.name ?? 'Service Request'}</Text>
                  <Text style={styles.itemSub}>
                    {priorityLabel(row.priority)} • {statusLabel(row.status)}
                  </Text>
                </View>
                <Text style={styles.itemMetaDate}>{formatDateTime(row.requestedAt)}</Text>
              </View>
              <Text style={styles.itemDesc}>{row.description ?? '—'}</Text>
              <Text style={styles.itemSub}>Updated: {formatDateTime(row.updatedAt)}</Text>
            </View>
          ))
        )}
      </ScreenCard>
      </ScrollView>
    </SafeAreaView>
  );
}

type DynamicFieldInputProps = {
  field: ServiceField;
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
          trackColor={{ false: '#CBD5E1', true: 'rgba(42,62,53,0.25)' }}
          thumbColor={Boolean(boolValue) ? akColors.primary : '#F8FAFC'}
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
            <Text style={styles.ghostButtonText}>
              {isUploadingFile ? 'Uploading...' : fileValue ? 'Replace File' : 'Upload File'}
            </Text>
          </Pressable>
        </View>

        {fileValue ? (
          <View style={styles.attachmentItem}>
            <View style={styles.flex}>
              <Text style={styles.attachmentName} numberOfLines={1}>
                {fileValue.name}
              </Text>
              <Text style={styles.attachmentMeta}>{fileValue.id}</Text>
            </View>
            <Pressable onPress={onClearFile}>
              <Text style={styles.removeAttachmentText}>Remove</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.dynamicHint}>Upload a file to populate this field.</Text>
        )}

        <TextInput
          value={textValue}
          onChangeText={onTextChange}
          style={styles.input}
          placeholder="Optional: paste file ID manually"
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.dynamicMeta}>Stored value (file ID)</Text>
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
            <Text style={styles.ghostButtonText}>Pick Date</Text>
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
            <Text style={styles.ghostButtonText}>Done</Text>
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
          ? 'Select a household member (name or ID).'
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
      return 'File UUID (upload flow next)';
    default:
      return 'Enter value';
  }
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
    gap: 10,
    ...akShadow.soft,
  },
  headerTitle: {
    color: akColors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: akColors.textMuted,
    fontSize: 13,
  },
  searchShell: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  heroBadge: {
    color: '#93C5FD',
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
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
  },
  helperText: {
    color: akColors.textMuted,
    fontSize: 12,
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
    gap: 10,
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
  choiceChip: {
    width: '48%',
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    borderRadius: 18,
    padding: 14,
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.9)',
    minHeight: 126,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  choiceChipActive: {
    backgroundColor: 'rgba(42,62,53,0.92)',
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: akColors.primaryDark,
    shadowOpacity: 0.18,
    elevation: 4,
  },
  choiceChipTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  choiceChipLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
    minWidth: 0,
  },
  choiceChipIcon: {
    opacity: 0.95,
  },
  choiceChipCategoryText: {
    color: akColors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  choiceChipCategoryTextActive: {
    color: 'rgba(255,255,255,0.82)',
  },
  choiceChipTitle: {
    color: akColors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  choiceChipTitleActive: {
    color: '#fff',
  },
  choiceChipMeta: {
    color: akColors.textMuted,
    fontSize: 10,
    lineHeight: 14,
  },
  choiceChipMetaActive: {
    color: akColors.text,
  },
  choiceChipSub: {
    color: akColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  choiceChipSubActive: {
    color: 'rgba(255,255,255,0.76)',
  },
  serviceInfo: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 12,
    backgroundColor: akColors.surfaceMuted,
    padding: 10,
    gap: 4,
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
    flexDirection: 'row',
    alignItems: 'center',
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
    color: '#B91C1C',
    fontSize: 11,
    fontWeight: '700',
  },
  dynamicFieldsBlock: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 14,
    backgroundColor: akColors.surfaceMuted,
    padding: 10,
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
    textTransform: 'uppercase',
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
    color: '#FFFFFF',
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
    borderColor: akColors.border,
    borderRadius: 14,
    padding: 12,
    gap: 5,
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
});
