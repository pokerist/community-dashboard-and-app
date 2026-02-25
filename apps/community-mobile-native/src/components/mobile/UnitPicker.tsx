import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ResidentUnit } from '../../features/community/types';
import { akColors, akRadius } from '../../theme/alkarma';

type UnitPickerProps = {
  units: ResidentUnit[];
  selectedUnitId: string | null;
  onSelect: (unitId: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  title?: string;
};

function unitLabel(unit: ResidentUnit): string {
  const unitNo = unit.unitNumber || 'Unit';
  const block = unit.block ? `B${unit.block}` : null;
  const project = unit.projectName ?? null;
  return [project, block, unitNo].filter(Boolean).join(' • ');
}

export function UnitPicker({
  units,
  selectedUnitId,
  onSelect,
  onRefresh,
  isRefreshing,
  title = 'My Units',
}: UnitPickerProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {onRefresh ? (
          <Pressable onPress={onRefresh}>
            <Text style={styles.refreshText}>
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {units.length === 0 ? (
        <Text style={styles.emptyText}>No linked units found for this account.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {units.map((unit) => {
            const active = unit.id === selectedUnitId;
            const capabilities = unit.unitAccesses?.[0];
            return (
              <Pressable
                key={unit.id}
                onPress={() => onSelect(unit.id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipTitle, active && styles.chipTitleActive]} numberOfLines={2}>
                  {unitLabel(unit)}
                </Text>
                <Text style={[styles.chipMeta, active && styles.chipMetaActive]}>
                  {unit.status ?? '—'}
                  {capabilities?.role ? ` • ${capabilities.role}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: akColors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  refreshText: {
    color: akColors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  row: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    width: 220,
    borderRadius: akRadius.lg,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    padding: 10,
    gap: 4,
  },
  chipActive: {
    backgroundColor: '#2a3e35' + '08',
    borderColor: akColors.primary,
  },
  chipTitle: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  chipTitleActive: {
    color: akColors.primary,
  },
  chipMeta: {
    color: akColors.textMuted,
    fontSize: 11,
  },
  chipMetaActive: {
    color: akColors.primary,
  },
  emptyText: {
    color: akColors.textMuted,
    fontSize: 12,
  },
});
