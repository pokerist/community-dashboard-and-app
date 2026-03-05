import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export type ConnectivitySnapshot = {
  isOnline: boolean;
  isInternetReachable: boolean;
  isDegraded: boolean;
  lastChangeAt: number | null;
  lastOnlineAt: number | null;
};

let currentSnapshot: ConnectivitySnapshot = {
  isOnline: true,
  isInternetReachable: true,
  isDegraded: false,
  lastChangeAt: null,
  lastOnlineAt: Date.now(),
};

const listeners = new Set<(snapshot: ConnectivitySnapshot) => void>();
let initialized = false;
let unsubscribeNetInfo: (() => void) | null = null;

function normalizeSnapshot(state: NetInfoState, previous: ConnectivitySnapshot): ConnectivitySnapshot {
  const reachable = state.isInternetReachable !== false;
  const connected = state.isConnected !== false;
  const isOnline = connected && reachable;
  const changed = isOnline !== previous.isOnline;
  const now = Date.now();

  return {
    isOnline,
    isInternetReachable: reachable,
    isDegraded: connected && !reachable,
    lastChangeAt: changed ? now : previous.lastChangeAt,
    lastOnlineAt: isOnline ? now : previous.lastOnlineAt,
  };
}

function emit(snapshot: ConnectivitySnapshot) {
  for (const listener of listeners) {
    listener(snapshot);
  }
}

function ensureStarted() {
  if (initialized) return;
  initialized = true;

  unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    currentSnapshot = normalizeSnapshot(state, currentSnapshot);
    emit(currentSnapshot);
  });

  void NetInfo.fetch().then((state) => {
    currentSnapshot = normalizeSnapshot(state, currentSnapshot);
    emit(currentSnapshot);
  });
}

export function startConnectivityWatcher() {
  ensureStarted();
}

export function subscribeConnectivity(
  listener: (snapshot: ConnectivitySnapshot) => void,
): () => void {
  ensureStarted();
  listeners.add(listener);
  listener(currentSnapshot);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && unsubscribeNetInfo) {
      unsubscribeNetInfo();
      unsubscribeNetInfo = null;
      initialized = false;
    }
  };
}

export function getConnectivitySnapshot(): ConnectivitySnapshot {
  ensureStarted();
  return currentSnapshot;
}

export function isNetworkOnline(): boolean {
  return getConnectivitySnapshot().isOnline;
}
