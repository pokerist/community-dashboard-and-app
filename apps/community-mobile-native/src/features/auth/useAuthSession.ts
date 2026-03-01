import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { configureHttpAuthHandlers, extractApiErrorMessage } from '../../lib/http';
import { extractUserIdFromAccessToken } from './jwt';
import { loginRequest, refreshRequest, verifyLoginTwoFactorRequest } from './service';
import {
  clearAuthSession,
  clearLoginCredentials,
  loadAuthSession,
  loadLoginCredentials,
  saveAuthSession,
  saveLoginCredentials,
} from './storage';
import type { AuthSession, SavedLoginCredentials } from './types';

type PendingTwoFactorChallenge = {
  challengeToken: string;
  method?: string;
  expiresInSeconds?: number;
  email: string;
  password: string;
  rememberCredentials: boolean;
};

type AuthHookResult = {
  session: AuthSession | null;
  isBootstrapping: boolean;
  isSubmitting: boolean;
  isRefreshing: boolean;
  errorMessage: string | null;
  refreshError: string | null;
  biometricAvailable: boolean;
  canBiometricQuickSignIn: boolean;
  biometricLabel: string | null;
  pendingTwoFactorChallenge: PendingTwoFactorChallenge | null;
  signIn: (
    email: string,
    password: string,
    options?: { rememberCredentials?: boolean },
  ) => Promise<void>;
  verifyTwoFactorOtp: (otp: string) => Promise<void>;
  clearTwoFactorChallenge: () => void;
  signInWithBiometrics: () => Promise<void>;
  refreshSession: () => Promise<void>;
  signOut: (reasonMessage?: string | null) => Promise<void>;
  markActivationComplete: (newPassword?: string) => Promise<void>;
};

