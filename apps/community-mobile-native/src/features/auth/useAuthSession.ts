import { useCallback, useEffect, useMemo, useState } from 'react';
import { extractApiErrorMessage } from '../../lib/http';
import { extractUserIdFromAccessToken } from './jwt';
import { loginRequest, refreshRequest } from './service';
import { clearAuthSession, loadAuthSession, saveAuthSession } from './storage';
import type { AuthSession } from './types';

type AuthHookResult = {
  session: AuthSession | null;
  isBootstrapping: boolean;
  isSubmitting: boolean;
  isRefreshing: boolean;
  errorMessage: string | null;
  refreshError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
};

export function useAuthSession(): AuthHookResult {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const saved = await loadAuthSession();
        if (mounted) setSession(saved);
      } finally {
        if (mounted) setIsBootstrapping(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setRefreshError(null);

    try {
      const data = await loginRequest({ email: email.trim(), password });
      if (!data.accessToken) {
        throw new Error('Login response did not include accessToken');
      }

      const nextSession: AuthSession = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? null,
        userId: extractUserIdFromAccessToken(data.accessToken),
        email: email.trim(),
      };

      await saveAuthSession(nextSession);
      setSession(nextSession);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error));
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    if (!session?.refreshToken || !session.userId) {
      setRefreshError(
        'Refresh token or userId is missing. Sign in again to continue.',
      );
      return;
    }

    setIsRefreshing(true);
    setRefreshError(null);

    try {
      const data = await refreshRequest({
        userId: session.userId,
        refreshToken: session.refreshToken,
      });

      if (!data.accessToken) {
        throw new Error('Refresh response did not include accessToken');
      }

      const updated: AuthSession = {
        ...session,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? session.refreshToken,
        userId: extractUserIdFromAccessToken(data.accessToken) ?? session.userId,
      };

      await saveAuthSession(updated);
      setSession(updated);
    } catch (error) {
      setRefreshError(extractApiErrorMessage(error));
      throw error;
    } finally {
      setIsRefreshing(false);
    }
  }, [session]);

  const signOut = useCallback(async () => {
    await clearAuthSession();
    setSession(null);
    setErrorMessage(null);
    setRefreshError(null);
  }, []);

  return useMemo(
    () => ({
      session,
      isBootstrapping,
      isSubmitting,
      isRefreshing,
      errorMessage,
      refreshError,
      signIn,
      refreshSession,
      signOut,
    }),
    [
      session,
      isBootstrapping,
      isSubmitting,
      isRefreshing,
      errorMessage,
      refreshError,
      signIn,
      refreshSession,
      signOut,
    ],
  );
}
