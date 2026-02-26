import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppToast } from '../components/mobile/AppToast';
import { UnitPicker } from '../components/mobile/UnitPicker';
import type { AuthSession } from '../features/auth/types';
import {
  addFamilyMember,
  createContractor,
  createDelegateRequestByContact,
  createWorker,
  generateWorkerQr,
  listContractors,
  listDelegatesForUnit,
  listFamilyMembers,
  listWorkers,
  removeFamilyMemberFromUnit,
  revokeDelegate,
  updateDelegateAccess,
  updateFamilyMemberProfile,
} from '../features/community/service';
import type {
  AddFamilyMemberInput,
  ContractorRow,
  CreateDelegateByContactInput,
  DelegateAccessRow,
  FamilyAccessRow,
  ResidentUnit,
  UpdateDelegateAccessInput,
  UpdateFamilyMemberInput,
  WorkerRow,
} from '../features/community/types';
import { pickAndUploadFileByPurpose } from '../features/files/service';
import { extractApiErrorMessage } from '../lib/http';
import { akColors, akRadius, akShadow } from '../theme/alkarma';
import { formatDateTime } from '../utils/format';

type HouseholdHubScreenProps = {
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

type SectionKey = 'family' | 'delegates' | 'staff';

function householdLabel(value?: string | null): string {
  return String(value ?? '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function HouseholdHubScreen({
  session,
  units,
  selectedUnitId,
  selectedUnit,
  unitsLoading,
  unitsRefreshing,
  unitsErrorMessage,
  onSelectUnit,
  onRefreshUnits,
}: HouseholdHubScreenProps) {
  const insets = useSafeAreaInsets();
  const toast = useAppToast();
  const [section, setSection] = useState<SectionKey>('family');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [familyRows, setFamilyRows] = useState<FamilyAccessRow[]>([]);
  const [delegateRows, setDelegateRows] = useState<DelegateAccessRow[]>([]);
  const [contractorRows, setContractorRows] = useState<ContractorRow[]>([]);
  const [workerRows, setWorkerRows] = useState<WorkerRow[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [contractorName, setContractorName] = useState('');
  const [workerForm, setWorkerForm] = useState({
    contractorId: '',
    fullName: '',
    nationalId: '',
    phone: '',
    jobType: '',
  });
  const [workerQrResult, setWorkerQrResult] = useState<string | null>(null);
  const [editingFamilyUserId, setEditingFamilyUserId] = useState<string | null>(null);
  const [editingDelegateAccessId, setEditingDelegateAccessId] = useState<string | null>(null);
  const [familyForm, setFamilyForm] = useState<{
    relationship: AddFamilyMemberInput['relationship'];
    name: string;
    email: string;
    phone: string;
    personalPhotoId: string;
    nationalId: string;
    nationalIdFileId: string;
    birthDate: string;
    birthCertificateFileId: string;
    marriageCertificateFileId: string;
  }>({
    relationship: 'CHILD',
    name: '',
    email: '',
    phone: '',
    personalPhotoId: '',
    nationalId: '',
    nationalIdFileId: '',
    birthDate: '',
    birthCertificateFileId: '',
    marriageCertificateFileId: '',
  });
  const [delegateForm, setDelegateForm] = useState<{
    type: CreateDelegateByContactInput['type'];
    name: string;
    email: string;
    phone: string;
    idFileId: string;
    canViewFinancials: boolean;
    canReceiveBilling: boolean;
    canBookFacilities: boolean;
    canGenerateQR: boolean;
    canManageWorkers: boolean;
  }>({
    type: 'FRIEND',
    name: '',
    email: '',
    phone: '',
    idFileId: '',
    canViewFinancials: true,
    canReceiveBilling: false,
    canBookFacilities: true,
    canGenerateQR: true,
    canManageWorkers: true,
  });

  const selectedUnitAccesses = selectedUnit?.unitAccesses ?? [];
  const canManageWorkers = useMemo(
    () => selectedUnitAccesses.some((a) => a.canManageWorkers),
    [selectedUnitAccesses],
  );
  const canGenerateWorkerQr = useMemo(
    () => selectedUnitAccesses.some((a) => a.canManageWorkers && a.canGenerateQR),
    [selectedUnitAccesses],
  );
  const canManageFamily = useMemo(() => {
    const roles = new Set(
      selectedUnitAccesses.map((a) => String(a.role ?? '').toUpperCase()).filter(Boolean),
    );
    return roles.has('OWNER') || roles.has('TENANT');
  }, [selectedUnitAccesses]);
  const canCreateDelegates = useMemo(() => {
    const roles = new Set(
      selectedUnitAccesses.map((a) => String(a.role ?? '').toUpperCase()).filter(Boolean),
    );
    return roles.has('OWNER');
  }, [selectedUnitAccesses]);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!selectedUnitId) {
        setFamilyRows([]);
        setDelegateRows([]);
        setContractorRows([]);
        setWorkerRows([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }
      if (mode === 'initial') setIsLoading(true);
      else setIsRefreshing(true);
      setErrorMessage(null);
      setWorkerQrResult(null);

      const results = await Promise.allSettled([
        listFamilyMembers(session.accessToken, selectedUnitId),
        listDelegatesForUnit(session.accessToken, selectedUnitId),
        listContractors(session.accessToken, selectedUnitId),
        listWorkers(session.accessToken, selectedUnitId),
      ]);

      const firstError = results.find((r) => r.status === 'rejected') as
        | PromiseRejectedResult
        | undefined;
      if (firstError) {
        setErrorMessage(extractApiErrorMessage(firstError.reason));
      }

      setFamilyRows(results[0].status === 'fulfilled' ? results[0].value : []);
      setDelegateRows(results[1].status === 'fulfilled' ? results[1].value : []);
      setContractorRows(results[2].status === 'fulfilled' ? results[2].value : []);
      setWorkerRows(results[3].status === 'fulfilled' ? results[3].value : []);

      setIsLoading(false);
      setIsRefreshing(false);
    },
    [selectedUnitId, session.accessToken],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  useEffect(() => {
    setWorkerForm((prev) => ({
      ...prev,
      contractorId: prev.contractorId && contractorRows.some((c) => c.id === prev.contractorId)
        ? prev.contractorId
        : (contractorRows[0]?.id ?? ''),
    }));
  }, [contractorRows]);

  const resetFamilyForm = () => {
    setEditingFamilyUserId(null);
    setFamilyForm({
      relationship: 'CHILD',
      name: '',
      email: '',
      phone: '',
      personalPhotoId: '',
      nationalId: '',
      nationalIdFileId: '',
      birthDate: '',
      birthCertificateFileId: '',
      marriageCertificateFileId: '',
    });
  };

  const resetDelegateForm = () => {
    setEditingDelegateAccessId(null);
    setDelegateForm({
      type: 'FRIEND',
      name: '',
      email: '',
      phone: '',
      idFileId: '',
      canViewFinancials: true,
      canReceiveBilling: false,
      canBookFacilities: true,
      canGenerateQR: true,
      canManageWorkers: true,
    });
  };

  const beginEditFamily = (row: FamilyAccessRow) => {
    setEditingFamilyUserId(row.userId ?? null);
    setFamilyForm((prev) => ({
      ...prev,
      relationship:
        (String(row.user?.resident?.relationship ?? '').toUpperCase() as AddFamilyMemberInput['relationship']) ||
        prev.relationship,
      name: row.user?.nameEN || row.user?.nameAR || '',
      email: row.user?.email ?? '',
      phone: row.user?.phone ?? '',
      personalPhotoId: '',
      nationalId: row.user?.resident?.nationalId ?? '',
      nationalIdFileId: '',
      birthDate: '',
      birthCertificateFileId: '',
      marriageCertificateFileId: '',
    }));
    setSection('family');
  };

  const beginEditDelegate = (row: DelegateAccessRow) => {
    setEditingDelegateAccessId(row.id);
    setDelegateForm({
      type:
        (String(row.delegateType ?? '').toUpperCase() as CreateDelegateByContactInput['type']) ||
        'FRIEND',
      name: row.user?.nameEN || row.user?.nameAR || '',
      email: row.user?.email ?? '',
      phone: row.user?.phone ?? '',
      idFileId: '',
      canViewFinancials: Boolean(row.canViewFinancials),
      canReceiveBilling: Boolean(row.canReceiveBilling),
      canBookFacilities: row.canBookFacilities !== false,
      canGenerateQR: Boolean(row.canGenerateQR),
      canManageWorkers: Boolean(row.canManageWorkers),
    });
    setSection('delegates');
  };

  const handleRemoveFamily = async (userId?: string) => {
    if (!selectedUnitId || !userId) return;
    setBusyKey(`family-remove-${userId}`);
    try {
      await removeFamilyMemberFromUnit(session.accessToken, selectedUnitId, userId);
      toast.success('Family member removed', 'The family member was removed from this unit.');
      await load('refresh');
    } catch (error) {
      const msg = extractApiErrorMessage(error);
      setErrorMessage(msg);
      toast.error('Failed to remove family member', msg);
    } finally {
      setBusyKey(null);
    }
  };

  const handleRevokeDelegate = async (delegateId: string) => {
    setBusyKey(`delegate-revoke-${delegateId}`);
    try {
      await revokeDelegate(session.accessToken, delegateId);
      toast.success('Authorized access revoked', 'Delegate access was revoked successfully.');
      await load('refresh');
    } catch (error) {
      const msg = extractApiErrorMessage(error);
      setErrorMessage(msg);
      toast.error('Failed to revoke delegate', msg);
    } finally {
      setBusyKey(null);
    }
  };

  const handleCreateContractor = async () => {
    if (!selectedUnitId) return;
    const name = contractorName.trim();
    if (!name) {
      setErrorMessage('Contractor name is required');
      toast.error('Missing contractor name', 'Contractor company name is required.');
      return;
    }
    setBusyKey('contractor-create');
    try {
      await createContractor(session.accessToken, { unitId: selectedUnitId, name });
      setContractorName('');
      await load('refresh');
      setSection('delegates');
      toast.success('Contractor created', 'Contractor was added successfully.');
    } catch (error) {
      const msg = extractApiErrorMessage(error);
      setErrorMessage(msg);
      toast.error('Failed to create contractor', msg);
    } finally {
      setBusyKey(null);
    }
  };

  const handleCreateWorker = async () => {
    if (!selectedUnitId) return;
    if (!workerForm.contractorId || !workerForm.fullName.trim() || !workerForm.nationalId.trim()) {
      setErrorMessage('Contractor, worker name and national ID are required');
      toast.error('Missing worker fields', 'Contractor, worker name and national ID are required.');
      return;
    }
    setBusyKey('worker-create');
    try {
      await createWorker(session.accessToken, {
        unitId: selectedUnitId,
        contractorId: workerForm.contractorId,
        fullName: workerForm.fullName.trim(),
        nationalId: workerForm.nationalId.trim(),
        phone: workerForm.phone.trim() || undefined,
        jobType: workerForm.jobType.trim() || undefined,
      });
      setWorkerForm((prev) => ({
        ...prev,
        fullName: '',
        nationalId: '',
        phone: '',
        jobType: '',
      }));
      await load('refresh');
      toast.success('Worker created', 'Worker was added successfully.');
    } catch (error) {
      const msg = extractApiErrorMessage(error);
      setErrorMessage(msg);
      toast.error('Failed to create worker', msg);
    } finally {
      setBusyKey(null);
    }
  };

  const handleGenerateWorkerQr = async (workerId: string, workerName?: string) => {
    setBusyKey(`worker-qr-${workerId}`);
    setWorkerQrResult(null);
    try {
      const result = await generateWorkerQr(session.accessToken, workerId, {
        notes: workerName ? `Household worker access for ${workerName}` : undefined,
      });
      const qrId = result.qrCode?.qrId || result.qrCode?.id || 'Generated';
      setWorkerQrResult(`Worker QR created: ${qrId}`);
      toast.success('Worker QR created', qrId);
      await load('refresh');
    } catch (error) {
      const msg = extractApiErrorMessage(error);
      setErrorMessage(msg);
      toast.error('Failed to generate worker QR', msg);
    } finally {
      setBusyKey(null);
    }
  };

  const hasUnit = Boolean(selectedUnitId);
  const familyRelationship = familyForm.relationship;
  const familyNeedsBirthDate = familyRelationship === 'CHILD';
  const familyNeedsMarriageCert = familyRelationship === 'SPOUSE';
  const familyNeedsNationalIdFile = familyRelationship === 'PARENT' || familyRelationship === 'CHILD';

  const handleUploadFamilyFile = async (
    purpose:
      | 'profile-photo'
      | 'national-id'
      | 'birth-certificate'
      | 'marriage-certificate',
    field:
      | 'personalPhotoId'
      | 'nationalIdFileId'
      | 'birthCertificateFileId'
      | 'marriageCertificateFileId',
  ) => {
    setBusyKey(`upload-${field}`);
    try {
      const uploaded = await pickAndUploadFileByPurpose(session.accessToken, purpose);
      if (!uploaded) return;
      setFamilyForm((prev) => ({ ...prev, [field]: uploaded.id }));
      toast.success('Document uploaded');
    } catch (error) {
      const msg = extractApiErrorMessage(error);
      setErrorMessage(msg);
      toast.error('Upload failed', msg);
    } finally {
      setBusyKey(null);
    }
  };

  const handleUploadDelegateId = async () => {
    setBusyKey('upload-delegate-id');
    try {
      const uploaded = await pickAndUploadFileByPurpose(session.accessToken, 'delegate-id');
      if (!uploaded) return;
      setDelegateForm((prev) => ({ ...prev, idFileId: uploaded.id }));
      toast.success('Delegate ID uploaded');
    } catch (error) {
      const msg = extractApiErrorMessage(error);
      setErrorMessage(msg);
      toast.error('Upload failed', msg);
    } finally {
      setBusyKey(null);
    }
  };

  const handleAddFamily = async () => {
    if (!selectedUnitId) return;
    if (!familyForm.name.trim()) {
      setErrorMessage('Family member name is required');
      toast.error('Missing family member name', 'Family member name is required.');
      return;
    }
    const isEditing = Boolean(editingFamilyUserId);
    if (!isEditing && (!familyForm.phone.trim() || !familyForm.personalPhotoId.trim())) {
      setErrorMessage('Family member name, phone and personal photo are required');
      toast.error(
        'Missing family member fields',
        'Name, phone and personal photo are required for a new family member.',
      );
      return;
    }
    if (!isEditing && familyNeedsNationalIdFile && !familyForm.nationalIdFileId.trim()) {
      setErrorMessage('National ID file is required for this relationship');
      toast.error('Missing document', 'National ID file is required for this relationship.');
      return;
    }
    if (!isEditing && familyNeedsBirthDate && !familyForm.birthDate.trim()) {
      setErrorMessage('Birth date is required for child family member');
      toast.error('Missing birth date', 'Birth date is required for child family member.');
      return;
    }
    if (!isEditing && familyNeedsMarriageCert && !familyForm.marriageCertificateFileId.trim()) {
      setErrorMessage('Marriage certificate file is required for spouse');
      toast.error('Missing document', 'Marriage certificate is required for spouse.');
      return;
    }
    setBusyKey('family-add');
    try {
      if (isEditing && editingFamilyUserId) {
        const updatePayload: UpdateFamilyMemberInput = {
          nameEN: familyForm.name.trim() || undefined,
          email: familyForm.email.trim() || undefined,
          phone: familyForm.phone.trim() || undefined,
          nationalId: familyForm.nationalId.trim() || undefined,
          profilePhotoId: familyForm.personalPhotoId.trim() || undefined,
          relationship: familyForm.relationship,
        };
        await updateFamilyMemberProfile(
          session.accessToken,
          editingFamilyUserId,
          updatePayload,
        );
      } else {
        const payload: AddFamilyMemberInput = {
          relationship: familyForm.relationship,
          name: familyForm.name.trim(),
          email: familyForm.email.trim() || undefined,
          phone: familyForm.phone.trim(),
          personalPhotoId: familyForm.personalPhotoId.trim(),
          nationalId: familyForm.nationalId.trim() || undefined,
          nationalIdFileId: familyForm.nationalIdFileId.trim() || undefined,
          birthDate: familyForm.birthDate.trim() || undefined,
          birthCertificateFileId: familyForm.birthCertificateFileId.trim() || undefined,
          marriageCertificateFileId: familyForm.marriageCertificateFileId.trim() || undefined,
        };
        await addFamilyMember(session.accessToken, selectedUnitId, payload);
      }
      resetFamilyForm();
      toast.success(
        isEditing ? 'Family member updated' : 'Family member added',
        isEditing
          ? 'Family member details were updated successfully.'
          : 'Family member was added to this unit successfully.',
      );
      await load('refresh');
    } catch (error) {
      const msg = extractApiErrorMessage(error);
      setErrorMessage(msg);
      toast.error(isEditing ? 'Update failed' : 'Add family member failed', msg);
    } finally {
      setBusyKey(null);
    }
  };

  const handleCreateDelegate = async () => {
    if (!selectedUnitId) return;
    const isEditing = Boolean(editingDelegateAccessId);
    if (
      !delegateForm.name.trim() ||
      !delegateForm.email.trim() ||
      !delegateForm.phone.trim() ||
      (!isEditing && !delegateForm.idFileId.trim())
    ) {
      setErrorMessage('Delegate name, email, phone and ID file are required');
      toast.error(
        'Missing delegate fields',
        'Delegate name, email, phone and ID file are required.',
      );
      return;
    }
    setBusyKey('delegate-create');
    try {
      if (isEditing && editingDelegateAccessId) {
        const updatePayload: UpdateDelegateAccessInput = {
          type: delegateForm.type,
          canViewFinancials: delegateForm.canViewFinancials,
          canReceiveBilling: delegateForm.canReceiveBilling,
          canBookFacilities: delegateForm.canBookFacilities,
          canGenerateQR: delegateForm.canGenerateQR,
          canManageWorkers: delegateForm.canManageWorkers,
        };
        await updateDelegateAccess(
          session.accessToken,
          editingDelegateAccessId,
          updatePayload,
        );
      } else {
        await createDelegateRequestByContact(session.accessToken, {
          unitId: selectedUnitId,
          type: delegateForm.type,
          idFileId: delegateForm.idFileId.trim(),
          name: delegateForm.name.trim(),
          email: delegateForm.email.trim(),
          phone: delegateForm.phone.trim(),
          canViewFinancials: delegateForm.canViewFinancials,
          canReceiveBilling: delegateForm.canReceiveBilling,
          canBookFacilities: delegateForm.canBookFacilities,
          canGenerateQR: delegateForm.canGenerateQR,
          canManageWorkers: delegateForm.canManageWorkers,
        });
      }
      resetDelegateForm();
      await load('refresh');
      setSection('delegates');
      toast.success(
        isEditing ? 'Authorized user updated' : 'Authorized request submitted',
        isEditing
          ? 'Delegate permissions were updated successfully.'
          : 'Delegate request was submitted successfully.',
      );
    } catch (error) {
      const msg = extractApiErrorMessage(error);
      setErrorMessage(msg);
      toast.error(isEditing ? 'Delegate update failed' : 'Delegate request failed', msg);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 8) + 6, paddingBottom: 112 },
        ]}
      >
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="people-outline" size={20} color={akColors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Manage Household</Text>
              <Text style={styles.headerSubtitle}>
                Family members, delegates, contractors and workers per unit
              </Text>
            </View>
            <Pressable onPress={() => void load('refresh')}>
              <Text style={styles.linkText}>{isRefreshing ? 'Refreshing...' : 'Refresh'}</Text>
            </Pressable>
          </View>

          <UnitPicker
            units={units}
            selectedUnitId={selectedUnitId}
            onSelect={onSelectUnit}
            onRefresh={() => void onRefreshUnits()}
            isRefreshing={unitsRefreshing}
            title="Household Unit"
          />

          {selectedUnit ? (
            <Text style={styles.helperText}>
              {selectedUnit.unitNumber ?? selectedUnit.id}
              {selectedUnit.block ? ` • Block ${selectedUnit.block}` : ''}
              {selectedUnit.status ? ` • ${String(selectedUnit.status).replace(/_/g, ' ')}` : ''}
            </Text>
          ) : null}
          {unitsLoading ? <ActivityIndicator color={akColors.primary} /> : null}
          {unitsErrorMessage ? <Text style={styles.errorText}>{unitsErrorMessage}</Text> : null}
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          {workerQrResult ? <Text style={styles.successText}>{workerQrResult}</Text> : null}
        </View>

        <View style={styles.segmentRow}>
          {([
            ['family', 'Family'],
            ['delegates', 'Authorized'],
            ['staff', 'Staff'],
          ] as const).map(([key, label]) => {
            const active = section === key;
            return (
              <Pressable
                key={key}
                onPress={() => setSection(key)}
                style={[styles.segmentChip, active && styles.segmentChipActive]}
              >
                <Text style={[styles.segmentChipText, active && styles.segmentChipTextActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {!hasUnit ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>Select a unit to manage household members.</Text>
          </View>
        ) : null}

        {isLoading ? <ActivityIndicator color={akColors.primary} /> : null}

        {hasUnit && !isLoading && section === 'family' ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Family Members</Text>
              <Text style={styles.cardSub}>
                {canManageFamily
                  ? 'List and remove family members linked to this unit.'
                  : 'Family management is available for owner/tenant authority on the selected unit.'}
              </Text>
              {!canManageFamily ? (
                <View style={styles.noticeBox}>
                  <Text style={styles.noticeText}>
                    Current account cannot manage family members for this unit.
                  </Text>
                </View>
              ) : null}
            </View>

            {canManageFamily ? (
              <View style={styles.card}>
                <View style={styles.formHeaderRow}>
                  <Text style={styles.formTitle}>
                    {editingFamilyUserId ? 'Edit Family Member' : 'Add Family Member'}
                  </Text>
                  {editingFamilyUserId ? (
                    <Pressable onPress={resetFamilyForm}>
                      <Text style={styles.linkText}>Cancel Edit</Text>
                    </Pressable>
                  ) : null}
                </View>

                <Text style={styles.fieldLabel}>Relationship</Text>
                <View style={styles.optionRow}>
                  {(['CHILD', 'PARENT', 'SPOUSE'] as const).map((rel) => {
                    const active = familyForm.relationship === rel;
                    return (
                      <Pressable
                        key={rel}
                        onPress={() => setFamilyForm((p) => ({ ...p, relationship: rel }))}
                        style={[styles.choiceChip, active && styles.choiceChipActive]}
                      >
                        <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>
                          {rel}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Full name"
                  value={familyForm.name}
                  onChangeText={(v) => setFamilyForm((p) => ({ ...p, name: v }))}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Email (optional)"
                  value={familyForm.email}
                  onChangeText={(v) => setFamilyForm((p) => ({ ...p, email: v }))}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Phone"
                  value={familyForm.phone}
                  onChangeText={(v) => setFamilyForm((p) => ({ ...p, phone: v }))}
                  keyboardType="phone-pad"
                />

                <View style={styles.uploadRow}>
                  <Pressable
                    style={[styles.secondaryButton, busyKey === 'upload-personalPhotoId' && styles.buttonDisabled]}
                    onPress={() => void handleUploadFamilyFile('profile-photo', 'personalPhotoId')}
                    disabled={busyKey === 'upload-personalPhotoId'}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {busyKey === 'upload-personalPhotoId' ? 'Uploading...' : 'Upload Personal Photo'}
                    </Text>
                  </Pressable>
                  <Text style={styles.uploadIdText} numberOfLines={1}>
                    {familyForm.personalPhotoId || 'No file uploaded'}
                  </Text>
                </View>

                {(familyNeedsNationalIdFile || familyForm.nationalId || familyForm.nationalIdFileId) ? (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder="National ID (if applicable)"
                      value={familyForm.nationalId}
                      onChangeText={(v) => setFamilyForm((p) => ({ ...p, nationalId: v }))}
                    />
                    <View style={styles.uploadRow}>
                      <Pressable
                        style={[styles.secondaryButton, busyKey === 'upload-nationalIdFileId' && styles.buttonDisabled]}
                        onPress={() => void handleUploadFamilyFile('national-id', 'nationalIdFileId')}
                        disabled={busyKey === 'upload-nationalIdFileId'}
                      >
                        <Text style={styles.secondaryButtonText}>
                          {busyKey === 'upload-nationalIdFileId' ? 'Uploading...' : 'Upload National ID File'}
                        </Text>
                      </Pressable>
                      <Text style={styles.uploadIdText} numberOfLines={1}>
                        {familyForm.nationalIdFileId || 'No file uploaded'}
                      </Text>
                    </View>
                  </>
                ) : null}

                {familyNeedsBirthDate ? (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder="Birth Date (YYYY-MM-DD)"
                      value={familyForm.birthDate}
                      onChangeText={(v) => setFamilyForm((p) => ({ ...p, birthDate: v }))}
                      autoCapitalize="none"
                    />
                    <View style={styles.uploadRow}>
                      <Pressable
                        style={[styles.secondaryButton, busyKey === 'upload-birthCertificateFileId' && styles.buttonDisabled]}
                        onPress={() => void handleUploadFamilyFile('birth-certificate', 'birthCertificateFileId')}
                        disabled={busyKey === 'upload-birthCertificateFileId'}
                      >
                        <Text style={styles.secondaryButtonText}>
                          {busyKey === 'upload-birthCertificateFileId' ? 'Uploading...' : 'Upload Birth Certificate'}
                        </Text>
                      </Pressable>
                      <Text style={styles.uploadIdText} numberOfLines={1}>
                        {familyForm.birthCertificateFileId || 'Optional unless child <16'}
                      </Text>
                    </View>
                  </>
                ) : null}

                {familyNeedsMarriageCert ? (
                  <View style={styles.uploadRow}>
                    <Pressable
                      style={[styles.secondaryButton, busyKey === 'upload-marriageCertificateFileId' && styles.buttonDisabled]}
                      onPress={() => void handleUploadFamilyFile('marriage-certificate', 'marriageCertificateFileId')}
                      disabled={busyKey === 'upload-marriageCertificateFileId'}
                    >
                      <Text style={styles.secondaryButtonText}>
                        {busyKey === 'upload-marriageCertificateFileId' ? 'Uploading...' : 'Upload Marriage Certificate'}
                      </Text>
                    </Pressable>
                    <Text style={styles.uploadIdText} numberOfLines={1}>
                      {familyForm.marriageCertificateFileId || 'No file uploaded'}
                    </Text>
                  </View>
                ) : null}

                <Pressable
                  style={[styles.primaryButton, busyKey === 'family-add' && styles.buttonDisabled]}
                  onPress={() => void handleAddFamily()}
                  disabled={busyKey === 'family-add'}
                >
                  <Text style={styles.primaryButtonText}>
                    {busyKey === 'family-add'
                      ? editingFamilyUserId
                        ? 'Saving...'
                        : 'Adding...'
                      : editingFamilyUserId
                        ? 'Save Changes'
                        : 'Add Family Member'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.listWrap}>
              {familyRows.length === 0 ? (
                <Text style={styles.emptyText}>No active family members for this unit.</Text>
              ) : (
                familyRows.map((row) => {
                  const name = row.user?.nameEN || row.user?.nameAR || row.user?.email || row.userId || row.id;
                  const relation = row.user?.resident?.relationship;
                  return (
                    <View key={row.id} style={styles.rowCard}>
                      <View style={styles.rowHeader}>
                        <Text style={styles.rowTitle}>{String(name)}</Text>
                        <View style={styles.statusPill}>
                          <Text style={styles.statusPillText}>{householdLabel(row.status || 'ACTIVE')}</Text>
                        </View>
                      </View>
                      <Text style={styles.rowSub}>
                        {relation ? `Relation: ${householdLabel(relation)}` : 'Family access'}
                        {row.user?.phone ? ` • ${row.user.phone}` : ''}
                      </Text>
                      <View style={styles.rowActions}>
                        <Pressable
                          disabled={!canManageFamily}
                          style={[
                            styles.actionButton,
                            !canManageFamily && styles.buttonDisabled,
                          ]}
                          onPress={() => beginEditFamily(row)}
                        >
                          <Text style={styles.actionButtonText}>Edit</Text>
                        </Pressable>
                        <Pressable
                          disabled={!canManageFamily || busyKey === `family-remove-${row.userId}`}
                          style={[
                            styles.actionButtonDanger,
                            (!canManageFamily || busyKey === `family-remove-${row.userId}`) &&
                              styles.buttonDisabled,
                          ]}
                          onPress={() => void handleRemoveFamily(row.userId)}
                        >
                          <Text style={styles.actionButtonDangerText}>
                            {busyKey === `family-remove-${row.userId}` ? 'Removing...' : 'Remove from Unit'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </>
        ) : null}

        {hasUnit && !isLoading && section === 'delegates' ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Authorized Users (Delegates)</Text>
              <Text style={styles.cardSub}>
                List and revoke delegates for this unit. Create by contact will create an invited user if needed.
              </Text>
            </View>
            {canCreateDelegates ? (
              <View style={styles.card}>
                <View style={styles.formHeaderRow}>
                  <Text style={styles.formTitle}>
                    {editingDelegateAccessId ? 'Edit Authorized User' : 'Add Authorized User'}
                  </Text>
                  {editingDelegateAccessId ? (
                    <Pressable onPress={resetDelegateForm}>
                      <Text style={styles.linkText}>Cancel Edit</Text>
                    </Pressable>
                  ) : null}
                </View>

                <Text style={styles.fieldLabel}>Delegate Type</Text>
                <View style={styles.optionRow}>
                  {(['FRIEND', 'FAMILY', 'INTERIOR_DESIGNER'] as const).map((type) => {
                    const active = delegateForm.type === type;
                    return (
                      <Pressable
                        key={type}
                        onPress={() => setDelegateForm((p) => ({ ...p, type }))}
                        style={[styles.choiceChip, active && styles.choiceChipActive]}
                      >
                        <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>
                          {type}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Full name"
                  value={delegateForm.name}
                  onChangeText={(v) => setDelegateForm((p) => ({ ...p, name: v }))}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  value={delegateForm.email}
                  onChangeText={(v) => setDelegateForm((p) => ({ ...p, email: v }))}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Phone"
                  value={delegateForm.phone}
                  onChangeText={(v) => setDelegateForm((p) => ({ ...p, phone: v }))}
                  keyboardType="phone-pad"
                />

                {!editingDelegateAccessId ? (
                  <View style={styles.uploadRow}>
                    <Pressable
                      style={[styles.secondaryButton, busyKey === 'upload-delegate-id' && styles.buttonDisabled]}
                      onPress={() => void handleUploadDelegateId()}
                      disabled={busyKey === 'upload-delegate-id'}
                    >
                      <Text style={styles.secondaryButtonText}>
                        {busyKey === 'upload-delegate-id' ? 'Uploading...' : 'Upload Delegate ID'}
                      </Text>
                    </Pressable>
                    <Text style={styles.uploadIdText} numberOfLines={1}>
                      {delegateForm.idFileId || 'No ID file uploaded'}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.helperText}>
                    Updating permissions/details only. ID document changes require a new request.
                  </Text>
                )}

                <Text style={styles.fieldLabel}>Permissions</Text>
                <View style={styles.optionRow}>
                  {([
                    ['canViewFinancials', 'View Billing'],
                    ['canReceiveBilling', 'Receive Bills'],
                    ['canBookFacilities', 'Book Facilities'],
                    ['canGenerateQR', 'Generate QR'],
                    ['canManageWorkers', 'Manage Workers'],
                  ] as const).map(([key, label]) => {
                    const active = delegateForm[key];
                    return (
                      <Pressable
                        key={key}
                        onPress={() =>
                          setDelegateForm((p) => ({ ...p, [key]: !p[key] }))
                        }
                        style={[styles.choiceChip, active && styles.choiceChipActive]}
                      >
                        <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  style={[styles.primaryButton, busyKey === 'delegate-create' && styles.buttonDisabled]}
                  onPress={() => void handleCreateDelegate()}
                  disabled={busyKey === 'delegate-create'}
                >
                  <Text style={styles.primaryButtonText}>
                    {busyKey === 'delegate-create'
                      ? editingDelegateAccessId
                        ? 'Saving...'
                        : 'Submitting...'
                      : editingDelegateAccessId
                        ? 'Save Delegate Changes'
                        : 'Submit Delegate Request'}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>
                  Only owners can submit new authorized user requests for the selected unit.
                </Text>
              </View>
            )}
            <View style={styles.listWrap}>
              {delegateRows.length === 0 ? (
                <Text style={styles.emptyText}>No delegates found for this unit.</Text>
              ) : (
                delegateRows.map((row) => {
                  const name = row.user?.nameEN || row.user?.nameAR || row.user?.email || row.userId || row.id;
                  return (
                    <View key={row.id} style={styles.rowCard}>
                      <View style={styles.rowHeader}>
                        <Text style={styles.rowTitle}>{String(name)}</Text>
                        <View style={styles.statusPill}>
                          <Text style={styles.statusPillText}>{householdLabel(row.status || 'UNKNOWN')}</Text>
                        </View>
                      </View>
                      <Text style={styles.rowSub}>
                        {row.delegateType ? householdLabel(row.delegateType) : 'Delegate'}
                        {row.user?.phone ? ` • ${row.user.phone}` : ''}
                      </Text>
                      <Text style={styles.rowSub}>
                        Permissions: QR {row.canGenerateQR ? '✓' : '✕'} • Workers{' '}
                        {row.canManageWorkers ? '✓' : '✕'} • Billing {row.canViewFinancials ? '✓' : '✕'}
                      </Text>
                      <View style={styles.rowActions}>
                        {canCreateDelegates ? (
                          <Pressable
                            style={styles.actionButton}
                            onPress={() => beginEditDelegate(row)}
                          >
                            <Text style={styles.actionButtonText}>Edit</Text>
                          </Pressable>
                        ) : null}
                        <Pressable
                          disabled={busyKey === `delegate-revoke-${row.id}`}
                          style={[
                            styles.actionButtonDanger,
                            busyKey === `delegate-revoke-${row.id}` && styles.buttonDisabled,
                          ]}
                          onPress={() => void handleRevokeDelegate(row.id)}
                        >
                          <Text style={styles.actionButtonDangerText}>
                            {busyKey === `delegate-revoke-${row.id}` ? 'Revoking...' : 'Revoke'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Contractors (Authorized)</Text>
              <Text style={styles.cardSub}>
                Contractors are treated as authorized parties and can be used when assigning workers.
              </Text>
              {!canManageWorkers ? (
                <View style={styles.noticeBox}>
                  <Text style={styles.noticeText}>
                    Current account cannot manage contractors on this unit.
                  </Text>
                </View>
              ) : null}
            </View>

            {canManageWorkers ? (
              <View style={styles.card}>
                <Text style={styles.formTitle}>Create Contractor</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Contractor company name"
                  value={contractorName}
                  onChangeText={setContractorName}
                  editable={busyKey !== 'contractor-create'}
                />
                <Pressable
                  style={[
                    styles.primaryButton,
                    busyKey === 'contractor-create' && styles.buttonDisabled,
                  ]}
                  disabled={busyKey === 'contractor-create'}
                  onPress={() => void handleCreateContractor()}
                >
                  <Text style={styles.primaryButtonText}>
                    {busyKey === 'contractor-create' ? 'Creating...' : 'Create Contractor'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Contractors</Text>
              {contractorRows.length === 0 ? (
                <Text style={styles.emptyText}>No contractors assigned for this unit.</Text>
              ) : (
                contractorRows.map((contractor) => (
                  <View key={contractor.id} style={styles.simpleRow}>
                    <View style={styles.simpleRowIcon}>
                      <Ionicons name="business-outline" size={16} color={akColors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.simpleRowTitle}>{contractor.name}</Text>
                      <Text style={styles.simpleRowSub}>
                          {householdLabel(contractor.status ?? 'ACTIVE')}
                        {contractor.createdAt ? ` • ${formatDateTime(contractor.createdAt)}` : ''}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        ) : null}

        {hasUnit && !isLoading && section === 'staff' ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Household Staff (Workers)</Text>
              <Text style={styles.cardSub}>
                Manage workers (nanny, cook, driver, etc.) linked to a contractor on the selected unit.
              </Text>
              {!canManageWorkers ? (
                <View style={styles.noticeBox}>
                  <Text style={styles.noticeText}>
                    Current account cannot manage workers on this unit.
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.formTitle}>Create Worker</Text>
              <Text style={styles.fieldLabel}>Contractor</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.contractorChipsRow}>
                {contractorRows.length === 0 ? (
                  <View style={styles.inlinePillMuted}>
                    <Text style={styles.inlinePillMutedText}>No contractors yet</Text>
                  </View>
                ) : (
                  contractorRows.map((contractor) => {
                    const active = workerForm.contractorId === contractor.id;
                    return (
                      <Pressable
                        key={contractor.id}
                        onPress={() =>
                          setWorkerForm((prev) => ({ ...prev, contractorId: contractor.id }))
                        }
                        style={[styles.choiceChip, active && styles.choiceChipActive]}
                      >
                        <Text
                          style={[styles.choiceChipText, active && styles.choiceChipTextActive]}
                        >
                          {contractor.name}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>

              <TextInput
                style={styles.input}
                placeholder="Worker full name"
                value={workerForm.fullName}
                onChangeText={(v) => setWorkerForm((p) => ({ ...p, fullName: v }))}
                editable={canManageWorkers && busyKey !== 'worker-create'}
              />
              <TextInput
                style={styles.input}
                placeholder="National ID"
                value={workerForm.nationalId}
                onChangeText={(v) => setWorkerForm((p) => ({ ...p, nationalId: v }))}
                editable={canManageWorkers && busyKey !== 'worker-create'}
              />
              <TextInput
                style={styles.input}
                placeholder="Phone (optional)"
                value={workerForm.phone}
                onChangeText={(v) => setWorkerForm((p) => ({ ...p, phone: v }))}
                editable={canManageWorkers && busyKey !== 'worker-create'}
                keyboardType="phone-pad"
              />
              <TextInput
                style={styles.input}
                placeholder="Job type (e.g. Nanny / Cook)"
                value={workerForm.jobType}
                onChangeText={(v) => setWorkerForm((p) => ({ ...p, jobType: v }))}
                editable={canManageWorkers && busyKey !== 'worker-create'}
              />

              <Pressable
                style={[
                  styles.primaryButton,
                  (!canManageWorkers || busyKey === 'worker-create') && styles.buttonDisabled,
                ]}
                disabled={!canManageWorkers || busyKey === 'worker-create'}
                onPress={() => void handleCreateWorker()}
              >
                <Text style={styles.primaryButtonText}>
                  {busyKey === 'worker-create' ? 'Creating...' : 'Create Worker'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Workers</Text>
              {workerRows.length === 0 ? (
                <Text style={styles.emptyText}>No workers found for this unit.</Text>
              ) : (
                workerRows.map((worker) => {
                  const workerName = worker.accessProfile?.fullName || worker.id;
                  return (
                    <View key={worker.id} style={styles.rowCard}>
                      <View style={styles.rowHeader}>
                        <Text style={styles.rowTitle}>{workerName}</Text>
                        <View style={styles.statusPill}>
                          <Text style={styles.statusPillText}>{worker.status ?? 'ACTIVE'}</Text>
                        </View>
                      </View>
                      <Text style={styles.rowSub}>
                        {worker.jobType || 'Worker'}
                        {worker.contractor?.name ? ` • ${worker.contractor.name}` : ''}
                      </Text>
                      <Text style={styles.rowSub}>
                        {worker.accessProfile?.nationalId || 'No National ID'}
                        {worker.accessProfile?.phone ? ` • ${worker.accessProfile.phone}` : ''}
                      </Text>
                      <View style={styles.rowActions}>
                        <Pressable
                          disabled={!canGenerateWorkerQr || busyKey === `worker-qr-${worker.id}`}
                          style={[
                            styles.actionButtonPrimary,
                            (!canGenerateWorkerQr || busyKey === `worker-qr-${worker.id}`) &&
                              styles.buttonDisabled,
                          ]}
                          onPress={() => void handleGenerateWorkerQr(worker.id, worker.accessProfile?.fullName)}
                        >
                          <MaterialCommunityIcons name="qrcode" size={14} color="#fff" />
                          <Text style={styles.actionButtonPrimaryText}>
                            {busyKey === `worker-qr-${worker.id}` ? 'Generating...' : 'Generate QR'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: akColors.bg,
  },
  content: {
    paddingHorizontal: 16,
    gap: 14,
  },
  headerCard: {
    backgroundColor: akColors.surface,
    borderRadius: akRadius.card,
    borderWidth: 1,
    borderColor: akColors.border,
    padding: 16,
    gap: 10,
    ...akShadow.soft,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(42,62,53,0.08)',
  },
  headerTitle: {
    color: akColors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: akColors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  helperText: {
    color: akColors.textMuted,
    fontSize: 12,
  },
  linkText: {
    color: akColors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 10,
  },
  segmentChip: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentChipActive: {
    backgroundColor: akColors.primary,
    borderColor: akColors.primary,
  },
  segmentChipText: {
    color: akColors.textMuted,
    fontWeight: '600',
    fontSize: 12,
  },
  segmentChipTextActive: {
    color: '#fff',
  },
  card: {
    backgroundColor: akColors.surface,
    borderRadius: akRadius.card,
    borderWidth: 1,
    borderColor: akColors.border,
    padding: 14,
    gap: 10,
    ...akShadow.soft,
  },
  cardTitle: {
    color: akColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  cardSub: {
    color: akColors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  formTitle: {
    color: akColors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  fieldLabel: {
    color: akColors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    paddingHorizontal: 12,
    color: akColors.text,
  },
  uploadRow: {
    gap: 6,
  },
  uploadIdText: {
    color: akColors.textMuted,
    fontSize: 11,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: akColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: akColors.text,
    fontWeight: '600',
    fontSize: 12,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  listWrap: {
    gap: 10,
  },
  rowCard: {
    backgroundColor: akColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: akColors.border,
    padding: 13,
    gap: 8,
    ...akShadow.soft,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowTitle: {
    color: akColors.text,
    fontWeight: '700',
    fontSize: 13,
    flex: 1,
  },
  rowSub: {
    color: akColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  actionButton: {
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: akColors.surfaceMuted,
    borderWidth: 1,
    borderColor: akColors.border,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  actionButtonDanger: {
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonDangerText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  actionButtonPrimary: {
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: akColors.primary,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  actionButtonPrimaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surfaceMuted,
  },
  statusPillText: {
    color: akColors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  emptyText: {
    color: akColors.textMuted,
    fontSize: 12,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
  },
  successText: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '600',
  },
  noticeBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    padding: 10,
  },
  noticeText: {
    color: '#92400E',
    fontSize: 11,
    lineHeight: 16,
  },
  contractorChipsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  choiceChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  choiceChipActive: {
    borderColor: akColors.primary,
    backgroundColor: 'rgba(42,62,53,0.08)',
  },
  choiceChipText: {
    color: akColors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  choiceChipTextActive: {
    color: akColors.primary,
  },
  inlinePillMuted: {
    borderRadius: 999,
    backgroundColor: akColors.surfaceMuted,
    borderWidth: 1,
    borderColor: akColors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inlinePillMutedText: {
    color: akColors.textMuted,
    fontSize: 11,
  },
  simpleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: akColors.border,
  },
  simpleRowIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(42,62,53,0.06)',
  },
  simpleRowTitle: {
    color: akColors.text,
    fontWeight: '600',
    fontSize: 12,
  },
  simpleRowSub: {
    color: akColors.textMuted,
    fontSize: 10,
  },
});