export function useAuthSession(): AuthHookResult {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [savedLogin, setSavedLogin] = useState<SavedLoginCredentials | null>(null);
  const [pendingTwoFactorChallenge, setPendingTwoFactorChallenge] =
    useState<PendingTwoFactorChallenge | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState<string | null>(null);
  const sessionRef = useRef<AuthSession | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const lastForegroundRefreshAtRef = useRef(0);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [savedSession, storedLogin] = await Promise.all([
          loadAuthSession(),
          loadLoginCredentials(),
        ]);
        if (mounted) {
          setSession(savedSession);
          setSavedLogin(storedLogin);
        }
        try {
          const [hasHardware, enrolled, types] = await Promise.all([
            LocalAuthentication.hasHardwareAsync(),
            LocalAuthentication.isEnrolledAsync(),
            LocalAuthentication.supportedAuthenticationTypesAsync().catch(
              () => [],
            ),
          ]);
          if (!mounted) return;
          const available = Boolean(hasHardware && enrolled);
          setBiometricAvailable(available);
          const typeValues = Array.isArray(types) ? types : [];
          const hasFace = typeValues.includes(
            LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
          );
          const hasFingerprint = typeValues.includes(
            LocalAuthentication.AuthenticationType.FINGERPRINT,
          );
          setBiometricLabel(
            available
              ? hasFace
                ? 'Face ID'
                : hasFingerprint
                  ? 'Fingerprint'
                  : 'Biometrics'
              : null,
          );
        } catch {
          if (mounted) {
            setBiometricAvailable(false);
            setBiometricLabel(null);
          }
        }
      } finally {
        if (mounted) setIsBootstrapping(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const completeSessionSignIn = useCallback(
    async (
      data: {
        accessToken?: string;
        refreshToken?: string;
        userStatus?: string;
        mustCompleteActivation?: boolean;
      },
      email: string,
      password: string,
      rememberCredentials: boolean,
    ) => {
      if (!data.accessToken) {
        throw new Error('Login response did not include accessToken');
      }

      const nextSession: AuthSession = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? null,
        userId: extractUserIdFromAccessToken(data.accessToken),
        email: email.trim(),
        userStatus: data.userStatus ?? null,
        mustCompleteActivation: data.mustCompleteActivation === true,
      };

      await saveAuthSession(nextSession);
      if (rememberCredentials) {
        await saveLoginCredentials({ email: email.trim(), password });
        setSavedLogin({ email: email.trim(), password });
      } else {
        await clearLoginCredentials();
        setSavedLogin(null);
      }
      setSession(nextSession);
      setPendingTwoFactorChallenge(null);
    },
    [],
  );

  const signIn = useCallback(async (
    email: string,
    password: string,
    options?: { rememberCredentials?: boolean },
  ) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setRefreshError(null);

    try {
      const data = await loginRequest({ email: email.trim(), password });
      if (data.challengeRequired && data.challengeToken) {
        setPendingTwoFactorChallenge({
          challengeToken: data.challengeToken,
          method: data.method,
          expiresInSeconds: data.expiresInSeconds,
          email: email.trim(),
          password,
          rememberCredentials: options?.rememberCredentials ?? true,
        });
        return;
      }

      await completeSessionSignIn(
        data,
        email,
        password,
        options?.rememberCredentials ?? true,
      );
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error));
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [completeSessionSignIn]);

  const verifyTwoFactorOtp = useCallback(async (otp: string) => {
    const challenge = pendingTwoFactorChallenge;
    if (!challenge?.challengeToken) {
      throw new Error('No active two-factor challenge.');
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const data = await verifyLoginTwoFactorRequest({
        challengeToken: challenge.challengeToken,
        otp: otp.trim(),
      });
      await completeSessionSignIn(
        data,
        challenge.email,
        challenge.password,
        challenge.rememberCredentials,
      );
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error));
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [completeSessionSignIn, pendingTwoFactorChallenge]);

  const clearTwoFactorChallenge = useCallback(() => {
    setPendingTwoFactorChallenge(null);
  }, []);

  const signInWithBiometrics = useCallback(async () => {
    if (!savedLogin?.email || !savedLogin.password) {
      const msg = 'No saved sign-in found. Sign in once and enable remember me.';
      setErrorMessage(msg);
      throw new Error(msg);
    }
    if (!biometricAvailable) {
      const msg = 'Biometric authentication is not available on this device.';
      setErrorMessage(msg);
      throw new Error(msg);
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Sign in to SSS Community',
      fallbackLabel: 'Use passcode',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });

    if (!result.success) {
      const msg =
        result.error === 'user_cancel' || result.error === 'system_cancel'
          ? 'Biometric sign-in cancelled.'
          : 'Biometric sign-in failed.';
      setErrorMessage(msg);
      throw new Error(msg);
    }

    await signIn(savedLogin.email, savedLogin.password, { rememberCredentials: true });
  }, [biometricAvailable, savedLogin, signIn]);

  const performRefresh = useCallback(async (current: AuthSession) => {
    const data = await refreshRequest({
      userId: current.userId!,
      refreshToken: current.refreshToken!,
    });

    if (!data.accessToken) {
      throw new Error('Refresh response did not include accessToken');
    }

    const updated: AuthSession = {
      ...current,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? current.refreshToken,
      userId: extractUserIdFromAccessToken(data.accessToken) ?? current.userId,
    };

    await saveAuthSession(updated);
    setSession(updated);
    sessionRef.current = updated;
    return updated;
  }, []);

  const refreshSession = useCallback(async () => {
    const current = sessionRef.current;
    if (!current?.refreshToken || !current.userId) {
      setRefreshError(
        'Refresh token or userId is missing. Sign in again to continue.',
      );
      return;
    }

    setIsRefreshing(true);
    setRefreshError(null);

    try {
      await performRefresh(current);
    } catch (error) {
      setRefreshError(extractApiErrorMessage(error));
      throw error;
    } finally {
      setIsRefreshing(false);
    }
  }, [performRefresh]);

  const signOut = useCallback(async (reasonMessage?: string | null) => {
    await clearAuthSession();
    setSession(null);
    sessionRef.current = null;
    setPendingTwoFactorChallenge(null);
    setErrorMessage(reasonMessage ?? null);
    setRefreshError(reasonMessage ?? null);
  }, []);

  const markActivationComplete = useCallback(
    async (newPassword?: string) => {
      const current = sessionRef.current;
      if (!current) return;
      const updated: AuthSession = {
        ...current,
        userStatus: 'ACTIVE',
        mustCompleteActivation: false,
      };
      await saveAuthSession(updated);
      setSession(updated);
      sessionRef.current = updated;

      if (
        newPassword &&
        savedLogin?.email &&
        savedLogin.email.trim().toLowerCase() ===
          (current.email || '').trim().toLowerCase()
      ) {
        const nextLogin = { email: savedLogin.email, password: newPassword };
        await saveLoginCredentials(nextLogin);
        setSavedLogin(nextLogin);
      }

      setErrorMessage(null);
      setRefreshError(null);
    },
    [savedLogin],
  );

  useEffect(() => {
    configureHttpAuthHandlers({
      getSession: () =>
        sessionRef.current
          ? {
              accessToken: sessionRef.current.accessToken,
              refreshToken: sessionRef.current.refreshToken,
              userId: sessionRef.current.userId,
            }
          : null,
      refreshSession: async () => {
        const current = sessionRef.current;
        if (!current?.refreshToken || !current.userId) return null;
        setIsRefreshing(true);
        setRefreshError(null);
        try {
          const updated = await performRefresh(current);
          return {
            accessToken: updated.accessToken,
            refreshToken: updated.refreshToken,
            userId: updated.userId,
          };
        } catch (error) {
          // Keep refresh failures silent during active usage; session invalidation is handled centrally.
          setRefreshError(null);
          return null;
        } finally {
          setIsRefreshing(false);
        }
      },
      onSessionExpired: () => signOut(null),
    });

    return () => {
      configureHttpAuthHandlers(null);
    };
  }, [performRefresh, signOut]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if (
        (prev === 'background' || prev === 'inactive') &&
        nextState === 'active'
      ) {
        const current = sessionRef.current;
        if (!current?.refreshToken || !current.userId) return;
        const now = Date.now();
        if (now - lastForegroundRefreshAtRef.current < 8000) return;
        lastForegroundRefreshAtRef.current = now;
        void refreshSession().catch(() => undefined);
      }
    });
    return () => sub.remove();
  }, [refreshSession]);

  return useMemo(
    () => ({
      session,
      isBootstrapping,
      isSubmitting,
      isRefreshing,
      errorMessage,
      refreshError,
      biometricAvailable,
      canBiometricQuickSignIn: Boolean(savedLogin && biometricAvailable),
      biometricLabel,
      pendingTwoFactorChallenge,
      signIn,
      verifyTwoFactorOtp,
      clearTwoFactorChallenge,
      signInWithBiometrics,
      refreshSession,
      signOut,
      markActivationComplete,
    }),
    [
      session,
      isBootstrapping,
      isSubmitting,
      isRefreshing,
      errorMessage,
      refreshError,
      biometricAvailable,
      savedLogin,
      biometricLabel,
      pendingTwoFactorChallenge,
      signIn,
      verifyTwoFactorOtp,
      clearTwoFactorChallenge,
      signInWithBiometrics,
      refreshSession,
      signOut,
      markActivationComplete,
    ],
  );
}
