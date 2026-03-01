import axios from 'axios';
import { API_BASE_URL } from '../config/env';

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

type AuthHttpSessionSnapshot = {
  accessToken: string;
  refreshToken: string | null;
  userId: string | null;
} | null;

type AuthHttpHandlers = {
  getSession: () => AuthHttpSessionSnapshot;
  refreshSession: () => Promise<AuthHttpSessionSnapshot>;
  onSessionExpired?: (message: string) => void | Promise<void>;
};

let authHttpHandlers: AuthHttpHandlers | null = null;
let inFlightRefresh: Promise<AuthHttpSessionSnapshot> | null = null;
let sessionExpiryHandledAt = 0;
let consecutiveRefreshFailures = 0;
let lastRefreshFailureAt = 0;

function setHeaderAuth(config: any, accessToken: string) {
  config.headers = config.headers ?? {};
  config.headers.Authorization = `Bearer ${accessToken}`;
}

async function handleSessionExpired(message: string) {
  const now = Date.now();
  if (now - sessionExpiryHandledAt < 1500) return;
  sessionExpiryHandledAt = now;
  await authHttpHandlers?.onSessionExpired?.(message);
}

function markRefreshFailureAndShouldExpire(): boolean {
  const now = Date.now();
  if (now - lastRefreshFailureAt > 90_000) {
    consecutiveRefreshFailures = 0;
  }
  lastRefreshFailureAt = now;
  consecutiveRefreshFailures += 1;
  return consecutiveRefreshFailures >= 3;
}

function resetRefreshFailureState() {
  consecutiveRefreshFailures = 0;
  lastRefreshFailureAt = 0;
}

export function configureHttpAuthHandlers(handlers: AuthHttpHandlers | null) {
  authHttpHandlers = handlers;
}

http.interceptors.request.use((config) => {
  const current = authHttpHandlers?.getSession();
  if (
    current?.accessToken &&
    !config.headers?.Authorization &&
    !String(config.url ?? '').includes('/auth/login') &&
    !String(config.url ?? '').includes('/auth/refresh') &&
    !String(config.url ?? '').includes('/signup')
  ) {
    setHeaderAuth(config, current.accessToken);
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const original = error.config as any;
    const url = String(original?.url ?? '');

    if (
      status !== 401 ||
      !authHttpHandlers ||
      !original ||
      original.__isRetryRequest ||
      url.includes('/auth/login') ||
      url.includes('/auth/refresh') ||
      url.includes('/signup')
    ) {
      return Promise.reject(error);
    }

    const session = authHttpHandlers.getSession();
    if (!session?.refreshToken || !session.userId) {
      await handleSessionExpired('Session expired. Please sign in again.');
      return Promise.reject(error);
    }

    original.__isRetryRequest = true;

    try {
      if (!inFlightRefresh) {
        inFlightRefresh = authHttpHandlers
          .refreshSession()
          .catch(() => null)
          .finally(() => {
            inFlightRefresh = null;
          });
      }

      const refreshed = await inFlightRefresh;
      if (!refreshed?.accessToken) {
        if (markRefreshFailureAndShouldExpire()) {
          await handleSessionExpired('Session expired. Please sign in again.');
        }
        return Promise.reject(error);
      }

      resetRefreshFailureState();
      setHeaderAuth(original, refreshed.accessToken);
      return http.request(original);
    } catch (refreshError) {
      if (markRefreshFailureAndShouldExpire()) {
        await handleSessionExpired('Session expired. Please sign in again.');
      }
      return Promise.reject(refreshError);
    }
  },
);

export function extractApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string | string[]; error?: string }
      | undefined;

    if (error.code === 'ERR_NETWORK' || !error.response) {
      return `Cannot reach backend at ${API_BASE_URL}`;
    }

    if (Array.isArray(data?.message)) return data.message.join(', ');
    if (typeof data?.message === 'string') return data.message;
    if (typeof data?.error === 'string') return data.error;
    if (typeof error.message === 'string') return error.message;
  }

  if (error instanceof Error && error.message) return error.message;
  return 'Unexpected error';
}
