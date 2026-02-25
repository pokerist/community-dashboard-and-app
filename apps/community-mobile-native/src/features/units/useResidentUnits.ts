import { useCallback, useEffect, useMemo, useState } from 'react';
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
  setSelectedUnitId: (unitId: string) => void;
  refresh: () => Promise<void>;
};

export function useResidentUnits(accessToken: string): UseResidentUnitsResult {
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
        setSelectedUnitIdState((prev) => {
          if (prev && result.data.some((u) => u.id === prev)) return prev;
          return result.data[0]?.id ?? null;
        });
      } catch (error) {
        setErrorMessage(extractApiErrorMessage(error));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [accessToken],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  const selectedUnit = useMemo(
    () => units.find((unit) => unit.id === selectedUnitId) ?? null,
    [units, selectedUnitId],
  );

  const setSelectedUnitId = useCallback((unitId: string) => {
    setSelectedUnitIdState(unitId);
  }, []);

  const refresh = useCallback(async () => {
    await load('refresh');
  }, [load]);

  return {
    units,
    selectedUnitId,
    selectedUnit,
    isLoading,
    isRefreshing,
    errorMessage,
    setSelectedUnitId,
    refresh,
  };
}
