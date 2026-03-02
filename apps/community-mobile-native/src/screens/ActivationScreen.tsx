import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Ionicons from '@expo/vector-icons/Ionicons';
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

type ActivationStep = 'documents' | 'phone-confirm' | 'phone-otp' | 'password';

function formatRemaining(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const mins = String(Math.floor(safe / 60)).padStart(2, '0');
  const secs = String(safe % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

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
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [status, setStatus] = useState<ActivationStatus | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nationalIdFileId, setNationalIdFileId] = useState<string | null>(null);
  const [profilePhotoId, setProfilePhotoId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [currentStep, setCurrentStep] = useState<ActivationStep>('documents');
  const [otpDeliveryChannel, setOtpDeliveryChannel] = useState<'SMS' | 'EMAIL' | string>('SMS');
  const [otpCooldownUntilMs, setOtpCooldownUntilMs] = useState<number>(0);
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0);
  const [confirmationResult, setConfirmationResult] =
    useState<any | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const requiresPhoneOtp = Boolean(status?.checklist.requiresPhoneOtp);
  const phoneVerified = Boolean(status?.checklist.phoneVerified);
  const hasDocs = Boolean(nationalIdFileId && profilePhotoId);

  const stepMeta = useMemo(() => {
    if (!requiresPhoneOtp) {
      return {
        total: 2,
        current: currentStep === 'password' ? 2 : 1,
      };
    }
    const map: Record<ActivationStep, number> = {
      documents: 1,
      'phone-confirm': 2,
      'phone-otp': 3,
      password: 4,
    };
    return { total: 4, current: map[currentStep] };
  }, [currentStep, requiresPhoneOtp]);

  const canSubmitActivation = useMemo(() => {
    if (!status) return false;
    if (!hasDocs) return false;
    if (requiresPhoneOtp && !phoneVerified) return false;
    if (newPassword.length < 8) return false;
    if (newPassword !== confirmPassword) return false;
    return true;
  }, [
    confirmPassword,
    hasDocs,
    newPassword,
    phoneVerified,
    requiresPhoneOtp,
    status,
  ]);

  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = (await getActivationStatusRequest(
        session.accessToken,
      )) as ActivationStatus;
      setStatus(result);
      setNationalIdFileId(result.user.nationalIdFileId ?? null);
      setProfilePhotoId(result.user.profilePhotoId ?? null);
      if (result.checklist.phoneVerified) {
        setCurrentStep('password');
      } else if (!result.checklist.requiresPhoneOtp && result.checklist.hasNationalId && result.checklist.hasProfilePhoto) {
        setCurrentStep('password');
      } else if (result.checklist.hasNationalId && result.checklist.hasProfilePhoto && result.checklist.requiresPhoneOtp) {
        setCurrentStep((prev) => (prev === 'phone-otp' ? prev : 'phone-confirm'));
      } else {
        setCurrentStep('documents');
      }
    } catch (error: any) {
      toast.error('Activation status failed', error?.message ?? 'Try again.');
    } finally {
      setIsLoading(false);
    }
  }, [session.accessToken, toast]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.ceil((otpCooldownUntilMs - Date.now()) / 1000));
      setOtpSecondsLeft(left);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [otpCooldownUntilMs]);

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
    setIsSendingOtp(true);
    try {
      const result = await sendPhoneOtpRequest(session.accessToken, phone);
      let rnFirebaseAuth: any;
      try {
        // Lazy-require so the app doesn't crash at startup on Expo Go/old binaries.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        rnFirebaseAuth = require('@react-native-firebase/auth').default;
      } catch {
        throw new Error(
          'Firebase native module is missing. Install a newly built APK (not Expo Go).',
        );
      }
      const confirmation = await rnFirebaseAuth().signInWithPhoneNumber(phone);
      const cooldown = Number(result.cooldownSeconds ?? 120);
      setOtpCooldownUntilMs(Date.now() + cooldown * 1000);
      setOtpDeliveryChannel('SMS');
      setConfirmationResult(confirmation);
      setCurrentStep('phone-otp');
      toast.success('Verification started', 'OTP has been sent to your phone.');
    } catch (error: any) {
      const reasonCode = axios.isAxiosError(error)
        ? String((error.response?.data as { reasonCode?: string } | undefined)?.reasonCode ?? '')
        : '';
      const details = axios.isAxiosError(error)
        ? ((error.response?.data as {
            details?: {
              smsOtpEnabled?: boolean;
              smsOtpConfigured?: boolean;
            };
          } | undefined)?.details ?? {})
        : {};
      const message =
        reasonCode === 'FIREBASE_OTP_NOT_CONFIGURED'
          ? 'OTP service is not configured on server. Please contact support.'
          : reasonCode === 'FIREBASE_AUTH_DISABLED'
            ? 'OTP service is disabled by admin settings.'
            : reasonCode === 'FIREBASE_CREDENTIALS_INCOMPLETE'
              ? 'OTP service credentials are incomplete on server.'
              : reasonCode === 'FIREBASE_SERVICE_ACCOUNT_JSON_INVALID'
                ? 'OTP service credentials are invalid on server.'
                : reasonCode === 'FIREBASE_PRIVATE_KEY_INVALID_PEM'
                  ? 'OTP private key format is invalid on server.'
                : error?.message ?? 'Failed to send OTP.';
      const debugHint =
        reasonCode && (details.smsOtpEnabled === false || details.smsOtpConfigured === false)
          ? ` (${reasonCode})`
          : '';
      toast.error('OTP failed', `${message}${debugHint}`);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const verifyOtp = async () => {
    const trimmedOtp = otpCode.trim();
    if (!/^\d{6}$/.test(trimmedOtp)) {
      toast.error('OTP required', 'Enter the 6-digit code.');
      return;
    }
    if (!confirmationResult) {
      toast.error('OTP session missing', 'Please request OTP again.');
      return;
    }
    setIsVerifyingOtp(true);
    try {
      const userCredential = await confirmationResult.confirm(trimmedOtp);
      if (!userCredential?.user) {
        throw new Error('Invalid OTP verification response');
      }
      const firebaseIdToken = await userCredential.user.getIdToken(true);
      const result = await verifyPhoneOtpRequest(session.accessToken, {
        firebaseIdToken,
      });
      toast.success('Phone verified', result.message || 'Phone verified successfully.');
      setOtpCode('');
      setConfirmationResult(null);
      await loadStatus();
      setCurrentStep('password');
    } catch (error: any) {
      toast.error('Verification failed', error?.message ?? 'Phone verification failed.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const submitActivation = async () => {
    if (!status) return;
    if (!canSubmitActivation) {
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
          <Text style={styles.heroSubtitle}>Complete your account activation to continue.</Text>
          <Text style={styles.stepMeta}>Step {stepMeta.current} of {stepMeta.total}</Text>
        </View>

        {currentStep === 'documents' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Step 1: Upload Required Documents</Text>
            <Pressable style={styles.actionRow} onPress={uploadNationalId}>
              <Text style={styles.actionTitle}>National ID / Passport</Text>
              <Text style={nationalIdFileId ? styles.done : styles.todo}>
                {nationalIdFileId ? 'Uploaded' : 'Required'}
              </Text>
            </Pressable>
            <Pressable style={styles.actionRow} onPress={uploadProfilePhoto}>
              <Text style={styles.actionTitle}>Personal Photo</Text>
              <Text style={profilePhotoId ? styles.done : styles.todo}>
                {profilePhotoId ? 'Uploaded' : 'Required'}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.submitButton,
                { backgroundColor: brandPrimary },
                !hasDocs && styles.submitButtonDisabled,
              ]}
              onPress={() =>
                setCurrentStep(requiresPhoneOtp && !phoneVerified ? 'phone-confirm' : 'password')
              }
              disabled={!hasDocs}
            >
              <Text style={styles.submitText}>Continue</Text>
            </Pressable>
          </View>
        ) : null}

        {currentStep === 'phone-confirm' && requiresPhoneOtp ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Step 2: Confirm Phone Number</Text>
            <Text style={styles.caption}>
              Verification code will be sent to:
            </Text>
            <Text style={styles.phoneValue}>{status?.user.phone || 'No phone number available'}</Text>
            <Text style={styles.caption}>
              Press OK to receive a 6-digit OTP, then enter it on the next screen.
            </Text>
            <Pressable
              style={[styles.submitButton, { backgroundColor: brandPrimary }, isSendingOtp && styles.submitButtonDisabled]}
              onPress={sendOtp}
              disabled={isSendingOtp}
            >
              {isSendingOtp ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitText}>OK, Send OTP</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {currentStep === 'phone-otp' && requiresPhoneOtp ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Step 3: Verify OTP</Text>
            <Text style={styles.caption}>
              Enter the 6-digit code sent via {otpDeliveryChannel}.
            </Text>
            <TextInput
              style={styles.input}
              value={otpCode}
              onChangeText={(value) => setOtpCode(value.replace(/[^\d]/g, '').slice(0, 6))}
              placeholder="Enter 6-digit OTP"
              placeholderTextColor={akColors.textSoft}
              keyboardType="number-pad"
              maxLength={6}
            />
            <Pressable
              style={[
                styles.submitButton,
                { backgroundColor: brandPrimary },
                (isVerifyingOtp || otpCode.trim().length !== 6 || !confirmationResult) &&
                  styles.submitButtonDisabled,
              ]}
              onPress={verifyOtp}
              disabled={isVerifyingOtp || otpCode.trim().length !== 6 || !confirmationResult}
            >
              {isVerifyingOtp ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitText}>Verify OTP</Text>
              )}
            </Pressable>

            <Pressable
              style={[
                styles.secondaryButton,
                otpSecondsLeft > 0 && styles.secondaryButtonDisabled,
              ]}
              onPress={sendOtp}
              disabled={otpSecondsLeft > 0 || isSendingOtp}
            >
              <Text style={styles.secondaryButtonText}>
                {otpSecondsLeft > 0
                  ? `Resend in ${formatRemaining(otpSecondsLeft)}`
                  : isSendingOtp
                    ? 'Sending...'
                    : 'Resend OTP'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {currentStep === 'password' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {requiresPhoneOtp ? 'Step 4: Change Password' : 'Step 2: Change Password'}
            </Text>
            <View style={styles.passwordField}>
              <TextInput
                style={styles.passwordInput}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                placeholder="New password (min 8 characters)"
                placeholderTextColor={akColors.textSoft}
              />
              <Pressable
                onPress={() => setShowNewPassword((v) => !v)}
                style={styles.eyeButton}
                hitSlop={8}
              >
                <Ionicons
                  name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={akColors.textMuted}
                />
              </Pressable>
            </View>
            <View style={styles.passwordField}>
              <TextInput
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                placeholder="Confirm password"
                placeholderTextColor={akColors.textSoft}
              />
              <Pressable
                onPress={() => setShowConfirmPassword((v) => !v)}
                style={styles.eyeButton}
                hitSlop={8}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={akColors.textMuted}
                />
              </Pressable>
            </View>
            {newPassword.length > 0 && newPassword.length < 8 ? (
              <Text style={styles.todo}>Password must be at least 8 characters</Text>
            ) : null}
            {confirmPassword.length > 0 && newPassword !== confirmPassword ? (
              <Text style={styles.todo}>Passwords do not match</Text>
            ) : null}
            {!hasDocs ? (
              <Text style={styles.todo}>Upload both National ID and Profile Photo first</Text>
            ) : null}
            {requiresPhoneOtp && !phoneVerified ? (
              <Text style={styles.todo}>Verify your phone OTP first</Text>
            ) : null}
            <Pressable
              style={[
                styles.submitButton,
                { backgroundColor: brandPrimary },
                (!canSubmitActivation || isSubmitting) && styles.submitButtonDisabled,
              ]}
              onPress={submitActivation}
              disabled={!canSubmitActivation || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitText}>Complete Activation</Text>
              )}
            </Pressable>
          </View>
        ) : null}

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
  stepMeta: {
    marginTop: 10,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    opacity: 0.95,
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
  phoneValue: {
    color: akColors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  input: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: akRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: akColors.text,
    backgroundColor: '#fff',
  },
  passwordField: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: akRadius.md,
    paddingHorizontal: 12,
    minHeight: 44,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    color: akColors.text,
    paddingVertical: 10,
  },
  eyeButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
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
  secondaryButton: {
    borderRadius: akRadius.lg,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: '#fff',
  },
  secondaryButtonDisabled: {
    opacity: 0.6,
  },
  secondaryButtonText: {
    color: akColors.text,
    fontWeight: '700',
    fontSize: 14,
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
