import * as SecureStore from 'expo-secure-store';
import type { AuthSession, SavedLoginCredentials } from './types';

const SESSION_KEY = 'alkarma.community.auth.session';
const SAVED_LOGIN_KEY = 'alkarma.community.auth.saved-login';

async function secureSetItem(key: string, value: string) {
  try {
    await SecureStore.setItemAsync(key, value);
    return;
  } catch {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return;
    }
    throw new Error('Secure storage unavailable');
  }
}

async function secureGetItem(key: string) {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  }
}

async function secureDeleteItem(key: string) {
  try {
    await SecureStore.deleteItemAsync(key);
    return;
  } catch {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
      return;
    }
  }
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  await secureSetItem(SESSION_KEY, JSON.stringify(session));
}

export async function loadAuthSession(): Promise<AuthSession | null> {
  const raw = await secureGetItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.email !== 'string'
    ) {
      return null;
    }

    return {
      accessToken: parsed.accessToken,
      refreshToken:
        typeof parsed.refreshToken === 'string' ? parsed.refreshToken : null,
      userId: typeof parsed.userId === 'string' ? parsed.userId : null,
      email: parsed.email,
      userStatus:
        typeof parsed.userStatus === 'string' ? parsed.userStatus : null,
      mustCompleteActivation:
        typeof parsed.mustCompleteActivation === 'boolean'
          ? parsed.mustCompleteActivation
          : false,
    };
  } catch {
    return null;
  }
}

export async function clearAuthSession(): Promise<void> {
  await secureDeleteItem(SESSION_KEY);
}

export async function saveLoginCredentials(
  credentials: SavedLoginCredentials,
): Promise<void> {
  await secureSetItem(SAVED_LOGIN_KEY, JSON.stringify(credentials));
}

export async function loadLoginCredentials(): Promise<SavedLoginCredentials | null> {
  const raw = await secureGetItem(SAVED_LOGIN_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SavedLoginCredentials>;
    if (
      typeof parsed.email !== 'string' ||
      typeof parsed.password !== 'string' ||
      !parsed.email.trim() ||
      !parsed.password
    ) {
      return null;
    }
    return { email: parsed.email, password: parsed.password };
  } catch {
    return null;
  }
}

export async function clearLoginCredentials(): Promise<void> {
  await secureDeleteItem(SAVED_LOGIN_KEY);
}
