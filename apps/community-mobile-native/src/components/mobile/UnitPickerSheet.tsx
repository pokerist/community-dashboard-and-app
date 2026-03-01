import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ResidentUnit } from '../../features/community/types';
import { useBranding } from '../../features/branding/provider';
import { getBrandPalette } from '../../features/branding/palette';
import { akColors, akRadius, akShadow } from '../../theme/alkarma';

type UnitPickerSheetProps = {
  visible: boolean;
  units: ResidentUnit[];
  selectedUnitId: string | null;
  anchorTop?: number;
  anchorRight?: number;
  isLoading?: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onClose: () => void;
  onSelect: (unitId: string) => void;
};

function unitLine(unit: ResidentUnit) {
  return unit.unitNumber || 'Unit';
}

function unitSubline(unit: ResidentUnit) {
  const unitTypeRaw = String(unit.type ?? '').toUpperCase();
  const unitTypeLabel =
    unitTypeRaw === 'OWNER' || unitTypeRaw === 'OWN_USE'
      ? 'Own Use'
      : unitTypeRaw === 'TENANT' || unitTypeRaw === 'RENTED'
        ? 'Rented'
        : unit.type
          ? String(unit.type)
          : null;
  const parts: string[] = [];
  if (unit.projectName) parts.push(unit.projectName);
  if (unit.block) parts.push(`Block ${unit.block}`);
  if (unitTypeLabel) parts.push(unitTypeLabel);
  return parts.join(' • ');
}

export function UnitPickerSheet({
  visible,
  units,
  selectedUnitId,
  anchorTop,
  anchorRight,
  isLoading,
  isRefreshing,
  onRefresh,
  onClose,
  onSelect,
}: UnitPickerSheetProps) {
  const { brand } = useBranding();
  const palette = getBrandPalette(brand);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheetWrap,
            {
              paddingTop: anchorTop ?? 84,
              paddingRight: anchorRight ?? 12,
            },
          ]}
        >
          <View style={styles.sheet}>
            <View style={styles.headerRow}>
              <View style={styles.headerTitleWrap}>
                <Text style={styles.title}>Select Unit</Text>
                <Text style={styles.subtitle}>
                  {units.length === 0
                    ? 'No units are linked to this account.'
                    : units.length === 1
                      ? 'Only one unit is registered under your name.'
                      : 'Switch the active unit to update home data and actions.'}
                </Text>
              </View>
              <View style={styles.headerActions}>
                {onRefresh ? (
                  <Pressable style={styles.iconBtn} onPress={onRefresh}>
                    <Ionicons
                      name="refresh"
                      size={17}
                      color={palette.primary}
                    />
                  </Pressable>
                ) : null}
                <Pressable style={styles.iconBtn} onPress={onClose}>
                  <Ionicons name="close" size={18} color={akColors.text} />
                </Pressable>
              </View>
            </View>

            {isLoading ? (
              <View style={styles.centerBox}>
                <ActivityIndicator color={palette.primary} />
              </View>
            ) : (
              <ScrollView
                style={styles.listScroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.list}
              >
                {units.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons
                      name="home-outline"
                      size={20}
                      color={akColors.textSoft}
                    />
                    <Text style={styles.emptyText}>
                      No units are linked to this account.
                    </Text>
                  </View>
                ) : (
                  units.map((unit) => {
                    const active = unit.id === selectedUnitId;
                    const access = unit.unitAccesses?.[0];
                    return (
                      <Pressable
                        key={unit.id}
                        style={[
                          styles.rowCard,
                          active && {
                            backgroundColor: palette.primary,
                            borderColor: palette.primary,
                          },
                        ]}
                        onPress={() => {
                          onSelect(unit.id);
                          onClose();
                        }}
                      >
                        <View style={styles.rowLeft}>
                          <View
                            style={[
                              styles.homeIconWrap,
                              active && styles.homeIconWrapActive,
                            ]}
                          >
                            <Ionicons
                              name="home-outline"
                              size={16}
                              color={active ? '#fff' : palette.primary}
                            />
                          </View>
                          <View style={styles.flex}>
                            <Text
                              numberOfLines={1}
                              style={[styles.rowTitle, active && styles.rowTitleActive]}
                            >
                              {unitLine(unit)}
                            </Text>
                            <Text
                              numberOfLines={2}
                              style={[styles.rowSub, active && styles.rowSubActive]}
                            >
                              {unitSubline(unit) || 'Residential Unit'}
                            </Text>
                            <Text
                              numberOfLines={1}
                              style={[styles.rowMeta, active && styles.rowMetaActive]}
                            >
                              {String(unit.status ?? 'ACTIVE').replace(/_/g, ' ')}
                              {access?.role ? ` • ${access.role}` : ''}
                            </Text>
                          </View>
                        </View>
                        {active ? (
                          <Ionicons name="checkmark-circle" size={18} color="#fff" />
                        ) : (
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={akColors.textSoft}
                          />
                        )}
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            )}

            {isRefreshing ? (
              <Text style={styles.refreshingText}>Refreshing units…</Text>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  sheetWrap: {
    width: '100%',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
  },
  sheet: {
    width: '100%',
    maxWidth: 348,
    borderRadius: 22,
    backgroundColor: akColors.surface,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.9)',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    maxHeight: '92%',
    ...akShadow.card,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  headerTitleWrap: {
    flex: 1,
  },
  title: {
    color: akColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 2,
    color: akColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  list: {
    gap: 8,
    paddingBottom: 4,
  },
  listScroll: {
    minHeight: 280,
  },
  centerBox: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  homeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.06)',
  },
  homeIconWrapActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  flex: {
    flex: 1,
  },
  rowTitle: {
    color: akColors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  rowTitleActive: {
    color: '#fff',
  },
  rowSub: {
    color: akColors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  rowSubActive: {
    color: 'rgba(255,255,255,0.82)',
  },
  rowMeta: {
    color: akColors.textSoft,
    fontSize: 10,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  rowMetaActive: {
    color: 'rgba(255,255,255,0.72)',
  },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: akColors.textMuted,
    fontSize: 12,
  },
  refreshingText: {
    marginTop: 8,
    textAlign: 'center',
    color: akColors.textMuted,
    fontSize: 11,
  },
});
