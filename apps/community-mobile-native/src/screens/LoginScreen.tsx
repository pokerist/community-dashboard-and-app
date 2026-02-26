import { useMemo, useState } from 'react';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Image,
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
import { API_BASE_URL } from '../config/env';
import { useBranding } from '../features/branding/provider';
import { akColors, akRadius, akShadow } from '../theme/alkarma';

const logoImage = require('../../assets/branding/alkarma-logo.png');
const DEMO_ACCOUNTS = [
  { label: 'Owner Demo', email: 'owner.demo@test.com', password: 'pass123' },
  { label: 'Tenant Demo', email: 'tenant.demo@test.com', password: 'pass123' },
  {
    label: 'Pre-Delivery Owner',
    email: 'preowner.demo@test.com',
    password: 'pass123',
  },
  { label: 'Family Demo', email: 'family.demo@test.com', password: 'pass123' },
  {
    label: 'Authorized (Delegate)',
    email: 'authorized.demo@test.com',
    password: 'pass123',
  },
  {
    label: 'Contractor Demo',
    email: 'contractor.demo@test.com',
    password: 'pass123',
  },
  { label: 'Resident A', email: 'residentA@test.com', password: 'pass123' },
  { label: 'Resident B', email: 'residentB@test.com', password: 'pass123' },
] as const;

type LoginScreenProps = {
  isSubmitting: boolean;
  errorMessage: string | null;
  canBiometricQuickSignIn?: boolean;
  biometricLabel?: string | null;
  onSubmit: (
    email: string,
    password: string,
    options?: { rememberCredentials?: boolean },
  ) => Promise<void>;
  onBiometricSignIn?: () => Promise<void>;
  onOpenRegister: () => void;
};

