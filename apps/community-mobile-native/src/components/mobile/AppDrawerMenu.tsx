import { useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ResidentUnit } from '../../features/community/types';
import type { AuthBootstrapProfile } from '../../features/auth/types';
import { useBranding } from '../../features/branding/provider';
import { akColors } from '../../theme/alkarma';

export type AppDrawerRoute =
  | 'Profile'
  | 'Access'
  | 'Requests'
  | 'Services'
  | 'Complaints'
  | 'Finance'
  | 'Notifications'
  | 'Bookings'
  | 'Household';

type DrawerMenuItem = {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'] | React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  iconSet?: 'ion' | 'mc';
  route?: AppDrawerRoute;
  disabled?: boolean;
};

type AppDrawerMenuProps = {
  visible: boolean;
  onClose: () => void;
  email: string;
  units: ResidentUnit[];
  selectedUnitId: string | null;
  onSelectUnit: (unitId: string) => void;
  onNavigate: (route: AppDrawerRoute) => void;
  onLogout: () => void;
  profile?: AuthBootstrapProfile | null;
  notificationUnreadCount?: number;
};

function isPreConstructionUnit(unit?: ResidentUnit | null): boolean {
  return String(unit?.status ?? '').toLowerCase().includes('not delivered');
}

export function AppDrawerMenu({
  visible,
  onClose,
  email,
  units,
  selectedUnitId,
  onSelectUnit,
  onNavigate,
  onLogout,
  profile,
  notificationUnreadCount: _notificationUnreadCount,
}: AppDrawerMenuProps) {
  const { brand } = useBranding();
  const brandPrimary = brand.primaryColor || akColors.primary;
  const brandAccent = brand.accentColor || akColors.gold;
  const selectedUnit = useMemo(
    () => units.find((u) => u.id === selectedUnitId) ?? units[0] ?? null,
    [selectedUnitId, units],
  );
  const initial = (email?.trim()?.charAt(0) || 'R').toUpperCase();
  const displayName =
    profile?.user?.nameEN?.trim() ||
    profile?.user?.nameAR?.trim() ||
    email.split('@')[0];
  const preConstruction = isPreConstructionUnit(selectedUnit);
  const unitAccesses = selectedUnit?.unitAccesses ?? [];
  const canGenerateQr =
    unitAccesses.length === 0 || unitAccesses.some((a) => a.canGenerateQR !== false);
  const canBookFacilities =
    unitAccesses.length === 0 || unitAccesses.some((a) => a.canBookFacilities !== false);
  const canViewFinancials =
    unitAccesses.length === 0 ||
    unitAccesses.some((a) => a.canViewFinancials || a.canReceiveBilling);
  const canManageWorkers =
    unitAccesses.some((a) => a.canManageWorkers) ||
    Boolean(profile?.personaHints?.canManageWorkers);
  const featureAvailability = profile?.featureAvailability;
  const allowServices = featureAvailability?.canUseServices ?? true;
  const allowComplaints = featureAvailability?.canUseComplaints ?? true;
  const allowFinance = (featureAvailability?.canViewFinance ?? true) && canViewFinancials;
  const allowQr = (featureAvailability?.canUseQr ?? true) && canGenerateQr;
  const allowBookings = (featureAvailability?.canUseBookings ?? true) && canBookFacilities;
  const allowHousehold =
    featureAvailability?.canManageHousehold ?? false;
  const hideUnsupported = true;

  const menuItems: DrawerMenuItem[] = [
    { key: 'profile', label: 'Profile', icon: 'person-outline', route: 'Profile' },
    { key: 'qr', label: 'QR Codes', icon: 'qrcode', iconSet: 'mc', route: 'Access', disabled: preConstruction || !allowQr },
    { key: 'bookings', label: 'Bookings', icon: 'calendar-outline', route: 'Bookings', disabled: preConstruction || !allowBookings },
    { key: 'requests', label: 'Requests', icon: 'file-tray-outline', route: 'Requests', disabled: preConstruction || !allowServices },
    { key: 'services', label: 'Services', icon: 'construct-outline', route: 'Services', disabled: preConstruction || !allowServices },
    { key: 'complaints', label: 'Complaints', icon: 'chatbubble-ellipses-outline', route: 'Complaints', disabled: !allowComplaints },
    { key: 'violations', label: 'Violations', icon: 'flag-outline', route: 'Finance', disabled: preConstruction || !allowFinance },
    { key: 'payments', label: 'Payments', icon: 'card-outline', route: 'Finance', disabled: !allowFinance },
    ...(allowHousehold
      ? ([
          {
            key: 'household',
            label: 'Manage Household',
            icon: 'people-outline',
            route: 'Household',
            disabled: preConstruction,
          },
        ] as DrawerMenuItem[])
      : []),
    ...(hideUnsupported
      ? []
      : ([
          { key: 'smart-home', label: 'Smart Home', icon: 'hardware-chip-outline', disabled: true },
          { key: 'discover', label: 'Discover', icon: 'compass-outline', disabled: true },
          { key: 'help', label: 'Help', icon: 'help-circle-outline', disabled: true },
        ] as DrawerMenuItem[])),
  ];

  const visibleMenuItems = menuItems;

  const renderIcon = (item: DrawerMenuItem, color: string) => {
    if (item.iconSet === 'mc') {
      return (
        <MaterialCommunityIcons
          name={item.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
          size={20}
          color={color}
        />
      );
    }
    return (
      <Ionicons
        name={item.icon as React.ComponentProps<typeof Ionicons>['name']}
        size={20}
        color={color}
      />
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <SafeAreaView style={styles.drawerSafeArea} edges={['top', 'bottom']}>
          <View style={styles.drawer}>
            <LinearGradient
              colors={[brandPrimary, akColors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.header}
            >
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={18} color="#fff" />
              </Pressable>

              <View style={styles.userRow}>
                <View
                  style={[
                    styles.avatar,
                    {
                      backgroundColor: `${brandAccent}26`,
                      borderColor: `${brandAccent}CC`,
                    },
                  ]}
                >
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
                <View style={styles.userTextWrap}>
                  <Text numberOfLines={1} style={styles.userName}>
                    {displayName}
                  </Text>
                  <Text numberOfLines={1} style={[styles.userUnit, { color: brandAccent }]}>
                    {selectedUnit?.unitNumber ?? 'No Unit Selected'}
                  </Text>
                  <Text numberOfLines={1} style={styles.userCompound}>
                    {selectedUnit?.projectName ?? brand.companyName ?? 'Community'}
                  </Text>
                </View>
              </View>
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.scrollContent}>
              {units.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>MY PROPERTIES</Text>
                  <View style={styles.unitList}>
                    {units.map((unit) => {
                      const active = unit.id === (selectedUnitId ?? units[0]?.id);
                      return (
                        <Pressable
                          key={unit.id}
                          onPress={() => {
                            onSelectUnit(unit.id);
                            onClose();
                          }}
                          style={[styles.unitTile, active && styles.unitTileActive]}
                        >
                          <View style={styles.unitTileHeader}>
                            <Text style={styles.unitTileTitle}>{unit.unitNumber ?? unit.id}</Text>
                            {active ? <View style={[styles.activeDot, { backgroundColor: brandPrimary }]} /> : null}
                          </View>
                          <Text style={styles.unitTileSub}>
                            {unit.projectName ?? 'Project'} {unit.block ? `• Block ${unit.block}` : ''}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              <View style={styles.menuList}>
                {visibleMenuItems.map((item) => {
                  const disabled = Boolean(item.disabled || !item.route);
                  const iconColor = disabled ? akColors.textSoft : akColors.textMuted;
                  return (
                    <Pressable
                      key={item.key}
                      disabled={disabled}
                      onPress={() => {
                        if (!item.route) return;
                        onNavigate(item.route);
                        onClose();
                      }}
                      style={({ pressed }) => [
                        styles.menuItem,
                        pressed && !disabled && styles.menuItemPressed,
                        disabled && styles.menuItemDisabled,
                      ]}
                    >
                      <View style={styles.menuItemLeft}>
                        <View style={styles.menuItemIconWrap}>{renderIcon(item, iconColor)}</View>
                        <Text style={[styles.menuItemText, disabled && styles.menuItemTextDisabled]}>
                          {item.label}
                        </Text>
                      </View>
                      <View />
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                onPress={() => {
                  onClose();
                  onLogout();
                }}
                style={styles.logoutButton}
              >
                <Ionicons name="log-out-outline" size={18} color="#EF4444" />
                <Text style={styles.logoutButtonText}>Logout</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  drawerSafeArea: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '82%',
    maxWidth: 340,
    height: '100%',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  drawer: {
    flex: 1,
    width: '100%',
    backgroundColor: akColors.surface,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    position: 'relative',
    minHeight: 120,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(201,169,97,0.25)',
    borderWidth: 2,
    borderColor: 'rgba(201,169,97,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 20,
  },
  userTextWrap: {
    flex: 1,
    gap: 2,
  },
  userName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  userUnit: {
    color: akColors.gold,
    fontSize: 11,
    fontWeight: '600',
  },
  userCompound: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 10,
  },
  scrollContent: {
    paddingVertical: 10,
  },
  section: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: akColors.border,
  },
  sectionLabel: {
    color: akColors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  unitList: {
    gap: 10,
  },
  unitTile: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  unitTileActive: {
    borderColor: '#9CA3AF',
    backgroundColor: '#fff',
  },
  unitTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  unitTileTitle: {
    color: akColors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  unitTileSub: {
    marginTop: 3,
    color: akColors.textMuted,
    fontSize: 10,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: akColors.primary,
  },
  menuList: {
    paddingVertical: 6,
  },
  menuItem: {
    minHeight: 58,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuItemPressed: {
    backgroundColor: akColors.surfaceMuted,
  },
  menuItemDisabled: {
    opacity: 0.75,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  menuItemIconWrap: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemText: {
    color: akColors.text,
    fontSize: 15,
  },
  menuItemTextDisabled: {
    color: akColors.textMuted,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: akColors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  logoutButton: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutButtonText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 14,
  },
});
