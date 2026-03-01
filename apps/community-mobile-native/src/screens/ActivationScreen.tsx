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
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AuthSession } from '../features/auth/types';
import {
  completeActivationRequest,
  getActivationStatusRequest,
  sendPhoneOtpRequest,
  verifyPhoneOtpRequest,
} from '../features/auth/service';
import { pickAndUploadFileByPurpose } from '../features/files/service';
import { useAppToast } from '../components/mobile/AppToast';
import { useBranding } from '../features/branding/provider';
import { akColors, akRadius, akShadow } from '../theme/alkarma';

type ActivationScreenProps = {
  session: AuthSession;
  onActivationCompleted: (newPassword?: string) => Promise<void>;
  onLogout: () => Promise<void>;
};

type ActivationStatus = {
  user: {
    id: string;
    email?: string | null;
    phone?: string | null;
    nameEN?: string | null;
    nameAR?: string | null;
    userStatus?: string | null;
    nationalIdFileId?: string | null;
    profilePhotoId?: string | null;
  };
  mustCompleteActivation: boolean;
  checklist: {
    requiresPhoneOtp: boolean;
    phoneVerified: boolean;
    hasNationalId: boolean;
    hasProfilePhoto: boolean;
    canCompleteActivation: boolean;
  };
};

export function ActivationScreen({
  session,
  onActivationCompleted,
  onLogout,
}: ActivationScreenProps) {
  const toast = useAppToast();
  const { brand } = useBranding();
  const brandPrimary = brand.primaryColor || akColors.primary;
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<ActivationStatus | null>(null);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nationalIdFileId, setNationalIdFileId] = useState<string | null>(null);
  const [profilePhotoId, setProfilePhotoId] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = (await getActivationStatusRequest(
        session.accessToken,
      )) as ActivationStatus;
      setStatus(result);
      setNationalIdFileId(result.user.nationalIdFileId ?? null);
      setProfilePhotoId(result.user.profilePhotoId ?? null);
    } catch (error: any) {
      toast.error('Activation status failed', error?.message ?? 'Try again.');
    } finally {
      setIsLoading(false);
    }
  }, [session.accessToken, toast]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const canSubmit = useMemo(() => {
    if (!status) return false;
    if (status.checklist.requiresPhoneOtp && !status.checklist.phoneVerified) return false;
    if (!nationalIdFileId || !profilePhotoId) return false;
    if (newPassword.length < 8) return false;
    if (newPassword !== confirmPassword) return false;
    return true;
  }, [confirmPassword, nationalIdFileId, newPassword, profilePhotoId, status]);

  const uploadNationalId = async () => {
    try {
      const uploaded = await pickAndUploadFileByPurpose(
        session.accessToken,
        'national-id',
      );
      if (!uploaded) return;
      setNationalIdFileId(uploaded.id);
      toast.success('Document uploaded', 'National ID uploaded successfully.');
    } catch (error: any) {
      toast.error('Upload failed', error?.message ?? 'Failed to upload document.');
    }
  };

  const uploadProfilePhoto = async () => {
    try {
      const uploaded = await pickAndUploadFileByPurpose(
        session.accessToken,
        'profile-photo',
      );
      if (!uploaded) return;
      setProfilePhotoId(uploaded.id);
      toast.success('Photo uploaded', 'Profile photo uploaded successfully.');
    } catch (error: any) {
      toast.error('Upload failed', error?.message ?? 'Failed to upload photo.');
    }
  };

  const sendOtp = async () => {
    const phone = status?.user.phone?.trim();
    if (!phone) {
      toast.error('Phone required', 'No phone number found on your account.');
      return;
    }
    try {
      const result = await sendPhoneOtpRequest(session.accessToken, phone);
      toast.success('OTP sent', result.message || 'Check your phone for OTP.');
    } catch (error: any) {
      toast.error('OTP failed', error?.message ?? 'Failed to send OTP.');
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) {
      toast.error('OTP required', 'Enter the OTP code first.');
      return;
    }
    try {
      const result = await verifyPhoneOtpRequest(session.accessToken, otp.trim());
      toast.success('Phone verified', result.message || 'Phone verified successfully.');
      await loadStatus();
      setOtp('');
    } catch (error: any) {
      toast.error('Invalid OTP', error?.message ?? 'OTP verification failed.');
    }
  };

  const submitActivation = async () => {
    if (!status) return;
    if (!canSubmit) {
      toast.error('Missing steps', 'Complete required activation steps first.');
      return;
    }

    setIsSubmitting(true);
    try {
      await completeActivationRequest(session.accessToken, {
        nationalIdFileId: nationalIdFileId!,
        profilePhotoId: profilePhotoId!,
        newPassword,
        nameEN: status.user.nameEN || undefined,
        nameAR: status.user.nameAR || undefined,
      });
      await onActivationCompleted(newPassword);
      toast.success('Activation complete', 'Your account is now active.');
    } catch (error: any) {
      toast.error('Activation failed', error?.message ?? 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={brandPrimary} />
          <Text style={styles.loadingText}>Preparing activation...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: brandPrimary }]}>
          <Text style={styles.heroTitle}>Welcome{status?.user.nameEN ? `, ${status.user.nameEN}` : ''}</Text>
          <Text style={styles.heroSubtitle}>
            Complete your account activation to continue.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Required Documents</Text>
          <Pressable style={styles.actionRow} onPress={uploadNationalId}>
            <Text style={styles.actionTitle}>Upload National ID / Passport</Text>
            <Text style={nationalIdFileId ? styles.done : styles.todo}>
              {nationalIdFileId ? 'Uploaded' : 'Required'}
            </Text>
          </Pressable>
          <Pressable style={styles.actionRow} onPress={uploadProfilePhoto}>
            <Text style={styles.actionTitle}>Upload Personal Photo</Text>
            <Text style={profilePhotoId ? styles.done : styles.todo}>
              {profilePhotoId ? 'Uploaded' : 'Required'}
            </Text>
          </Pressable>
        </View>

        {status?.checklist.requiresPhoneOtp ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Phone Verification</Text>
            <Text style={styles.caption}>
              {status.user.phone || 'No phone number available'}
            </Text>
            {status.checklist.phoneVerified ? (
              <Text style={styles.done}>Phone already verified</Text>
            ) : (
              <>
                <View style={styles.row}>
                  <Pressable style={[styles.smallButton, { backgroundColor: brandPrimary }]} onPress={sendOtp}>
                    <Text style={styles.smallButtonText}>Send OTP</Text>
                  </Pressable>
                </View>
                <View style={styles.otpRow}>
                  <TextInput
                    style={styles.input}
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    placeholder="Enter OTP"
                    placeholderTextColor={akColors.textSoft}
                    maxLength={6}
                  />
                  <Pressable style={[styles.smallButton, { backgroundColor: brandPrimary }]} onPress={verifyOtp}>
                    <Text style={styles.smallButtonText}>Verify</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Set New Password</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="New password"
            placeholderTextColor={akColors.textSoft}
          />
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="Confirm password"
            placeholderTextColor={akColors.textSoft}
          />
          {confirmPassword.length > 0 && newPassword !== confirmPassword ? (
            <Text style={styles.todo}>Passwords do not match</Text>
          ) : null}
        </View>

        <Pressable
          style={[
            styles.submitButton,
            { backgroundColor: brandPrimary },
            (!canSubmit || isSubmitting) && styles.submitButtonDisabled,
          ]}
          onPress={submitActivation}
          disabled={!canSubmit || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitText}>Complete Activation</Text>
          )}
        </Pressable>

        <Pressable style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: akColors.bg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: akColors.textMuted,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
    gap: 12,
  },
  hero: {
    borderRadius: akRadius.lg,
    padding: 16,
    ...akShadow.card,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    marginTop: 6,
    fontSize: 13,
  },
  card: {
    borderRadius: akRadius.lg,
    backgroundColor: '#fff',
    padding: 14,
    gap: 10,
    ...akShadow.card,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: akColors.text,
  },
  actionRow: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: akRadius.md,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  actionTitle: {
    color: akColors.text,
    fontWeight: '600',
    fontSize: 14,
    flex: 1,
  },
  done: {
    color: '#059669',
    fontWeight: '700',
    fontSize: 12,
  },
  todo: {
    color: '#B45309',
    fontWeight: '700',
    fontSize: 12,
  },
  caption: {
    color: akColors.textMuted,
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  otpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: akRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: akColors.text,
    backgroundColor: '#fff',
  },
  smallButton: {
    borderRadius: akRadius.md,
    backgroundColor: akColors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  submitButton: {
    backgroundColor: akColors.primary,
    borderRadius: akRadius.lg,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    ...akShadow.card,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  logoutButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  logoutText: {
    color: akColors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
