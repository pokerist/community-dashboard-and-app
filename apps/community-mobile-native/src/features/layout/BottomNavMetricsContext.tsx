import { createContext, useContext } from 'react';

export type BottomNavMetrics = {
  contentInsetBottom: number;
  barHeight: number;
  barBottom: number;
  fabSize: number;
  fabLiftPx: number;
};

const BottomNavMetricsContext = createContext<BottomNavMetrics>({
  contentInsetBottom: 96,
  barHeight: 68,
  barBottom: 6,
  fabSize: 54,
  fabLiftPx: 26,
});

export const BottomNavMetricsProvider = BottomNavMetricsContext.Provider;

export function useBottomNavMetrics() {
  return useContext(BottomNavMetricsContext);
}
