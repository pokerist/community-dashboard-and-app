import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppToastProvider } from './src/components/mobile/AppToast';
import { BrandingProvider } from './src/features/branding/provider';
import { I18nProvider } from './src/features/i18n/provider';
import { ActivationScreen } from './src/screens/ActivationScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { MobileShell } from './src/screens/MobileShell';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { useAuthSession } from './src/features/auth/useAuthSession';
import { ensureInitialRuntimePermissionsRequested } from './src/features/device/permissions';

type GuestRoute = 'onboarding' | 'login' | 'forgot';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function App() {
  const auth = useAuthSession();
  const [guestRoute, setGuestRoute] = useState<GuestRoute>('onboarding');
  const [isAppReady, setIsAppReady] = useState(false);

  useEffect(() => {
    if (!auth.isBootstrapping) setIsAppReady(true);
  }, [auth.isBootstrapping]);

  useEffect(() => {
    if (!isAppReady) return;
    SplashScreen.hideAsync().catch(() => undefined);
  }, [isAppReady]);

  useEffect(() => {
    if (!isAppReady) return;
    void ensureInitialRuntimePermissionsRequested();
  }, [isAppReady]);

  if (!isAppReady) return null;

  if (!auth.session) {
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView style={styles.root}>
          <I18nProvider>
            <BrandingProvider>
              <AppToastProvider>
                {guestRoute === 'onboarding' ? (
                  <>
                    <OnboardingScreen onComplete={() => setGuestRoute('login')} />
                    <StatusBar style="light" />
                  </>
                ) : guestRoute === 'forgot' ? (
                  <>
                    <ForgotPasswordScreen onBackToLogin={() => setGuestRoute('login')} />
                    <StatusBar style="dark" />
                  </>
                ) : (
                  <>
                    <LoginScreen
                      isSubmitting={auth.isSubmitting}
                      errorMessage={auth.errorMessage}
                      canBiometricQuickSignIn={auth.canBiometricQuickSignIn}
                      biometricLabel={auth.biometricLabel}
                      pendingTwoFactorChallenge={auth.pendingTwoFactorChallenge}
                      onSubmit={auth.signIn}
                      onSubmitTwoFactorOtp={auth.verifyTwoFactorOtp}
                      onCancelTwoFactor={auth.clearTwoFactorChallenge}
                      onBiometricSignIn={auth.signInWithBiometrics}
                      onOpenForgotPassword={() => setGuestRoute('forgot')}
                    />
                    <StatusBar style="dark" />
                  </>
                )}
              </AppToastProvider>
            </BrandingProvider>
          </I18nProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }

  if (auth.session.mustCompleteActivation) {
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView style={styles.root}>
          <I18nProvider>
            <BrandingProvider>
              <AppToastProvider>
                <ActivationScreen
                  session={auth.session}
                  onActivationCompleted={auth.markActivationComplete}
                  onLogout={() => auth.signOut(null)}
                />
                <StatusBar style="dark" />
              </AppToastProvider>
            </BrandingProvider>
          </I18nProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
        <I18nProvider>
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
        </I18nProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
