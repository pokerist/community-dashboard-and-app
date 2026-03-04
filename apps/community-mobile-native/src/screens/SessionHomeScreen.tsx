import { useCallback, useEffect, useMemo, useState } from 'react';
import { Feather, Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Image,
  Modal,
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
import { useBranding } from '../features/branding/provider';
import { getBrandPalette } from '../features/branding/palette';
import type { AuthSession } from '../features/auth/types';
import type {
  AuthBootstrapProfile,
  ProfileChangeRequestRow,
} from '../features/auth/types';
import {
  createMyResidentVehicle,
  deleteMyResidentVehicle,
  getAuthBootstrapProfile,
  listMyProfileChangeRequests,
  listMyResidentVehicles,
  type ResidentVehiclePayload,
  type ResidentVehicleRow,
  updateMyProfilePhoto,
  updateMyResidentVehicle,
  updateAuthSecuritySettings,
  updateAuthBootstrapProfile,
} from '../features/auth/profile';
import { pickAndUploadFileByPurpose } from '../features/files/service';
import { API_BASE_URL } from '../config/env';
import { unitStatusDisplayLabel } from '../features/presentation/status';
import { useI18n } from '../features/i18n/provider';
import { akColors, akRadius, akShadow } from '../theme/alkarma';
import { formatDateTime } from '../utils/format';

type SessionHomeScreenProps = {
  session: AuthSession;
  isRefreshing: boolean;
  refreshError: string | null;
  onRefreshSession: () => Promise<void>;
  onLogout: () => Promise<void>;
  onProfileBootstrapUpdated?: (profile: AuthBootstrapProfile) => void;
};

type CapabilityChip = {
  key: string;
  label: string;
};

function humanizeRole(role?: string | null) {
  const key = String(role ?? '').toUpperCase();
  switch (key) {
    case 'SUPER_ADMIN':
      return 'Super Admin';
    case 'MANAGER':
      return 'Community Manager';
    case 'COMMUNITY_USER':
      return 'Resident';
    default:
      return key
        .toLowerCase()
        .split('_')
        .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : p))
        .join(' ');
  }
}

function humanizePersona(persona?: AuthBootstrapProfile['personaHints'] extends infer P ? any : any) {
  const key = String(persona?.resolvedPersona ?? '').toUpperCase();
  switch (key) {
    case 'PRE_DELIVERY_OWNER':
      return 'Pre-delivery Owner';
    case 'CONTRACTOR':
      return 'Authorized User';
    case 'AUTHORIZED':
      return 'Authorized User';
    case 'OWNER':
      return 'Owner';
    case 'TENANT':
      return 'Tenant';
    case 'FAMILY':
      return 'Family Member';
    default:
      return 'Resident';
  }
}

function buildCapabilityChips(profile: AuthBootstrapProfile | null): CapabilityChip[] {
  if (!profile) return [];
  const chips: CapabilityChip[] = [];
  const f = profile.featureAvailability ?? {};
  const p = profile.personaHints ?? {};

  if (f.canUseServices) chips.push({ key: 'services', label: 'Services & Requests' });
  if (f.canUseBookings) chips.push({ key: 'bookings', label: 'Facility Bookings' });
  if (f.canUseQr) chips.push({ key: 'qr', label: 'Visitor QR Codes' });
  if (f.canViewFinance) chips.push({ key: 'finance', label: 'Payments & Violations' });
  if (f.canUseComplaints) chips.push({ key: 'complaints', label: 'Complaints' });
  if (f.canManageHousehold) chips.push({ key: 'household', label: 'Household Management' });
  if (p.canManageWorkers) chips.push({ key: 'workers', label: 'Home Staff Access' });
  if (p.isPreDeliveryOwner) chips.push({ key: 'pre', label: 'Pre-delivery Access' });

  return chips;
}

function profileRequestStatusLabel(status?: string | null) {
  const key = String(status ?? '').toUpperCase();
  switch (key) {
    case 'PENDING':
      return 'Pending Admin Approval';
    case 'APPROVED':
      return 'Approved';
    case 'REJECTED':
      return 'Rejected';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return '—';
  }
}

