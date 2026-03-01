import { useCallback, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { extractApiErrorMessage } from '../../lib/http';
import { listMyUnits } from '../community/service';
import type { ResidentUnit } from '../community/types';

type UseResidentUnitsResult = {
  units: ResidentUnit[];
  selectedUnitId: string | null;
  selectedUnit: ResidentUnit | null;
  isLoading: boolean;
  isRefreshing: boolean;
  errorMessage: string | null;
  requiresSelection: boolean;
  setSelectedUnitId: (unitId: string) => void;
  refresh: () => Promise<void>;
};

function unitSelectionStorageKey(userId?: string | null) {
  return `resident_last_selected_unit_${String(userId ?? 'unknown')}`;
}

export function useResidentUnits(
  accessToken: string,
  userId?: string | null,
): UseResidentUnitsResult {
  const [units, setUnits] = useState<ResidentUnit[]>([]);
  const [selectedUnitId, setSelectedUnitIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setIsLoading(true);
      else setIsRefreshing(true);
      setErrorMessage(null);
      try {
        const result = await listMyUnits(accessToken);
        setUnits(result.data);
        const storageKey = unitSelectionStorageKey(userId);
        const savedSelection = await SecureStore.getItemAsync(storageKey);

        setSelectedUnitIdState((prev) => {
          if (prev && result.data.some((u) => u.id === prev)) return prev;
          if (savedSelection && result.data.some((u) => u.id === savedSelection)) {
            return savedSelection;
          }
          if (result.data.length === 1) return result.data[0].id;
          return null;
        });

        if (result.data.length === 1) {
          await SecureStore.setItemAsync(storageKey, result.data[0].id);
        }
      } catch (error) {
        setErrorMessage(extractApiErrorMessage(error));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [accessToken, userId],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  const selectedUnit = useMemo(
    () => units.find((unit) => unit.id === selectedUnitId) ?? null,
    [units, selectedUnitId],
  );

  const setSelectedUnitId = useCallback(
    (unitId: string) => {
      setSelectedUnitIdState(unitId);
      void SecureStore.setItemAsync(unitSelectionStorageKey(userId), unitId);
    },
    [userId],
  );

  const refresh = useCallback(async () => {
    await load('refresh');
  }, [load]);

  const requiresSelection =
    !isLoading && units.length > 1 && !selectedUnitId;

  return {
    units,
    selectedUnitId,
    selectedUnit,
    isLoading,
    isRefreshing,
    errorMessage,
    requiresSelection,
    setSelectedUnitId,
    refresh,
  };
}
