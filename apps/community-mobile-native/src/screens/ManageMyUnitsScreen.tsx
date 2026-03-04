import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { BrandedPageHero } from '../components/mobile/BrandedPageHero';
import type { AuthSession } from '../features/auth/types';
import {
  createRentRequest,
  listMyRentRequests,
} from '../features/community/service';
import type { RentRequestRow, ResidentUnit } from '../features/community/types';
import { pickAndUploadFileByPurpose } from '../features/files/service';
import { useBranding } from '../features/branding/provider';
import { getBrandPalette } from '../features/branding/palette';
import { useAppToast } from '../components/mobile/AppToast';
import { useBottomNavMetrics } from '../features/layout/BottomNavMetricsContext';
import { akColors, akRadius, akShadow } from '../theme/alkarma';

type ManageMyUnitsScreenProps = {
  session: AuthSession;
  units: ResidentUnit[];
  selectedUnitId: string | null;
  onSelectUnit: (unitId: string) => void;
};

export function ManageMyUnitsScreen({
  session,
  units,
  selectedUnitId,
  onSelectUnit,
}: ManageMyUnitsScreenProps) {
  const toast = useAppToast();
  const { brand } = useBranding();
  const palette = getBrandPalette(brand);
  const insets = useSafeAreaInsets();
  const { contentInsetBottom } = useBottomNavMetrics();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rentRequests, setRentRequests] = useState<RentRequestRow[]>([]);
  const [tenantName, setTenantName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [tenantNationalId, setTenantNationalId] = useState('');
  const [tenantNationality, setTenantNationality] = useState<'EGYPTIAN' | 'FOREIGN'>('EGYPTIAN');
  const [contractFileId, setContractFileId] = useState<string | null>(null);

  const selectedUnit = useMemo(
    () => units.find((u) => u.id === selectedUnitId) ?? units[0] ?? null,
    [selectedUnitId, units],
  );

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMyRentRequests(session.accessToken);
      setRentRequests(data);
    } catch (error: any) {
      toast.error('Failed to load rent requests', error?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [session.accessToken, toast]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const uploadContract = async () => {
    try {
      const uploaded = await pickAndUploadFileByPurpose(session.accessToken, 'contract');
      if (!uploaded) return;
      setContractFileId(uploaded.id);
      toast.success('Contract uploaded', uploaded.name || 'File uploaded successfully.');
    } catch (error: any) {
      toast.error('Upload failed', error?.message ?? 'Could not upload contract.');
    }
  };

  const submitRentRequest = async () => {
    if (!selectedUnit?.id) {
      toast.error('Select unit', 'Please choose a unit first.');
      return;
    }
    if (!tenantName.trim() || !tenantEmail.trim() || !tenantPhone.trim()) {
      toast.error('Missing tenant data', 'Name, email, and phone are required.');
      return;
    }
    if (!contractFileId) {
      toast.error('Contract required', 'Please upload rent contract first.');
      return;
    }

    setSubmitting(true);
    try {
      await createRentRequest(session.accessToken, {
        unitId: selectedUnit.id,
        tenantName: tenantName.trim(),
        tenantEmail: tenantEmail.trim(),
        tenantPhone: tenantPhone.trim(),
        tenantNationalId: tenantNationalId.trim() || undefined,
        tenantNationality,
        contractFileId,
      });

      toast.success('Rent request submitted', 'Admin will review your request.');
      setTenantName('');
      setTenantEmail('');
      setTenantPhone('');
      setTenantNationalId('');
      setContractFileId(null);
      await loadRequests();
    } catch (error: any) {
      toast.error('Submit failed', error?.message ?? 'Could not submit rent request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(30, contentInsetBottom + Math.max(insets.bottom - 4, 0)) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <BrandedPageHero
          title="Manage My Units"
          subtitle="Create rent requests and track admin review status."
        />

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your Units</Text>
          <View style={styles.unitsList}>
            {units.map((unit) => {
              const active = unit.id === selectedUnit?.id;
              return (
                <Pressable
                  key={unit.id}
                  style={[styles.unitItem, active && styles.unitItemActive]}
                  onPress={() => onSelectUnit(unit.id)}
                >
                  <Text style={styles.unitTitle}>{unit.unitNumber || unit.id}</Text>
                  <Text style={styles.unitMeta}>
                    {unit.projectName || 'Project'} {unit.block ? `• Block ${unit.block}` : ''}
                  </Text>
                  <Text style={styles.unitMeta}>Status: {String(unit.status || 'UNKNOWN')}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Rent Unit</Text>
          <TextInput
            style={styles.input}
            placeholder="Tenant Full Name"
            value={tenantName}
            onChangeText={setTenantName}
            placeholderTextColor={akColors.textSoft}
          />
          <TextInput
            style={styles.input}
            placeholder="Tenant Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={tenantEmail}
            onChangeText={setTenantEmail}
            placeholderTextColor={akColors.textSoft}
          />
          <TextInput
            style={styles.input}
            placeholder="Tenant Phone"
            keyboardType="phone-pad"
            value={tenantPhone}
            onChangeText={setTenantPhone}
            placeholderTextColor={akColors.textSoft}
          />
          <TextInput
            style={styles.input}
            placeholder="National ID / Passport (Optional)"
            value={tenantNationalId}
            onChangeText={setTenantNationalId}
            placeholderTextColor={akColors.textSoft}
          />

          <View style={styles.row}>
            <Pressable
              style={[styles.choice, tenantNationality === 'EGYPTIAN' && styles.choiceActive]}
              onPress={() => setTenantNationality('EGYPTIAN')}
            >
              <Text style={styles.choiceText}>Egyptian</Text>
            </Pressable>
            <Pressable
              style={[styles.choice, tenantNationality === 'FOREIGN' && styles.choiceActive]}
              onPress={() => setTenantNationality('FOREIGN')}
            >
              <Text style={styles.choiceText}>Foreign</Text>
            </Pressable>
          </View>

          <View style={styles.row}>
            <Pressable style={[styles.secondaryButton, { borderColor: palette.primary }]} onPress={uploadContract}>
              <Text style={[styles.secondaryText, { color: palette.primary }]}>Upload Contract</Text>
            </Pressable>
            <Text style={styles.fileText}>{contractFileId ? 'Contract ready' : 'No contract uploaded'}</Text>
          </View>

          <Pressable
            style={[styles.primaryButton, { backgroundColor: palette.primary }, submitting && styles.disabledButton]}
            onPress={submitRentRequest}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Submit Rent Request</Text>}
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>My Rent Requests</Text>
            <Pressable onPress={() => void loadRequests()}>
              <Text style={[styles.linkText, { color: palette.primary }]}>Refresh</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.centered}><ActivityIndicator color={palette.primary} /></View>
          ) : rentRequests.length === 0 ? (
            <Text style={styles.emptyText}>No rent requests yet.</Text>
          ) : (
            <View style={styles.requestsList}>
              {rentRequests.map((row) => (
                <View key={row.id} style={styles.requestItem}>
                  <Text style={styles.requestTitle}>{row.unit?.unitNumber || row.unitId}</Text>
                  <Text style={styles.requestMeta}>Tenant: {row.tenantName}</Text>
                  <Text style={styles.requestMeta}>Status: {row.status}</Text>
                  <Text style={styles.requestMeta}>Created: {new Date(row.createdAt).toLocaleString()}</Text>
                  {row.rejectionReason ? (
                    <Text style={styles.rejectedText}>Reason: {row.rejectionReason}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>
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
    padding: 16,
    gap: 12,
  },
  header: {
    borderRadius: akRadius.lg,
    padding: 16,
    ...akShadow.card,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  headerSubtitle: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: akRadius.lg,
    padding: 14,
    gap: 10,
    ...akShadow.card,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: akColors.text,
  },
  unitsList: {
    gap: 8,
  },
  unitItem: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: akRadius.md,
    padding: 10,
    backgroundColor: '#fff',
  },
  unitItemActive: {
    borderColor: '#64748B',
    backgroundColor: '#F8FAFC',
  },
  unitTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: akColors.text,
  },
  unitMeta: {
    marginTop: 2,
    fontSize: 12,
    color: akColors.textMuted,
  },
  input: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: akRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: akColors.text,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  choice: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: akRadius.md,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  choiceActive: {
    borderColor: '#334155',
    backgroundColor: '#F1F5F9',
  },
  choiceText: {
    color: akColors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: akRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  secondaryText: {
    fontWeight: '700',
    fontSize: 13,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: akRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  fileText: {
    fontSize: 12,
    color: akColors.textMuted,
    flexShrink: 1,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '700',
  },
  centered: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: akColors.textMuted,
    fontSize: 13,
  },
  requestsList: {
    gap: 8,
  },
  requestItem: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: akRadius.md,
    padding: 10,
    backgroundColor: '#fff',
  },
  requestTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: akColors.text,
  },
  requestMeta: {
    marginTop: 2,
    fontSize: 12,
    color: akColors.textMuted,
  },
  rejectedText: {
    marginTop: 4,
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '600',
  },
});