export function SessionHomeScreen({
  session,
  isRefreshing: _isRefreshing,
  refreshError: _refreshError,
  onRefreshSession: _onRefreshSession,
  onLogout,
  onProfileBootstrapUpdated,
}: SessionHomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { brand } = useBranding();
  const palette = getBrandPalette(brand);
  const { language, setLanguage, t } = useI18n();
  const toast = useAppToast();
  const [profile, setProfile] = useState<AuthBootstrapProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [latestProfileRequest, setLatestProfileRequest] =
    useState<ProfileChangeRequestRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editNameEn, setEditNameEn] = useState('');
  const [editNameAr, setEditNameAr] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editProfilePhotoId, setEditProfilePhotoId] = useState<string | null>(null);
  const [isUploadingProfilePhoto, setIsUploadingProfilePhoto] = useState(false);
  const [localProfilePreviewUri, setLocalProfilePreviewUri] = useState<string | null>(null);
  const [profilePhotoVersion, setProfilePhotoVersion] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [vehicleEditingId, setVehicleEditingId] = useState<string | null>(null);
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehicleNotes, setVehicleNotes] = useState('');
  const [vehiclePrimary, setVehiclePrimary] = useState(false);
  const [isSavingVehicle, setIsSavingVehicle] = useState(false);
  const [deletingVehicleId, setDeletingVehicleId] = useState<string | null>(null);

  const loadProfile = async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setIsLoadingProfile(true);
    else setIsRefreshingProfile(true);
    setProfileError(null);
    try {
      const [result, changeRequests] = await Promise.all([
        getAuthBootstrapProfile(session.accessToken),
        listMyProfileChangeRequests(session.accessToken),
      ]);
      setProfile(result);
      onProfileBootstrapUpdated?.(result);
      setLatestProfileRequest(changeRequests[0] ?? null);
      setEditNameEn(result.user?.nameEN ?? '');
      setEditNameAr(result.user?.nameAR ?? '');
      setEditEmail(result.user?.email ?? '');
      setEditPhone(result.user?.phone ?? '');
      setEditProfilePhotoId(result.user?.profilePhoto?.id ?? null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to load profile';
      setProfileError(msg);
    } finally {
      setIsLoadingProfile(false);
      setIsRefreshingProfile(false);
    }
  };

  useEffect(() => {
    void loadProfile('initial');
  }, [session.accessToken]);

  const unitCount = profile?.units?.length ?? 0;
  const displayName =
    profile?.user?.nameEN || profile?.user?.nameAR || session.email.split('@')[0] || 'Resident';
  const roleLabel = humanizePersona(profile?.personaHints);
  const initial = String(displayName).trim().charAt(0).toUpperCase() || 'R';
  const capabilityChips = useMemo(() => buildCapabilityChips(profile), [profile]);
  const vehicles = useMemo(() => profile?.vehicles ?? [], [profile?.vehicles]);
  const avatarImageUri = profile?.user?.profilePhoto?.id
    ? `${API_BASE_URL}/files/public/profile-photo/${profile.user.profilePhoto.id}?t=${profilePhotoVersion}`
    : null;
  const editAvatarImageUri = editProfilePhotoId
    ? `${API_BASE_URL}/files/public/profile-photo/${editProfilePhotoId}?t=${profilePhotoVersion}`
    : localProfilePreviewUri;

  const handleSaveProfile = async () => {
    const normalizedEmail = editEmail.trim();
    const normalizedPhone = editPhone.trim();
    const payload = {
      nameEN: editNameEn.trim() || undefined,
      nameAR: editNameAr.trim() || undefined,
      email: normalizedEmail || undefined,
      phone: normalizedPhone || undefined,
    };
    const hasContactPayload = Boolean(payload.nameEN || payload.nameAR || payload.email || payload.phone);
    const currentPhotoId = profile?.user?.profilePhoto?.id ?? null;
    const hasPhotoChange = Boolean(editProfilePhotoId && editProfilePhotoId !== currentPhotoId);
    if (!hasContactPayload && !hasPhotoChange) {
      toast.error(t('profile.nothingToSave'), t('profile.enterAtLeastOne'));
      return;
    }

    if (hasContactPayload && normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      toast.error(t('profile.invalidEmail'), t('profile.invalidEmailMsg'));
      return;
    }

    setIsSaving(true);
    try {
      let profileUpdated = false;
      if (hasPhotoChange && editProfilePhotoId) {
        const updated = await updateMyProfilePhoto(session.accessToken, editProfilePhotoId);
        setProfile(updated);
        onProfileBootstrapUpdated?.(updated);
        setProfilePhotoVersion((prev) => prev + 1);
        setLocalProfilePreviewUri(null);
        profileUpdated = true;
      }

      if (hasContactPayload) {
        const requestRow = await updateAuthBootstrapProfile(session.accessToken, payload);
        setLatestProfileRequest(requestRow);
      }
      setEditOpen(false);
      if (profileUpdated && hasContactPayload) {
        toast.success(t('profile.updated'), 'Photo updated. Contact changes are pending admin approval.');
      } else if (profileUpdated) {
        toast.success(t('profile.updated'), 'Profile photo updated successfully.');
      } else {
        toast.success(t('profile.updated'), 'Your profile change request is pending admin approval.');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to update profile';
      toast.error(t('profile.updateFailed'), msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadProfilePhoto = useCallback(async () => {
    setIsUploadingProfilePhoto(true);
    try {
      const uploaded = await pickAndUploadFileByPurpose(
        session.accessToken,
        'profile-photo',
      );
      if (!uploaded) return;
      if (uploaded.localUri) {
        setLocalProfilePreviewUri(uploaded.localUri);
      }
      setEditProfilePhotoId(uploaded.id);
      setProfilePhotoVersion((prev) => prev + 1);
      toast.success('Photo uploaded', 'Tap Save Changes to apply it.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to upload profile photo';
      toast.error('Photo upload failed', msg);
    } finally {
      setIsUploadingProfilePhoto(false);
    }
  }, [session.accessToken, toast]);

  const handleToggleTwoFactor = async (enabled: boolean) => {
    if (!profile || isSavingSecurity) return;
    const previous = Boolean(profile.user?.twoFactorEnabled);
    if (previous === enabled) return;
    setIsSavingSecurity(true);
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            user: {
              ...prev.user,
              twoFactorEnabled: enabled,
            },
          }
        : prev,
    );
    try {
      const updated = await updateAuthSecuritySettings(session.accessToken, {
        twoFactorEnabled: enabled,
      });
      setProfile(updated);
      toast.success(
        enabled ? t('profile.twoFactorEnabled') : t('profile.twoFactorDisabled'),
        enabled
          ? t('profile.twoFactorEnabledMsg')
          : t('profile.twoFactorDisabledMsg'),
      );
    } catch (error) {
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              user: {
                ...prev.user,
                twoFactorEnabled: previous,
              },
            }
          : prev,
      );
      const msg = error instanceof Error ? error.message : 'Failed to update 2FA settings';
      toast.error(t('profile.securityUpdateFailed'), msg);
    } finally {
      setIsSavingSecurity(false);
    }
  };

  const applyVehicles = useCallback((rows: ResidentVehicleRow[]) => {
    setProfile((prev) => (prev ? { ...prev, vehicles: rows } : prev));
  }, []);

  const reloadVehicles = useCallback(async () => {
    const rows = await listMyResidentVehicles(session.accessToken);
    applyVehicles(rows);
    return rows;
  }, [applyVehicles, session.accessToken]);

  const resetVehicleForm = useCallback(() => {
    setVehicleEditingId(null);
    setVehicleType('');
    setVehicleModel('');
    setVehiclePlate('');
    setVehicleColor('');
    setVehicleNotes('');
    setVehiclePrimary(false);
  }, []);

  const openAddVehicle = useCallback(() => {
    resetVehicleForm();
    setVehicleModalOpen(true);
  }, [resetVehicleForm]);

  const openEditVehicle = useCallback((vehicle: ResidentVehicleRow) => {
    setVehicleEditingId(vehicle.id);
    setVehicleType(vehicle.vehicleType ?? '');
    setVehicleModel(vehicle.model ?? '');
    setVehiclePlate(vehicle.plateNumber ?? '');
    setVehicleColor(vehicle.color ?? '');
    setVehicleNotes(vehicle.notes ?? '');
    setVehiclePrimary(Boolean(vehicle.isPrimary));
    setVehicleModalOpen(true);
  }, []);

  const saveVehicle = useCallback(async () => {
    const payload: ResidentVehiclePayload = {
      vehicleType: vehicleType.trim(),
      model: vehicleModel.trim(),
      plateNumber: vehiclePlate.trim(),
      color: vehicleColor.trim() || undefined,
      notes: vehicleNotes.trim() || undefined,
      isPrimary: vehiclePrimary,
    };

    if (!payload.vehicleType || !payload.model || !payload.plateNumber) {
      toast.error(t('profile.vehicleValidation'), t('profile.enterAtLeastOne'));
      return;
    }

    setIsSavingVehicle(true);
    try {
      if (vehicleEditingId) {
        await updateMyResidentVehicle(session.accessToken, vehicleEditingId, payload);
      } else {
        await createMyResidentVehicle(session.accessToken, payload);
      }
      await reloadVehicles();
      setVehicleModalOpen(false);
      resetVehicleForm();
      toast.success(t('profile.vehicleSaved'), t('profile.updatedMsg'));
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to save vehicle';
      toast.error(t('profile.vehicleSaveFailed'), msg);
    } finally {
      setIsSavingVehicle(false);
    }
  }, [
    resetVehicleForm,
    reloadVehicles,
    session.accessToken,
    t,
    toast,
    vehicleColor,
    vehicleEditingId,
    vehicleModel,
    vehicleNotes,
    vehiclePlate,
    vehiclePrimary,
    vehicleType,
  ]);

  const removeVehicle = useCallback(
    async (vehicleId: string) => {
      setDeletingVehicleId(vehicleId);
      try {
        await deleteMyResidentVehicle(session.accessToken, vehicleId);
        await reloadVehicles();
        toast.success(t('profile.vehicleDeleted'), t('profile.updatedMsg'));
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to delete vehicle';
        toast.error(t('profile.vehicleDeleteFailed'), msg);
      } finally {
        setDeletingVehicleId(null);
      }
    },
    [reloadVehicles, session.accessToken, t, toast],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: 0 },
        ]}
      >
        <BrandedPageHero
          title=""
          showBack={false}
          hideHeaderRow
        >
          <View style={styles.profileHeroRow}>
            <View style={styles.avatarWrap}>
              {avatarImageUri ? (
                <Image
                  source={{
                    uri: avatarImageUri,
                    headers: {
                      Authorization: `Bearer ${session.accessToken}`,
                    },
                  }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.avatarText}>{initial}</Text>
              )}
            </View>
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroName}>{displayName}</Text>
              <Text style={styles.heroEmail}>{session.email}</Text>
            </View>
            <Pressable style={styles.heroEditButton} onPress={() => setEditOpen(true)}>
              <Feather name="edit-2" size={16} color="#FFFFFF" />
            </Pressable>
          </View>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatLabel}>Units</Text>
              <Text style={styles.heroStatValue}>{unitCount}</Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatLabel}>Account Type</Text>
              <Text style={[styles.heroStatValue, styles.heroStatValueSmall]}>{roleLabel}</Text>
            </View>
          </View>
        </BrandedPageHero>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>{t('profile.title')}</Text>
            <Pressable onPress={() => void loadProfile('refresh')} disabled={isRefreshingProfile}>
              <Text style={[styles.linkText, { color: palette.primary }]}>
                {isRefreshingProfile ? t('common.refreshing') : t('common.refresh')}
              </Text>
            </Pressable>
          </View>

          {isLoadingProfile ? <ActivityIndicator color={palette.primary} /> : null}
          {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}

          {profile ? (
            <>
              <InfoRow label={t('profile.fullName')} value={displayName} />
              <InfoRow label={t('profile.email')} value={profile.user.email || session.email || '—'} />
              <InfoRow label={t('profile.phone')} value={profile.user.phone || 'Not added'} />
              {latestProfileRequest ? (
                <InfoRow
                  label="Last Profile Change Request"
                  value={`${profileRequestStatusLabel(latestProfileRequest.status)}${
                    latestProfileRequest.rejectionReason
                      ? ` • ${latestProfileRequest.rejectionReason}`
                      : ''
                  }`}
                />
              ) : null}
              <InfoRow
                label={t('profile.roles')}
                value={profile.roles.length ? profile.roles.map(humanizeRole).join(', ') : 'Resident'}
              />
              <InfoRow
                label={t('profile.profileTypes')}
                value={Object.entries(profile.profileKinds)
                  .filter(([, enabled]) => Boolean(enabled))
                  .map(([key]) => humanizeRole(key))
                  .join(', ') || '—'}
              />
              {profile.user.lastLoginAt ? (
                <InfoRow label={t('profile.lastLogin')} value={formatDateTime(profile.user.lastLoginAt)} />
              ) : null}
            </>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.access')}</Text>
          {capabilityChips.length === 0 ? (
            <Text style={styles.hint}>{t('profile.noFeaturePermissions')}</Text>
          ) : (
            <View style={styles.permissionsWrap}>
              {capabilityChips.map((chip) => (
                <View key={chip.key} style={styles.permissionChip}>
                  <Text style={styles.permissionChipText}>{chip.label}</Text>
                </View>
              ))}
            </View>
          )}
          {profile?.units?.slice(0, 5).map((unit) => {
            const roleLabels = (unit.accesses ?? [])
              .map((a) => humanizeRole(a.role))
              .filter(Boolean)
              .join(', ');
            return (
              <View key={unit.id} style={styles.inlinePanel}>
                <Text style={styles.inlinePanelTitle}>{unit.unitNumber ?? 'Unit'}</Text>
                <Text style={styles.inlinePanelSub}>
                  {unit.projectName ?? 'Project'}
                  {unit.block ? ` • Block ${unit.block}` : ''}
                  {unit.status ? ` • ${unitStatusDisplayLabel(unit.status)}` : ''}
                </Text>
                {roleLabels ? (
                  <Text style={styles.inlinePanelSub}>Access: {roleLabels}</Text>
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>{t('profile.vehiclesTitle')}</Text>
            <Pressable onPress={openAddVehicle}>
              <Text style={styles.linkText}>{t('profile.vehiclesAdd')}</Text>
            </Pressable>
          </View>
          {vehicles.length === 0 ? (
            <Text style={styles.hint}>{t('profile.vehiclesNone')}</Text>
          ) : (
            vehicles.map((vehicle) => (
              <View key={vehicle.id} style={styles.inlinePanel}>
                <View style={styles.vehicleRowHeader}>
                  <View style={styles.vehicleTitleWrap}>
                    <Text style={styles.inlinePanelTitle}>
                      {vehicle.vehicleType} • {vehicle.model}
                    </Text>
                    <Text style={styles.inlinePanelSub}>{vehicle.plateNumber}</Text>
                  </View>
                  {vehicle.isPrimary ? (
                    <View style={styles.vehiclePrimaryBadge}>
                      <Text style={styles.vehiclePrimaryBadgeText}>{t('profile.vehiclePrimary')}</Text>
                    </View>
                  ) : null}
                </View>
                {vehicle.color ? (
                  <Text style={styles.inlinePanelSub}>
                    {t('profile.vehicleColor')}: {vehicle.color}
                  </Text>
                ) : null}
                {vehicle.notes ? (
                  <Text style={styles.inlinePanelSub}>{vehicle.notes}</Text>
                ) : null}
                <View style={styles.vehicleActionsRow}>
                  <Pressable style={styles.vehicleActionBtn} onPress={() => openEditVehicle(vehicle)}>
                    <Text style={styles.vehicleActionText}>{t('profile.vehicleEdit')}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.vehicleActionBtnDanger, deletingVehicleId === vehicle.id && styles.buttonDisabled]}
                    onPress={() => void removeVehicle(vehicle.id)}
                    disabled={deletingVehicleId === vehicle.id}
                  >
                    <Text style={styles.vehicleActionTextDanger}>
                      {deletingVehicleId === vehicle.id ? t('common.updating') : t('profile.vehicleDelete')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.support')}</Text>
          <View style={styles.languageRow}>
            <Text style={styles.languageLabel}>{t('common.language')}</Text>
            <View style={styles.languageActions}>
              <Pressable
                onPress={() => void setLanguage('en')}
                style={[
                  styles.languageBtn,
                  language === 'en' && styles.languageBtnActive,
                  language === 'en' && { borderColor: palette.primary, backgroundColor: palette.primary },
                ]}
              >
                <Text style={[styles.languageBtnText, language === 'en' && styles.languageBtnTextActive]}>
                  {t('common.english')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void setLanguage('ar')}
                style={[
                  styles.languageBtn,
                  language === 'ar' && styles.languageBtnActive,
                  language === 'ar' && { borderColor: palette.primary, backgroundColor: palette.primary },
                ]}
              >
                <Text style={[styles.languageBtnText, language === 'ar' && styles.languageBtnTextActive]}>
                  {t('common.arabic')}
                </Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.securityRow}>
            <View style={styles.securityTextWrap}>
              <Text style={styles.languageLabel}>{t('profile.twoFactorTitle')}</Text>
              <Text style={styles.hintMini}>{t('profile.twoFactorHint')}</Text>
            </View>
            <Switch
              value={Boolean(profile?.user?.twoFactorEnabled)}
              onValueChange={(value) => void handleToggleTwoFactor(value)}
              disabled={!profile || isSavingSecurity}
              trackColor={{ false: akColors.border, true: palette.primarySoft22 }}
              thumbColor={Boolean(profile?.user?.twoFactorEnabled) ? palette.primary : akColors.surfaceMuted}
            />
          </View>
          {isSavingSecurity ? (
            <Text style={styles.hintMini}>{t('profile.updatingSecurity')}</Text>
          ) : null}
          <Text style={styles.hint}>
            {t('profile.supportHint')}
          </Text>
          <Pressable style={[styles.logoutButton, { backgroundColor: palette.primary }]} onPress={() => void onLogout()}>
            <Text style={styles.logoutButtonText}>{t('common.logout')}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={editOpen} transparent animationType="fade" onRequestClose={() => setEditOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => !isSaving && setEditOpen(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <Pressable onPress={() => !isSaving && setEditOpen(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={18} color={akColors.text} />
              </Pressable>
            </View>

            <View style={styles.modalPhotoRow}>
              <View style={styles.modalAvatarWrap}>
                {editAvatarImageUri ? (
                  <Image
                    source={{ uri: editAvatarImageUri }}
                    style={styles.modalAvatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.modalAvatarText}>{initial}</Text>
                )}
              </View>
              <Pressable
                style={[styles.modalPhotoButton, isUploadingProfilePhoto && styles.buttonDisabled]}
                onPress={() => void handleUploadProfilePhoto()}
                disabled={isUploadingProfilePhoto || isSaving}
              >
                {isUploadingProfilePhoto ? (
                  <View style={styles.buttonRow}>
                    <ActivityIndicator size="small" color={akColors.white} />
                    <Text style={styles.primaryButtonText}>Uploading...</Text>
                  </View>
                ) : (
                  <Text style={styles.primaryButtonText}>Upload Profile Photo</Text>
                )}
              </Pressable>
            </View>

            <Text style={styles.label}>Name (English)</Text>
            <TextInput
              value={editNameEn}
              onChangeText={setEditNameEn}
              style={styles.input}
              placeholder="Ahmed Hassan"
              placeholderTextColor={akColors.textSoft}
              editable={!isSaving}
            />

            <Text style={styles.label}>Name (Arabic) - optional</Text>
            <TextInput
              value={editNameAr}
              onChangeText={setEditNameAr}
              style={styles.input}
              placeholder="أحمد حسن"
              placeholderTextColor={akColors.textSoft}
              editable={!isSaving}
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              value={editEmail}
              onChangeText={setEditEmail}
              style={styles.input}
              placeholder="email@example.com"
              placeholderTextColor={akColors.textSoft}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!isSaving}
            />

            <Text style={styles.label}>Phone</Text>
            <TextInput
              value={editPhone}
              onChangeText={setEditPhone}
              style={styles.input}
              placeholder="+201100000000"
              placeholderTextColor={akColors.textSoft}
              keyboardType="phone-pad"
              editable={!isSaving}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.secondaryButton, isSaving && styles.buttonDisabled]}
                onPress={() => setEditOpen(false)}
                disabled={isSaving}
              >
                <Text style={styles.secondaryButtonText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, isSaving && styles.buttonDisabled]}
                onPress={() => void handleSaveProfile()}
                disabled={isSaving}
              >
                {isSaving ? (
                  <View style={styles.buttonRow}>
                    <ActivityIndicator size="small" color={akColors.white} />
                    <Text style={styles.primaryButtonText}>{t('profile.saving')}</Text>
                  </View>
                ) : (
                  <Text style={styles.primaryButtonText}>{t('profile.saveChanges')}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={vehicleModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !isSavingVehicle && setVehicleModalOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => !isSavingVehicle && setVehicleModalOpen(false)}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {vehicleEditingId ? t('profile.vehicleEdit') : t('profile.vehiclesAdd')}
              </Text>
              <Pressable
                onPress={() => !isSavingVehicle && setVehicleModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={18} color={akColors.text} />
              </Pressable>
            </View>

            <Text style={styles.label}>{t('profile.vehicleType')}</Text>
            <TextInput
              value={vehicleType}
              onChangeText={setVehicleType}
              style={styles.input}
              placeholder="Toyota"
              placeholderTextColor={akColors.textSoft}
              editable={!isSavingVehicle}
            />

            <Text style={styles.label}>{t('profile.vehicleModel')}</Text>
            <TextInput
              value={vehicleModel}
              onChangeText={setVehicleModel}
              style={styles.input}
              placeholder="Corolla 2024"
              placeholderTextColor={akColors.textSoft}
              editable={!isSavingVehicle}
            />

            <Text style={styles.label}>{t('profile.vehiclePlate')}</Text>
            <TextInput
              value={vehiclePlate}
              onChangeText={setVehiclePlate}
              style={styles.input}
              placeholder={t('profile.vehiclePlateHint')}
              placeholderTextColor={akColors.textSoft}
              editable={!isSavingVehicle}
            />

            <Text style={styles.label}>{t('profile.vehicleColor')}</Text>
            <TextInput
              value={vehicleColor}
              onChangeText={setVehicleColor}
              style={styles.input}
              placeholder="White"
              placeholderTextColor={akColors.textSoft}
              editable={!isSavingVehicle}
            />

            <Text style={styles.label}>{t('profile.vehicleNotes')}</Text>
            <TextInput
              value={vehicleNotes}
              onChangeText={setVehicleNotes}
              style={[styles.input, styles.inputMultiline]}
              placeholder="Parking B2 - Slot 14"
              placeholderTextColor={akColors.textSoft}
              editable={!isSavingVehicle}
              multiline
            />

            <Pressable
              style={styles.vehiclePrimaryToggle}
              onPress={() => setVehiclePrimary((prev) => !prev)}
              disabled={isSavingVehicle}
            >
              <View style={[styles.vehiclePrimaryCheck, vehiclePrimary && styles.vehiclePrimaryCheckActive]}>
                {vehiclePrimary ? <Ionicons name="checkmark" size={12} color={akColors.white} /> : null}
              </View>
              <Text style={styles.vehiclePrimaryText}>{t('profile.vehicleMakePrimary')}</Text>
            </Pressable>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.secondaryButton, isSavingVehicle && styles.buttonDisabled]}
                onPress={() => setVehicleModalOpen(false)}
                disabled={isSavingVehicle}
              >
                <Text style={styles.secondaryButtonText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, isSavingVehicle && styles.buttonDisabled]}
                onPress={() => void saveVehicle()}
                disabled={isSavingVehicle}
              >
                {isSavingVehicle ? (
                  <View style={styles.buttonRow}>
                    <ActivityIndicator size="small" color={akColors.white} />
                    <Text style={styles.primaryButtonText}>{t('profile.vehicleSaving')}</Text>
                  </View>
                ) : (
                  <Text style={styles.primaryButtonText}>{t('profile.vehicleSave')}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: akColors.bg,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 110,
    gap: 16,
  },
  profileHero: {
    borderRadius: 24,
    minHeight: 230,
    padding: 22,
    gap: 18,
    justifyContent: 'center',
    ...akShadow.card,
  },
  profileHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(201,169,97,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(201,169,97,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: akColors.white,
    fontSize: 24,
    fontWeight: '700',
  },
  heroTextWrap: {
    flex: 1,
    gap: 2,
  },
  heroName: {
    color: akColors.white,
    fontSize: 20,
    fontWeight: '700',
  },
  heroRole: {
    color: akColors.gold,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heroEmail: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
  },
  heroEditButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(201,169,97,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroStatCard: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 12,
    gap: 2,
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 11,
  },
  heroStatValue: {
    color: akColors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  heroStatValueSmall: {
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    backgroundColor: akColors.surface,
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: akRadius.card,
    padding: 14,
    gap: 10,
    ...akShadow.soft,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: akColors.text,
    marginBottom: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    fontSize: 12,
    color: akColors.textMuted,
    marginTop: 2,
  },
  value: {
    fontSize: 14,
    color: akColors.text,
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    color: akColors.textMuted,
  },
  languageRow: {
    marginTop: 4,
    marginBottom: 6,
    gap: 8,
  },
  securityRow: {
    marginTop: 2,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  securityTextWrap: {
    flex: 1,
    gap: 2,
  },
  languageLabel: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  hintMini: {
    color: akColors.textSoft,
    fontSize: 11,
    lineHeight: 15,
  },
  languageActions: {
    flexDirection: 'row',
    gap: 8,
  },
  languageBtn: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: akColors.surface,
  },
  languageBtnActive: {
    borderColor: akColors.primary,
    backgroundColor: `${akColors.primary}12`,
  },
  languageBtnText: {
    color: akColors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  languageBtnTextActive: {
    color: '#FFFFFF',
  },
  linkText: {
    color: akColors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  inlinePanel: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 12,
    backgroundColor: akColors.surfaceMuted,
    padding: 11,
    gap: 3,
    marginTop: 2,
  },
  inlinePanelTitle: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  inlinePanelSub: {
    color: akColors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  vehicleRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  vehicleTitleWrap: {
    flex: 1,
    gap: 2,
  },
  vehiclePrimaryBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
    backgroundColor: 'rgba(16,185,129,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  vehiclePrimaryBadgeText: {
    color: akColors.success,
    fontSize: 10,
    fontWeight: '700',
  },
  vehicleActionsRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  vehicleActionBtn: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 10,
    backgroundColor: akColors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  vehicleActionText: {
    color: akColors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  vehicleActionBtnDanger: {
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.25)',
    borderRadius: 10,
    backgroundColor: 'rgba(220,38,38,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  vehicleActionTextDanger: {
    color: akColors.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  permissionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  permissionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(42,62,53,0.18)',
    backgroundColor: 'rgba(42,62,53,0.07)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  permissionChipText: {
    color: akColors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  primaryButton: {
    marginTop: 2,
    backgroundColor: akColors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    flex: 1,
  },
  primaryButtonText: {
    color: akColors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: akColors.border,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: akColors.surface,
    flex: 1,
  },
  secondaryButtonText: {
    color: akColors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  logoutButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: akColors.dangerBorder,
    backgroundColor: akColors.dangerBg,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  logoutButtonText: {
    color: akColors.danger,
    fontWeight: '700',
    fontSize: 14,
  },
  errorText: {
    color: akColors.danger,
    fontSize: 12,
    lineHeight: 18,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.25)',
  },
  modalCard: {
    backgroundColor: akColors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: akColors.border,
    padding: 16,
    gap: 10,
    ...akShadow.card,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: akColors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: akColors.surfaceMuted,
    borderWidth: 1,
    borderColor: akColors.border,
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
  inputMultiline: {
    minHeight: 74,
    textAlignVertical: 'top',
  },
  vehiclePrimaryToggle: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  vehiclePrimaryCheck: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  modalAvatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: akColors.surfaceMuted,
    borderWidth: 1,
    borderColor: akColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAvatarImage: {
    width: '100%',
    height: '100%',
  },
  modalAvatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: akColors.text,
  },
  modalPhotoButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: akColors.text,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  vehiclePrimaryCheckActive: {
    borderColor: akColors.primary,
    backgroundColor: akColors.primary,
  },
  vehiclePrimaryText: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
});
