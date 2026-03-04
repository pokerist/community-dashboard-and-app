import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';

const INITIAL_PERMISSIONS_KEY = 'mobile.initial_permissions_requested.v1';

async function requestNotificationPermissionOnce() {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'granted') return;
    await Notifications.requestPermissionsAsync();
  } catch {
    // best-effort only
  }
}

async function requestLocationPermissionOnce() {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.status === 'granted') return;
    await Location.requestForegroundPermissionsAsync();
  } catch {
    // best-effort only
  }
}

async function requestMicrophonePermissionOnce() {
  try {
    const current = await Audio.getPermissionsAsync();
    if (current.granted) return;
    await Audio.requestPermissionsAsync();
  } catch {
    // best-effort only
  }
}

export async function ensureInitialRuntimePermissionsRequested() {
  try {
    const done = await SecureStore.getItemAsync(INITIAL_PERMISSIONS_KEY);
    if (done === '1') return;

    // Ask runtime permissions once after install.
    await requestNotificationPermissionOnce();
    await requestLocationPermissionOnce();
    await requestMicrophonePermissionOnce();

    await SecureStore.setItemAsync(INITIAL_PERMISSIONS_KEY, '1');
  } catch {
    // Do not block app startup if secure store is unavailable.
  }
}

export async function resetInitialPermissionBootstrapForDebug() {
  if (Platform.OS === 'web') return;
  try {
    await SecureStore.deleteItemAsync(INITIAL_PERMISSIONS_KEY);
  } catch {
    // noop
  }
}
