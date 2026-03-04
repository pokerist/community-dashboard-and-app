import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppToast } from '../components/mobile/AppToast';
import { BrandedPageHero } from '../components/mobile/BrandedPageHero';
import { UnitPicker } from '../components/mobile/UnitPicker';
import type { AuthSession } from '../features/auth/types';
import { useBranding } from '../features/branding/provider';
import { getBrandPalette } from '../features/branding/palette';
import {
  createAuthorizedRequest,
  createFamilyRequest,
  createHomeStaffAccess,
  createContractor,
  createDelegateRequestByContact,
  createWorker,
  generateWorkerQr,
  listHouseholdRequests,
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
  AuthorizedRequestRow,
  CreateAuthorizedRequestInput,
  CreateHomeStaffInput,
  ContractorRow,
  CreateDelegateByContactInput,
  DelegateAccessRow,
  FamilyAccessRow,
  HomeStaffAccessRow,
  HouseholdRequestsResponse,
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
type FamilyWizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

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
  const { brand } = useBranding();
  const palette = getBrandPalette(brand);
  const toast = useAppToast();
  const [section, setSection] = useState<SectionKey>('family');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [familyRows, setFamilyRows] = useState<FamilyAccessRow[]>([]);
  const [delegateRows, setDelegateRows] = useState<DelegateAccessRow[]>([]);
  const [contractorRows, setContractorRows] = useState<ContractorRow[]>([]);
  const [workerRows, setWorkerRows] = useState<WorkerRow[]>([]);
  const [householdRequests, setHouseholdRequests] = useState<HouseholdRequestsResponse>({
    family: [],
    authorized: [],
    homeStaff: [],
  });
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [workerForm, setWorkerForm] = useState({
    fullName: '',
    nationalId: '',
    phone: '',
    jobType: '',
  });
  const [workerQrResult, setWorkerQrResult] = useState<string | null>(null);
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [editingFamilyUserId, setEditingFamilyUserId] = useState<string | null>(null);
  const [familyWizardStep, setFamilyWizardStep] = useState<FamilyWizardStep>(1);
  const [editingDelegateAccessId, setEditingDelegateAccessId] = useState<string | null>(null);
  const [familyForm, setFamilyForm] = useState<{
    relationship: AddFamilyMemberInput['relationship'];
    nationality: 'EGYPTIAN' | 'FOREIGN';
    name: string;
    email: string;
    phone: string;
    personalPhotoId: string;
    nationalId: string;
    nationalIdFileId: string;
    passportFileId: string;
    childAgeBracket: '<16' | '>=16';
    birthDate: string;
    birthCertificateFileId: string;
    marriageCertificateFileId: string;
    permissions: Record<string, boolean>;
  }>({
    relationship: 'CHILD',
    nationality: 'EGYPTIAN',
    name: '',
    email: '',
    phone: '',
    personalPhotoId: '',
    nationalId: '',
    nationalIdFileId: '',
    passportFileId: '',
    childAgeBracket: '<16',
    birthDate: '',
    birthCertificateFileId: '',
    marriageCertificateFileId: '',
    permissions: {
      requests: true,
      services: true,
      bookings: true,
      complaints: true,
      utilityPayment: false,
      violations: false,
    },
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
  const [authorizedRequestForm, setAuthorizedRequestForm] = useState<{
    fullName: string;
    email: string;
    phone: string;
    nationality: 'EGYPTIAN' | 'FOREIGN';
    nationalIdOrPassport: string;
    idOrPassportFileId: string;
    powerOfAttorneyFileId: string;
    personalPhotoFileId: string;
    validFrom: string;
    validTo: string;
    feeMode: 'NO_FEE' | 'FEE_REQUIRED';
    feeAmount: string;
    permissions: Record<string, boolean>;
  }>({
    fullName: '',
    email: '',
    phone: '',
    nationality: 'EGYPTIAN',
    nationalIdOrPassport: '',
    idOrPassportFileId: '',
    powerOfAttorneyFileId: '',
    personalPhotoFileId: '',
    validFrom: '',
    validTo: '',
    feeMode: 'NO_FEE',
    feeAmount: '',
    permissions: {
      qrDelivery: true,
      qrWorkers: true,
      qrDriver: true,
      qrVisitor: true,
      requests: true,
      services: true,
      utilityPayment: false,
      complaints: true,
      bookings: false,
      violations: false,
    },
  });
  const [homeStaffRequestForm, setHomeStaffRequestForm] = useState<{
    fullName: string;
    phone: string;
    nationality: 'EGYPTIAN' | 'FOREIGN';
    nationalIdOrPassport: string;
    idOrPassportFileId: string;
    personalPhotoFileId: string;
    staffType: CreateHomeStaffInput['staffType'];
    employmentDuration: string;
    liveIn: boolean;
    accessFrom: string;
    accessTo: string;
  }>({
    fullName: '',
    phone: '',
    nationality: 'EGYPTIAN',
    nationalIdOrPassport: '',
    idOrPassportFileId: '',
    personalPhotoFileId: '',
    staffType: 'OTHER',
    employmentDuration: '',
    liveIn: false,
    accessFrom: '',
    accessTo: '',
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
  const showLegacyDelegateManagement = false;
  const showLegacyWorkerTools = false;

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!selectedUnitId) {
        setFamilyRows([]);
        setDelegateRows([]);
        setContractorRows([]);
        setWorkerRows([]);
        setHouseholdRequests({ family: [], authorized: [], homeStaff: [] });
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
        listHouseholdRequests(session.accessToken, { unitId: selectedUnitId }),
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
      setHouseholdRequests(
        results[4].status === 'fulfilled'
          ? results[4].value
          : { family: [], authorized: [], homeStaff: [] },
      );

      setIsLoading(false);
      setIsRefreshing(false);
    },
    [selectedUnitId, session.accessToken],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  const resetFamilyForm = () => {
    setEditingFamilyUserId(null);
    setFamilyWizardStep(1);
    setFamilyForm({
      relationship: 'CHILD',
      nationality: 'EGYPTIAN',
      name: '',
      email: '',
      phone: '',
      personalPhotoId: '',
      nationalId: '',
      nationalIdFileId: '',
      passportFileId: '',
      childAgeBracket: '<16',
      birthDate: '',
      birthCertificateFileId: '',
      marriageCertificateFileId: '',
      permissions: {
        requests: true,
        services: true,
        bookings: true,
        complaints: true,
        utilityPayment: false,
        violations: false,
      },
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
    setFamilyWizardStep(1);
    setFamilyForm((prev) => ({
      ...prev,
      relationship:
        (String(row.user?.resident?.relationship ?? '').toUpperCase() as AddFamilyMemberInput['relationship']) ||
        prev.relationship,
      nationality: 'EGYPTIAN',
      name: row.user?.nameEN || row.user?.nameAR || '',
      email: row.user?.email ?? '',
      phone: row.user?.phone ?? '',
      personalPhotoId: '',
      nationalId: row.user?.resident?.nationalId ?? '',
      nationalIdFileId: '',
      passportFileId: '',
      childAgeBracket: prev.childAgeBracket,
      birthDate: '',
      birthCertificateFileId: '',
      marriageCertificateFileId: '',
      permissions: prev.permissions,
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

  const handleCreateWorker = async () => {
    if (!selectedUnitId) return;
    if (!workerForm.fullName.trim() || !workerForm.nationalId.trim()) {
      setErrorMessage('Worker name and national ID are required');
      toast.error('Missing worker fields', 'Worker name and national ID are required.');
      return;
    }
    setBusyKey('worker-create');
    try {
      let contractorId = contractorRows[0]?.id ?? '';
      if (!contractorId) {
        const internal = await createContractor(session.accessToken, {
          unitId: selectedUnitId,
          name: 'Home Staff',
        });
        contractorId = internal.id;
      }
      await createWorker(session.accessToken, {
        unitId: selectedUnitId,
        contractorId,
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
  const familyNationality = familyForm.nationality;
  const familyNeedsBirthDate =
    familyRelationship === 'CHILD' && familyForm.childAgeBracket === '<16';
  const familyNeedsMarriageCert = familyRelationship === 'SPOUSE';
  const familyNeedsNationalIdFile =
    familyNationality === 'EGYPTIAN' &&
    (familyRelationship !== 'CHILD' || familyForm.childAgeBracket === '>=16');
  const familyNeedsBirthCert =
    familyNationality === 'EGYPTIAN' &&
    familyRelationship === 'CHILD' &&
    familyForm.childAgeBracket === '<16';
  const familyNeedsPassportFile = familyNationality === 'FOREIGN';
  const familyIsEditing = Boolean(editingFamilyUserId);

  const familyWizardSteps: Array<{ key: FamilyWizardStep; title: string }> = [
    { key: 1, title: 'Relationship' },
    { key: 2, title: 'Nationality' },
    { key: 3, title: 'Age' },
    { key: 4, title: 'Documents' },
    { key: 5, title: 'Identity & Contact' },
    { key: 6, title: 'Permissions' },
    { key: 7, title: 'Review' },
  ];

  const canMoveFamilyWizardStep = (step: FamilyWizardStep): boolean => {
    switch (step) {
      case 1:
        return Boolean(familyForm.relationship);
      case 2:
        return Boolean(familyForm.nationality);
      case 3:
        return familyForm.relationship === 'CHILD'
          ? familyForm.childAgeBracket === '<16' || familyForm.childAgeBracket === '>=16'
          : true;
      case 4:
        if (familyIsEditing) return true;
        if (!familyForm.personalPhotoId.trim()) return false;
        if (familyNeedsNationalIdFile && !familyForm.nationalIdFileId.trim()) return false;
        if (familyNeedsPassportFile && !familyForm.passportFileId.trim()) return false;
        if (familyNeedsBirthDate && !familyForm.birthDate.trim()) return false;
        if (familyNeedsBirthCert && !familyForm.birthCertificateFileId.trim()) return false;
        if (familyNeedsMarriageCert && !familyForm.marriageCertificateFileId.trim()) return false;
        return true;
      case 5:
        if (!familyForm.name.trim()) return false;
        if (!familyIsEditing && !familyForm.phone.trim()) return false;
        return true;
      case 6:
      case 7:
        return true;
      default:
        return true;
    }
  };

  const familyWizardStepHint = (step: FamilyWizardStep): string | null => {
    switch (step) {
      case 4:
        if (familyIsEditing) return null;
        if (!familyForm.personalPhotoId.trim()) return 'Upload personal photo first.';
        if (familyNeedsNationalIdFile && !familyForm.nationalIdFileId.trim())
          return 'National ID file is required for this member.';
        if (familyNeedsPassportFile && !familyForm.passportFileId.trim())
          return 'Passport file is required for foreign family members.';
        if (familyNeedsBirthDate && !familyForm.birthDate.trim())
          return 'Birth date is required for child under 16.';
        if (familyNeedsBirthCert && !familyForm.birthCertificateFileId.trim())
          return 'Birth certificate is required for child under 16.';
        if (familyNeedsMarriageCert && !familyForm.marriageCertificateFileId.trim())
          return 'Marriage certificate is required for spouse.';
        return null;
      case 5:
        if (!familyForm.name.trim()) return 'Full name is required.';
        if (!familyIsEditing && !familyForm.phone.trim())
          return 'Phone is required for new family member.';
        return null;
      default:
        return null;
    }
  };

  const goFamilyWizardNext = () => {
    if (!canMoveFamilyWizardStep(familyWizardStep)) {
      const hint = familyWizardStepHint(familyWizardStep);
      if (hint) toast.error('Complete this step', hint);
      return;
    }
    setFamilyWizardStep((prev) => (prev < 7 ? ((prev + 1) as FamilyWizardStep) : prev));
  };

  const goFamilyWizardBack = () => {
    setFamilyWizardStep((prev) => (prev > 1 ? ((prev - 1) as FamilyWizardStep) : prev));
  };

  const handleUploadFamilyFile = async (
    purpose:
      | 'profile-photo'
      | 'national-id'
      | 'birth-certificate'
      | 'marriage-certificate'
      | 'delegate-id',
    field:
      | 'personalPhotoId'
      | 'nationalIdFileId'
      | 'birthCertificateFileId'
      | 'marriageCertificateFileId'
      | 'passportFileId',
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

  const handleUploadAuthorizedFile = async (
    field: 'idOrPassportFileId' | 'powerOfAttorneyFileId' | 'personalPhotoFileId',
    purpose: 'delegate-id' | 'service-attachment' | 'profile-photo',
  ) => {
    setBusyKey(`upload-auth-${field}`);
    try {
      const uploaded = await pickAndUploadFileByPurpose(session.accessToken, purpose);
      if (!uploaded) return;
      setAuthorizedRequestForm((prev) => ({ ...prev, [field]: uploaded.id }));
      toast.success('Document uploaded');
    } catch (error) {
      const msg = extractApiErrorMessage(error);
      setErrorMessage(msg);
      toast.error('Upload failed', msg);
    } finally {
      setBusyKey(null);
    }
  };

  const handleUploadHomeStaffFile = async (
    field: 'idOrPassportFileId' | 'personalPhotoFileId',
    purpose: 'delegate-id' | 'profile-photo',
  ) => {
    setBusyKey(`upload-staff-${field}`);
    try {
      const uploaded = await pickAndUploadFileByPurpose(session.accessToken, purpose);
      if (!uploaded) return;
      setHomeStaffRequestForm((prev) => ({ ...prev, [field]: uploaded.id }));
      toast.success('Document uploaded');
    } catch (error) {
      const msg = extractApiErrorMessage(error);
      setErrorMessage(msg);
      toast.error('Upload failed', msg);
    } finally {
      setBusyKey(null);
    }
  };

  const handleCreateAuthorizedRequest = async () => {
    if (!selectedUnitId) return;
    if (
      !authorizedRequestForm.fullName.trim() ||
      !authorizedRequestForm.phone.trim() ||
      !authorizedRequestForm.idOrPassportFileId.trim() ||
      !authorizedRequestForm.powerOfAttorneyFileId.trim() ||
      !authorizedRequestForm.personalPhotoFileId.trim() ||
      !authorizedRequestForm.validFrom.trim() ||
      !authorizedRequestForm.validTo.trim()
    ) {
      toast.error('Missing required fields', 'Please complete all required authorized request fields.');
      return;
    }
    if (
      authorizedRequestForm.feeMode === 'FEE_REQUIRED' &&
      (!authorizedRequestForm.feeAmount.trim() ||
        Number.isNaN(Number(authorizedRequestForm.feeAmount)) ||
        Number(authorizedRequestForm.feeAmount) <= 0)
    ) {
      toast.error('Invalid fee amount', 'Provide a valid fee amount for fee-required mode.');
      return;
    }

    setBusyKey('authorized-request-create');
    try {
      const payload: CreateAuthorizedRequestInput = {
        unitId: selectedUnitId,
        fullName: authorizedRequestForm.fullName.trim(),
        phone: authorizedRequestForm.phone.trim(),
        email: authorizedRequestForm.email.trim() || undefined,
        nationality: authorizedRequestForm.nationality,
        nationalIdOrPassport: authorizedRequestForm.nationalIdOrPassport.trim() || undefined,
        idOrPassportFileId: authorizedRequestForm.idOrPassportFileId.trim(),
        powerOfAttorneyFileId: authorizedRequestForm.powerOfAttorneyFileId.trim(),
        personalPhotoFileId: authorizedRequestForm.personalPhotoFileId.trim(),
        validFrom: authorizedRequestForm.validFrom.trim(),
        validTo: authorizedRequestForm.validTo.trim(),
        feeMode: authorizedRequestForm.feeMode,
        feeAmount:
          authorizedRequestForm.feeMode === 'FEE_REQUIRED'
            ? Number(authorizedRequestForm.feeAmount)
            : undefined,
        delegatePermissions: authorizedRequestForm.permissions,
      };
      await createAuthorizedRequest(session.accessToken, payload);
      setAuthorizedRequestForm({
        fullName: '',
        email: '',
        phone: '',
        nationality: 'EGYPTIAN',
        nationalIdOrPassport: '',
        idOrPassportFileId: '',
        powerOfAttorneyFileId: '',
        personalPhotoFileId: '',
        validFrom: '',
        validTo: '',
        feeMode: 'NO_FEE',
        feeAmount: '',
        permissions: {
          qrDelivery: true,
          qrWorkers: true,
          qrDriver: true,
          qrVisitor: true,
          requests: true,
          services: true,
          utilityPayment: false,
          complaints: true,
          bookings: false,
          violations: false,
        },
      });
      toast.success('Authorized request submitted', 'Request is pending admin approval.');
      await load('refresh');
    } catch (error) {
      const msg = extractApiErrorMessage(error);
      setErrorMessage(msg);
      toast.error('Authorized request failed', msg);
    } finally {
      setBusyKey(null);
    }
  };

  const handleCreateHomeStaffRequest = async () => {
    if (!selectedUnitId) return;
    if (
      !homeStaffRequestForm.fullName.trim() ||
      !homeStaffRequestForm.phone.trim() ||
      !homeStaffRequestForm.idOrPassportFileId.trim() ||
      !homeStaffRequestForm.accessFrom.trim() ||
      !homeStaffRequestForm.accessTo.trim()
    ) {
      toast.error('Missing required fields', 'Please complete all required home staff fields.');
      return;
    }

    setBusyKey('home-staff-request-create');
    try {
      const payload: CreateHomeStaffInput = {
        unitId: selectedUnitId,
        fullName: homeStaffRequestForm.fullName.trim(),
        phone: homeStaffRequestForm.phone.trim(),
        nationality: homeStaffRequestForm.nationality,
        nationalIdOrPassport: homeStaffRequestForm.nationalIdOrPassport.trim() || undefined,
        idOrPassportFileId: homeStaffRequestForm.idOrPassportFileId.trim(),
        personalPhotoFileId: homeStaffRequestForm.personalPhotoFileId.trim() || undefined,
        staffType: homeStaffRequestForm.staffType,
        employmentDuration: homeStaffRequestForm.employmentDuration.trim() || undefined,
        liveIn: homeStaffRequestForm.liveIn,
        accessFrom: homeStaffRequestForm.accessFrom.trim(),
        accessTo: homeStaffRequestForm.accessTo.trim(),
      };
      await createHomeStaffAccess(session.accessToken, payload);
      setHomeStaffRequestForm({
        fullName: '',
        phone: '',
        nationality: 'EGYPTIAN',
        nationalIdOrPassport: '',
        idOrPassportFileId: '',
        personalPhotoFileId: '',
        staffType: 'OTHER',
        employmentDuration: '',
        liveIn: false,
        accessFrom: '',
        accessTo: '',
      });
      toast.success('Home staff request submitted', 'Request is pending admin approval.');
      await load('refresh');
    } catch (error) {
      const msg = extractApiErrorMessage(error);
      setErrorMessage(msg);
      toast.error('Home staff request failed', msg);
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
    if (!isEditing && familyNeedsPassportFile && !familyForm.passportFileId.trim()) {
      setErrorMessage('Passport file is required for foreign family members');
      toast.error('Missing document', 'Passport file is required for foreign family members.');
      return;
    }
    if (!isEditing && familyNeedsBirthDate && !familyForm.birthDate.trim()) {
      setErrorMessage('Birth date is required for child family member');
      toast.error('Missing birth date', 'Birth date is required for child family member.');
      return;
    }
    if (!isEditing && familyNeedsBirthCert && !familyForm.birthCertificateFileId.trim()) {
      setErrorMessage('Birth certificate file is required for child below 18');
      toast.error('Missing document', 'Birth certificate is required for child below 18.');
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
        await createFamilyRequest(session.accessToken, {
          unitId: selectedUnitId,
          relationship:
            familyForm.relationship === 'CHILD'
              ? 'SON_DAUGHTER'
              : familyForm.relationship === 'PARENT'
                ? 'MOTHER_FATHER'
                : 'SPOUSE',
          fullName: familyForm.name.trim(),
          email: familyForm.email.trim() || undefined,
          phone: familyForm.phone.trim(),
          nationality: familyForm.nationality,
          nationalIdOrPassport: familyForm.nationalId.trim() || undefined,
          personalPhotoFileId: familyForm.personalPhotoId.trim(),
          nationalIdFileId:
            familyForm.nationality === 'EGYPTIAN'
              ? familyForm.nationalIdFileId.trim() || undefined
              : undefined,
          passportFileId:
            familyForm.nationality === 'FOREIGN'
              ? familyForm.passportFileId.trim() || undefined
              : undefined,
          birthCertificateFileId: familyForm.birthCertificateFileId.trim() || undefined,
          marriageCertificateFileId: familyForm.marriageCertificateFileId.trim() || undefined,
          childAgeBracket:
            familyForm.relationship === 'CHILD'
              ? familyForm.childAgeBracket
              : undefined,
          featurePermissions: familyForm.permissions,
        });
      }
      resetFamilyForm();
      toast.success(
        isEditing ? 'Family member updated' : 'Family request submitted',
        isEditing
          ? 'Family member details were updated successfully.'
          : 'Family request was sent for admin approval.',
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
          { paddingTop: 0, paddingBottom: 112 },
        ]}
      >
        <View style={styles.headerCard}>
          <BrandedPageHero
            title="Manage Household"
            subtitle="Manage family members, authorized users, and home staff per unit."
            rightSlot={(
              <Pressable onPress={() => void load('refresh')}>
                <Text style={styles.heroRefreshText}>
                  {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </Text>
              </Pressable>
            )}
          />

          {units.length > 1 ? (
            <View style={styles.unitContextRow}>
              <Text style={styles.unitContextText}>
                Currently managing:
                {' '}
                {selectedUnit?.unitNumber ?? selectedUnit?.id ?? 'Unit'}
                {selectedUnit?.block ? ` • Block ${selectedUnit.block}` : ''}
              </Text>
              <Pressable onPress={() => setUnitPickerOpen(true)}>
                <Text style={[styles.unitContextChangeText, { color: palette.primary }]}>
                  Change
                </Text>
              </Pressable>
            </View>
          ) : null}

          {selectedUnit ? (
            <Text style={styles.helperText}>
              {selectedUnit.unitNumber ?? selectedUnit.id}
              {selectedUnit.block ? ` • Block ${selectedUnit.block}` : ''}
              {selectedUnit.status
                ? ` • ${
                    ['LEASED', 'RENTED', 'TENANT_OCCUPIED'].includes(
                      String(selectedUnit.status).toUpperCase(),
                    )
                      ? 'Rented'
                      : 'Own Use'
                  }`
                : ''}
            </Text>
          ) : null}
          {unitsLoading ? <ActivityIndicator color={palette.primary} /> : null}
          {unitsErrorMessage ? <Text style={styles.errorText}>{unitsErrorMessage}</Text> : null}
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          {workerQrResult ? <Text style={styles.successText}>{workerQrResult}</Text> : null}
        </View>

        <View style={styles.segmentRow}>
          {([
            ['family', 'Family'],
            ['delegates', 'Authorized'],
            ['staff', 'Home Staff'],
          ] as const).map(([key, label]) => {
            const active = section === key;
            return (
              <Pressable
                key={key}
                onPress={() => setSection(key)}
                style={[
                  styles.segmentChip,
                  active && styles.segmentChipActive,
                  active && { backgroundColor: palette.primary, borderColor: palette.primary },
                ]}
              >
                <Text
                  style={[
                    styles.segmentChipText,
                    active && styles.segmentChipTextActive,
                    active && { color: '#fff' },
                  ]}
                >
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

        {isLoading ? <ActivityIndicator color={palette.primary} /> : null}

        {hasUnit && !isLoading && section === 'family' ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Family Members</Text>
              <Text style={styles.cardSub}>
                {canManageFamily
                  ? 'Submit first-degree family requests and review linked family members for this unit.'
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
                      <Text style={[styles.linkText, { color: palette.primary }]}>Cancel Edit</Text>
                    </Pressable>
                  ) : null}
                </View>
                <View style={styles.wizardStepsRow}>
                  {familyWizardSteps.map((step) => {
                    const active = familyWizardStep === step.key;
                    const completed = familyWizardStep > step.key;
                    return (
                      <Pressable
                        key={step.key}
                        onPress={() =>
                          setFamilyWizardStep((prev) =>
                            step.key <= prev || canMoveFamilyWizardStep(prev) ? step.key : prev,
                          )
                        }
                        style={[
                          styles.wizardStepChip,
                          active && styles.wizardStepChipActive,
                          completed && styles.wizardStepChipDone,
                          active && { borderColor: palette.primary, backgroundColor: palette.primarySoft8 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.wizardStepChipText,
                            active && { color: palette.primary },
                            completed && styles.wizardStepChipTextDone,
                          ]}
                        >
                          {step.key}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.wizardStepTitle}>
                  Step {familyWizardStep}: {familyWizardSteps.find((step) => step.key === familyWizardStep)?.title}
                </Text>

                {familyWizardStep === 1 ? (
                  <>
                    <Text style={styles.fieldLabel}>Relationship</Text>
                    <View style={styles.optionRow}>
                      {(['CHILD', 'PARENT', 'SPOUSE'] as const).map((rel) => {
                        const active = familyForm.relationship === rel;
                        const label =
                          rel === 'CHILD'
                            ? 'Son / Daughter'
                            : rel === 'PARENT'
                              ? 'Mother / Father'
                              : 'Spouse';
                        return (
                          <Pressable
                            key={rel}
                            onPress={() => setFamilyForm((p) => ({ ...p, relationship: rel }))}
                            style={[styles.choiceChip, active && styles.choiceChipActive, active && { borderColor: palette.primary, backgroundColor: palette.primarySoft8 }]}
                          >
                            <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive, active && { color: palette.primary }]}>
                              {label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                ) : null}
                {familyWizardStep === 2 ? (
                  <>
                    <Text style={styles.fieldLabel}>Nationality</Text>
                    <View style={styles.optionRow}>
                      {(['EGYPTIAN', 'FOREIGN'] as const).map((nationality) => {
                        const active = familyForm.nationality === nationality;
                        return (
                          <Pressable
                            key={nationality}
                            onPress={() =>
                              setFamilyForm((p) => ({
                                ...p,
                                nationality,
                                nationalIdFileId:
                                  nationality === 'FOREIGN' ? '' : p.nationalIdFileId,
                                passportFileId:
                                  nationality === 'EGYPTIAN' ? '' : p.passportFileId,
                              }))
                            }
                            style={[styles.choiceChip, active && styles.choiceChipActive, active && { borderColor: palette.primary, backgroundColor: palette.primarySoft8 }]}
                          >
                            <Text
                              style={[styles.choiceChipText, active && styles.choiceChipTextActive, active && { color: palette.primary }]}
                            >
                              {nationality === 'EGYPTIAN' ? 'Egyptian' : 'Foreign'}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                ) : null}

                {familyWizardStep === 3 && familyForm.relationship === 'CHILD' ? (
                  <>
                    <Text style={styles.fieldLabel}>Child Age Group</Text>
                    <View style={styles.optionRow}>
                      {(['<16', '>=16'] as const).map((age) => {
                        const active = familyForm.childAgeBracket === age;
                        return (
                          <Pressable
                            key={age}
                            onPress={() =>
                              setFamilyForm((p) => ({ ...p, childAgeBracket: age }))
                            }
                            style={[styles.choiceChip, active && styles.choiceChipActive, active && { borderColor: palette.primary, backgroundColor: palette.primarySoft8 }]}
                          >
                            <Text
                              style={[styles.choiceChipText, active && styles.choiceChipTextActive, active && { color: palette.primary }]}
                            >
                              {age === '<16' ? 'Under 16' : '16 and above'}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                ) : null}
                {familyWizardStep === 3 && familyForm.relationship !== 'CHILD' ? (
                  <View style={styles.noticeBox}>
                    <Text style={styles.noticeText}>
                      Age step is not required for this relationship.
                    </Text>
                  </View>
                ) : null}

                {familyWizardStep === 5 ? (
                  <>
                    <Text style={styles.fieldLabel}>Full Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Full name"
                      value={familyForm.name}
                      onChangeText={(v) => setFamilyForm((p) => ({ ...p, name: v }))}
                    />
                    <Text style={styles.fieldLabel}>Email</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Email (optional)"
                      value={familyForm.email}
                      onChangeText={(v) => setFamilyForm((p) => ({ ...p, email: v }))}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <Text style={styles.fieldLabel}>Phone</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Phone"
                      value={familyForm.phone}
                      onChangeText={(v) => setFamilyForm((p) => ({ ...p, phone: v }))}
                      keyboardType="phone-pad"
                    />
                  </>
                ) : null}

                {familyWizardStep === 4 ? (
                  <>
                    <Text style={styles.fieldLabel}>Personal Photo</Text>
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
                  </>
                ) : null}

                {familyWizardStep === 4 && (familyNeedsNationalIdFile ||
                  familyNeedsPassportFile ||
                  familyForm.nationalId ||
                  familyForm.nationalIdFileId) ? (
                  <>
                    <Text style={styles.fieldLabel}>
                      {familyForm.nationality === 'FOREIGN' ? 'Passport Number' : 'National ID'}
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder={
                        familyForm.nationality === 'FOREIGN'
                          ? 'Passport Number'
                          : 'National ID'
                      }
                      value={familyForm.nationalId}
                      onChangeText={(v) => setFamilyForm((p) => ({ ...p, nationalId: v }))}
                    />
                    {familyNeedsNationalIdFile ? (
                      <>
                        <Text style={styles.fieldLabel}>National ID File</Text>
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
                  </>
                ) : null}

                {familyWizardStep === 4 && familyNeedsPassportFile ? (
                  <>
                    <Text style={styles.fieldLabel}>Passport File</Text>
                    <View style={styles.uploadRow}>
                      <Pressable
                        style={[styles.secondaryButton, busyKey === 'upload-passportFileId' && styles.buttonDisabled]}
                        onPress={() => void handleUploadFamilyFile('delegate-id', 'passportFileId')}
                        disabled={busyKey === 'upload-passportFileId'}
                      >
                        <Text style={styles.secondaryButtonText}>
                          {busyKey === 'upload-passportFileId'
                            ? 'Uploading...'
                            : 'Upload Passport'}
                        </Text>
                      </Pressable>
                      <Text style={styles.uploadIdText} numberOfLines={1}>
                        {familyForm.passportFileId || 'No file uploaded'}
                      </Text>
                    </View>
                  </>
                ) : null}

                {familyWizardStep === 4 && familyNeedsBirthDate ? (
                  <>
                    <Text style={styles.fieldLabel}>Birth Date</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Birth Date (YYYY-MM-DD)"
                      value={familyForm.birthDate}
                      onChangeText={(v) => setFamilyForm((p) => ({ ...p, birthDate: v }))}
                      autoCapitalize="none"
                    />
                    {familyNeedsBirthCert ? (
                      <>
                        <Text style={styles.fieldLabel}>Birth Certificate</Text>
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
                            {familyForm.birthCertificateFileId || 'No file uploaded'}
                          </Text>
                        </View>
                      </>
                    ) : null}
                  </>
                ) : null}

                {familyWizardStep === 4 && familyNeedsMarriageCert ? (
                  <>
                    <Text style={styles.fieldLabel}>Marriage Certificate</Text>
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
                  </>
                ) : null}

                {familyWizardStep === 6 ? (
                  <>
                    <Text style={styles.fieldLabel}>Family Permissions</Text>
                    <View style={styles.optionRow}>
                      {(
                        [
                          ['requests', 'Requests'],
                          ['services', 'Services'],
                          ['bookings', 'Bookings'],
                          ['complaints', 'Complaints'],
                          ['utilityPayment', 'Utility Payment'],
                          ['violations', 'Violations'],
                        ] as const
                      ).map(([key, label]) => {
                        const active = Boolean(familyForm.permissions[key]);
                        return (
                          <Pressable
                            key={key}
                            onPress={() =>
                              setFamilyForm((p) => ({
                                ...p,
                                permissions: {
                                  ...p.permissions,
                                  [key]: !p.permissions[key],
                                },
                              }))
                            }
                            style={[
                              styles.choiceChip,
                              active && styles.choiceChipActive,
                              active && {
                                borderColor: palette.primary,
                                backgroundColor: palette.primarySoft8,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.choiceChipText,
                                active && styles.choiceChipTextActive,
                                active && { color: palette.primary },
                              ]}
                            >
                              {label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                ) : null}

                {familyWizardStep === 7 ? (
                  <View style={styles.noticeBox}>
                    <Text style={styles.noticeText}>
                      Review complete. Confirm to {familyIsEditing ? 'save changes' : 'add this family member'}.
                    </Text>
                    <Text style={styles.noticeText}>Name: {familyForm.name || '—'}</Text>
                    <Text style={styles.noticeText}>Phone: {familyForm.phone || '—'}</Text>
                    <Text style={styles.noticeText}>Relationship: {householdLabel(familyForm.relationship)}</Text>
                    <Text style={styles.noticeText}>
                      Nationality: {familyForm.nationality === 'EGYPTIAN' ? 'Egyptian' : 'Foreign'}
                    </Text>
                  </View>
                ) : null}

                {familyWizardStepHint(familyWizardStep) ? (
                  <Text style={styles.errorText}>{familyWizardStepHint(familyWizardStep)}</Text>
                ) : null}

                <View style={styles.wizardActionsRow}>
                  <Pressable
                    style={[styles.secondaryButton, styles.wizardActionButton, familyWizardStep === 1 && styles.buttonDisabled]}
                    onPress={goFamilyWizardBack}
                    disabled={familyWizardStep === 1}
                  >
                    <Text style={styles.secondaryButtonText}>Back</Text>
                  </Pressable>

                  {familyWizardStep < 7 ? (
                    <Pressable style={[styles.primaryButton, styles.wizardActionButton, { backgroundColor: palette.primary }]} onPress={goFamilyWizardNext}>
                      <Text style={styles.primaryButtonText}>Next</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={[styles.primaryButton, styles.wizardActionButton, { backgroundColor: palette.primary }, busyKey === 'family-add' && styles.buttonDisabled]}
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
                  )}
                </View>
              </View>
            ) : null}

            <View style={styles.listWrap}>
              {familyRows.length === 0 ? (
                <View style={styles.emptyStateCard}>
                  <Ionicons name="person-add-outline" size={24} color={palette.primary} />
                  <Text style={styles.emptyTitle}>No family members added yet</Text>
                  <Text style={styles.emptyText}>
                    Use Add Family Member to start creating household access.
                  </Text>
                </View>
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
              <Text style={styles.cardTitle}>Authorized Users</Text>
              <Text style={styles.cardSub}>
                Submit authorized access requests with permissions and validity window.
              </Text>
            </View>
            {canCreateDelegates ? (
              <View style={styles.card}>
                <Text style={styles.formTitle}>New Authorized Request</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Full name"
                  value={authorizedRequestForm.fullName}
                  onChangeText={(v) => setAuthorizedRequestForm((p) => ({ ...p, fullName: v }))}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Email (optional)"
                  value={authorizedRequestForm.email}
                  onChangeText={(v) => setAuthorizedRequestForm((p) => ({ ...p, email: v }))}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Phone"
                  value={authorizedRequestForm.phone}
                  onChangeText={(v) => setAuthorizedRequestForm((p) => ({ ...p, phone: v }))}
                  keyboardType="phone-pad"
                />
                <TextInput
                  style={styles.input}
                  placeholder="ID / Passport Number"
                  value={authorizedRequestForm.nationalIdOrPassport}
                  onChangeText={(v) =>
                    setAuthorizedRequestForm((p) => ({ ...p, nationalIdOrPassport: v }))
                  }
                />
                <TextInput
                  style={styles.input}
                  placeholder="Valid From (YYYY-MM-DD)"
                  value={authorizedRequestForm.validFrom}
                  onChangeText={(v) => setAuthorizedRequestForm((p) => ({ ...p, validFrom: v }))}
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Valid To (YYYY-MM-DD)"
                  value={authorizedRequestForm.validTo}
                  onChangeText={(v) => setAuthorizedRequestForm((p) => ({ ...p, validTo: v }))}
                  autoCapitalize="none"
                />
                <View style={styles.optionRow}>
                  {(['NO_FEE', 'FEE_REQUIRED'] as const).map((mode) => {
                    const active = authorizedRequestForm.feeMode === mode;
                    return (
                      <Pressable
                        key={mode}
                        onPress={() => setAuthorizedRequestForm((p) => ({ ...p, feeMode: mode }))}
                        style={[styles.choiceChip, active && styles.choiceChipActive, active && { borderColor: palette.primary, backgroundColor: palette.primarySoft8 }]}
                      >
                        <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive, active && { color: palette.primary }]}>
                          {mode === 'NO_FEE' ? 'No Fee' : 'Fee Required'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {authorizedRequestForm.feeMode === 'FEE_REQUIRED' ? (
                  <TextInput
                    style={styles.input}
                    placeholder="Fee Amount"
                    value={authorizedRequestForm.feeAmount}
                    onChangeText={(v) => setAuthorizedRequestForm((p) => ({ ...p, feeAmount: v }))}
                    keyboardType="decimal-pad"
                  />
                ) : null}
                <Text style={styles.fieldLabel}>Permissions</Text>
                <View style={styles.optionRow}>
                  {(
                    [
                      ['qrDelivery', 'QR Delivery'],
                      ['qrWorkers', 'QR Workers'],
                      ['qrDriver', 'QR Driver'],
                      ['qrVisitor', 'QR Visitor'],
                      ['requests', 'Requests'],
                      ['services', 'Services'],
                      ['utilityPayment', 'Utility Payment'],
                      ['complaints', 'Complaints'],
                      ['bookings', 'Bookings'],
                      ['violations', 'Violations'],
                    ] as const
                  ).map(([key, label]) => {
                    const active = authorizedRequestForm.permissions[key];
                    return (
                      <Pressable
                        key={key}
                        onPress={() =>
                          setAuthorizedRequestForm((p) => ({
                            ...p,
                            permissions: {
                              ...p.permissions,
                              [key]: !p.permissions[key],
                            },
                          }))
                        }
                        style={[styles.choiceChip, active && styles.choiceChipActive, active && { borderColor: palette.primary, backgroundColor: palette.primarySoft8 }]}
                      >
                        <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive, active && { color: palette.primary }]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.uploadRow}>
                  <Pressable
                    style={[styles.secondaryButton, busyKey === 'upload-auth-idOrPassportFileId' && styles.buttonDisabled]}
                    onPress={() => void handleUploadAuthorizedFile('idOrPassportFileId', 'delegate-id')}
                    disabled={busyKey === 'upload-auth-idOrPassportFileId'}
                  >
                    <Text style={styles.secondaryButtonText}>Upload ID/Passport File</Text>
                  </Pressable>
                  <Text style={styles.uploadIdText} numberOfLines={1}>
                    {authorizedRequestForm.idOrPassportFileId || 'No file uploaded'}
                  </Text>
                </View>
                <View style={styles.uploadRow}>
                  <Pressable
                    style={[styles.secondaryButton, busyKey === 'upload-auth-powerOfAttorneyFileId' && styles.buttonDisabled]}
                    onPress={() => void handleUploadAuthorizedFile('powerOfAttorneyFileId', 'service-attachment')}
                    disabled={busyKey === 'upload-auth-powerOfAttorneyFileId'}
                  >
                    <Text style={styles.secondaryButtonText}>Upload Power of Attorney</Text>
                  </Pressable>
                  <Text style={styles.uploadIdText} numberOfLines={1}>
                    {authorizedRequestForm.powerOfAttorneyFileId || 'No file uploaded'}
                  </Text>
                </View>
                <View style={styles.uploadRow}>
                  <Pressable
                    style={[styles.secondaryButton, busyKey === 'upload-auth-personalPhotoFileId' && styles.buttonDisabled]}
                    onPress={() => void handleUploadAuthorizedFile('personalPhotoFileId', 'profile-photo')}
                    disabled={busyKey === 'upload-auth-personalPhotoFileId'}
                  >
                    <Text style={styles.secondaryButtonText}>Upload Personal Photo</Text>
                  </Pressable>
                  <Text style={styles.uploadIdText} numberOfLines={1}>
                    {authorizedRequestForm.personalPhotoFileId || 'No file uploaded'}
                  </Text>
                </View>
                <Pressable
                  style={[styles.primaryButton, { backgroundColor: palette.primary }, busyKey === 'authorized-request-create' && styles.buttonDisabled]}
                  onPress={() => void handleCreateAuthorizedRequest()}
                  disabled={busyKey === 'authorized-request-create'}
                >
                  <Text style={styles.primaryButtonText}>
                    {busyKey === 'authorized-request-create' ? 'Submitting...' : 'Submit Authorized Request'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.formTitle}>Authorized Requests</Text>
              {householdRequests.authorized.length === 0 ? (
                <Text style={styles.emptyText}>No authorized requests for this unit.</Text>
              ) : (
                householdRequests.authorized.map((row: AuthorizedRequestRow) => (
                  <View key={row.id} style={styles.rowCard}>
                    <View style={styles.rowHeader}>
                      <Text style={styles.rowTitle}>{row.fullName}</Text>
                      <View style={styles.statusPill}>
                        <Text style={styles.statusPillText}>{householdLabel(row.status)}</Text>
                      </View>
                    </View>
                    <Text style={styles.rowSub}>
                      {row.phone || '—'} {row.email ? ` • ${row.email}` : ''}
                    </Text>
                    <Text style={styles.rowSub}>
                      {row.validFrom ? formatDateTime(row.validFrom) : '—'} → {row.validTo ? formatDateTime(row.validTo) : '—'}
                    </Text>
                    {row.rejectionReason ? (
                      <Text style={styles.errorText}>Rejection: {row.rejectionReason}</Text>
                    ) : null}
                  </View>
                ))
              )}
            </View>
            {showLegacyDelegateManagement && canCreateDelegates ? (
              <View style={styles.card}>
                <View style={styles.formHeaderRow}>
                  <Text style={styles.formTitle}>
                    {editingDelegateAccessId ? 'Edit Authorized User' : 'Add Authorized User'}
                  </Text>
                  {editingDelegateAccessId ? (
                    <Pressable onPress={resetDelegateForm}>
                      <Text style={[styles.linkText, { color: palette.primary }]}>Cancel Edit</Text>
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
                        style={[styles.choiceChip, active && styles.choiceChipActive, active && { borderColor: palette.primary, backgroundColor: palette.primarySoft8 }]}
                      >
                        <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive, active && { color: palette.primary }]}>
                          {householdLabel(type)}
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
                        style={[styles.choiceChip, active && styles.choiceChipActive, active && { borderColor: palette.primary, backgroundColor: palette.primarySoft8 }]}
                      >
                        <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive, active && { color: palette.primary }]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  style={[styles.primaryButton, { backgroundColor: palette.primary }, busyKey === 'delegate-create' && styles.buttonDisabled]}
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
                        Access: QR {row.canGenerateQR ? '✓' : '✕'} • Workers{' '}
                        {row.canManageWorkers ? '✓' : '✕'} • Billing {row.canViewFinancials ? '✓' : '✕'}
                      </Text>
                      <View style={styles.rowActions}>
                        {showLegacyDelegateManagement && canCreateDelegates ? (
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
              <Text style={styles.cardTitle}>Authorized Accounts</Text>
              <Text style={styles.cardSub}>
                Authorized user access requests are reviewed by management before activation.
              </Text>
            </View>
          </>
        ) : null}

        {hasUnit && !isLoading && section === 'staff' ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Home Staff</Text>
              <Text style={styles.cardSub}>
                Submit home staff access requests (driver, nanny, servant, gardener) for admin approval.
              </Text>
              {!canManageWorkers ? (
                <View style={styles.noticeBox}>
                  <Text style={styles.noticeText}>
                    Current account cannot manage workers on this unit.
                  </Text>
                </View>
              ) : null}
            </View>
            {canManageWorkers ? (
              <View style={styles.card}>
                <Text style={styles.formTitle}>New Home Staff Request</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Full name"
                  value={homeStaffRequestForm.fullName}
                  onChangeText={(v) => setHomeStaffRequestForm((p) => ({ ...p, fullName: v }))}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Phone"
                  value={homeStaffRequestForm.phone}
                  onChangeText={(v) => setHomeStaffRequestForm((p) => ({ ...p, phone: v }))}
                  keyboardType="phone-pad"
                />
                <TextInput
                  style={styles.input}
                  placeholder="ID / Passport Number"
                  value={homeStaffRequestForm.nationalIdOrPassport}
                  onChangeText={(v) =>
                    setHomeStaffRequestForm((p) => ({ ...p, nationalIdOrPassport: v }))
                  }
                />
                <View style={styles.optionRow}>
                  {(['DRIVER', 'NANNY', 'SERVANT', 'GARDENER', 'OTHER'] as const).map((type) => {
                    const active = homeStaffRequestForm.staffType === type;
                    return (
                      <Pressable
                        key={type}
                        onPress={() => setHomeStaffRequestForm((p) => ({ ...p, staffType: type }))}
                        style={[styles.choiceChip, active && styles.choiceChipActive, active && { borderColor: palette.primary, backgroundColor: palette.primarySoft8 }]}
                      >
                        <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive, active && { color: palette.primary }]}>
                          {householdLabel(type)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Employment duration (e.g. 6 months)"
                  value={homeStaffRequestForm.employmentDuration}
                  onChangeText={(v) =>
                    setHomeStaffRequestForm((p) => ({ ...p, employmentDuration: v }))
                  }
                />
                <View style={styles.optionRow}>
                  {[true, false].map((value) => {
                    const active = homeStaffRequestForm.liveIn === value;
                    return (
                      <Pressable
                        key={String(value)}
                        onPress={() => setHomeStaffRequestForm((p) => ({ ...p, liveIn: value }))}
                        style={[styles.choiceChip, active && styles.choiceChipActive, active && { borderColor: palette.primary, backgroundColor: palette.primarySoft8 }]}
                      >
                        <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive, active && { color: palette.primary }]}>
                          {value ? 'Live-in' : 'Non live-in'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Access From (YYYY-MM-DD)"
                  value={homeStaffRequestForm.accessFrom}
                  onChangeText={(v) => setHomeStaffRequestForm((p) => ({ ...p, accessFrom: v }))}
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Access To (YYYY-MM-DD)"
                  value={homeStaffRequestForm.accessTo}
                  onChangeText={(v) => setHomeStaffRequestForm((p) => ({ ...p, accessTo: v }))}
                  autoCapitalize="none"
                />
                <View style={styles.uploadRow}>
                  <Pressable
                    style={[styles.secondaryButton, busyKey === 'upload-staff-idOrPassportFileId' && styles.buttonDisabled]}
                    onPress={() => void handleUploadHomeStaffFile('idOrPassportFileId', 'delegate-id')}
                    disabled={busyKey === 'upload-staff-idOrPassportFileId'}
                  >
                    <Text style={styles.secondaryButtonText}>Upload ID/Passport File</Text>
                  </Pressable>
                  <Text style={styles.uploadIdText} numberOfLines={1}>
                    {homeStaffRequestForm.idOrPassportFileId || 'No file uploaded'}
                  </Text>
                </View>
                <View style={styles.uploadRow}>
                  <Pressable
                    style={[styles.secondaryButton, busyKey === 'upload-staff-personalPhotoFileId' && styles.buttonDisabled]}
                    onPress={() => void handleUploadHomeStaffFile('personalPhotoFileId', 'profile-photo')}
                    disabled={busyKey === 'upload-staff-personalPhotoFileId'}
                  >
                    <Text style={styles.secondaryButtonText}>Upload Personal Photo</Text>
                  </Pressable>
                  <Text style={styles.uploadIdText} numberOfLines={1}>
                    {homeStaffRequestForm.personalPhotoFileId || 'Optional'}
                  </Text>
                </View>
                <Pressable
                  style={[styles.primaryButton, { backgroundColor: palette.primary }, busyKey === 'home-staff-request-create' && styles.buttonDisabled]}
                  onPress={() => void handleCreateHomeStaffRequest()}
                  disabled={busyKey === 'home-staff-request-create'}
                >
                  <Text style={styles.primaryButtonText}>
                    {busyKey === 'home-staff-request-create' ? 'Submitting...' : 'Submit Home Staff Request'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.formTitle}>Home Staff Requests</Text>
              {householdRequests.homeStaff.length === 0 ? (
                <Text style={styles.emptyText}>No home staff requests for this unit.</Text>
              ) : (
                householdRequests.homeStaff.map((row: HomeStaffAccessRow) => (
                  <View key={row.id} style={styles.rowCard}>
                    <View style={styles.rowHeader}>
                      <Text style={styles.rowTitle}>{row.fullName}</Text>
                      <View style={styles.statusPill}>
                        <Text style={styles.statusPillText}>{householdLabel(row.status)}</Text>
                      </View>
                    </View>
                    <Text style={styles.rowSub}>
                      {householdLabel(row.staffType || 'OTHER')} • {row.isLiveIn ? 'Live-in' : 'Non live-in'}
                    </Text>
                    <Text style={styles.rowSub}>
                      {row.phone || '—'} • {row.accessValidFrom ? formatDateTime(row.accessValidFrom) : '—'} → {row.accessValidTo ? formatDateTime(row.accessValidTo) : '—'}
                    </Text>
                    {row.rejectionReason ? (
                      <Text style={styles.errorText}>Rejection: {row.rejectionReason}</Text>
                    ) : null}
                  </View>
                ))
              )}
            </View>

            {showLegacyWorkerTools ? (
              <>
                <View style={styles.card}>
                  <Text style={styles.formTitle}>Create Worker</Text>
                  <Text style={styles.cardSub}>
                    Home staff records are linked internally after admin review.
                  </Text>
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Workers</Text>
                  <Text style={styles.emptyText}>Worker tools are disabled in this mode.</Text>
                </View>
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>
      <Modal
        visible={unitPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setUnitPickerOpen(false)}
      >
        <View style={styles.unitPickerModalRoot}>
          <Pressable style={styles.unitPickerModalBackdrop} onPress={() => setUnitPickerOpen(false)} />
          <View style={styles.unitPickerModalCard}>
            <UnitPicker
              units={units}
              selectedUnitId={selectedUnitId}
              onSelect={(unitId) => {
                onSelectUnit(unitId);
                setUnitPickerOpen(false);
              }}
              onRefresh={() => void onRefreshUnits()}
              isRefreshing={unitsRefreshing}
              title="Select Unit"
            />
          </View>
        </View>
      </Modal>
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
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    padding: 0,
    gap: 10,
  },
  unitContextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 12,
    backgroundColor: akColors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  unitContextText: {
    flex: 1,
    color: akColors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  unitContextChangeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  unitPickerModalRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  unitPickerModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.28)',
  },
  unitPickerModalCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    padding: 14,
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
  heroRefreshText: {
    color: '#FFFFFF',
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
  wizardStepsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  wizardStepChip: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wizardStepChipActive: {
    borderColor: akColors.primary,
    backgroundColor: 'rgba(42,62,53,0.08)',
  },
  wizardStepChipDone: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16,185,129,0.08)',
  },
  wizardStepChipText: {
    color: akColors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  wizardStepChipTextDone: {
    color: '#047857',
  },
  wizardStepTitle: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  wizardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wizardActionButton: {
    flex: 1,
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
  emptyStateCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    color: akColors.text,
    fontSize: 14,
    fontWeight: '700',
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


