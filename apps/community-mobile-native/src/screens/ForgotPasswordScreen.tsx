import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppToast } from '../components/mobile/AppToast';
import { forgotPasswordRequest } from '../features/auth/service';
import { extractApiErrorMessage } from '../lib/http';
import { akColors, akShadow } from '../theme/alkarma';

type ForgotPasswordScreenProps = {
  onBackToLogin: () => void;
};

export function ForgotPasswordScreen({ onBackToLogin }: ForgotPasswordScreenProps) {
  const insets = useSafeAreaInsets();
  const toast = useAppToast();
  const [identifier, setIdentifier] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const value = identifier.trim();
    if (!value) {
      toast.error('Missing value', 'Enter your email or phone number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = value.includes('@') ? { email: value } : { phone: value };
      const response = await forgotPasswordRequest(payload);
      const message =
        response?.message ||
        'If the account exists, reset instructions were sent.';
      if (response?.code === 'ACCOUNT_NOT_ACTIVATED') {
        toast.info('Account not activated', message);
      } else {
        toast.success('Request submitted', message);
      }
    } catch (error) {
      toast.error('Reset request failed', extractApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: Math.max(insets.top, 8) + 10 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable style={styles.backBtn} onPress={onBackToLogin}>
            <Feather name="arrow-left" size={16} color={akColors.text} />
            <Text style={styles.backText}>Back to Login</Text>
          </Pressable>

          <View style={styles.card}>
            <Text style={styles.title}>Forgot Password</Text>
            <Text style={styles.subtitle}>
              Enter your registered email or phone number. We will send reset instructions based on your account configuration.
            </Text>

            <Text style={styles.label}>Email or Phone</Text>
            <View style={styles.inputShell}>
              <Feather name="mail" size={17} color={akColors.textMuted} />
              <TextInput
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
                placeholder="email@example.com or +2011..."
                placeholderTextColor={akColors.textSoft}
                style={styles.input}
              />
            </View>

            <Pressable
              style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
              disabled={isSubmitting}
              onPress={handleSubmit}
            >
              {isSubmitting ? (
                <View style={styles.loadingInline}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.submitText}>Submitting...</Text>
                </View>
              ) : (
                <Text style={styles.submitText}>Send Reset Instructions</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: akColors.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 14,
  },
  backBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backText: {
    color: akColors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    borderRadius: 18,
    backgroundColor: akColors.surface,
    borderWidth: 1,
    borderColor: akColors.border,
    padding: 16,
    gap: 10,
    ...akShadow.card,
  },
  title: {
    color: akColors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    color: akColors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  label: {
    marginTop: 6,
    color: akColors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  inputShell: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    color: akColors.text,
    fontSize: 14,
    paddingVertical: 0,
  },
  submitBtn: {
    marginTop: 8,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: akColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.75,
  },
  submitText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
