import * as SecureStore from 'expo-secure-store';
import type { AuthSession } from './types';

const SESSION_KEY = 'alkarma.community.auth.session';

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
    };
  } catch {
    return null;
  }
}

export async function clearAuthSession(): Promise<void> {
  await secureDeleteItem(SESSION_KEY);
}
