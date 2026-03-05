import { Platform } from 'react-native';

const explicitBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

function defaultBaseUrl() {
  // Android emulator cannot reach localhost on host machine directly.
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001';
  }
  return 'http://127.0.0.1:3001';
}

export const API_BASE_URL = (explicitBaseUrl || defaultBaseUrl()).replace(
  /\/+$/,
  '',
);

export const APP_NAME = 'MG Community';
