import axios from 'axios';
import { API_BASE_URL } from '../config/env';
import { getConnectivitySnapshot } from '../features/network/connectivity';

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

export type HttpNormalizedErrorCode =
  | 'NETWORK_UNREACHABLE'
  | 'REQUEST_TIMEOUT'
  | 'AUTH_EXPIRED'
  | 'API_ERROR';

export type HttpNormalizedError = {
  code: HttpNormalizedErrorCode;
  message: string;
  status?: number;
  retriable: boolean;
  endpoint: string;
};

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
let lastNetworkToastAt = 0;

const RETRY_DELAYS_MS = [400, 900, 1700];

type RetryConfig = {
  enabled?: boolean;
  retries?: number;
};

type RetryRequestConfig = {
  url?: string;
  method?: string;
  retryPolicy?: RetryConfig;
  idempotent?: boolean;
  __retryCount?: number;
  __isRetryRequest?: boolean;
};

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

function isAuthRoute(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('/auth/login') ||
    lower.includes('/auth/refresh') ||
    lower.includes('/signup')
  );
}

function isTerminalRefreshAuthError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  if (status !== 401 && status !== 403) return false;
  const requestUrl = String(error.config?.url ?? '').toLowerCase();
  return requestUrl.includes('/auth/refresh');
}

function normalizeHttpError(error: unknown): HttpNormalizedError {
  if (!axios.isAxiosError(error)) {
    return {
      code: 'API_ERROR',
      message: error instanceof Error ? error.message : 'Unexpected error',
      retriable: false,
      endpoint: 'unknown',
    };
  }

  const status = error.response?.status;
  const endpoint = String(error.config?.url ?? '');
  const data = error.response?.data as
    | { message?: string | string[]; error?: string }
    | undefined;
  const apiMessage = Array.isArray(data?.message)
    ? data?.message.join(', ')
    : typeof data?.message === 'string'
      ? data?.message
      : typeof data?.error === 'string'
        ? data.error
        : error.message;

  if (status === 401 || status === 403) {
    return {
      code: 'AUTH_EXPIRED',
      message: apiMessage || 'Session expired. Please sign in again.',
      status,
      retriable: false,
      endpoint,
    };
  }

  if (error.code === 'ECONNABORTED' || String(error.message).toLowerCase().includes('timeout')) {
    return {
      code: 'REQUEST_TIMEOUT',
      message: 'Request timed out. Please try again.',
      status,
      retriable: true,
      endpoint,
    };
  }

  if (error.code === 'ERR_NETWORK' || !error.response) {
    return {
      code: 'NETWORK_UNREACHABLE',
      message: 'Network unavailable. Check your internet connection.',
      status,
      retriable: true,
      endpoint,
    };
  }

  return {
    code: 'API_ERROR',
    message: apiMessage || 'Request failed. Please try again.',
    status,
    retriable: status === 502 || status === 503 || status === 504,
    endpoint,
  };
}

function canRetryRequest(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const original = (error.config ?? {}) as RetryRequestConfig & {
    method?: string;
    url?: string;
  };

  const endpoint = String(original.url ?? '');
  if (isAuthRoute(endpoint)) return false;

  const status = error.response?.status;
  const retryableStatus = status === 502 || status === 503 || status === 504;
  const noResponseNetwork =
    error.code === 'ERR_NETWORK' ||
    error.code === 'ECONNABORTED' ||
    !error.response ||
    String(error.message).toLowerCase().includes('timeout');
  if (!retryableStatus && !noResponseNetwork) return false;

  const retries = Math.max(
    0,
    Math.min(original.retryPolicy?.retries ?? RETRY_DELAYS_MS.length, RETRY_DELAYS_MS.length),
  );
  const count = original.__retryCount ?? 0;
  if (count >= retries) return false;

  if (original.retryPolicy?.enabled === true) return true;
  if (original.idempotent === true) return true;

  const method = String(original.method ?? 'get').toUpperCase();
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS' || method === 'DELETE';
}

function retryDelayForAttempt(attempt: number): number {
  const base = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)] ?? 1700;
  const jitter = Math.floor(Math.random() * 201) - 100;
  return Math.max(200, base + jitter);
}

export function configureHttpAuthHandlers(handlers: AuthHttpHandlers | null) {
  authHttpHandlers = handlers;
}

http.interceptors.request.use((config) => {
  const current = authHttpHandlers?.getSession();
  const url = String(config.url ?? '');
  const retryConfig = config as RetryRequestConfig;
  if (typeof retryConfig.__retryCount !== 'number') {
    retryConfig.__retryCount = 0;
  }
  if (
    current?.accessToken &&
    !config.headers?.Authorization &&
    !isAuthRoute(url)
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
    const original = error.config as any as RetryRequestConfig;
    const url = String(original?.url ?? '');

    if (canRetryRequest(error) && original) {
      const retryCount = original.__retryCount ?? 0;
      const delay = retryDelayForAttempt(retryCount);
      original.__retryCount = retryCount + 1;
      console.log(`[HTTP-RETRY] attempt ${original.__retryCount} ${url || 'unknown-url'}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return http.request(original as any);
    }

    if (
      status !== 401 ||
      !authHttpHandlers ||
      !original ||
      original.__isRetryRequest ||
      isAuthRoute(url)
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
        return Promise.reject(error);
      }

      setHeaderAuth(original, refreshed.accessToken);
      return http.request(original as any);
    } catch (refreshError) {
      const normalized = normalizeHttpError(refreshError);
      if (normalized.code === 'NETWORK_UNREACHABLE' || normalized.code === 'REQUEST_TIMEOUT') {
        const now = Date.now();
        if (now - lastNetworkToastAt > 8000) {
          lastNetworkToastAt = now;
          console.log('[AUTH] refresh failed due to network');
        }
        return Promise.reject(error);
      }
      if (isTerminalRefreshAuthError(refreshError)) {
        await handleSessionExpired('Session expired. Please sign in again.');
      }
      return Promise.reject(refreshError);
    }
  },
);

export function extractApiErrorMessage(error: unknown): string {
  return normalizeHttpError(error).message;
}

export function isNetworkError(error: unknown): boolean {
  const normalized = normalizeHttpError(error);
  return (
    normalized.code === 'NETWORK_UNREACHABLE' ||
    normalized.code === 'REQUEST_TIMEOUT'
  );
}

export function isAuthExpiredError(error: unknown): boolean {
  return normalizeHttpError(error).code === 'AUTH_EXPIRED';
}

export function isCurrentlyOnline(): boolean {
  return getConnectivitySnapshot().isOnline;
}