export function LoginScreen({
  isSubmitting,
  errorMessage,
  canBiometricQuickSignIn = false,
  biometricLabel = null,
  onSubmit,
  onBiometricSignIn,
  onOpenRegister,
}: LoginScreenProps) {
  const insets = useSafeAreaInsets();
  const { brand } = useBranding();
  const [email, setEmail] = useState('residentA@test.com');
  const [password, setPassword] = useState('pass123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isBiometricSubmitting, setIsBiometricSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showCredentials, setShowCredentials] = useState(true);

  const combinedError = errorMessage || localError;
  const backendHint = useMemo(() => {
    if (!combinedError) return null;
    return combinedError.toLowerCase().includes('cannot reach backend')
      ? `Backend not reachable: ${API_BASE_URL}`
      : null;
  }, [combinedError]);
  const topPadding = Math.max(insets.top, 10) + 8;
  const brandPrimary = brand.primaryColor || akColors.primary;
  const brandAccent = brand.accentColor || akColors.gold;
  const logoSource =
    brand.logoUrl && brand.logoUrl.trim()
      ? ({ uri: brand.logoUrl } as const)
      : logoImage;

  const handleSubmit = async () => {
    setLocalError(null);
    if (!email.trim() || !password) {
      setLocalError('Email and password are required.');
      return;
    }

    try {
      await onSubmit(email, password, { rememberCredentials: rememberMe });
    } catch {
      // handled by auth hook
    }
  };

  const handleBiometric = async () => {
    if (!onBiometricSignIn || !canBiometricQuickSignIn || isSubmitting) return;
    setLocalError(null);
    setIsBiometricSubmitting(true);
    try {
      await onBiometricSignIn();
    } catch {
      // surfaced by auth hook
    } finally {
      setIsBiometricSubmitting(false);
    }
  };

  const fillDemo = (demo: (typeof DEMO_ACCOUNTS)[number]) => {
    setEmail(demo.email);
    setPassword(demo.password);
    setLocalError(null);
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
            <View style={styles.logoHeader}>
              <Image source={logoSource} style={styles.logo} resizeMode="contain" />
            </View>

            <View style={styles.bannerWrap}>
              <LinearGradient
                colors={[brandPrimary, akColors.primaryDark, brandPrimary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.bannerCard}
              >
                <View style={styles.bannerOverlay} />
                <View style={styles.bannerContent}>
                  <Text style={[styles.bannerTag, { color: brandAccent }]}>
                    {(brand.companyName || 'Community').toUpperCase()}
                  </Text>
                  <Text style={styles.bannerTitle}>Community Access</Text>
                  <Text style={styles.bannerSubtitle}>
                    {(brand.appDisplayName || 'Resident app')} connected to the live backend for real booking, services and QR flows.
                  </Text>
                </View>
              </LinearGradient>
            </View>

            <View style={styles.formArea}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Email or Phone</Text>
                <View style={styles.inputShell}>
                  <Ionicons name="mail-outline" size={18} color={akColors.textMuted} />
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                    style={styles.input}
                    placeholder="ahmed.hassan@email.com"
                    placeholderTextColor={akColors.textSoft}
                    editable={!isSubmitting}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Password</Text>
                <View style={styles.inputShell}>
                  <Feather name="lock" size={18} color={akColors.textMuted} />
                  <TextInput
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    style={styles.input}
                    placeholder="Enter your password"
                    placeholderTextColor={akColors.textSoft}
                    editable={!isSubmitting}
                  />
                  <Pressable
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={8}
                    style={styles.inputIconButton}
                  >
                    {showPassword ? (
                      <Feather name="eye-off" size={18} color={akColors.textMuted} />
                    ) : (
                      <Feather name="eye" size={18} color={akColors.textMuted} />
                    )}
                  </Pressable>
                </View>
              </View>

              {combinedError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{combinedError}</Text>
                </View>
              ) : null}
              {backendHint ? (
                <View style={styles.hintBox}>
                  <Text style={styles.hintText}>{backendHint}</Text>
                </View>
              ) : null}

              <View style={styles.rowBetween}>
                <Pressable
                  onPress={() => setRememberMe((v) => !v)}
                  style={styles.rememberRow}
                  hitSlop={6}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe ? <Feather name="check" size={12} color="#fff" /> : null}
                  </View>
                  <Text style={styles.rememberText}>Remember me</Text>
                </Pressable>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </View>

              <Pressable
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <View style={styles.loadingInline}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.submitButtonText}>Signing In...</Text>
                  </View>
                ) : (
                  <Text style={styles.submitButtonText}>Sign In</Text>
                )}
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Or</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable
                style={styles.outlineButton}
                onPress={handleBiometric}
                disabled={!canBiometricQuickSignIn || isBiometricSubmitting || isSubmitting}
              >
                <MaterialCommunityIcons
                  name="fingerprint"
                  size={18}
                  color={canBiometricQuickSignIn ? brandPrimary : akColors.textSoft}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.outlineButtonText,
                    !canBiometricQuickSignIn && styles.outlineButtonTextDisabled,
                  ]}
                >
                  {isBiometricSubmitting
                    ? 'Authenticating...'
                    : canBiometricQuickSignIn
                      ? `Sign in with ${biometricLabel || 'Biometrics'}`
                      : 'Biometric sign-in unavailable'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.footerBlock}>
              <View style={styles.footerRow}>
                <Text style={styles.footerLine}>Don't have an account?</Text>
                <Pressable onPress={onOpenRegister} hitSlop={6}>
                  <Text style={styles.footerAccent}>Register Now</Text>
                </Pressable>
              </View>
              <Text style={styles.footerSmall}>
                Submit a signup request for admin approval.
              </Text>
            </View>

            {showCredentials ? (
              <LinearGradient
                colors={['rgba(201,169,97,0.12)', 'rgba(42,62,53,0.05)']}
                style={styles.demoCredentialsCard}
              >
                <View style={styles.rowBetween}>
                  <Text style={styles.demoCredTitle}>Demo Credentials</Text>
                  <Pressable onPress={() => setShowCredentials(false)}>
                    <Text style={styles.demoHideText}>Hide</Text>
                  </Pressable>
                </View>

                {DEMO_ACCOUNTS.map((demo) => (
                  <Pressable
                    key={demo.email}
                    style={styles.demoUserTile}
                    onPress={() => fillDemo(demo)}
                  >
                    <Text style={styles.demoUserName}>{demo.label}</Text>
                    <Text style={styles.demoUserEmail}>{demo.email}</Text>
                  </Pressable>
                ))}
              </LinearGradient>
            ) : (
              <Pressable onPress={() => setShowCredentials(true)} style={styles.showDemoButton}>
                <Text style={styles.showDemoText}>Show Demo Credentials</Text>
              </Pressable>
            )}

            <View style={styles.poweredWrap}>
              <Text style={styles.poweredText}>
                Powered by <Text style={[styles.poweredAccent, { color: brandAccent }]}>
                  {brand.companyName || 'Community Platform'}
                </Text>
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
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
    gap: 16,
  },
  logoHeader: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 4,
  },
  logo: {
    width: 170,
    height: 64,
  },
  bannerWrap: {
    marginTop: 2,
  },
  bannerCard: {
    borderRadius: 20,
    minHeight: 150,
    overflow: 'hidden',
    ...akShadow.card,
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  bannerContent: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
    gap: 4,
  },
  bannerTag: {
    color: akColors.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  bannerTitle: {
    color: akColors.white,
    fontSize: 20,
    fontWeight: '700',
  },
  bannerSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    lineHeight: 17,
  },
  formArea: {
    gap: 10,
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
    height: 56,
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
    fontSize: 15,
    color: akColors.text,
    paddingVertical: 0,
  },
  inputIconButton: {
    padding: 2,
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
  hintBox: {
    borderWidth: 1,
    borderColor: '#d6c28a',
    backgroundColor: '#fff9ec',
    borderRadius: 12,
    padding: 10,
  },
  hintText: {
    color: akColors.primary,
    fontSize: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: akColors.primary,
    backgroundColor: akColors.primary,
  },
  rememberText: {
    color: akColors.textMuted,
    fontSize: 12,
  },
  forgotText: {
    color: akColors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  submitButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: akColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...akShadow.soft,
  },
  submitButtonDisabled: {
    opacity: 0.75,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  loadingInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: akColors.border,
  },
  dividerText: {
    color: akColors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  outlineButton: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  outlineButtonText: {
    color: akColors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  outlineButtonTextDisabled: {
    color: akColors.textSoft,
  },
  footerBlock: {
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerLine: {
    color: akColors.textMuted,
    fontSize: 13,
  },
  footerAccent: {
    color: akColors.primary,
    fontWeight: '700',
  },
  footerSmall: {
    color: akColors.textSoft,
    fontSize: 11,
    textAlign: 'center',
  },
  demoCredentialsCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(201,169,97,0.22)',
    padding: 14,
    gap: 10,
  },
  demoCredTitle: {
    color: akColors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  demoHideText: {
    color: akColors.textMuted,
    fontSize: 11,
  },
  demoUserTile: {
    backgroundColor: akColors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: akColors.border,
    padding: 12,
    gap: 2,
  },
  demoUserName: {
    color: akColors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  demoUserEmail: {
    color: akColors.textMuted,
    fontSize: 11,
  },
  showDemoButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  showDemoText: {
    color: akColors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  poweredWrap: {
    alignItems: 'center',
    marginTop: 2,
  },
  poweredText: {
    color: akColors.textMuted,
    fontSize: 11,
  },
  poweredAccent: {
    color: akColors.gold,
  },
});
