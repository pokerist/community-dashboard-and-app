import { useEffect, useState } from 'react';
import {
  getConnectivitySnapshot,
  subscribeConnectivity,
  type ConnectivitySnapshot,
} from './connectivity';

export type UseNetworkStatusResult = Pick<
  ConnectivitySnapshot,
  'isOnline' | 'isInternetReachable' | 'isDegraded' | 'lastChangeAt'
>;

export function useNetworkStatus(): UseNetworkStatusResult {
  const [snapshot, setSnapshot] = useState<ConnectivitySnapshot>(() =>
    getConnectivitySnapshot(),
  );

  useEffect(() => subscribeConnectivity(setSnapshot), []);

  return {
    isOnline: snapshot.isOnline,
    isInternetReachable: snapshot.isInternetReachable,
    isDegraded: snapshot.isDegraded,
    lastChangeAt: snapshot.lastChangeAt,
  };
}
