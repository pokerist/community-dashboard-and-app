import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppToastProvider } from './src/components/mobile/AppToast';
import { BrandingProvider } from './src/features/branding/provider';
import { LoginScreen } from './src/screens/LoginScreen';
import { MobileShell } from './src/screens/MobileShell';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { useAuthSession } from './src/features/auth/useAuthSession';

type GuestRoute = 'onboarding' | 'login' | 'register';

export default function App() {
  const auth = useAuthSession();
  const [guestRoute, setGuestRoute] = useState<GuestRoute>('onboarding');

  if (auth.isBootstrapping) {
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView style={styles.root}>
          <BrandingProvider>
            <AppToastProvider>
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0B5FFF" />
                <Text style={styles.loadingText}>Loading session...</Text>
                <StatusBar style="dark" />
              </View>
            </AppToastProvider>
          </BrandingProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }

  if (!auth.session) {
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView style={styles.root}>
          <BrandingProvider>
            <AppToastProvider>
              {guestRoute === 'onboarding' ? (
                <>
                  <OnboardingScreen onComplete={() => setGuestRoute('login')} />
                  <StatusBar style="light" />
                </>
              ) : guestRoute === 'register' ? (
                <>
                  <RegisterScreen onBackToLogin={() => setGuestRoute('login')} />
                  <StatusBar style="dark" />
                </>
              ) : (
                <>
                  <LoginScreen
                    isSubmitting={auth.isSubmitting}
                    errorMessage={auth.errorMessage}
                    canBiometricQuickSignIn={auth.canBiometricQuickSignIn}
                    biometricLabel={auth.biometricLabel}
                    onSubmit={auth.signIn}
                    onBiometricSignIn={auth.signInWithBiometrics}
                    onOpenRegister={() => setGuestRoute('register')}
                  />
                  <StatusBar style="dark" />
                </>
              )}
            </AppToastProvider>
          </BrandingProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
        <BrandingProvider>
          <AppToastProvider>
            <MobileShell
              session={auth.session}
              isRefreshing={auth.isRefreshing}
              refreshError={auth.refreshError}
              onRefreshSession={auth.refreshSession}
              onLogout={auth.signOut}
            />
            <StatusBar style="dark" />
          </AppToastProvider>
        </BrandingProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    padding: 24,
  },
  loadingText: {
    fontSize: 14,
    color: '#475569',
  },
});
