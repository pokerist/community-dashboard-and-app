import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useAppToast } from '../components/mobile/AppToast';
import { extractApiErrorMessage } from '../lib/http';
import { signupRequest } from '../features/auth/service';
import { pickAndUploadPublicSignupPhoto } from '../features/files/service';
import type { SignupRoleIntent } from '../features/auth/types';
import { akColors, akShadow } from '../theme/alkarma';

type RegisterScreenProps = {
  onBackToLogin: () => void;
};

const roleOptions: Array<{ value: SignupRoleIntent; label: string }> = [
  { value: 'OWNER', label: 'Owner' },
  { value: 'TENANT', label: 'Tenant' },
  { value: 'FAMILY', label: 'Family' },
];

export function RegisterScreen({ onBackToLogin }: RegisterScreenProps) {
  const insets = useSafeAreaInsets();
  const toast = useAppToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [personalPhotoId, setPersonalPhotoId] = useState('');
  const [password, setPassword] = useState('');
  const [roleIntent, setRoleIntent] = useState<SignupRoleIntent>('OWNER');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const topPadding = useMemo(() => Math.max(insets.top, 10) + 8, [insets.top]);

  const handleSubmit = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!name.trim() || !phone.trim() || !nationalId.trim() || !personalPhotoId.trim()) {
      const msg = 'Name, phone, national ID and personal photo are required.';
      setErrorMessage(msg);
      toast.error('Missing required fields', msg);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await signupRequest({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        nationalId: nationalId.trim(),
        personalPhotoId: personalPhotoId.trim(),
        roleIntent,
        password: password.trim() || undefined,
      });

      setSuccessMessage(
        `Signup request submitted (${response.status ?? 'PENDING'}). Community admin will review your request.`,
      );
      toast.success('Signup request submitted', 'Your request was sent for admin review.');
      setPassword('');
    } catch (error) {
      const msg = extractApiErrorMessage(error);
      setErrorMessage(msg);
      toast.error('Failed to submit signup request', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadPersonalPhoto = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsUploadingPhoto(true);
    try {
      const uploaded = await pickAndUploadPublicSignupPhoto();
      if (!uploaded) return;
      setPersonalPhotoId(uploaded.id);
      toast.success('Photo uploaded', 'Personal photo attached to signup request.');
    } catch (error) {
      const msg = extractApiErrorMessage(error);
      setErrorMessage(msg);
      toast.error('Failed to upload photo', msg);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <LinearGradient colors={['#f8f9fa', '#ffffff']} style={styles.gradientBg}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingTop: topPadding }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerRow}>
              <Pressable onPress={onBackToLogin} style={styles.backButton}>
                <Ionicons name="chevron-back" size={16} color={akColors.primary} />
                <Text style={styles.backButtonText}>Back</Text>
              </Pressable>
            </View>

            <LinearGradient
              colors={[akColors.primary, akColors.primaryDark, akColors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <Text style={styles.heroTag}>REQUEST ACCESS</Text>
              <Text style={styles.heroTitle}>Create a Resident Signup Request</Text>
              <Text style={styles.heroSubtitle}>
                Your request will be reviewed by the community administration before activation.
              </Text>
            </LinearGradient>

            <View style={styles.formCard}>
              <Text style={styles.sectionTitle}>Basic Information</Text>

              <Field
                label="Full Name"
                icon={<Feather name="user" size={17} color={akColors.textMuted} />}
                value={name}
                onChangeText={setName}
                placeholder="Ahmed Hassan"
                editable={!isSubmitting}
              />
              <Field
                label="Phone Number"
                icon={<Feather name="phone" size={17} color={akColors.textMuted} />}
                value={phone}
                onChangeText={setPhone}
                placeholder="+2010XXXXXXXX"
                keyboardType="phone-pad"
                editable={!isSubmitting}
              />
              <Field
                label="Email (Optional)"
                icon={<Ionicons name="mail-outline" size={17} color={akColors.textMuted} />}
                value={email}
                onChangeText={setEmail}
                placeholder="email@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isSubmitting}
              />
              <Field
                label="National ID"
                icon={
                  <MaterialLikeIcon text="ID" />
                }
                value={nationalId}
                onChangeText={setNationalId}
                placeholder="National ID / Passport"
                editable={!isSubmitting}
              />

              <Text style={styles.fieldLabel}>Role Intent</Text>
              <View style={styles.roleRow}>
                {roleOptions.map((option) => {
                  const active = roleIntent === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setRoleIntent(option.value)}
                      style={[styles.roleChip, active && styles.roleChipActive]}
                    >
                      <Text style={[styles.roleChipText, active && styles.roleChipTextActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.sectionTitle}>Verification</Text>
              <Field
                label="Personal Photo File ID"
                icon={<Feather name="image" size={17} color={akColors.textMuted} />}
                value={personalPhotoId}
                onChangeText={setPersonalPhotoId}
                placeholder="Paste uploaded fileId"
                autoCapitalize="none"
                editable={!isSubmitting && !isUploadingPhoto}
              />
              <Pressable
                onPress={() => void handleUploadPersonalPhoto()}
                disabled={isSubmitting || isUploadingPhoto}
                style={[styles.uploadPhotoButton, (isSubmitting || isUploadingPhoto) && styles.buttonDisabled]}
              >
                {isUploadingPhoto ? (
                  <View style={styles.inlineRow}>
                    <ActivityIndicator size="small" color={akColors.primary} />
                    <Text style={styles.uploadPhotoButtonText}>Uploading Photo...</Text>
                  </View>
                ) : (
                  <Text style={styles.uploadPhotoButtonText}>
                    {personalPhotoId ? 'Replace Personal Photo' : 'Upload Personal Photo'}
                  </Text>
                )}
              </Pressable>
              <View style={styles.noteCard}>
                <Ionicons name="information-circle-outline" size={16} color={akColors.primary} />
                <Text style={styles.noteText}>
                  Signup requires a `personalPhotoId`. You can upload a photo directly here or paste
                  a `fileId` manually for testing.
                </Text>
              </View>

              <Field
                label="Password (Optional)"
                icon={<Feather name="lock" size={17} color={akColors.textMuted} />}
                value={password}
                onChangeText={setPassword}
                placeholder="Set password now (optional)"
                secureTextEntry
                editable={!isSubmitting}
              />

              {/* errors are shown as toasts to keep form layout clean */}
              {successMessage ? (
                <View style={styles.successBox}>
                  <Text style={styles.successText}>{successMessage}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={handleSubmit}
                disabled={isSubmitting}
                style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
              >
                {isSubmitting ? (
                  <View style={styles.inlineRow}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.submitButtonText}>Submitting...</Text>
                  </View>
                ) : (
                  <Text style={styles.submitButtonText}>Submit Signup Request</Text>
                )}
              </Pressable>

              <Pressable onPress={onBackToLogin} style={styles.backToLoginLink}>
                <Text style={styles.backToLoginText}>Already have an account? Sign In</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

type FieldProps = {
  label: string;
  icon: ReactNode;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  editable?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

function Field({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  editable = true,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
}: FieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputShell}>
        {icon}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={akColors.textSoft}
          editable={editable}
          style={styles.input}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
        />
      </View>
    </View>
  );
}

function MaterialLikeIcon({ text }: { text: string }) {
  return (
    <View style={styles.idBadge}>
      <Text style={styles.idBadgeText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: akColors.bg,
  },
  gradientBg: {
    flex: 1,
  },
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 28,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: akColors.surface,
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  backButtonText: {
    color: akColors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  heroCard: {
    borderRadius: 20,
    padding: 16,
    gap: 5,
    ...akShadow.card,
  },
  heroTag: {
    color: akColors.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 12,
    lineHeight: 17,
  },
  formCard: {
    backgroundColor: akColors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: akColors.border,
    padding: 14,
    gap: 10,
    ...akShadow.soft,
  },
  sectionTitle: {
    color: akColors.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  inputShell: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    color: akColors.text,
    fontSize: 14,
    paddingVertical: 0,
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 2,
  },
  roleChip: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: akColors.surfaceMuted,
  },
  roleChipActive: {
    backgroundColor: akColors.primary,
    borderColor: akColors.primary,
  },
  roleChipText: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  roleChipTextActive: {
    color: '#fff',
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e7d7af',
    backgroundColor: '#fff8e9',
    borderRadius: 12,
    padding: 10,
  },
  noteText: {
    flex: 1,
    color: akColors.primary,
    fontSize: 11,
    lineHeight: 16,
  },
  errorBox: {
    borderWidth: 1,
    borderColor: akColors.dangerBorder,
    backgroundColor: akColors.dangerBg,
    borderRadius: 12,
    padding: 10,
  },
  errorText: {
    color: akColors.danger,
    fontSize: 12,
    lineHeight: 17,
  },
  successBox: {
    borderWidth: 1,
    borderColor: akColors.successBorder,
    backgroundColor: akColors.successBg,
    borderRadius: 12,
    padding: 10,
  },
  successText: {
    color: akColors.success,
    fontSize: 12,
    lineHeight: 17,
  },
  submitButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: akColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...akShadow.soft,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  uploadPhotoButton: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  uploadPhotoButtonText: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.8,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backToLoginLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  backToLoginText: {
    color: akColors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  idBadge: {
    minWidth: 28,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idBadgeText: {
    color: akColors.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
});
