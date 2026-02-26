import { useEffect, useMemo, useState } from 'react';
import { Feather, Ionicons } from '@expo/vector-icons';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppToast } from '../components/mobile/AppToast';
import type { AuthSession } from '../features/auth/types';
import type { AuthBootstrapProfile } from '../features/auth/types';
import {
  getAuthBootstrapProfile,
  updateAuthBootstrapProfile,
} from '../features/auth/profile';
import { unitStatusDisplayLabel } from '../features/presentation/status';
import { akColors, akRadius, akShadow } from '../theme/alkarma';
import { formatDateTime } from '../utils/format';

type SessionHomeScreenProps = {
  session: AuthSession;
  isRefreshing: boolean;
  refreshError: string | null;
  onRefreshSession: () => Promise<void>;
  onLogout: () => Promise<void>;
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
      return 'Authorized Contractor';
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
  if (p.canManageWorkers) chips.push({ key: 'workers', label: 'Workers & Contractors' });
  if (p.isPreDeliveryOwner) chips.push({ key: 'pre', label: 'Pre-delivery Access' });

  return chips;
}

export function SessionHomeScreen({
  session,
  isRefreshing: _isRefreshing,
  refreshError: _refreshError,
  onRefreshSession: _onRefreshSession,
  onLogout,
}: SessionHomeScreenProps) {
  const insets = useSafeAreaInsets();
  const toast = useAppToast();
  const [profile, setProfile] = useState<AuthBootstrapProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editNameEn, setEditNameEn] = useState('');
  const [editNameAr, setEditNameAr] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadProfile = async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setIsLoadingProfile(true);
    else setIsRefreshingProfile(true);
    setProfileError(null);
    try {
      const result = await getAuthBootstrapProfile(session.accessToken);
      setProfile(result);
      setEditNameEn(result.user?.nameEN ?? '');
      setEditNameAr(result.user?.nameAR ?? '');
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

  const handleSaveProfile = async () => {
    const payload = {
      nameEN: editNameEn.trim() || undefined,
      nameAR: editNameAr.trim() || undefined,
    };
    if (!payload.nameEN && !payload.nameAR) {
      toast.error('Nothing to save', 'Enter at least one name field.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateAuthBootstrapProfile(session.accessToken, payload);
      setProfile(updated);
      setEditOpen(false);
      toast.success('Profile updated', 'Your display name was updated successfully.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to update profile';
      toast.error('Update failed', msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 8) + 8 },
        ]}
      >
        <LinearGradient
          colors={[akColors.primary, akColors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileHero}
        >
          <View style={styles.profileHeroRow}>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroName}>{displayName}</Text>
              <Text style={styles.heroRole}>{roleLabel}</Text>
              <Text style={styles.heroEmail}>{session.email}</Text>
            </View>
            <Pressable style={styles.heroEditButton} onPress={() => setEditOpen(true)}>
              <Feather name="edit-2" size={16} color={akColors.gold} />
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
        </LinearGradient>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Profile Information</Text>
            <Pressable onPress={() => void loadProfile('refresh')} disabled={isRefreshingProfile}>
              <Text style={styles.linkText}>{isRefreshingProfile ? 'Refreshing...' : 'Refresh'}</Text>
            </Pressable>
          </View>

          {isLoadingProfile ? <ActivityIndicator color={akColors.primary} /> : null}
          {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}

          {profile ? (
            <>
              <InfoRow label="Full Name" value={displayName} />
              <InfoRow label="Email" value={profile.user.email || session.email || '—'} />
              <InfoRow label="Phone" value={profile.user.phone || 'Not added'} />
              <InfoRow
                label="Roles"
                value={profile.roles.length ? profile.roles.map(humanizeRole).join(', ') : 'Resident'}
              />
              <InfoRow
                label="Profile Types"
                value={Object.entries(profile.profileKinds)
                  .filter(([, enabled]) => Boolean(enabled))
                  .map(([key]) => humanizeRole(key))
                  .join(', ') || '—'}
              />
              {profile.user.lastLoginAt ? (
                <InfoRow label="Last Login" value={formatDateTime(profile.user.lastLoginAt)} />
              ) : null}
            </>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Access & Features</Text>
          {capabilityChips.length === 0 ? (
            <Text style={styles.hint}>No feature permissions were detected for this account yet.</Text>
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
          <Text style={styles.cardTitle}>Support</Text>
          <Text style={styles.hint}>
            Need help with your account, payments, or access requests? Contact community support from the dashboard support channels.
          </Text>
          <Pressable style={styles.logoutButton} onPress={() => void onLogout()}>
            <Text style={styles.logoutButtonText}>Logout</Text>
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

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.secondaryButton, isSaving && styles.buttonDisabled]}
                onPress={() => setEditOpen(false)}
                disabled={isSaving}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, isSaving && styles.buttonDisabled]}
                onPress={() => void handleSaveProfile()}
                disabled={isSaving}
              >
                {isSaving ? (
                  <View style={styles.buttonRow}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.primaryButtonText}>Saving...</Text>
                  </View>
                ) : (
                  <Text style={styles.primaryButtonText}>Save Changes</Text>
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
    padding: 18,
    gap: 14,
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
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  heroTextWrap: {
    flex: 1,
    gap: 2,
  },
  heroName: {
    color: '#fff',
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
    color: '#fff',
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
    color: '#FFFFFF',
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
    backgroundColor: '#fff',
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
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
});
